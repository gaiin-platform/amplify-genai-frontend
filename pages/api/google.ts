import { NextApiRequest, NextApiResponse } from 'next';
import { cleanSourceText } from '@/utils/server/google';

import { Message, newMessage } from '@/types/chat';
import { GoogleBody, GoogleSource } from '@/types/google';

import endent from 'endent';

const handler = async (req: NextApiRequest, res: NextApiResponse<any>) => {
  try {
    const { messages, key, model, googleAPIKey, googleCSEId } =
      req.body as GoogleBody;

    const userMessage = messages[messages.length - 1];
    const query = encodeURIComponent(userMessage.content.trim());

    const googleRes = await fetch(
      `https://customsearch.googleapis.com/customsearch/v1?key=${
        googleAPIKey ? googleAPIKey : process.env.GOOGLE_API_KEY
      }&cx=${
        googleCSEId ? googleCSEId : process.env.GOOGLE_CSE_ID
      }&q=${query}&num=5`,
    );

    const googleData = await googleRes.json();

    const sources: GoogleSource[] = googleData.items.map((item: any) => ({
      title: item.title,
      link: item.link,
      displayLink: item.displayLink,
      snippet: item.snippet,
      image: item.pagemap?.cse_image?.[0]?.src,
      text: '',
    }));

    const sourcesWithText: any = await Promise.all(
      sources.map(async (source) => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 5000),
          );

          const res = (await Promise.race([
            fetch(source.link),
            timeoutPromise,
          ])) as any;

          // if (res) {
          const html = await res.text();

          // const virtualConsole = new jsdom.VirtualConsole();
          // virtualConsole.on('error', (error) => {
          //   if (!error.message.includes('Could not parse CSS stylesheet')) {
          //     console.error(error);
          //   }
          // });

          //const dom = new JSDOM(html, { virtualConsole });
          const doc = null;//dom.window.document;
          const parsed = {textContent:""};//new Readability(doc).parse();

          if (parsed) {
            let sourceText = cleanSourceText(parsed.textContent);

            return {
              ...source,
              // TODO: switch to tokens
              text: sourceText.slice(0, 2000),
            } as GoogleSource;
          }
          // }

          return null;
        } catch (error) {
          console.error(error);
          return null;
        }
      }),
    );

    const filteredSources: GoogleSource[] = sourcesWithText.filter(Boolean);
    
    res.status(200).json({ filteredSources });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error'})
  }
};

export default handler;

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { cleanSourceText } from '@/utils/server/google';

import { Message, newMessage } from '@/types/chat';
import { GoogleBody, GoogleSource } from '@/types/google';

import endent from 'endent';

const handler = async (req: NextApiRequest, res: NextApiResponse<any>) => {
  // Authentication check - matches pattern used in other secure endpoints
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

    // Helper function to validate URLs before fetching
    const isUrlSafe = (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);

        // Block private IP ranges and local addresses
        const hostname = parsedUrl.hostname;
        const blockedPatterns = [
          /^127\./,                           // Localhost (127.0.0.0/8)
          /^10\./,                            // Private Class A (10.0.0.0/8)
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B (172.16.0.0/12)
          /^192\.168\./,                      // Private Class C (192.168.0.0/16)
          /^169\.254\./,                      // Link-local / AWS metadata (169.254.0.0/16)
          /^::1$/,                            // IPv6 localhost
          /^fc00:/,                           // IPv6 private (fc00::/7)
          /^fe80:/,                           // IPv6 link-local (fe80::/10)
          /localhost/i,                       // Localhost hostname
        ];

        if (blockedPatterns.some(pattern => pattern.test(hostname))) {
          console.warn(`Blocked attempt to fetch private IP: ${url}`);
          return false;
        }

        // Only allow HTTP and HTTPS protocols
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          console.warn(`Blocked non-HTTP(S) protocol: ${url}`);
          return false;
        }

        return true;
      } catch (error) {
        console.warn(`Invalid URL format: ${url}`);
        return false;
      }
    };

    const sourcesWithText: any = await Promise.all(
      sources.map(async (source) => {
        try {
          // Validate URL before fetching
          if (!isUrlSafe(source.link)) {
            console.warn(`Skipping unsafe URL: ${source.link}`);
            return null;
          }

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

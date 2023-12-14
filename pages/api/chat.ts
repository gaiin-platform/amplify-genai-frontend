import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { OpenAIError, OpenAIStream } from '@/utils/server';
import { ChatBody, Message } from '@/types/chat';
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"
import {NextApiRequest, NextApiResponse} from "next";

import tiktokenModel from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from '@dqbd/tiktoken/lite';
import {Readable} from "stream";


export const config = {
  runtime: 'nodejs',
};



const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try{
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      // Unauthorized access, no session found
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log("Chat request received",
    //current time
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    const { model, messages, key, prompt, temperature, functions, function_call } = req.body as ChatBody;

    console.log("Chat request unmarshalled",
        `Model Id: ${model.id}, Temperature: ${temperature}`,
        //current time
        new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    //await init((imports) => WebAssembly.instantiate(wasm, imports));
    const encoding = new Tiktoken(
      tiktokenModel.bpe_ranks,
      tiktokenModel.special_tokens,
      tiktokenModel.pat_str,
    );

    let promptToSend = prompt;
    if (!promptToSend) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (temperatureToUse == null) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    const prompt_tokens = encoding.encode(promptToSend);

    let tokenCount = prompt_tokens.length;
    let messagesToSend: Message[] = [];

    var maxTokens = model.tokenLimit;
    if (typeof maxTokens === "undefined") {
      //console.log("Token Limit is undefined, setting to 8192");
      maxTokens = 4000
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length + 1200 > maxTokens) {
        break;
      }
      tokenCount += tokens.length;
      messagesToSend = [message, ...messagesToSend];
    }

    //console.log("Sending: "+ tokenCount + " [max: " + maxTokens +"]")

    encoding.free();

    console.log("Chat request built",
        `Token Count: ${tokenCount}`,
        //current time
        new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    const stream = await OpenAIStream(model, promptToSend, temperatureToUse, key, messagesToSend, functions, function_call);
    // @ts-ignore
    const nodeStream = Readable.fromWeb(stream);
    nodeStream.pipe(res);

  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      return new Response('Error', { status: 500, statusText: error.message });
    } else {
      // @ts-ignore
      return new Response('Error', { status: 500, statusText: error.message });
    }
  }
};

export default handler;

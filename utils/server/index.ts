import {ChatResponseFormat, Message} from '@/types/chat';
import { OpenAIModel } from '@/types/openai';
import { CustomFunction } from '@/types/chat';
import { AZURE_DEPLOYMENT_ID, OPENAI_API_HOST, OPENAI_API_TYPE, OPENAI_API_VERSION, OPENAI_ORGANIZATION, AZURE_API_NAME } from '../app/const';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

export const OpenAIStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature : number,
  key: string,
  messages: Message[],
  functions?: CustomFunction[],
  function_call?: string,
  response_format?: ChatResponseFormat,
) => {

  let function_call_obj = null;
  if(functions && function_call){
    function_call_obj = {name: function_call};
  }

  let url = `${OPENAI_API_HOST}/v1/chat/completions`;
  if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/${AZURE_API_NAME}/deployments/${model.id}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(OPENAI_API_TYPE === 'openai' && {
        Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`
      }),
      ...(OPENAI_API_TYPE === 'azure' && {
        'api-key': `${key ? key : process.env.OPENAI_API_KEY}`
      }),
      ...((OPENAI_API_TYPE === 'openai' && OPENAI_ORGANIZATION) && {
        'OpenAI-Organization': OPENAI_ORGANIZATION,
      }),
    },
    method: 'POST',
    body: JSON.stringify({
      ...(OPENAI_API_TYPE === 'openai' && {model: model.id}),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: temperature,
      stream: true,
      ...(functions && {functions: functions}),
      ...(function_call_obj && {function_call: function_call_obj}),
      ...(response_format && {response_format: response_format}),
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  let nameDone = false;
  let first = true;

  const fnCallHandler = (controller:any, json:any) => {
    const base = json.choices[0].delta.function_call
    let text = "";

    if(base && base.name){
      if(first){
        text = "{\"name\":\"";
        first = false;
      }
      text += base.name;
    }
    if(base && base.arguments){
      if(!nameDone){
        text += "\", \"arguments\":";
        nameDone = true;
      }
      text += (base.arguments) ? base.arguments : "";
    }
    if (json.choices[0].finish_reason != null) {

        // console.log("------------- Completing------------")
        // console.log(json.choices)
        // console.log("------------------------------------")

        text += "}";

        const queue = encoder.encode(text);
        controller.enqueue(queue);

        console.log("Chat request completed",
          //current time
          new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

        controller.close();
        return;
    }

    const queue = encoder.encode(text);
    controller.enqueue(queue);

    first = false;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {

          const data = event.data;

          try {
            const json = JSON.parse(data);

            if(functions){
              fnCallHandler(controller, json);
            }
            else {
              if (json.choices[0].finish_reason != null) {

                console.log("Chat request completed",
                    //current time
                    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

                controller.close();
                return;
              }

              const text = json.choices[0].delta.content;
              const queue = encoder.encode(text);
              controller.enqueue(queue);
            }
          } catch (e) {
            // Apparent edge case required for Azure
            if (data === "[DONE]") {
              return;
            } else {
               controller.error(e);
            }
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};

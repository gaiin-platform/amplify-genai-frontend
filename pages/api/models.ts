import {
  AZURE_API_NAME,
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
  AVAILABLE_MODELS,
} from '@/utils/app/const';

import { OpenAIModel, OpenAIModelID, OpenAIModels } from '@/types/openai';

export const config = {
  runtime: 'edge',
};

let url = `${OPENAI_API_HOST}/v1/models`;
if (OPENAI_API_TYPE === 'azure') {
  url = `${OPENAI_API_HOST}/${AZURE_API_NAME}/models?api-version=${OPENAI_API_VERSION}`;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const { key } = (await req.json()) as {
      key: string;
    };

    const actualKey = key ? key : process.env.OPENAI_API_KEY;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(OPENAI_API_TYPE === 'openai' && {
          Authorization: `Bearer ${actualKey}`
        }),
        ...(OPENAI_API_TYPE === 'azure' && {
          'api-key': `${actualKey}`
        }),
        ...((OPENAI_API_TYPE === 'openai' && OPENAI_ORGANIZATION) && {
          'OpenAI-Organization': OPENAI_ORGANIZATION,
        }),
      },
    });

    if (response.status === 401) {
      return new Response(response.body, {
        status: 500,
        headers: response.headers,
      });
    } else if (response.status !== 200) {
      console.error(
        `OpenAI API returned an error ${
          response.status
        }: ${await response.text()}`,
      );
      throw new Error('OpenAI API returned an error');
    }

    const json = await response.json();

    const modelIds = AVAILABLE_MODELS.split(',');

    const models: OpenAIModel[] = json.data.reduce((result: OpenAIModel[], model: any) => {
      const model_name = model.id;

      for (const [key, value] of Object.entries(OpenAIModelID)) {
        if (value === model_name && modelIds.includes(model.id)) {

          result.push({
            id: model.id,
            name: OpenAIModels[value].name,
            maxLength: OpenAIModels[value].maxLength,
            tokenLimit: OpenAIModels[value].tokenLimit,
            actualTokenLimit: OpenAIModels[value].actualTokenLimit,
            inputCost: OpenAIModels[value].inputCost,
            outputCost: OpenAIModels[value].outputCost,
          });
        }
      }
      return result;
    }, []);

    return new Response(JSON.stringify(models), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
};

export default handler;
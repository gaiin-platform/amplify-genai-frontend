import { OPENAI_API_TYPE } from '../utils/app/const';

export interface OpenAIModel {
  id: string;
  name: string;
  maxLength: number; // maximum length of a message
  tokenLimit: number;
  actualTokenLimit: number;
  visible?: boolean;
  outputCost: number;
  inputCost: number;
}

export enum OpenAIModelID {
  GPT_4_TURBO = 'gpt-4-1106-preview',
  GPT_4_TURBO_AZ = 'gpt-4-1106-Preview',
  GPT_3_5 = 'gpt-3.5-turbo',
  GPT_3_5_FN = 'gpt-3.5-turbo-0613',
  GPT_3_5_AZ = 'gpt-35-turbo',
  GPT_4 = 'gpt-4',
  GPT_4_FN = 'gpt-4-0613',
}

// in case the `DEFAULT_MODEL` environment variable is not set or set to an unsupported model
export const fallbackModelID = OpenAIModelID.GPT_3_5;

export const OpenAIModels: Record<OpenAIModelID, OpenAIModel> = {

  [OpenAIModelID.GPT_4_TURBO_AZ]: {
    id: OpenAIModelID.GPT_4_TURBO,
    name: 'GPT-4-Turbo (Azure)',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 128000,
    visible: true,
    outputCost: .03,
    inputCost: .01,
  },
  [OpenAIModelID.GPT_4_TURBO]: {
      id: OpenAIModelID.GPT_4_TURBO,
      name: 'GPT-4-Turbo',
      maxLength: 24000,
      tokenLimit: 8000,
      actualTokenLimit: 128000,
      visible: true,
      outputCost: .03,
      inputCost: .01,
  },
  [OpenAIModelID.GPT_3_5]: {
    id: OpenAIModelID.GPT_3_5,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    actualTokenLimit: 4000,
    visible: true,
    outputCost: .002,
    inputCost: .001,
  },
  [OpenAIModelID.GPT_3_5_FN]: {
    id: OpenAIModelID.GPT_3_5_FN,
    name: 'GPT-3.5 Function Calling',
    maxLength: 12000,
    tokenLimit: 4000,
    actualTokenLimit: 4000,
    visible: false,
    outputCost: .002,
    inputCost: .001,
  },
  [OpenAIModelID.GPT_3_5_AZ]: {
    id: OpenAIModelID.GPT_3_5_AZ,
    name: 'GPT-3.5 (Azure)',
    maxLength: 12000,
    tokenLimit: 4000,
    actualTokenLimit: 4000,
    visible: false,
    outputCost: .002,
    inputCost: .001,
  },
  [OpenAIModelID.GPT_4]: {
    id: OpenAIModelID.GPT_4,
    name: 'GPT-4',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 8000,
    visible: true,
    outputCost: .06,
    inputCost: .03,
  },
  [OpenAIModelID.GPT_4_FN]: {
    id: OpenAIModelID.GPT_4_FN,
    name: 'GPT-4 Function Calling',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 8000,
    visible: false,
    outputCost: .06,
    inputCost: .03,
  },
};

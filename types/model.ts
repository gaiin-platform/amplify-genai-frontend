
export interface Model {
  id: string;
  name: string;
  maxLength: number; // maximum length of a message
  tokenLimit: number;
  actualTokenLimit: number;
  visible?: boolean;
  outputCost: number;
  inputCost: number;
  description: string;
}

export enum ModelID {
  GPT_4_TURBO = 'gpt-4-1106-preview',
  GPT_4_TURBO_AZ = 'gpt-4-1106-Preview',
  GPT_3_5 = 'gpt-3.5-turbo',
  GPT_3_5_FN = 'gpt-3.5-turbo-0613',
  GPT_3_5_AZ = 'gpt-35-turbo',
  GPT_4 = 'gpt-4',
  GPT_4o_AZ = 'gpt-4o',
  GPT_4o_MINI = 'gpt-4o-mini',
  GPT_4_FN = 'gpt-4-0613',
  CLAUDE_INSTANT_1_2 = 'anthropic.claude-instant-v1',
  CLAUDE_2_1 = 'anthropic.claude-v2:1',
  CLAUDE_3_SONNET = 'anthropic.claude-3-sonnet-20240229-v1:0',
  CLAUDE_3_5_SONNET = 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  CLAUDE_3_HAIKU = 'anthropic.claude-3-haiku-20240307-v1:0',
  CLAUDE_3_OPUS = 'anthropic.claude-3-opus-20240229-v1:0',
  MISTRAL_7B = 'mistral.mistral-7b-instruct-v0:2',
  MIXTRAL_8X7B =  'mistral.mixtral-8x7b-instruct-v0:1',
  MISTRAL_LARGE = 'mistral.mistral-large-2402-v1:0'
}

// in case the `DEFAULT_MODEL` environment variable is not set or set to an unsupported model
export const fallbackModelID = ModelID.CLAUDE_3_HAIKU;

export const Models: Record<ModelID, Model> = {

  [ModelID.GPT_4_TURBO_AZ]: {
    id: ModelID.GPT_4_TURBO,
    name: 'GPT-4-Turbo',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 128000,
    visible: true,
    outputCost: .03,
    inputCost: .01,
    description: "This is an omni model which can be used for complex tasks requiring advanced understanding.\nIncreased speed with similar understanding in line with its predecessors at a reduced cost. \nCan carry out complex mathematical operations, code assistance, analyze intricate documents and datasets, demonstrates critical thinking, in-depth context understanding, and supports images as input.\nTrained on information available through October 2023."
  },

  [ModelID.GPT_4o_MINI]: {
    id: ModelID.GPT_4o_MINI,
    name: 'GPT-4o-Mini',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 128000,
    visible: true,
    outputCost: .00066,
    inputCost: .000165,
    description: "GPT-4o Mini is OpenAI’s most cost-efficient small model. \nA compact yet powerful omni model that showcases remarkable abilities in textual intelligence and multimodal reasoning. \nIt surpasses its predecessors and competitors in various academic benchmarks, demonstrating a level of understanding that rivals larger models.\nTrained on information available through October 2023."
  },  
  [ModelID.GPT_4o_AZ]: {
    id: ModelID.GPT_4o_AZ,
    name: 'GPT-4o',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 128000,
    visible: true,
    outputCost: .005,
    inputCost: .015,
    description: "Consider for complex tasks requiring advanced understanding.\nOffers further advanced intelligence over its predecessors.\nCan carry out complex mathematical operations, code assistance, analyze intricate documents and datasets, demonstrates critical thinking, in-depth context understanding, and supports images as input.\nTrained on information available through April 2023."
  },
  [ModelID.GPT_4_TURBO]: {
      id: ModelID.GPT_4_TURBO,
      name: 'GPT-4-Turbo',
      maxLength: 24000,
      tokenLimit: 8000,
      actualTokenLimit: 128000,
      visible: true,
      outputCost: .03,
      inputCost: .01,
      description: ''
  },
  [ModelID.GPT_3_5]: {
    id: ModelID.GPT_3_5,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    actualTokenLimit: 4000,
    visible: true,
    outputCost: .002,
    inputCost: .001,
    description: ''
  },
  [ModelID.GPT_3_5_FN]: {
    id: ModelID.GPT_3_5_FN,
    name: 'GPT-3.5 Function Calling',
    maxLength: 12000,
    tokenLimit: 4000,
    actualTokenLimit: 4000,
    visible: false,
    outputCost: .002,
    inputCost: .001,
    description: ''
  },
  [ModelID.GPT_3_5_AZ]: {
    id: ModelID.GPT_3_5_AZ,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    actualTokenLimit: 4000,
    visible: false,
    outputCost: .002,
    inputCost: .001,
    description: "Consider for simpler queries where the latest information isn't crucial.\nA cost-effective and less sophisticated alternative to GPT-4, balancing performance with affordability.\nPerforms well with precise tasks, discussing general topics, brainstorming, drafting questions, organizing fundamental information, proposing innovative ideas, and offering recommendations.\nTrained on information available through January 2022."
  },
  [ModelID.GPT_4]: {
    id: ModelID.GPT_4,
    name: 'GPT-4',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 8000,
    visible: true,
    outputCost: .06,
    inputCost: .03,
    description: ''
  },
  [ModelID.GPT_4_FN]: {
    id: ModelID.GPT_4_FN,
    name: 'GPT-4 Function Calling',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 8000,
    visible: false,
    outputCost: .06,
    inputCost: .03,
    description: ''
  },
  [ModelID.CLAUDE_INSTANT_1_2]: {
    id: ModelID.CLAUDE_INSTANT_1_2,
    name: 'Claude-Instant-1.2',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: .0024,
    inputCost: .0008,
    description: "Consider for immediate, responsive interaction without the need for deep, complex reasoning.\nRapid and cost-effective option compared to Claude 2.1.\nOffers lightweight dialogue, text analysis, document summarization, classification, and writing assistance.\nTrained on information available through Early 2023."
  },
  [ModelID.CLAUDE_2_1]: {
    id: ModelID.CLAUDE_2_1,
    name: 'Claude-2.1',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: .024,
    inputCost: .008,
    description: "Consider for complex tasks with an emphasis on ethical reasoning, prioritized nuanced comprehension, and safety.\nIs more advanced than Claude-Instant, aiming for higher accuracy and deeper understanding.\nEngages in sophisticated dialogue, complex reasoning, code assistance, data analysis, and generates creative and detailed content.\nTrained on information available through Early 2023."
   },
   [ModelID.CLAUDE_3_SONNET]: {
    id: ModelID.CLAUDE_3_SONNET,
    name: 'Claude-3-Sonnet',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: 0.01500,
    inputCost: 0.00300,
    description: "Consider for complex tasks requiring advanced understanding and intelligence, while keeping cost low.\nOffers a better balance between cost, speed, and performance compared to Claude 2.1.\nCan perform complex mathematical computations, statistical analyses, coding assistance, think critically, maintain context understanding, and supports images as input.\nTrained on information available through August 2023."
   },
   [ModelID.CLAUDE_3_5_SONNET] : { 
    id: ModelID.CLAUDE_3_5_SONNET,
    name: 'Claude-3-5-Sonnet',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: 0.015,
    inputCost: 0.003,
    description: "Consider for advanced tasks with the most up-to-date information.\nClaude 3.5 is Anthropic's most current, powerful, and cost-efficient model.\nCan write, edit, and execute code with sophisticated reasoning, understands user context, offers orchestrating multi-step workflows, can navigate unstructured data, write creatively, understands nuance and humor, and supports images as input.\nTrained on information available through April 2024."
   },
   [ModelID.CLAUDE_3_HAIKU]: {
    id: ModelID.CLAUDE_3_HAIKU,
    name: 'Claude-3-Haiku',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: 0.00125,
    inputCost: 0.00025,
    description: "Consider for high-velocity tasks with near-instant responsiveness and emphasis on security and robustness through minimized risk of harmful outputs.\nFeatures speeds 3 times faster than its Claude peer models while being the most economical choice.\nBest for simple queries, lightweight conversation, rapid analysis of large volumes of data, handling of much longer prompts, and supports images as input.\nTrained on information available through August 2023."
   },
   [ModelID.CLAUDE_3_OPUS]: {
    id: ModelID.CLAUDE_3_OPUS,
    name: 'Claude-3-Opus',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: 0.07500,
    inputCost: 0.01500,
    description: "Consider for your most demanding tasks that require a highly intelligent model.\nThis is Anthropic’s most sophisticated model to date.\nIt excels in task automation, interactive coding, complex data analysis, navigating intricate scenarios, brainstorming, hypothesis generation, providing in-depth analysis of financial trends and market data, and supports images as input.\nTrained on information available through August 2023."
   },
   [ModelID.MISTRAL_7B]: {
    id: ModelID.MISTRAL_7B,
    name: 'Mistral-7b-Instruct',
    maxLength: 24000,
    tokenLimit: 8000,
    actualTokenLimit: 8192,
    visible: false,
    outputCost: 0.00015,
    inputCost: 0.0002,
    description: "Consider for pre-filtering or high-volume tasks.\nReduces costs when used alongside more sophisticated models like GPT-4, Claude-3, or Mixtral-8x7B-Instruct.\nBest for text-related tasks such as summarization, classification, answering questions, creative content generation, and light dialogue\nTrained on information available through September 2023."
    },
[ModelID.MIXTRAL_8X7B]: {
    id: ModelID.MIXTRAL_8X7B,
    name: 'Mixtral-8x7b-Instruct',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: 0.00045,
    inputCost: 0.0007,
    description: "Consider for rapid processing and task-specific fine-tuning.\nOffers advanced intelligence, compared to its predecessors, at a low cost.\nBest for text summarization, question answering, text classification, code generation, and creative content generation.\nTrained on information available through September 2023."
  },
  [ModelID.MISTRAL_LARGE]: {
    id: ModelID.MISTRAL_LARGE,
    name: 'Mistral-Large',
    maxLength: 24000,
    tokenLimit: 4000,
    actualTokenLimit: 4096,
    visible: false,
    outputCost: 0.024,
    inputCost: 0.008,
    description: "Consider for complex tasks and advanced understanding without the need for recent knowledge.\mOffer a greater level of intelligence compared to its predecessors.\nExcels in complex reasoning, text understanding, transformation, code generation, and offers advanced capabilities for multilingual reasoning and analysis.\nTrained on information available through 2021."
   },
   
};

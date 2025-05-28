
export interface Model {
  id: string;
  name: string;
  description: string;
  inputContextWindow: number;
  outputTokenLimit: number;
  supportsImages: boolean;
  supportsReasoning: boolean;
  provider: string;
  inputTokenCost: number;
  outputTokenCost: number;
  cachedTokenCost: number;
}

export interface Models {
    [key: string]: Model
}


export enum DefaultModels {
  DEFAULT = 'defaultModelId',
  ADVANCED = 'advancedModelId',
  CHEAPEST = 'cheapestModelId',
}


export const REASONING_LEVELS = ['low', 'medium', 'high'];

// Derive the type from the array
export type ReasoningLevels = typeof REASONING_LEVELS[number];
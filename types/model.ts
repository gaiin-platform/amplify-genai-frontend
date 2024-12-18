
export interface Model {
  id: string;
  name: string;
  description: string;
  inputContextWindow: number;
  supportsImages: boolean;
  provider: string;
}

export interface Models {
    [key: string]: Model
}


export enum DefaultModels {
  DEFAULT = 'defaultModelId',
  ADVANCED = 'cheapestModelId',
  CHEAPEST = 'advancedModelId',
}
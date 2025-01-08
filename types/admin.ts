// Provider Types

export const providers = {
    Azure: 'Azure',
    OpenAI: 'OpenAI',
    Bedrock: 'Bedrock',
  } as const;
  
  // Derive the type from the object keys
  export type Providers = keyof typeof providers;


// Used for updating data in the backend
export enum AdminConfigTypes {
    ADMINS = 'admins',
    EMBEDDINGS = 'embeddings',
    OPS = 'ops',
    FEATURE_FLAGS = 'featureFlags', 
    APP_VARS = 'applicationVariables',
    APP_SECRETS = 'applicationSecrets',
    OPENAI_ENDPONTS = 'openaiEndpoints',
    AVAILABLE_MODELS = 'supportedModels',
    AST_ADMIN_GROUPS = 'assistantAdminGroups',
    PPTX_TEMPLATES = 'powerPointTemplates',
    AMPLIFY_GROUPS = 'amplifyGroups',
    RATE_LIMIT = 'rateLimit',
    PROMPT_COST_ALERT = 'promtCostAlert',
  }

  // As tabs get added please keep track of where each config data lives
export type Admin_Tab = 'config' | 'feature_data' | 'embeddings';

  //////////////////// Keep track of admin changes and the tabs they belong to ////////////////////

export const adminDataTabMap: Record<Admin_Tab, string[]> = {
    // Embeddings Tab
    'embeddings': [
      AdminConfigTypes.EMBEDDINGS,
    ],
  
    // Config Tab
    'config': [
      AdminConfigTypes.ADMINS,
      AdminConfigTypes.APP_VARS,
      AdminConfigTypes.APP_SECRETS,
      AdminConfigTypes.RATE_LIMIT,
      AdminConfigTypes.PROMPT_COST_ALERT,
      AdminConfigTypes.OPENAI_ENDPONTS,
      AdminConfigTypes.AVAILABLE_MODELS,
      AdminConfigTypes.FEATURE_FLAGS,
    ],
  
    // Feature Data Tab
    'feature_data': [
      AdminConfigTypes.AST_ADMIN_GROUPS,
      AdminConfigTypes.OPS,
      AdminConfigTypes.PPTX_TEMPLATES,
      AdminConfigTypes.AMPLIFY_GROUPS,
      // Direct uploads with no backend mapping
      'dataDisclosure', 
      'builtInAmplifyAssistants', 
      'apiDocumentation', 
      'ops', 
    ],
  };
  

export interface FeatureFlag {
    enabled: boolean,
    userExceptions?: string[];
    amplifyGroupExceptions?: string[];
} 

// feature flags
export interface FeatureFlagConfig  { 
    [key: string]: FeatureFlag
}

// openai endpoints:
export interface Endpoint {
    url: string;
    key: string;
    isNew?: boolean;
}

export interface OpenAIModelsConfig {
    models: {
        [modelName: string]: {
            endpoints: Endpoint[];
        };
    }[];
}


// embedding
export interface Embedding  { 
    messageId: string;
    eventTime: string; 
    object: {
        key: string;
        size: number;
        user: string;
    }
    terminated?: boolean;

}

// embeddings
export interface EmbeddingsConfig  { 
    embeddings: Embedding[]
}


// available/supported Models 

  export interface SupportedModel {
    id: string;
    name: string;
    provider: string
    inputContextWindow: number; // maximum length of a message
    outputTokenLimit: number; // max num of tokens a model will respond with (most models have preset max of 4096)
    outputTokenCost: number;
    inputTokenCost: number;
    description: string;
    exclusiveGroupAvailability: string[];
    supportsImages: boolean;
    supportsSystemPrompts: boolean;
    systemPrompt: string;

    defaultCheapestModel: boolean; // recommend cheaper model
    defaultAdvancedModel: boolean; // recommend more expensive 
    defaultEmbeddingsModel: boolean
    defaultQAModel: boolean;
    
    isDefault: boolean;
    isAvailable: boolean;
    isBuiltIn: boolean;
}


export interface SupportedModelsConfig  { 
    [modelId: string]: SupportedModel;
}




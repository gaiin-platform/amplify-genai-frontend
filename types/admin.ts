// Provider Types
export const ModelProviders = ['Azure', 'OpenAI', 'Bedrock', 'Gemini'];

// Used for updating data in the backend
export enum AdminConfigTypes {
    ADMINS = 'admins',
    EMBEDDINGS = 'embeddings',
    OPS = 'ops',
    FEATURE_FLAGS = 'featureFlags', 
    APP_VARS = 'applicationVariables',
    APP_SECRETS = 'applicationSecrets',
    OPENAI_ENDPOINTS = 'openaiEndpoints',
    AVAILABLE_MODELS = 'supportedModels',
    AST_ADMIN_GROUPS = 'assistantAdminGroups',
    PPTX_TEMPLATES = 'powerPointTemplates',
    AMPLIFY_GROUPS = 'amplifyGroups',
    RATE_LIMIT = 'rateLimit',
    PROMPT_COST_ALERT = 'promtCostAlert',
    EMAIL_SUPPORT = 'emailSupport',
    AI_EMAIL_DOMAIN = 'aiEmailDomain',
    INTEGRATIONS = 'integrations',
    DEFAULT_CONVERSATION_STORAGE = 'defaultConversationStorage',
    DEFAULT_MODELS = 'defaultModels'

  }

  // As tabs get added please keep track of where each config data lives
export type AdminTab = 'Configurations' | 'Feature Flags' | 'Feature Data' | 'Embeddings' | 'Supported Models' |
                        'Application Variables' | 'OpenAi Endpoints' | 'Ops' | 'Integrations';

  //////////////////// Keep track of admin changes and the tabs they belong to ////////////////////

export const adminDataTabMap: Record<AdminTab, string[]> = {
    // Config Tab
    'Configurations': [
      AdminConfigTypes.ADMINS,
      AdminConfigTypes.RATE_LIMIT,
      AdminConfigTypes.PROMPT_COST_ALERT,
      AdminConfigTypes.AI_EMAIL_DOMAIN,
      AdminConfigTypes.EMAIL_SUPPORT,
      AdminConfigTypes.AMPLIFY_GROUPS,
      AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE,
    ],

    'Feature Flags' : [
      AdminConfigTypes.FEATURE_FLAGS,
    ],
  
    // Feature Data Tab
    'Feature Data': [
      AdminConfigTypes.AST_ADMIN_GROUPS,
      AdminConfigTypes.PPTX_TEMPLATES,
      // Direct uploads with no backend mapping
      'dataDisclosure', 
      'builtInAmplifyAssistants', 
      'apiDocumentation', 
    ],


    // Embeddings Tab
    'Embeddings': [
      AdminConfigTypes.EMBEDDINGS,
    ],
    'Supported Models' : [
      AdminConfigTypes.AVAILABLE_MODELS,
      AdminConfigTypes.DEFAULT_MODELS,
    ],
    'Application Variables' : [
      AdminConfigTypes.APP_VARS,
      AdminConfigTypes.APP_SECRETS,
    ],
    'OpenAi Endpoints' : [
      AdminConfigTypes.OPENAI_ENDPOINTS,
    ],
    
    'Ops' : [
      AdminConfigTypes.OPS,
    ],

    'Integrations' : [
      AdminConfigTypes.INTEGRATIONS
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
    cachedTokenCost: number;
    description: string;
    exclusiveGroupAvailability: string[];
    supportsImages: boolean;
    supportsReasoning: boolean;
    supportsSystemPrompts: boolean;
    systemPrompt: string;
    isAvailable: boolean;
    isBuiltIn: boolean;
}


export interface SupportedModelsConfig  { 
    [modelId: string]: SupportedModel;
}

export interface DefaultModelsConfig {
  'user': string,
  'advanced': string,
  'cheapest': string,
  'agent': string,
  'embeddings': string,
  'documentCaching': string,
}




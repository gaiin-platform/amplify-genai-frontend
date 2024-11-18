export enum AdminConfigTypes {
    ADMINS = 'admins',
    EMBEDDINGS = 'embeddings',
    FEATURE_FLAGS = 'featureFlags', 
    APP_VARS = 'applicationVariables',
    APP_SECRETS = 'applicationSecrets',
    OPENAI_ENDPONTS = 'openaiEndpoints',
  }


// feature flags
export interface FeatureFlagConfig  { 
    [key: string]: {
        enabled: boolean,
        userExceptions?: string[];
    } 
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

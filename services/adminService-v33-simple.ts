import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/amplifymin";
const SERVICE_NAME = "admin";
const EMBEDDINGS_SERVICE_NAME = "embeddings";


export const updateAdminConfigs = async (configs: any[]) => {
    const op = {
        method: 'POST',
        data: { configurations: configs },
        path: URL_PATH,
        op: "/configs/update",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getAdminConfigs = async (lazyLoad: boolean = false) => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/configs",
        queryParams: { "lazy_load": JSON.stringify(+lazyLoad) },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getFeatureFlags = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/feature_flags",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


export const getUserAppConfigs = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/user_app_configs",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getPowerPoints = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/pptx_templates",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getAvailableModels = async () => {
    try {
        const op = {
            method: 'GET',
            path: "/available_models",
            op: "",
        };
        const result = await doRequestOp(op);
        
        if (result.success && result.data && result.data.models) {
            // If backend only returns Bedrock models, add others
            const hasOpenAI = result.data.models.some((m: any) => m.provider === 'openai');
            const hasGemini = result.data.models.some((m: any) => m.provider === 'gemini');
            
            if (!hasOpenAI) {
                // Add OpenAI models
                result.data.models.push(
                    {
                        id: 'gpt-3.5-turbo',
                        name: 'GPT-3.5 Turbo',
                        provider: 'openai',
                        description: 'OpenAI GPT-3.5 Turbo - Fast and efficient',
                        inputContextWindow: 16385,
                        outputTokenLimit: 4096,
                        supportsImages: false,
                        supportsReasoning: false,
                        inputTokenCost: 0.0005,
                        outputTokenCost: 0.0015,
                        cachedTokenCost: 0.0
                    },
                    {
                        id: 'gpt-4',
                        name: 'GPT-4',
                        provider: 'openai',
                        description: 'OpenAI GPT-4 - Advanced reasoning',
                        inputContextWindow: 8192,
                        outputTokenLimit: 4096,
                        supportsImages: false,
                        supportsReasoning: true,
                        inputTokenCost: 0.03,
                        outputTokenCost: 0.06,
                        cachedTokenCost: 0.0
                    }
                );
            }
            
            if (!hasGemini) {
                // Add Gemini models
                result.data.models.push(
                    {
                        id: 'gemini-1.5-flash',
                        name: 'Gemini 1.5 Flash',
                        provider: 'gemini',
                        description: 'Google Gemini 1.5 Flash - Fast multimodal',
                        inputContextWindow: 1048576,
                        outputTokenLimit: 8192,
                        supportsImages: true,
                        supportsReasoning: false,
                        inputTokenCost: 0.00035,
                        outputTokenCost: 0.0007,
                        cachedTokenCost: 0.0001
                    },
                    {
                        id: 'gemini-1.5-pro',
                        name: 'Gemini 1.5 Pro',
                        provider: 'gemini',
                        description: 'Google Gemini 1.5 Pro - Advanced multimodal',
                        inputContextWindow: 2097152,
                        outputTokenLimit: 8192,
                        supportsImages: true,
                        supportsReasoning: true,
                        inputTokenCost: 0.00125,
                        outputTokenCost: 0.005,
                        cachedTokenCost: 0.0005
                    }
                );
            }
            
            return result;
        }
        
        // If the request failed or returned no models
        throw new Error("No models returned from backend");
        
    } catch (error) {
        console.error("Error fetching models, returning all providers:", error);
        
        // Return all models as fallback
        return {
            success: true,
            data: {
                models: [
                    // Bedrock models
                    {
                        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
                        name: 'Claude 3.5 Sonnet',
                        provider: 'bedrock',
                        description: 'Anthropic Claude 3.5 Sonnet - Most capable',
                        inputContextWindow: 200000,
                        outputTokenLimit: 4096,
                        supportsImages: true,
                        supportsReasoning: true,
                        inputTokenCost: 0.003,
                        outputTokenCost: 0.015,
                        cachedTokenCost: 0.001
                    },
                    {
                        id: 'anthropic.claude-3-sonnet-20240229-v1:0',
                        name: 'Claude 3 Sonnet',
                        provider: 'bedrock',
                        description: 'Anthropic Claude 3 Sonnet - Balanced performance',
                        inputContextWindow: 200000,
                        outputTokenLimit: 4096,
                        supportsImages: true,
                        supportsReasoning: false,
                        inputTokenCost: 0.003,
                        outputTokenCost: 0.015,
                        cachedTokenCost: 0.001
                    },
                    {
                        id: 'anthropic.claude-3-haiku-20240307-v1:0',
                        name: 'Claude 3 Haiku',
                        provider: 'bedrock',
                        description: 'Anthropic Claude 3 Haiku - Fast and efficient',
                        inputContextWindow: 200000,
                        outputTokenLimit: 4096,
                        supportsImages: true,
                        supportsReasoning: false,
                        inputTokenCost: 0.00025,
                        outputTokenCost: 0.00125,
                        cachedTokenCost: 0.0001
                    },
                    // OpenAI models
                    {
                        id: 'gpt-3.5-turbo',
                        name: 'GPT-3.5 Turbo',
                        provider: 'openai',
                        description: 'OpenAI GPT-3.5 Turbo - Fast and efficient',
                        inputContextWindow: 16385,
                        outputTokenLimit: 4096,
                        supportsImages: false,
                        supportsReasoning: false,
                        inputTokenCost: 0.0005,
                        outputTokenCost: 0.0015,
                        cachedTokenCost: 0.0
                    },
                    {
                        id: 'gpt-4',
                        name: 'GPT-4',
                        provider: 'openai',
                        description: 'OpenAI GPT-4 - Advanced reasoning',
                        inputContextWindow: 8192,
                        outputTokenLimit: 4096,
                        supportsImages: false,
                        supportsReasoning: true,
                        inputTokenCost: 0.03,
                        outputTokenCost: 0.06,
                        cachedTokenCost: 0.0
                    },
                    // Gemini models
                    {
                        id: 'gemini-1.5-flash',
                        name: 'Gemini 1.5 Flash',
                        provider: 'gemini',
                        description: 'Google Gemini 1.5 Flash - Fast multimodal',
                        inputContextWindow: 1048576,
                        outputTokenLimit: 8192,
                        supportsImages: true,
                        supportsReasoning: false,
                        inputTokenCost: 0.00035,
                        outputTokenCost: 0.0007,
                        cachedTokenCost: 0.0001
                    },
                    {
                        id: 'gemini-1.5-pro',
                        name: 'Gemini 1.5 Pro',
                        provider: 'gemini',
                        description: 'Google Gemini 1.5 Pro - Advanced multimodal',
                        inputContextWindow: 2097152,
                        outputTokenLimit: 8192,
                        supportsImages: true,
                        supportsReasoning: true,
                        inputTokenCost: 0.00125,
                        outputTokenCost: 0.005,
                        cachedTokenCost: 0.0005
                    }
                ],
                default: {
                    id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
                    name: 'Claude 3.5 Sonnet',
                    provider: 'bedrock',
                    description: 'Anthropic Claude 3.5 Sonnet - Most capable',
                    inputContextWindow: 200000,
                    outputTokenLimit: 4096,
                    supportsImages: true,
                    supportsReasoning: true,
                    inputTokenCost: 0.003,
                    outputTokenCost: 0.015,
                    cachedTokenCost: 0.001
                },
                cheapest: {
                    id: 'anthropic.claude-3-haiku-20240307-v1:0',
                    name: 'Claude 3 Haiku',
                    provider: 'bedrock',
                    description: 'Anthropic Claude 3 Haiku - Fast and efficient',
                    inputContextWindow: 200000,
                    outputTokenLimit: 4096,
                    supportsImages: true,
                    supportsReasoning: false,
                    inputTokenCost: 0.00025,
                    outputTokenCost: 0.00125,
                    cachedTokenCost: 0.0001
                },
                advanced: {
                    id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
                    name: 'Claude 3.5 Sonnet',
                    provider: 'bedrock',
                    description: 'Anthropic Claude 3.5 Sonnet - Most capable',
                    inputContextWindow: 200000,
                    outputTokenLimit: 4096,
                    supportsImages: true,
                    supportsReasoning: true,
                    inputTokenCost: 0.003,
                    outputTokenCost: 0.015,
                    cachedTokenCost: 0.001
                }
            }
        };
    }
}

export const terminateEmbedding = async (key: any) => {
    const op = {
        data: { object_key: key },
        method: 'POST',
        path: "/embedding",
        op: '/terminate',
        SERVICE_NAME: EMBEDDINGS_SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getInFlightEmbeddings = async () => {
    const op = {
        method: 'GET',
        path: "/embedding",
        op: '/sqs/get',
        SERVICE_NAME: EMBEDDINGS_SERVICE_NAME
    };

    const result = await doRequestOp(op);
    try {
        const resultBody = result ? JSON.parse(result.body || '{}') : { "success": false };
        if (resultBody.success) {
            return resultBody.messages;
        } else {
            return null;
        }
    } catch (e) {
        console.error("Error parsing result body: ", e);
        return null;
    }
}

const endpointRequest = async (url: string, key: string, data: any) => {
    try {
        const response = await fetch('/api/admin/testEndpoint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, key, body: data }),
        });

        const result = await response.json();
        return result.success;
    } catch (e) {
        console.error('Error testing endpoint: ', e);
        return false;
    }
}

export const testEndpoint = async (url: string, key: string, model: string) => {
    return endpointRequest(url, key, {
        max_tokens: 50,
        temperature: 1,
        top_p: 1,
        n: 1,
        stream: false,
        model: model,
        messages: [
            {
                role: "user",
                content: "This is a test. Say Hi!",
            },
        ],
    });
};


export const testEmbeddingEndpoint = async (url: string, key: string) => {
    return endpointRequest(url, key, { input: "This is a smaple input" });
};


export const uploadPptx = async (data: {
    fileName: string, isAvailable: boolean,
    amplifyGroups: string[], contentType: string, md5: any
}) => {

    const op = {
        method: 'POST',
        data: data,
        path: URL_PATH,
        op: "/pptx_templates/upload",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const deletePptx = async (templateName: string) => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/pptx_templates/delete",
        queryParams: { "template_name": templateName },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


export const getUserAmplifyGroups = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/amplify_groups/list",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
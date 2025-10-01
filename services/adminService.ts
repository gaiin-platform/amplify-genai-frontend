import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/amplifymin";
const EMBEDDINGS_URL_PATH = "/embedding";
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
        // TEMPORARY FIX: Always use direct endpoint until backend is fixed
        console.log("Using direct models endpoint for all providers");
        const response = await fetch('/api/direct/models');
        if (response.ok) {
            return await response.json();
        }
        
        // If direct endpoint fails, try backend
        const op = {
            method: 'GET',
            path: "/available_models",
            op: "",
        };
        const result = await doRequestOp(op);
        
        if (result.success) {
            return result;
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
    
    // Return all models as last resort
    return {
        success: true,
        data: {
            models: [
                // OpenAI models
                {
                    id: 'gpt-3.5-turbo',
                    name: 'GPT-3.5 Turbo',
                    provider: 'openai',
                    description: 'OpenAI GPT-3.5 Turbo - Fast and efficient',
                    inputCostPer1K: 0.0005,
                    outputCostPer1K: 0.0015,
                    inputContextWindow: 16385,
                    supportsImages: false,
                    supportsReasoning: false
                },
                {
                    id: 'gpt-4',
                    name: 'GPT-4',
                    provider: 'openai',
                    description: 'OpenAI GPT-4 - Advanced reasoning',
                    inputCostPer1K: 0.03,
                    outputCostPer1K: 0.06,
                    inputContextWindow: 8192,
                    supportsImages: false,
                    supportsReasoning: true
                },
                // Gemini models
                {
                    id: 'gemini-1.5-flash',
                    name: 'Gemini 1.5 Flash',
                    provider: 'gemini',
                    description: 'Google Gemini 1.5 Flash - Fast multimodal',
                    inputCostPer1K: 0.00035,
                    outputCostPer1K: 0.0007,
                    inputContextWindow: 1048576,
                    supportsImages: true,
                    supportsReasoning: false
                },
                {
                    id: 'gemini-1.5-pro',
                    name: 'Gemini 1.5 Pro',
                    provider: 'gemini',
                    description: 'Google Gemini 1.5 Pro - Advanced multimodal',
                    inputCostPer1K: 0.00125,
                    outputCostPer1K: 0.005,
                    inputContextWindow: 2097152,
                    supportsImages: true,
                    supportsReasoning: true
                }
            ],
            default: {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                provider: 'openai',
                description: 'OpenAI GPT-3.5 Turbo - Fast and efficient',
                inputCostPer1K: 0.0005,
                outputCostPer1K: 0.0015,
                inputContextWindow: 16385,
                supportsImages: false,
                supportsReasoning: false
            },
            cheapest: {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash',
                provider: 'gemini',
                description: 'Google Gemini 1.5 Flash - Fast multimodal',
                inputCostPer1K: 0.00035,
                outputCostPer1K: 0.0007,
                inputContextWindow: 1048576,
                supportsImages: true,
                supportsReasoning: false
            },
            advanced: {
                id: 'gpt-4',
                name: 'GPT-4',
                provider: 'openai',
                description: 'OpenAI GPT-4 - Advanced reasoning',
                inputCostPer1K: 0.03,
                outputCostPer1K: 0.06,
                inputContextWindow: 8192,
                supportsImages: false,
                supportsReasoning: true
            }
        }
    };
}

export const embeddingDocumentStaus = async (dataSources: {key: string, type: string}[]) => {
    const op = {
        data: { dataSources },
        method: 'POST',
        path: EMBEDDINGS_URL_PATH,
        op: '/status',
        SERVICE_NAME: EMBEDDINGS_SERVICE_NAME
    };
    return await doRequestOp(op);
}


export const terminateEmbedding = async (key: any) => {
    const op = {
        data: { object_key: key },
        method: 'POST',
        path: EMBEDDINGS_URL_PATH,
        op: '/terminate',
        SERVICE_NAME: EMBEDDINGS_SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getInFlightEmbeddings = async () => {
    const op = {
        method: 'GET',
        path: EMBEDDINGS_URL_PATH,
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

const isCompletionsEndpoint = (url: string) => {
    return url.includes("/completions");
}

const translateDataToResponseBody = (data: any) => {
    const messages = [...data.messages];
    data.input = messages;
    data.max_output_tokens = data.max_tokens || data.max_completion_tokens || 1000;
    if (data.max_output_tokens < 16) data.max_output_tokens = 16;
    delete data.messages;
    delete data.max_tokens;
    delete data.max_completion_tokens;
    delete data.stream_options;
    delete data.temperature;
    delete data.n;
    return data;
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
    const isOmodel = /^o\d/.test(model) || /^gpt-5/.test(model);
    const isCompletionEndpoint = isCompletionsEndpoint(url);
    
    const baseMessages = [
        {
            role: "user",
            content: "This is a test. Say Hi!",
        },
    ];

    let requestBody;
    if (isOmodel) {
        // O models use max_completion_tokens and simplified body
        requestBody = {
            max_completion_tokens: 50,
            messages: baseMessages,
            model: model,
            stream: false
        };
    } else {
        // Regular models use the standard format
        requestBody = {
            max_tokens: 50,
            temperature: 1,
            top_p: 1,
            n: 1,
            stream: false,
            model: model,
            messages: baseMessages,
        };
    }

    // Transform data for non-completions endpoints
    if (!isCompletionEndpoint) {
        requestBody = translateDataToResponseBody(requestBody);
    }

    const result = await endpointRequest(url, key, requestBody);
    console.log("result", result);
    return result;
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
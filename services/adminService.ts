import { doRequestOp } from "./doRequestOp";
import { storageGet, storageSet, storageRemove } from '@/utils/app/storage';

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
    const op = {
        method: 'GET',
        path: "/available_models",
        op: "",
    };
    return await doRequestOp(op);
}

export const embeddingDocumentStatus = async (dataSources: {key: string, type: string}[]) => {
    const CACHE_KEY_PREFIX = 'embedding_status_';
    
    // Separate cached vs non-cached items
    const cachedResults: {[key: string]: string} = {};
    const cachedMetadata: {[key: string]: any} = {};
    const nonCachedDataSources: {key: string, type: string}[] = [];
    
    // Check cache for each datasource
    for (const ds of dataSources) {
        const cacheKey = `${CACHE_KEY_PREFIX}${ds.key}`;
        const cachedStr = await storageGet(cacheKey); // AWAIT the async call
        
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                if (cached && cached.status === 'completed') {
                    // Completed files never change - cache forever (no expiry check)
                    cachedResults[ds.key] = cached.status;
                    if (cached.metadata) {
                        cachedMetadata[ds.key] = cached.metadata;
                    }
                    continue;
                }
            } catch (error) {
                console.error(`Failed to parse cache for ${cacheKey}:`, error);
                // Clear corrupted cache entry
                await storageRemove(cacheKey).catch(err => 
                    console.error(`Failed to remove corrupted cache for ${cacheKey}:`, err)
                );
            }
        }
        
        // Not cached, need to fetch
        nonCachedDataSources.push(ds);
    }
    
    let apiResults: any = { success: true, data: {}, metadata: {} };
    
    // Only make API call if there are non-cached items
    if (nonCachedDataSources.length > 0) {
        const op = {
            data: { dataSources: dataSources },
            method: 'POST',
            path: EMBEDDINGS_URL_PATH,
            op: '/status',
            service: EMBEDDINGS_SERVICE_NAME
        };
        
        apiResults = await doRequestOp(op);
        
        // Cache any 'completed' results from the API
        if (apiResults?.success && apiResults?.data) {
            for (const [key, status] of Object.entries(apiResults.data)) {
                if (status === 'completed') {
                    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
                    const cacheData = {
                        status,
                        metadata: apiResults.metadata?.[key],
                        timestamp: Date.now()
                    };
                    await storageSet(cacheKey, JSON.stringify(cacheData)); // AWAIT and stringify
                }
            }
        }
    }
    
    // Merge cached and API results
    const combinedData = {
        ...cachedResults,
        ...(apiResults?.data || {})
    };
    
    const combinedMetadata = {
        ...cachedMetadata,
        ...(apiResults?.metadata || {})
    };
    
    return {
        success: apiResults?.success !== false,
        data: combinedData,
        ...(Object.keys(combinedMetadata).length > 0 && { metadata: combinedMetadata })
    };
}

export const clearEmbeddingStatusCache = async (key: string) => {
    const CACHE_KEY_PREFIX = 'embedding_status_';
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    
    // Remove from IndexedDB storage
    try {
        await storageRemove(cacheKey);
    } catch (error) {
        console.error('Failed to clear embedding status cache:', error);
    }
}

export const terminateEmbedding = async (key: any) => {
    const op = {
        data: { object_key: key },
        method: 'POST',
        path: EMBEDDINGS_URL_PATH,
        op: '/terminate',
        service: EMBEDDINGS_SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getInFlightEmbeddings = async () => {
    const op = {
        method: 'GET',
        path: EMBEDDINGS_URL_PATH,
        op: '/sqs/get',
        service: EMBEDDINGS_SERVICE_NAME
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

export const getCriticalErrors = async (limit: number = 50, lastEvaluatedKey: any = null) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/critical_errors',
        data: {
            limit,
            ...(lastEvaluatedKey && { last_evaluated_key: lastEvaluatedKey })
        },
        service: SERVICE_NAME
    };
    
    const result = await doRequestOp(op);
    console.log("result: ", result);
    return result;
}

export const resolveCriticalError = async (errorId: string, resolutionNotes: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/critical_errors/resolve',
        data: {
            error_id: errorId,
            resolution_notes: resolutionNotes
        },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
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
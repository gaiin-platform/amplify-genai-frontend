import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/apiKeys";
const SERVICE_NAME = "apiKeys";

export const createApiKey = async (data: any) => {
    const op = {
        method: 'POST',
        data: data,
        path: URL_PATH,
        op: '/keys/create',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const rotateApiKey = async (apiKeyId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: '/key/rotate',
        data: { "apiKeyId": apiKeyId },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


export const fetchAllApiKeys = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/keys/get',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const fetchAllSystemIds = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/get_system_ids',
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success ? result.data : [];
}

export const deactivateApiKey = async (apiKeyId: string) => {
    const op = {
        method: 'POST',
        data: { 'apiKeyId': apiKeyId },
        path: URL_PATH,
        op: '/key/deactivate',
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const updateApiKeys = async (data: any) => {
    const op = {
        method: 'POST',
        data: data,
        path: URL_PATH,
        op: "/keys/update",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const fetchApiDoc = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/api_documentation/get',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const uploadApiDoc = async (filename: string, md5: string) => {
    const op = {
        data: { filename: filename, content_md5: md5 },
        method: 'POST',
        path: URL_PATH,
        op: '/api_documentation/upload',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const fetchApiDocTemplates = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/api_documentation/get_templates",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

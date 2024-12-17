import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/apiKeys";


export const createApiKey = async (data: any) => {
    const op = {
        method: 'POST',
        data: data,
        path: URL_PATH,
        op: '/keys/create'
    };
    return await doRequestOp(op);
}



export const fetchApiKey = async (apiKeyId: string) => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/key/get',
        queryParams: {"apiKeyId": apiKeyId}
    };
    return await doRequestOp(op);
}



export const fetchAllApiKeys = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/keys/get',
    };
    return await doRequestOp(op);
}



export const fetchAllSystemIds = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/get_system_ids',
    };
    const result = await doRequestOp(op);
    return result.success ? result.data : [];
}


// export const fetchAllSystemIds = async (abortSignal = null) => {
//     const response = await fetch('/api/apikeys/opget' + `?path=${encodeURIComponent("/get_system_ids")}`, {
//         method: 'GET',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         signal: abortSignal,
//     });

//     const result = await response.json();
//     try {
//         return result.success ? result.data : [];
//     } catch (e) {
//         console.error("Error during api key system id request: ", e);
//         return [];
//     }
// };


export const deactivateApiKey = async (apiKeyId: string) => {
    const op = {
        method: 'POST',
        data: {'apiKeyId': apiKeyId},
        path: URL_PATH,
        op: '/key/deactivate'
    };
    const result =  await doRequestOp(op);
    return 'success' in result ? result.success : false;
}




export const updateApiKeys = async (data: any) => {
    const op = {
        method: 'POST',
        data: data,
        path: URL_PATH,
        op: "/keys/update"
    };
    return await doRequestOp(op);
}


export const fetchApiDoc = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/api_documentation/get',
    };
    return await doRequestOp(op);
}



export const uploadApiDoc = async (filename: string, md5: string) => {
    const op = {
        data: {filename: filename, content_md5: md5},
        method: 'POST',
        path: URL_PATH,
        op: '/api_documentation/upload',
    };
    return await doRequestOp(op);
}


export const fetchApiDocTemplates = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/api_documentation/get_templates",
    };
    return await doRequestOp(op);
}

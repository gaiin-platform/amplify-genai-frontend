import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/data-disclosure";


export const checkDataDisclosureDecision = async (email: string, abortSignal = null) => {
    const response = await fetch('/api/datadisclosure/check', {
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
};

export const saveDataDisclosureDecision = async (email: string, acceptedDataDisclosure: boolean, abortSignal = null) => {
    const response = await fetch('/api/datadisclosure/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({data: { email: email, acceptedDataDisclosure: acceptedDataDisclosure }}),
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
};

export const getLatestDataDisclosure = async (abortSignal = null) => {
    const response = await fetch('/api/datadisclosure/latest', {
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
};



export const uploadDataDisclosure = async (content_md5:string) => {
    const op = {
        data: {md5: content_md5},
        method: 'POST',
        path: URL_PATH,
        op: '/upload',
    };
    return await doRequestOp(op);
}

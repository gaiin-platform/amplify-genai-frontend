import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/data-disclosure";


export const checkDataDisclosureDecision = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/check',
    };
    return await doRequestOp(op);
}


export const saveDataDisclosureDecision = async (email: string, acceptedDataDisclosure: boolean) => {
    const op = {
        data: { email: email, acceptedDataDisclosure: acceptedDataDisclosure },
        method: 'POST',
        path: URL_PATH,
        op: '/save',
    };
    return await doRequestOp(op);
}



export const getLatestDataDisclosure = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/latest",
    };
    return await doRequestOp(op);
}


export const uploadDataDisclosure = async (data: any) => {
    const op = {
        data: data,
        method: 'POST',
        path: URL_PATH,
        op: '/upload',
    };
    return await doRequestOp(op);
}

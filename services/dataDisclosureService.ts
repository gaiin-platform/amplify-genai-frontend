import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/data-disclosure";
const SERVICE_NAME = "dataDisclosure";

export const checkDataDisclosureDecision = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: '/check',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const saveDataDisclosureDecision = async (email: string, acceptedDataDisclosure: boolean) => {
    const op = {
        data: { email: email, acceptedDataDisclosure: acceptedDataDisclosure },
        method: 'POST',
        path: URL_PATH,
        op: '/save',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getLatestDataDisclosure = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/latest",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const uploadDataDisclosure = async (data: any) => {
    const op = {
        data: data,
        method: 'POST',
        path: URL_PATH,
        op: '/upload',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/state/settings";
const SERVICE_NAME = "settings";

export const fetchUserSettings = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const saveUserSettings = async (settings: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save",
        data: { settings: settings },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

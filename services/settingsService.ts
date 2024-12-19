import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/state/settings";


export const fetchUserSettings = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
    };
    return await doRequestOp(op);
}

export const saveUserSettings = async (settings: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save",
        data: {settings: settings}
    };
    const result =  await doRequestOp(op);
    return result.success;
}



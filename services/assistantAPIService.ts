import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/assistant-api";

export const executeAssistantApiCall = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/execute-custom-auto",
        data: data
    };
    return await doRequestOp(op);
}

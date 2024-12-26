import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/assistant-api";

export const executeAssistantApiCall = async (data: any) => {
    const op = {
        //url: 'http://localhost:3015',
        method: 'POST',
        path: URL_PATH,
        op: "/execute-custom-auto",
        data: data
    };
    return await doRequestOp(op);
}

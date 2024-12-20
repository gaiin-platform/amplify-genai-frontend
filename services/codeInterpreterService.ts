import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/assistant";

export const deleteAssistant = async (assistantId: string) => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/openai/delete",
        queryParams: {"assistantId" : assistantId}
    };
    const result = await doRequestOp(op);
    return result.success;
}


export const deleteThread = async (threadId: string) => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/openai/thread/delete",
        queryParams: { "threadId": threadId }
    };
    const result = await doRequestOp(op);
    return result.success;
};


export const getPresignedDownloadUrl = async (data:any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/files/download/codeinterpreter",
        data: data
    };
    return await doRequestOp(op);
};


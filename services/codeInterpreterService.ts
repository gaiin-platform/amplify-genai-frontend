import { Conversation } from "@/types/chat";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/assistant";
const SERVICE_NAME = "agentcore";

const deleteAgentCoreSession = async (recordId: string) => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/agentcore/session/delete",
        queryParams: { "codeInterpreterRecordId": recordId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
};

export const createCodeInterpreterSession = async (): Promise<string | null> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create/codeinterpreter",
        data: {},
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    // Backend returns: { success: true, data: { codeInterpreterRecordId: "..." } }
    return result?.success ? (result.data?.codeInterpreterRecordId ?? null) : null;
};

export const getPresignedDownloadUrl = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/files/download/codeinterpreter",
        data: data,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const deleteCodeInterpreterConversation = (conversation: Conversation) => {
    const recordId = conversation.codeInterpreterRecordId;
    if (recordId) deleteAgentCoreSession(recordId);
}

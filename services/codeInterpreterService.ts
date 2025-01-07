import { Conversation, Message } from "@/types/chat";
import { doRequestOp } from "./doRequestOp";
import { conversationWithUncompressedMessages } from "@/utils/app/conversation";

const URL_PATH =  "/assistant";

const deleteOpenAIAssistant = async (assistantId: string) => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/openai/delete",
        queryParams: {"assistantId" : assistantId}
    };
    const result = await doRequestOp(op);
    return result.success;
}


const deleteOpenAiThread = async (threadId: string) => {
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



export const deleteCodeInterpreterConversation = (conversation: Conversation) => {
    const threads: Set<string> = new Set(
                        conversationWithUncompressedMessages(conversation).messages
                                .map(m => m.data?.state?.codeInterpreter?.threadId)
                                .filter(Boolean));
    threads.forEach((t: string) => deleteOpenAiThread(t));
    const astId = conversation.codeInterpreterAssistantId;
    if (astId) deleteOpenAIAssistant(astId);
}

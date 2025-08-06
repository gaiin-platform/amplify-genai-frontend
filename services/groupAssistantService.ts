import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/assistant";
const SERVICE_NAME = "assistant";

export const getGroupConversationData = async (assistantId: string, conversationId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get_group_conversations_data",
        data: { assistantId, conversationId },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);

    try {
        const resultBody = JSON.parse(result.body || 'false');
        return resultBody ? { success: true, data: resultBody } : { success: false };
    } catch (e) {
        console.error("Error parsing result body: ", e);
        return { success: false };
    }
}

export const getGroupAssistantConversations = async (assistantId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get_group_assistant_conversations",
        data: { assistantId: assistantId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);

    try {
        const resultBody = JSON.parse(result.body || 'false');
        return resultBody ? { success: true, data: resultBody } : { success: false };
    } catch (e) {
        console.error("Error parsing result body: ", e);
        return { success: false };
    }

}

export const getGroupAssistantDashboards = async (
    assistantId: string,
    startDate?: string,
    endDate?: string,
    includeConversationData?: boolean,
    includeConversationContent?: boolean,
) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get_group_assistant_dashboards",
        data: {
            assistantId,
            startDate,
            endDate,
            includeConversationData,
            includeConversationContent,
        },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    try {
        const resultBody = JSON.parse(result.body || 'false');

        return resultBody ? { success: true, data: resultBody } : { success: false };
    } catch (e) {
        console.error("Error parsing result body: ", e);
        return { success: false };
    }
}

export const saveUserRating = async (conversationId: string, userRating: number, userFeedback?: string, abortSignal = null) => {

    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save_user_rating",
        data: {
            conversationId,
            userRating,
            userFeedback
        },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    try {
        const resultBody = JSON.parse(result.body || 'false');

        return resultBody ? { success: true } : { success: false };
    } catch (e) {
        console.error("Error parsing result body: ", e);
        return { success: false };
    }

}

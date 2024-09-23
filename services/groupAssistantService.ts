const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}

export const getGroupAssistantConversations = async (assistantId: string, abortSignal = null) => {
    try {
        const response = await fetch('/api/groupAssistants/getConversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: { assistantId: assistantId } }),
            signal: abortSignal,
        });

        if (response.ok) {
            const result = await response.json();
            return { success: true, message: "Group assistant conversations fetched successfully.", data: result };
        } else {
            const errorText = await response.text();
            console.error(`Error response: ${response.status} ${response.statusText}`, errorText);
            return { success: false, message: `Error calling group assistant conversations: ${response.statusText}.`, data: {} };
        }
    } catch (e) {
        console.error("Fetch error:", e);
        return { success: false, message: "Error fetching group assistant conversations.", data: {} };
    }
}

export const getGroupAssistantDashboards = async (
    assistantId: string,
    startDate?: string,
    endDate?: string,
    includeConversationData?: boolean,
    includeConversationContent?: boolean,
    abortSignal = null
) => {
    try {
        const response = await fetch('/api/groupAssistants/getDashboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: {
                    assistantId,
                    startDate,
                    endDate,
                    includeConversationData,
                    includeConversationContent,
                },
            }),
            signal: abortSignal,
        });

        if (response.ok) {
            const result = await response.json();
            if (result.body) {
                const parsedBody = JSON.parse(result.body);
                return { success: true, message: "Group assistant dashboards fetched successfully.", data: parsedBody };
            }
        } else {
            const errorText = await response.text();
            console.error(`Error response: ${response.status} ${response.statusText}`, errorText);
            return { success: false, message: `Error calling group assistant dashboards: ${response.statusText}.`, data: {} };
        }
    } catch (e) {
        console.error("Fetch error:", e);
        return { success: false, message: "Error fetching group assistant dashboards.", data: {} };
    }
}

export const saveUserRating = async (conversationId: string, userRating: number, userFeedback?: string, abortSignal = null) => {
    try {
        const body = {
            data: {
                conversationId,
                userRating,
                userFeedback
            }
        };

        const response = await fetch('/api/groupAssistants/saveRating', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: abortSignal,
        });

        if (response.ok) {
            const result = await response.json();
            return { success: true, message: "User rating and feedback saved successfully.", data: result };
        } else {
            const errorText = await response.text();
            console.error(`Error response: ${response.status} ${response.statusText}`, errorText);
            return failureResponse(`Error saving user rating and feedback: ${response.statusText}.`);
        }
    } catch (e) {
        console.error("Fetch error:", e);
        return failureResponse("Error saving user rating and feedback.");
    }
}

import {Assistant, AssistantDefinition} from "@/types/assistant";
import {OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types/openai";
import {ChatBody, Message, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {Stopper} from "@/utils/app/tools";
import {v4 as uuidv4} from 'uuid';

const failureResponse = (messages: Message[], reason: string) => {
    return {
        success: false,
        messages: [
            messages,
            newMessage({
                role: "assistant",
                data: {isError: true},
                content: reason,
            })
        ]
    }
}

const doAssistantOp = async (stopper: Stopper, opName: string, data: any, errorHandler = (e: any) => {
}) => {
    const op = {
        data: data,
        op: opName
    };

    console.log("Assistant Op:", op);

    const response = await fetch('/api/assistant/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: stopper.signal,
        body: JSON.stringify(op),
    });

    console.log("Assistant Op response:", response);

    if (response.ok) {
        try {
            const result = await response.json();
            console.log("Assistant Op result:", result);

            return result;
        } catch (e) {
            return {success: false, message: "Error parsing response."};
        }
    } else {
        return {success: false, message: `Error calling assistant: ${response.statusText} .`}
    }
}

const addData = (data: { [key: string]: any }) => {
    return (m: Message) => {
        return {...m, data: {...m.data, ...data}}
    };
}

const addDataToMessages = (messages: Message[], data: { [key: string]: any }) => {
    return messages.map((m) => {
        return {...m, data: {...m.data, ...data}}
    });
}

export const createAssistant = async (assistantDefinition: AssistantDefinition, abortSignal = null) => {

    if (assistantDefinition.provider === 'openai') {
        if (assistantDefinition.dataSources) {
            assistantDefinition.fileKeys = assistantDefinition.dataSources.map((ds) => ds.id);
        }

        const response = await fetch('/api/assistant/op', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({op: "/create", data: assistantDefinition}),
            signal: abortSignal,
        });

        const result = await response.json();
        const id = result.data.assistantId;
        return {assistantId: id, id, provider: 'openai'};
    } else if (assistantDefinition.provider === 'amplify') {
        const response = await fetch('/api/assistant/op', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({op: "/create", data: assistantDefinition}),
            signal: abortSignal,
        });

        const result = await response.json();

        console.log("Create Assistant result:", result);

        return {
            id: result.data.id,
            assistantId: result.data.assistantId,
            provider: 'amplify',
            dataSources: assistantDefinition.fileKeys || [],
            name: assistantDefinition.name || "Unnamed Assistant",
            description: assistantDefinition.description || "No description provided",
            instructions: assistantDefinition.instructions || assistantDefinition.description,
        }
    }

    return {
        assistantId: uuidv4(),
        provider: 'amplify',
        dataSources: assistantDefinition.fileKeys || [],
        name: assistantDefinition.name || "Unnamed Assistant",
        description: assistantDefinition.description || "No description provided",
        instructions: assistantDefinition.instructions || assistantDefinition.description,
    }
};


export const listAssistants = async (user: string, abortSignal = null) => {
    const response = await fetch('/api/assistant/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({op: "/list", data: {}}),
        signal: abortSignal,
    });

    const result = await response.json();

    if (result.success) {
        return result.data;
    } else {
        console.error("Error listing assistants: ", result.message);
        return [];
    }
};

export const deleteAssistant = async (assistantId: string, abortSignal = null) => {
    const response = await fetch('/api/assistant/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({op: "/delete", data: {assistantId}}),
        signal: abortSignal,
    });

    const result = await response.json();

    if (result.success) {
        return true;
    } else {
        console.error("Error deleting assistant: ", result.message);
        return false;
    }
};
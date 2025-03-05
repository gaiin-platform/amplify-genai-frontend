import { AssistantDefinition } from "@/types/assistant";
import { Message } from "@/types/chat";
import { v4 as uuidv4 } from 'uuid';
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/assistant";
const SERVICE_NAME = "assistant";

const addData = (data: { [key: string]: any }) => {
    return (m: Message) => {
        return { ...m, data: { ...m.data, ...data } }
    };
}

const addDataToMessages = (messages: Message[], data: { [key: string]: any }) => {
    return messages.map((m) => {
        return { ...m, data: { ...m.data, ...data } }
    });
}

export const createAssistant = async (assistantDefinition: AssistantDefinition, abortSignal = null) => {
    if (!("disclaimer" in assistantDefinition)) assistantDefinition.disclaimer = '';
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create",
        data: { ...assistantDefinition },
        service: SERVICE_NAME
    };

    if (assistantDefinition.provider === 'openai') {
        if (assistantDefinition.dataSources) {
            assistantDefinition.fileKeys = assistantDefinition.dataSources.map((ds) => ds.id);
        }

        const result = await doRequestOp(op);

        const id = result.data.assistantId;
        return { assistantId: id, id, provider: 'openai' };
    } else if (assistantDefinition.provider === 'amplify') {

        try {
            const result = await doRequestOp(op);

            console.log("Create Assistant result:", result);

            return {
                id: result.data.id,
                assistantId: result.data.assistantId,
                provider: 'amplify',
                dataSources: assistantDefinition.fileKeys || [],
                name: assistantDefinition.name || "Unnamed Assistant",
                description: assistantDefinition.description || "No description provided",
                instructions: assistantDefinition.instructions || assistantDefinition.description,
                disclaimer: assistantDefinition.disclaimer || ""
            }
        } catch {
            console.log("Response result failed to parse assistant for correct data");
            return {
                id: null,
                assistantId: null,
                provider: 'amplify'
            }

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

export const listAssistants = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/list",
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success ? result.data : [];
}

export const deleteAssistant = async (assistantId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete",
        data: { assistantId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

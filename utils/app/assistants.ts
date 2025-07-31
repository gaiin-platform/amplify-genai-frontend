import {Assistant, AssistantDefinition, DEFAULT_ASSISTANT} from "@/types/assistant";
import {Prompt} from "@/types/prompt";
import {Message, MessageType} from "@/types/chat";
import {ReservedTags} from "@/types/tags";
import { savePrompts } from "./prompts";
import { baseAssistantFolder } from "./basePrompts";

export const isAssistantById = (promptId: string, prompts: Prompt[]) => {
    const prompt = prompts.find((p: Prompt) => p.id === promptId);
    if (prompt) return isAssistant(prompt);
    return false;
}

export const isAssistant = (prompt: Prompt) => {
    return prompt.data && prompt.data.assistant;
}

export const setAssistant = (message: Message, assistant: Assistant): Message => {
    if(!assistant || assistant === DEFAULT_ASSISTANT) {
        const newMessage = {...message};
        if(newMessage.data && newMessage.data.assistant) {
            delete newMessage.data.assistant;
        }
        return newMessage;
    }

    return {
        ...message,
        data: {
            ...message.data, assistant: {
                definition: {
                    assistantId: assistant.definition.assistantId,
                    name: assistant.definition.name,
                    ...(assistant.definition.uri ? {uri: assistant.definition.uri} : {}),
                }
            }
        }
    };
}

export const getAssistants = (prompts: Prompt[]): Assistant[] => {
    return prompts
        .filter(isAssistant)
        .map((p) => p.data?.assistant);
}

export const getAssistant = (prompt: Prompt): AssistantDefinition => {
    return prompt.data?.assistant.definition;
}

export const getAssistantFromMessage = (message: Message): AssistantDefinition | null => {
    return (message.data && message.data.assistant && message.data.assistant.definition) ?
        message.data?.assistant.definition : null;
}

export const createAssistantPrompt = (assistant: AssistantDefinition): Prompt => {

    const access = (assistant.data && assistant.data.access) ?
        assistant.data.access : {read: true, write: false};

    const noEdit = (
        !access.write ||
        (assistant.tags &&
            assistant.tags.includes(ReservedTags.SYSTEM))
    )

    const noDelete = (
        !access.write ||
        (assistant.tags &&
            assistant.tags.includes(ReservedTags.SYSTEM))
    )

    const noShare = (
        !access.write ||
        (assistant.tags &&
            assistant.tags.includes(ReservedTags.SYSTEM))
    )

    return {
        id: assistant.id || "",
        type: MessageType.ROOT,
        name: assistant.name,
        description: assistant.description,
        content: assistant.instructions,
        folderId: baseAssistantFolder.id,
        data: {
            assistant: {id: assistant.id, definition: assistant},
            ...(assistant.data || {}),
            noCopy: true,
            noEdit,
            noDelete,
            noShare,
        }
    };
}



export const isSystemAssistant = (prompt: Prompt) => {
    return prompt.data?.assistant?.definition?.tags.includes(ReservedTags.SYSTEM);

}

export const syncAssistants = async (assistants: AssistantDefinition[], prompts: Prompt[], folderIds: string[]) => {
    // Match assistants by name and only take the one with the highest version number for each name
    const latestAssistants = assistants.reduce((acc: { [key: string]: AssistantDefinition }, assistant: AssistantDefinition) => {
        if (!assistant.version) {
            assistant.version = 1;
        }

        // @ts-ignore        
        if (!acc[assistant.assistantId] || acc[assistant.assistantId].version < assistant.version) {
            if (!assistant.assistantId) assistant.assistantId = assistant.id;
            acc[assistant.assistantId || ""] = assistant;
        }
        return acc;
    }, {});
    assistants = Object.values(latestAssistants);

    const assistantNames = new Set(assistants.map(prompt => prompt.name));

    let assistantPrompts: Prompt[] = assistants.map(createAssistantPrompt);  
    const astFolderIdMap: {[id: string]: string} = prompts.reduce((acc: {[id: string]: string}, p:Prompt) => {
                                                            if (isAssistant(p) && p.folderId && p.folderId !== baseAssistantFolder.id &&
                                                                folderIds.includes(p.folderId)) acc[p.id] = p.folderId;
                                                        return acc;
                                                    }, {});
    assistantPrompts = assistantPrompts.map((p: Prompt) => {
                            if (Object.keys(astFolderIdMap).includes(p.id)) {
                                return {...p, folderId: astFolderIdMap[p.id]}
                            }
                            return p; 
                         });                   
    // keep imported Assistants
    const importedAssistants = prompts.filter(prompt =>  isAssistant(prompt) && prompt.data?.noShare && 
                                                        !assistantNames.has(prompt.name) && !prompt.groupId && !isSystemAssistant(prompt));                           
    const sortedAssistants = [...assistantPrompts, ...importedAssistants];
    sortedAssistants.sort((a, b) =>  a.name.localeCompare(b.name));
    return sortedAssistants;
}



export const handleUpdateAssistantPrompt = async (assistantPrompt: Prompt, prompts: Prompt[], dispatch: any) => {
    const filteredPrompts: Prompt[] = prompts.filter((curPrompt: Prompt) => curPrompt?.data?.assistant?.definition.assistantId !== 
                                                                         assistantPrompt.data?.assistant?.definition.assistantId)
    const updatedPrompts = [...filteredPrompts, assistantPrompt]
    dispatch({ field: 'prompts', value: updatedPrompts });
    savePrompts(updatedPrompts);
}

export const filterAstsByFeatureFlags = (prompts: Prompt[], featureFlags: { [key: string]: boolean }) => {
    let filteredPrompts: Prompt[] = [...prompts];
    if (!featureFlags.apiKeys) {
        filteredPrompts = filteredPrompts.filter(prompt =>{
            const tags = prompt.data?.tags;
            return !(
                tags && 
                (tags.includes(ReservedTags.ASSISTANT_API_KEY_MANAGER) || 
                tags.includes(ReservedTags.ASSISTANT_API_HELPER))
            );
        });
    }
    return filteredPrompts;

}
import {Assistant, AssistantDefinition, DEFAULT_ASSISTANT} from "@/types/assistant";
import {Prompt} from "@/types/prompt";
import {Message, MessageType} from "@/types/chat";
import {FolderInterface} from "@/types/folder";
import {ReservedTags} from "@/types/tags";
import { saveFolders } from '@/utils/app/folders';
import { savePrompts } from "./prompts";
import { getDate } from "./date";

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

export const getAssistantFromMessage = (message: Message): AssistantDefinition => {
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
        folderId: "assistants",
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

const createAssistantFolder = async (folders: FolderInterface[], dispatch: any) => {
    console.log("Creating assistants folder...")
    const newFolder = {
        id: "assistants",
        date: getDate(),
        name: "Assistants",
        type: "prompt",
    } as FolderInterface;
    const updatedFolders = [...folders, newFolder];
    dispatch({field: 'folders', value: updatedFolders});
    saveFolders(updatedFolders);
    return 
}

export const syncAssistants = async (assistants: AssistantDefinition[], folders: FolderInterface[], prompts: Prompt[], dispatch: any, featureFlags: any) => {


    prompts = prompts.filter(p => p.id !== 'ast/assistant-api-key-manager' && p.id !== 'ast/assistant-api-key-creator')
    // Match assistants by name and only take the one with the highest version number for each name
    const latestAssistants = assistants.reduce((acc: { [key: string]: AssistantDefinition }, assistant: AssistantDefinition) => {
        if (!assistant.version) {
            assistant.version = 1;
        }

        // @ts-ignore
        if (!acc[assistant.assistantId] || acc[assistant.assistantId].version < assistant.version) {
            acc[assistant.assistantId || ""] = assistant;
        }
        return acc;
    }, {});
    assistants = Object.values(latestAssistants);
    

    // Make sure the "assistants" folder exists and create it if necessary
    const assistantsFolder = folders.find((f) => f.id === "assistants");
    if (!assistantsFolder) {
        await createAssistantFolder(folders, dispatch);
    }

    // would love for it to be like this but we need to offset render or add loading because prompts are jumping 
    //const assistantPrompts: Prompt[] = assistants.map(createAssistantPrompt);    
    // const updatedPrompts = prompts.filter(prompt =>  !isAssistant(prompt) || prompt.data?.noShare);


    //create Assistant prompts for new assistants only since we already have them in our prompts list 
    const assistantPrompts: Prompt[] = assistants.reduce((acc: Prompt[], ast) => {
            const existingAssistant = prompts.find(prompt => prompt.id === ast.id);
            if (!existingAssistant) {
                const newPrompt = createAssistantPrompt(ast);
                acc.push(newPrompt);
            } 
            return acc;
    }, []);
    
    const assistantNames = new Set(assistantPrompts.map(prompt => prompt.name));
    // we want the updated assistant versions so we filter and old versions from our original prompts list 
    let updatedPrompts: Prompt[] = assistantNames.size > 0 ? prompts.filter(prompt => !assistantNames.has(prompt.name)) : prompts;
    

    // filter out any assistants that are no longer in the back end while keeping imported ones 
    const assistantIds = new Set(assistants.map(prompt => prompt.id));
                                        // keep the       nonassistants            imported                 still in db 
    updatedPrompts = updatedPrompts.filter(prompt =>  !isAssistant(prompt) || prompt.data?.noShare || assistantIds.has(prompt.id));                            
    
    // feature flag considerations
    if (!featureFlags.apiKeys) updatedPrompts = updatedPrompts.filter(prompt => prompt.id !== 'ast/assistant-api-key-manager');

    savePrompts([...updatedPrompts, ...assistantPrompts]);
    dispatch({field: 'prompts', value: [...updatedPrompts, ...assistantPrompts]}); 
   
}



export const handleUpdateAssistantPrompt = async (assistantPrompt: Prompt, prompts: Prompt[], dispatch: any) => {
    const filteredPrompts: Prompt[] = prompts.filter((curPrompt: Prompt) => curPrompt?.data?.assistant?.definition.assistantId !== 
                                                                         assistantPrompt.data?.assistant?.definition.assistantId)
    const updatedPrompts = [...filteredPrompts, assistantPrompt]
    dispatch({ field: 'prompts', value: updatedPrompts });
    savePrompts(updatedPrompts);
}
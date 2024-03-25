import {AssistantDefinition} from "@/types/assistant";
import {Prompt} from "@/types/prompt";
import {MessageType} from "@/types/chat";
import {FolderInterface} from "@/types/folder";
import {ReservedTags} from "@/types/tags";

export const isAssistant = (prompt:Prompt) => {
    return prompt.type === MessageType.ROOT && prompt.data && prompt.data.assistant;
}

export const getAssistant = (prompt:Prompt):AssistantDefinition => {
    return prompt.data?.assistant.definition;
}

export const createAssistantPrompt = (assistant:AssistantDefinition):Prompt => {

    const access = (assistant.data && assistant.data.access) ?
        assistant.data.access : {read: true, write:false};

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
            assistant: {id:assistant.id, definition:assistant},
            ...(assistant.data || {}),
            noCopy: true,
            noEdit,
            noDelete,
            noShare,
        }
    };
}

export const syncAssistants = (assistants:AssistantDefinition[], folders:FolderInterface[], prompts:Prompt[], dispatch:any) => {
    // Match assistants by name and only take the one with the highest version number for each name
    const latestAssistants = assistants.reduce((acc: {[key:string]:AssistantDefinition}, assistant: AssistantDefinition) => {
        if(!assistant.version) {
            assistant.version = 1;
        }

        // @ts-ignore
        if (!acc[assistant.assistantId] || acc[assistant.assistantId].version < assistant.version) {
            acc[assistant.assistantId || ""] = assistant;
        }
        return acc;
    },{});
    assistants = Object.values(latestAssistants);

    // Make sure the "assistants" folder exists and
    // create it if necessary
    const assistantsFolder = folders.find((f) => f.id === "assistants");
    if (!assistantsFolder) {
        console.log("Creating assistants folder...")
        const newFolder = {
            id: "assistants",
            name: "Assistants",
            type: "prompt",
        };
        dispatch({field: 'folders', value: [...folders, newFolder]});
    }

    const aPrompts:Prompt[] = assistants.map(createAssistantPrompt);

    const withoutAssistants = prompts.filter((p) =>
        !(p.type === MessageType.ROOT && p.data && p.data.assistant)
    );

    dispatch({field:'prompts', value: [...withoutAssistants, ...aPrompts]});
}
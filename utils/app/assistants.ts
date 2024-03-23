import {AssistantDefinition} from "@/types/assistant";
import {Prompt} from "@/types/prompt";
import {MessageType} from "@/types/chat";
import {FolderInterface} from "@/types/folder";


export const syncAssistants = (assistants:AssistantDefinition[], folders:FolderInterface[], prompts:Prompt[], dispatch:any) => {
    // Match assistants by name and only take the one with the highest version number for each name
    const latestAssistants = assistants.reduce((acc: {[key:string]:AssistantDefinition}, assistant: AssistantDefinition) => {
        if(!assistant.version) {
            assistant.version = 1;
        }

        // @ts-ignore
        if (!acc[assistant.name] || acc[assistant.name].version < assistant.version) {
            acc[assistant.name] = assistant;
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

    const aPrompts:Prompt[] = [];
    for(const assistant of assistants) {

        console.log("Creating assistant prompt...", assistant)

        const assistantPrompt: Prompt = {
            id: assistant.id || "",
            type: MessageType.ROOT,
            name: assistant.name,
            description: assistant.description,
            content: assistant.instructions,
            folderId: "assistants",
            data: {
                assistant: {id:assistant.id, definition:assistant},
                ...(assistant.data || {})
            }
        };

        aPrompts.push(assistantPrompt);
    }

    const withoutAssistants = prompts.filter((p) =>
        !(p.type === MessageType.ROOT && p.data && p.data.assistant)
    );

    dispatch({field:'prompts', value: [...withoutAssistants, ...aPrompts]});
}
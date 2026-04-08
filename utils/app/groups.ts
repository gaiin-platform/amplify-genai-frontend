import { AssistantDefinition } from "@/types/assistant";
import { FolderInterface } from "@/types/folder";
import { Group } from "@/types/groups";
import { LayeredAssistant } from "@/types/layeredAssistant";
import { Prompt } from "@/types/prompt";
import { createAssistantPrompt } from "@/utils/app/assistants";
import { getDate } from "@/utils/app/date";


export const contructGroupData = (groupData: any[]) =>{
    if (groupData.length === 0) return {groups: [], groupFolders: [] as FolderInterface[], groupPrompts: [] as Prompt[]};
    const groups:Group[] = [];
    const newFolders: FolderInterface[] = [];
    let groupAstPrompts: Prompt[] = [];
    groupData.forEach((group: any) => {
        newFolders.push({
                            id: group.id ,
                            date: getDate(),
                            name: group.name,
                            type: 'prompt',
                            isGroupFolder: true
                        } as FolderInterface);
        const groupAsts: Prompt[] = group.assistants.map( (ast: AssistantDefinition) => {return {...createAssistantPrompt(ast), groupId: group.id, folderId: group.id}});

        groupAstPrompts.push.apply(groupAstPrompts, groupAsts)

        // Parse layered assistants from the group response and attach groupId
        const layeredAssistants: LayeredAssistant[] = (group.layeredAssistants ?? []).map(
            (la: any) => ({ ...la, groupId: la.groupId ?? group.id } as LayeredAssistant)
        );

        // update group assistants to Prompt compatible type
        groups.push({...group, assistants: groupAsts, layeredAssistants});
    })
    return {groups: groups, groupFolders: newFolders, groupPrompts: groupAstPrompts}
}

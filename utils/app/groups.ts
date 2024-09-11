import { AssistantDefinition } from "@/types/assistant";
import { FolderInterface } from "@/types/folder";
import { Group } from "@/types/groups";
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
        // update group assistants to Prompt compatible type
        groups.push({...group, assistants: groupAsts});
    })
    return {groups: groups, groupFolders: newFolders, groupPrompts: groupAstPrompts}
}

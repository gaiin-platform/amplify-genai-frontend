// Replace imports to match actual paths
import {useContext} from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {WorkflowDefinition} from "@/types/workflow";
import {WorkflowDefinitionComponent} from './WorkflowDefinitionComponent';
import Folder from '@/components/Folder';
import {FolderInterface} from '@/types/folder';
import WorkflowDefinitionBarContext from "@/components/Workflow/WorkflowDefinitionBarContext";

export const WorkflowDefinitionFolders = () => {
    const {
        state: {folders, workflows},
    } = useContext(HomeContext);

    const {
        state: { searchTerm, filteredWorkflows },
        handleUpdateWorkflowDefinition,
    } = useContext(WorkflowDefinitionBarContext);

    const handleDrop = (e: any, folder: FolderInterface) => {
        if (e.dataTransfer) {
            console.log(e.dataTransfer);
            const workflow = JSON.parse(e.dataTransfer.getData('workflowDefinition'));

            const updatedWorkflow = {
                ...workflow,
                folderId: folder.id,
            };

            handleUpdateWorkflowDefinition(updatedWorkflow);
        }
    };

    const workflowFolders = (currentFolder: FolderInterface) => (
        // replace filteredWorkflows with your data source
        workflows.filter((w:WorkflowDefinition) => w.folderId)
            .map((workflow:WorkflowDefinition, index) => {
                if (workflow.folderId === currentFolder.id) {
                    return (
                        <div key={index} className="ml-5 gap-2 border-l pl-2">
                            <WorkflowDefinitionComponent workflow={workflow}/>
                        </div>
                    );
                }
            })
    );

    return (
        <div className="flex w-full flex-col pt-2">
            {folders
                .filter((folder) => folder.type === 'workflow')
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((folder, index) => (
                    <Folder
                        key={index}
                        searchTerm={searchTerm} // replace as needed
                        currentFolder={folder}
                        handleDrop={handleDrop}
                        folderComponent={workflowFolders(folder)}
                    />
                ))}
        </div>
    );
};
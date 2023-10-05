import {
    IconBulbFilled,
    IconEdit,
    IconCheck,
    IconTrash,
    IconX,
    IconDots,
    IconShare,
} from '@tabler/icons-react';
import {
    DragEvent,
    MouseEventHandler,
    useContext,
    useEffect,
    useState,
} from 'react';

import HomeContext from '@/pages/api/home/home.context';

import {WorkflowDefinition} from "@/types/workflow";

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';

import WorkflowDefinitionBarContext from "@/components/Workflow/WorkflowDefinitionBarContext";
import { WorkflowDefinitionModal } from './WorkflowDefinitionModal';


interface Props {
    workflow: WorkflowDefinition;
}

export const WorkflowDefinitionComponent = ({ workflow }: Props) => {
    const {
        dispatch: workflowDispatch,
        handleUpdateWorkflowDefinition,
        handleDeleteWorkflowDefinition,
    } = useContext(WorkflowDefinitionBarContext);

    const {
        state: { workflows, defaultModelId, apiKey },
        dispatch: homeDispatch,
        handleCreateFolder,
        handleNewConversation,
    } = useContext(HomeContext);


    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [showModal, setShowModal] = useState(false);

    // create a method to open the Modal and set the selected WorkflowDefinition
    const handleEditWorkflowDefinition: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setShowModal(true);
    };


    const handleUpdate = (workflow: WorkflowDefinition) => {
        handleUpdateWorkflowDefinition(workflow);
        workflowDispatch({ field: 'searchTerm', value: '' });
    };

    const handleDelete: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();

        if (isDeleting) {
            handleDeleteWorkflowDefinition(workflow);
            workflowDispatch({ field: 'searchTerm', value: '' });
        }

        setIsDeleting(false);
    };

    const handleCancelDelete: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setIsDeleting(false);
    };

    const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setIsDeleting(true);
    };

    const handleDragStart = (e: DragEvent<HTMLButtonElement>, workflow: WorkflowDefinition) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('workflowDefinition', JSON.stringify(workflow));
        }
        else {
            console.log("No data transfer");
        }
    };


    useEffect(() => {
        if (isRenaming) {
            setIsDeleting(false);
        } else if (isDeleting) {
            setIsRenaming(false);
        }
    }, [isRenaming, isDeleting]);

    // @ts-ignore
    // @ts-ignore
    return (
        <div className="relative flex items-center">
            <div className="flex w-full">
                <button
                    className="flex-grow cursor-pointer items-center gap-1 rounded-lg p-1 text-sm transition-colors duration-200 hover:bg-[#343541]/90"
                    draggable="true"
                    onClick={handleEditWorkflowDefinition}
                    onDragStart={(e) => handleDragStart(e, workflow)}
                    onMouseLeave={() => {
                        setIsDeleting(false);
                        setIsRenaming(false);
                        setRenameValue('');
                    }}
                >
                    {/*<IconEdit size={18} />*/}

                    <div className="relative flex-1 overflow-hidden pr-4 text-left text-[12.5px] leading-3">
                        <div style={{ maxWidth: '300px', overflowWrap: 'anywhere', hyphens: 'auto', lineHeight: '1.5em' }}>
                            {workflow.name}
                        </div>
                    </div>
                </button>

                <div className="flex-shrink-0 flex items-center space-x-1">

                    {/*{!isDeleting && !isRenaming && (*/}
                    {/*    <SidebarActionButton handleClick={() => setShowModal(true)}>*/}
                    {/*        <IconEdit size={18} />*/}
                    {/*    </SidebarActionButton>*/}
                    {/*)}*/}

                    {/*{!isDeleting && !isRenaming && (*/}
                    {/*    <SidebarActionButton handleClick={handleSharePrompt}>*/}
                    {/*        <IconShare size={18} />*/}
                    {/*    </SidebarActionButton>*/}
                    {/*)}*/}

                    {!isDeleting && !isRenaming && (
                        <SidebarActionButton handleClick={handleOpenDeleteModal}>
                            <IconTrash size={18} />
                        </SidebarActionButton>
                    )}

                    {(isDeleting || isRenaming) && (
                        <>
                            <SidebarActionButton handleClick={handleDelete}>
                                <IconCheck size={18} />
                            </SidebarActionButton>

                            <SidebarActionButton handleClick={handleCancelDelete}>
                                <IconX size={18} />
                            </SidebarActionButton>
                        </>
                    )}
                </div>
            </div>

            {showModal && (
                <WorkflowDefinitionModal
                    workflowDefinition={workflow}
                    onClose={() => setShowModal(false)}
                    onUpdateWorkflowDefinition={handleUpdate}
                />
            )}

            {/*{showModal && (*/}
            {/*    <PromptModal*/}
            {/*        prompt={prompt}*/}
            {/*        onClose={() => setShowModal(false)}*/}
            {/*        onUpdatePrompt={handleUpdate}*/}
            {/*    />*/}
            {/*)}*/}

            {/*{showShareModal && (*/}
            {/*    <ShareModal*/}
            {/*        prompt={prompt}*/}
            {/*        onClose={() => setShowShareModal(false)}*/}
            {/*        onSharePrompt={(p)=>{alert("Share"+p.name)}}*/}
            {/*    />*/}
            {/*)}*/}
        </div>
    );
};

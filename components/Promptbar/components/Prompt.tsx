import {
    IconEdit,
    IconCopy,
    IconCheck,
    IconApiApp,
    IconMessage2,
    IconTrash,
    IconX,
    IconRobot,
    IconShare,
    IconEye,
} from '@tabler/icons-react';
import {
    DragEvent,
    MouseEventHandler,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import HomeContext from '@/pages/api/home/home.context';

import { Prompt } from '@/types/prompt';


import PromptbarContext from '../PromptBar.context';
import { PromptModal } from './PromptModal';
import { v4 as uuidv4 } from "uuid";
import {
    handleStartConversationWithPrompt,
} from "@/utils/app/prompts";
import { useSession } from "next-auth/react";
import {getAssistant, handleUpdateAssistantPrompt, isAssistant} from "@/utils/app/assistants";
import {AssistantModal} from "@/components/Promptbar/components/AssistantModal";
import {deleteAssistant} from "@/services/assistantService";
import { ReservedTags } from '@/types/tags';
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { Group } from '@/types/groups';
import React from 'react';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import { isBasePrompt } from '@/utils/app/basePrompts';

interface Props {
    prompt: Prompt;
}

export const PromptComponent = ({ prompt }: Props) => {
    const {
        dispatch: promptDispatch,
        handleAddPrompt,
        handleUpdatePrompt,
        handleDeletePrompt,
        handleSharePrompt,
    } = useContext(PromptbarContext);

    const {
        state: { statsService, selectedAssistant, checkingItemType, checkedItems, prompts, groups, syncingPrompts, featureFlags},
        dispatch: homeDispatch,
        handleNewConversation,
        setLoadingMessage,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

    const { data: session } = useSession();
    const user = session?.user;
    // const isReserved = (isAssistant(prompt) && prompt?.data?.assistant?.definition?.tags?.includes(ReservedTags.SYSTEM));
    const isBase = isBasePrompt(prompt.id);
    const groupId = prompt.groupId;
    const canDelete = (!prompt.data || !prompt.data.noDelete) && !groupId;
    const canEdit = (!prompt.data || !prompt.data.noEdit);
    const canCopy = (!prompt.data || !prompt.data.noCopy) && !groupId;
    const canShare = (!prompt.data || !prompt.data.noShare)  && !groupId;

    const [showModal, setShowModal] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isHovered, setIsHovered] = useState(false);
    const [checkPrompts, setCheckPrompts] = useState(false);
    const [isChecked, setIsChecked] = useState(false);

    const handleStartConversation = (startPrompt: Prompt) => {

        if(isAssistant(startPrompt) && startPrompt.data){
            homeDispatch({field: 'selectedAssistant', value: startPrompt.data.assistant});
        }


        statsService.startConversationEvent(startPrompt);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, startPrompt);

    }

    useEffect(() => {
        if (checkingItemType === 'Prompts') setCheckPrompts(true);
        if (checkingItemType === null) setCheckPrompts(false);
      }, [checkingItemType]);

    const handleUpdate = (prompt: Prompt) => {
        handleUpdatePrompt(prompt);
        promptDispatch({ field: 'searchTerm', value: '' });
    };

    const handleDelete: MouseEventHandler<HTMLButtonElement> = async (e) => {
        e.stopPropagation();

        if (isDeleting) {
            handleDeletePrompt(prompt);
            promptDispatch({ field: 'searchTerm', value: '' });
        }

        if (selectedAssistant && prompt?.data?.assistant?.definition.assistantId === selectedAssistant.definition.assistantId) homeDispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT }); 
        
        if (isAssistant(prompt) && canDelete ){
           const assistant = getAssistant(prompt);
           if (assistant && assistant.assistantId){
               setLoadingMessage("Deleting assistant...");
               try {
                   const result = await deleteAssistant(assistant.assistantId);
                   if(!result){
                       setLoadingMessage("");
                       alert("Failed to delete assistant. Please try again.");
                       return;
                   }
               } catch (e) {
                   setLoadingMessage("");
                   alert("Failed to delete assistant. Please try again.");
                   return;
               }
               setLoadingMessage("");
           }
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

    const handleDragStart = (e: DragEvent<HTMLButtonElement>, prompt: Prompt) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('prompt', JSON.stringify(prompt));
        }
    };

    const handleCopy = () => {
        const newPrompt = { ...prompt, id: uuidv4(), name: prompt.name + ' (copy)' };
        if (isBase) newPrompt.folderId = null;
        
        handleAddPrompt(newPrompt);
    }

    const getIcon = (prompt: Prompt) => {
        if (prompt.data && prompt.data.assistant) {
            return (<IconRobot size={18} />);
        }
        else if (prompt.type === "automation") {
            return (<IconApiApp size={18} />);
        }
        else {
            return (<IconMessage2 size={18} />);
        }
    }


    useEffect(() => {
        if (isRenaming) {
            setIsDeleting(false);
        } else if (isDeleting) {
            setIsRenaming(false);
        }
    }, [isRenaming, isDeleting]);

    useEffect(() => {
        setIsChecked((checkedItems.includes(prompt) ? true : false)); 
    }, [checkedItems]);

    const handleCheckboxChange = (checked: boolean) => {
        if (checked){
          homeDispatch({field: 'checkedItems', value: [...checkedItems, prompt]}); 
        } else {
          homeDispatch({field: 'checkedItems', value: checkedItems.filter((i:any) => i !== prompt)});
        }
    }

    // @ts-ignore
    // @ts-ignore
    return (
        <div className="relative flex items-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsDeleting(false);
                setIsRenaming(false);
                setRenameValue('');
                setIsHovered(false)
            }
            }
        >

            <div id="promptEncompass" className="relative flex w-full">
                <button
                    className="w-full  cursor-pointer p-1 items-center gap-1 rounded-lg p-2 text-sm transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-[#343541]/90"
                    draggable={prompt.id.startsWith("astg") || isBase ? false : true} 
                    onClick={(e) => {
                        e.stopPropagation();

                        if (isAssistant(prompt) && prompt.data && prompt.data.assistant){
                            console.log("Updating assistant...")
                            handleStartConversation(prompt);
                        } else {
                            //setShowModal(true);
                            handleStartConversation(prompt);
                        }
                    }}
                    onDragStart={(e) => handleDragStart(e, prompt)}
                    title="Use Template"
                    id={isAssistant(prompt) ? "assistantClick" : "promptClick"}
                >
                    {/*<IconEdit size={18} />*/}

                    <div className="relative flex items-center overflow-hidden text-left text-[12.5px] leading-3">
                        <div className="pr-2">
                            {getIcon(prompt)}
                        </div>
                        <div
                            id={isAssistant(prompt) ? "assistantName" : "promptName"}
                            className="overflow-hidden flex-1 text-ellipsis whitespace-nowrap break-all text-left text-[12.5px] leading-4">
                            {prompt.name}
                        </div>
                    </div>

                </button>

                { checkPrompts && !groupId && !isBase &&  ( //&& !isReserved
                    <div className="relative flex items-center">
                        <div key={prompt.id} className="absolute right-4 z-10">
                            <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleCheckboxChange(e.target.checked)}
                            />
                        </div>
                    </div>
                )}

                {isHovered && !checkPrompts &&
                    <div
                        className="absolute top-1 right-0 flex-shrink-0 flex flex-row items-center space-y-0 bg-neutral-200 dark:bg-[#343541]/90 rounded">

                        {!isDeleting && !isRenaming && canCopy && (
                            <ActionButton handleClick={handleCopy} title="Duplicate Template" id="duplicateTemplate"> 
                                <IconCopy size={18} />
                            </ActionButton>
                        )}

                        {(!isDeleting && !isRenaming && canEdit && !isBase) &&
                         (groupId ? !syncingPrompts && featureFlags.assistantAdminInterface : true) && (
                            <ActionButton title="Edit Template" id="editTemplate"
                                handleClick={() => {
                                    if (groupId) {
                                        //show admin on ast 
                                        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', 
                                                                            { detail: { isOpen: true, 
                                                                                        data: { 
                                                                                            group: groups.find((g:Group) => g.id === groupId),
                                                                                            assistant: prompt
                                                                                        } 
                                                                                      }} ));
                                    } else {
                                        setShowModal(true)
                                    }
                                }} 
                            > 
                                <IconEdit size={18} />
                            </ActionButton>
                        )}
                        {!isDeleting && !isRenaming && !canEdit && !groupId && ( // && !isReserved
                            <ActionButton handleClick={() => setShowModal(true)} title="View Template">
                                <IconEye size={18} />
                            </ActionButton>
                        )}

                        {!isDeleting && !isRenaming && canShare && (
                            <ActionButton handleClick={() => {
                                handleSharePrompt(prompt);
                            }} title="Share Template" id="shareTemplate">
                                <IconShare size={18} />
                            </ActionButton>
                        )}

                        {!isDeleting && !isRenaming && !groupId && !isBase &&( //&& !isReserved 
                            <ActionButton handleClick={handleOpenDeleteModal} title="Delete Template" id="deleteTemplate">
                                <IconTrash size={18} />
                            </ActionButton>
                        )}

                        {(isDeleting || isRenaming) && (
                            <>
                                <ActionButton handleClick={handleDelete} title="Confirm" id="confirm">
                                    <IconCheck size={18} />
                                </ActionButton>

                                <ActionButton handleClick={handleCancelDelete} title="Cancel" id="cancel">
                                    <IconX size={18} />
                                </ActionButton>
                            </>
                        )}

                    </div>
                }

            </div>

            {showModal && !isAssistant(prompt) && (
                <PromptModal
                    prompt={prompt}
                    onCancel={() => setShowModal(false)}
                    onSave={() => setShowModal(false)}
                    onUpdatePrompt={handleUpdate}
                />
            )}

            {showModal && isAssistant(prompt) && (
                <AssistantModal
                    assistant={prompt}
                    onCancel={() => setShowModal(false)}
                    onSave={() => setShowModal(false)}
                    onUpdateAssistant={async (assistantPrompt) => {
                        handleUpdateAssistantPrompt(assistantPrompt, promptsRef.current, homeDispatch)
                        statsService.editPromptCompletedEvent(assistantPrompt);
                    }}
                    loadingMessage="Updating assistant..."
                    loc="edit_assistant"
                    disableEdit={!canEdit}
                />
            )}

           
        </div>
    );
};

import {FolderInterface} from "@/types/folder";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation} from "@/types/chat";
import React, {FC, useContext, useEffect, useRef, useState} from "react";
import {Prompt} from "@/types/prompt";
import {createExport} from "@/utils/app/importExport";
import {shareItems} from "@/services/shareService";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {useSession} from "next-auth/react";
import { EmailsList } from "../Emails/EmailsList";
import toast from "react-hot-toast";
import { ItemSelect } from "../ReusableComponents/ItemsSelect";
import { baseAssistantFolder, isBaseFolder, isBasePrompt } from "@/utils/app/basePrompts";
import { Modal } from "../ReusableComponents/Modal";
import { IconNote } from "@tabler/icons-react";

export interface SharingModalProps {
    open: boolean;
    onShare: (selectedItems: Array<Prompt | Conversation | FolderInterface>) => void;
    onCancel: () => void;
    includeConversations: boolean;
    includePrompts: boolean;
    includeFolders: boolean;
    selectedPrompts?: Prompt[];
    selectedConversations?: Conversation[];
    selectedFolders?: FolderInterface[];
}

const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 4rem;
  animation: ${animate} 2s infinite;
`;

export const ShareAnythingModal: FC<SharingModalProps> = (
    {
        open,
        onShare,
        onCancel,
        includePrompts,
        includeConversations,
        includeFolders,
        selectedPrompts = [],
        selectedConversations = [],
        selectedFolders = []
    }) => {
    const {
        state: {prompts, conversations, folders, statsService},
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const { data: session } = useSession();
    const user = session?.user;

    // Individual states for selected prompts, conversations, and folders
    const [isSharing, setIsSharing] = useState(false);
    const [selectedPromptsState, setSelectedPrompts] = useState<Prompt[]>([]);
    const [selectedConversationsState, setSelectedConversations] = useState<Conversation[]>([]);
    const [selectedFoldersState, setSelectedFolders] = useState<FolderInterface[]>([]);
    const [selectedPeople, setSelectedPeople] = useState<Array<string>>([]);
    const [sharingNote, setSharingNote] = useState<string>("");

    const [canShare, setCanShare] = useState<boolean>(false);

    useEffect(() => {
        if (open) {
            setSelectedPrompts([...selectedPrompts]);
            setSelectedConversations([...selectedConversations]);
            setSelectedFolders([...selectedFolders]);
        }
    }, [open]);

    const checkCanShare = () => {
        return selectedPeople.length > 0 && (sharingNote && sharingNote?.length > 0) &&
               (selectedPromptsState.length > 0 || selectedConversationsState.length > 0 || selectedFoldersState.length > 0);
    }

    useEffect(() => {
        setCanShare(!!checkCanShare());
    }, [selectedPeople, sharingNote, selectedPromptsState, selectedConversationsState, selectedFoldersState]);

    const handleShare = async () => {
        //onSave(selectedItems);
        setIsSharing(true);

        // Go through the prompts and look for ones that have a value for prompt.data.rootPromptId and
        // automatically find those prompts and add them to the list of prompts to share if they are not already there
        // This is necessary because the root prompt is needed for the prompt to work properly.
        const rootPromptsToAdd = selectedPromptsState.filter(prompt => {
            if (prompt.data && prompt.data.rootPromptId) {
                // @ts-ignore
                const rootPrompt = promptsRef.current.find(p => p.id === prompt.data.rootPromptId);
                if (rootPrompt && !selectedPromptsState.some(p => p.id === rootPrompt.id)) {
                    return true;
                }
            }
            return false;
        })
            .map(prompt => prompt.data?.rootPromptId)
            .map(id => promptsRef.current.find((p:Prompt) => p.id === id))
            .filter(prompt => prompt !== undefined) as Prompt[];
        
        const sharedData = await createExport(
            selectedConversationsState,
            selectedFoldersState,
            [...selectedPromptsState.map(p => {
                delete p.data?.workflowTemplateId;
                delete p.data?.emailEvents?.tag;
                return p;
            }),
             ...rootPromptsToAdd], "share", false);
        
        const sharedWith = [...selectedPeople];
        const sharedBy = user?.email ? user.email.toLowerCase() : undefined;


        if (sharedBy && sharingNote) {
            try {
                const result = await shareItems(sharedBy, sharedWith, sharingNote, sharedData);

                if (result.success) {
                    statsService.sharedItemEvent(sharedBy, sharedWith, sharingNote, sharedData);

                    setIsSharing(false);
                    toast("Shared successfully");
                    onShare([...selectedPromptsState, ...selectedConversationsState, ...selectedFoldersState]);
                } else {
                    setIsSharing(false);
                    alert("Sharing failed, please try again.");
                }
            } catch (e) {
                setIsSharing(false);
                alert("Sharing failed, please try again.");
            }
        }

    }


    if (!open) {
        return <></>;
    }


    return (
        <Modal 
            width={() => window.innerWidth * (!isSharing ?  0.5 : 0.3)}
            height={() => !isSharing ? window.innerHeight * 0.9 : 280}
            title={!isSharing ? "Add People to Share With": ""}
            onCancel={onCancel} 
            showCancel={!isSharing}
            onSubmit={handleShare}
            submitLabel={"Share"}
            disableSubmit={!canShare}
            showSubmit={!isSharing}
            resizeOnVarChange={isSharing}
            content={
                <>
                 {isSharing ? (
                    <div className="flex flex-col items-center justify-center pb-2 border-b">
                        <LoadingIcon/>
                        <span className="text-black dark:text-white text-xl font-bold mt-4">Sharing...</span>
                    </div>) :

                    ( <div className="overflow-y-auto">

                        <EmailsList label={"People"}
                                    addMessage={"Email addresses of people to share with:"}
                                    emails={selectedPeople}
                                    setEmails={setSelectedPeople}/>


                        <div className="mr-8">
                            <h3 className="flex flex-row text-black dark:text-white text-lg mt-2 border-b ">
                                <IconNote className="mt-1.5 mx-2" size={18}/>
                                Note
                            </h3>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={
                                    "Describe what you are sharing (required)."
                                }
                                value={sharingNote || ''}
                                onChange={(e) => setSharingNote(e.target.value)}
                                rows={1}
                            />

                            <ItemSelect
                                scrollToFirstSelected={(+includePrompts + +includeConversations + +includeFolders) === 1}
                                selectedPromptsState={selectedPromptsState}
                                setSelectedPrompts={setSelectedPrompts}
                                includePrompts={includePrompts}                                                                 
                                promptFilter={ (p:Prompt[]) =>  p.filter((prompt:Prompt) => (!prompt?.data?.noShare) && 
                                                                                                !prompt.groupId && !isBasePrompt(prompt.id) ) }
                    
                                selectedConversationsState={selectedConversationsState}
                                setSelectedConversations={setSelectedConversations}
                                includeConversations={includeConversations}
                            
                                selectedFoldersState={selectedFoldersState}
                                setSelectedFolders={setSelectedFolders}
                                includeFolders={includeFolders}
                                folderFilter={(f:FolderInterface[]) => f.filter((folder:FolderInterface) => 
                                                                        !isBaseFolder(folder.id) && !folder.isGroupFolder &&
                                                                        folder.id!== baseAssistantFolder.id)}
                            />
                        </div>

                    </div>
                )}

                </>
            }
        />

    );
};
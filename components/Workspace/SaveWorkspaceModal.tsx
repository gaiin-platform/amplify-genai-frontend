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
import toast from "react-hot-toast";

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
    editable: boolean;
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

export const SaveWorkspaceModal: FC<SharingModalProps> = (
    {
        open,
        onShare,
        onCancel,
        includePrompts,
        includeConversations,
        includeFolders,
        selectedPrompts = [],
        selectedConversations = [],
        selectedFolders = [],
        editable
    }) => {
    const {
        state: {prompts, conversations, folders, workspaceMetadata},
        dispatch: homeDispatch
    } = useContext(HomeContext);

    
    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
    }, [prompts]);

    
    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    

    let currentWorkspaceMetadata = workspaceMetadata;

    if(!workspaceMetadata) {
        currentWorkspaceMetadata = {
            name: "",
            description: "",
            tags: [],
            id: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            data:{},
        }
    }


    const { data: session } = useSession();
    const user = session?.user;

    // Individual states for selected prompts, conversations, and folders
    const [isSharing, setIsSharing] = useState(false);
    const [selectedPromptsState, setSelectedPrompts] = useState([...selectedPrompts]);
    const [selectedConversationsState, setSelectedConversations] = useState([...selectedConversations]);
    const [selectedFoldersState, setSelectedFolders] = useState([...selectedFolders]);
    const [sharingNote, setSharingNote] = useState<string>(currentWorkspaceMetadata.name || '');
    const itemRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});
    const [promptsChecked, setPromptsChecked] = useState(false);
    const [conversationsChecked, setConversationsChecked] = useState(false);
    const [foldersChecked, setFoldersChecked] = useState(false);

    const handlePromptsCheck = (checked:boolean) => {
        // if checked, add all prompts to selected, else remove them
        //setSharingNote(currentWorkspaceMetadata.name);
        setSelectedPrompts(checked ? promptsRef.current: []);
        setPromptsChecked(checked);
    };

    const handleConversationsCheck = (checked:boolean) => {
        setSelectedConversations(checked ? conversationsRef.current : []);
        setConversationsChecked(checked);
    };

    const handleFoldersCheck = (checked:boolean) => {
        setSelectedFolders(checked ? foldersRef.current: []);
        setFoldersChecked(checked);
    };

    useEffect(() => {
        handleConversationsCheck(true);
        handleFoldersCheck(true);
        handlePromptsCheck(true);
    }, [open]);

    const handleItemSelect = (item: Prompt | Conversation | FolderInterface, itemType: string) => {
        switch (itemType) {
            case 'Prompt': {
                setSelectedPrompts(prevItems => toggleItem(prevItems, item as Prompt));
                break;
            }
            case 'Conversation': {
                setSelectedConversations(prevItems => toggleItem(prevItems, item as Conversation));
                break;
            }
            case 'Folder': {
                const folder = item as FolderInterface;
                if (selectedFoldersState.some(i => i.id === folder.id)) {
                    // If the folder is currently selected, we are deselecting it
                    if (folder.type === 'prompt') {
                        setSelectedPrompts(prevPrompts => prevPrompts.filter(p => p.folderId !== folder.id));
                    } else if (folder.type === 'chat') {
                        setSelectedConversations(prevConversations => prevConversations.filter(c => c.folderId !== folder.id));
                    }
                } else {
                    // If the folder is currently deselected, we are selecting it
                    if (folder.type === 'prompt') {
                        const folderPrompts = promptsRef.current.filter((prompt:Prompt) => prompt.folderId === folder.id);
                        setSelectedPrompts(prevPrompts => [...prevPrompts, ...folderPrompts]);
                    } else if (folder.type === 'chat') {
                        const folderConversations = conversationsRef.current.filter((conversation:Conversation) => conversation.folderId === folder.id);
                        setSelectedConversations(prevConversations => [...prevConversations, ...folderConversations]);
                    }
                }

                setSelectedFolders(prevItems => toggleItem(prevItems, folder));

                break;
            }
            default:
                return;
        }
    }

    const toggleItem = <T, >(items: Array<T>, item: T) => {
        return items.some(i => i === item) ? items.filter(i => i !== item) : [...items, item];
    }

    const canShare = () => {

        return (selectedPromptsState.length > 0 || selectedConversationsState.length > 0 || selectedFoldersState.length > 0)
            && (sharingNote && sharingNote?.length > 0);
    }

    const handleShare = async () => {

        if(user?.email) {
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
                [...selectedPromptsState, ...rootPromptsToAdd], "save", false);

            const sharedWith = [user?.email];
            const sharedBy = user?.email;

            if (sharedBy && sharingNote) {
                try {
                    const result = await shareItems(sharedBy, sharedWith, sharingNote, sharedData);
                   
                    if (result.success) {
                        setIsSharing(false);
                        toast("Saved successfully");
                        homeDispatch({field: 'workspaceDirty', value: false});
                        onShare([...selectedPromptsState, ...selectedConversationsState, ...selectedFoldersState]);
                    } else {
                        setIsSharing(false);
                        alert("Saving failed, please try again.");
                    }
                } catch (e) {
                    setIsSharing(false);
                    alert("Saving failed, please try again.");
                }
            }
        }

        //onShare([...selectedPromptsState, ...selectedConversationsState, ...selectedFoldersState]);
    }

    const isSelected = (item: { id: string; }, itemType: string) => {
        switch (itemType) {
            case 'Prompt':
                return selectedPromptsState.some(selectedItem => selectedItem.id === item.id);
            case 'Conversation':
                return selectedConversationsState.some(selectedItem => selectedItem.id === item.id);
            case 'Folder':
                return selectedFoldersState.some(selectedItem => selectedItem.id === item.id);
            default:
                return false;
        }
    };

    // Add necessary useEffects

    const renderItem = (item: Prompt | Conversation | FolderInterface, itemType: string) => {


        // Create a new ref for each item if it does not exist yet.
        if (!itemRefs.current[item.id]) {
            itemRefs.current[item.id] = React.createRef();
        }

        return (
            <div className="flex items-center p-2" ref={itemRefs.current[item.id]} key={item.id}>
                <input
                    type="checkbox"
                    className="form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                    checked={isSelected(item, itemType)}
                    onChange={() => {
                        handleItemSelect(item, itemType)
                    }}
                />
                <div className="ml-2 text-black dark:text-white ">{`${itemType} : ${item.name}`}</div>
            </div>
        );
    };

    const renderScrollableSection = (items: Array<Prompt | Conversation | FolderInterface>, itemType: string) => {
        return (
            <div style={{height: "100px", overflowY: "scroll"}}>
                {items.map((item) =>
                    renderItem(item, itemType)
                )}
            </div>
        );
    };

    useEffect(() => {
        if (open) {
            const firstSelectedId =
                selectedPrompts[0]?.id || selectedConversations[0]?.id || selectedFolders[0]?.id;

            // @ts-ignore
            itemRefs.current[firstSelectedId]?.current?.scrollIntoView({
                block: 'center',
            });

            //setSelectedPrompts([...selectedPrompts]);
            //setSelectedConversations([...selectedConversations]);
            //setSelectedFolders([...selectedFolders]);
        }
    }, [open]);

    function extractEmails(inputText: string): string[] {
        const regex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const emails = inputText.match(regex);
        return emails ?? [];  // return an empty array if no emails found.
    }


    if (!open) {
        return <></>;
    }


    // ...Other Code...

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div
                    className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"/>
                    <div
                        className="border-neutral-400 dark:border-neutral-600 inline-block transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 py-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-w-lg sm:p-6 sm:align-middle"
                        role="dialog"
                    >
                        {isSharing && (
                            <div className="flex flex-col items-center justify-center">
                                <LoadingIcon/>
                                <span className="text-black dark:text-white text-xl font-bold mt-4">Saving...</span>
                            </div>
                        )}

                        {!isSharing && (
                            <>
                                <h2 className="text-black dark:text-white text-xl font-bold">Save Workspace</h2>

                                <div className="overflow-y-auto" style={{maxHeight: "calc(100vh - 200px)"}}>

                                    {/*<TagsList label={"Tags"}*/}
                                    {/*          addMessage={"Tags for the Workspace:"}*/}
                                    {/*          tagParser={extractEmails}*/}
                                    {/*          tags={selectedPeople}*/}
                                    {/*          setTags={setSelectedPeople}/>*/}


                                    <h3 className="text-black dark:text-white text-lg mt-2 border-b">Workspace Name</h3>
                                    <textarea
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        style={{resize: 'none'}}
                                        placeholder={
                                            "Describe the workspace (required)."
                                        }
                                        value={sharingNote || ''}
                                        onChange={(e) => setSharingNote(e.target.value)}
                                        rows={1}
                                    />



                                    {includePrompts && editable && (
                                        <>
                                            <div className="mt-3 flex items-center border-b">
                                                <input
                                                    type="checkbox"
                                                    className="mx-2 form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                                                    checked={promptsChecked}
                                                    onChange={(e) => handlePromptsCheck(e.target.checked)}
                                                />
                                                <h3 className="ml-2 text-black dark:text-white text-lg">Prompts</h3>
                                            </div>
                                            {renderScrollableSection(promptsRef.current, 'Prompt')}
                                        </>
                                    )}

                                    {includeConversations && editable && (
                                        <>
                                            <div className="mt-3 flex items-center border-b ">

                                                <input
                                                    type="checkbox"
                                                    className="mx-2 form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                                                    checked={conversationsChecked}
                                                    onChange={(e) => handleConversationsCheck(e.target.checked)}
                                                />
                                                <h3 className="ml-2 text-black dark:text-white text-lg">Conversations</h3>
                                            </div>
                                            {renderScrollableSection(conversationsRef.current, 'Conversation')}
                                        </>
                                    )}

                                    {includeFolders && editable && (
                                        <>
                                            <div className="mt-3 flex items-center border-b ">

                                                <input
                                                    type="checkbox"
                                                    className="mx-2 form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                                                    checked={foldersChecked}
                                                    onChange={(e) => handleFoldersCheck(e.target.checked)}
                                                />
                                                <h3 className="ml-2 text-black dark:text-white text-lg">Folders</h3>
                                            </div>
                                            {renderScrollableSection(foldersRef.current, 'Folder')}
                                        </>
                                    )}

                                </div>
                            </>
                        )}

                        <div className="pt-4 flex justify-end items-center">

                            <button
                                type="button"
                                className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            {!isSharing && (
                                <button
                                    type="button"
                                    style={{opacity: !canShare() ? 0.3 : 1}}
                                    className="ml-2 w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300 ${selectedPeople.length === 0 || (selectedPromptsState.length === 0 && selectedConversationsState.length === 0 && selectedFoldersState.length === 0) ? 'cursor-not-allowed' : ''}"
                                    onClick={handleShare}
                                    disabled={!canShare()}
                                >
                                    Save
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
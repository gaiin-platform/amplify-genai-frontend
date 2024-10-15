import {FolderInterface} from "@/types/folder";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation} from "@/types/chat";
import React, {FC, useContext, useEffect, useRef, useState} from "react";
import {Prompt} from "@/types/prompt";
import {TagsList} from "@/components/Chat/TagsList";
import {createExport} from "@/utils/app/importExport";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {getCategories, getCategory, publish} from "@/services/marketService";
import {v4} from "uuid";
import {useSession} from "next-auth/react";
import { getDate } from "@/utils/app/date";
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

export const ShareAnythingToMarketModal: FC<SharingModalProps> = (
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


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);


    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);




    const { data: session } = useSession();
    const user = session?.user;

    // Individual states for selected prompts, conversations, and folders
    const [isPublishing, setIsPublishing] = useState(false);
    const [selectedPromptsState, setSelectedPrompts] = useState([...selectedPrompts]);
    const [selectedConversationsState, setSelectedConversations] = useState([...selectedConversations]);
    const [selectedFoldersState, setSelectedFolders] = useState([...selectedFolders]);
    const [selectedTags, setSelectedTags] = useState<Array<string>>([]);
    const [publishedDescription, setPublishedDescription] = useState<string>("");
    const itemRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});
    const [promptsChecked, setPromptsChecked] = useState(false);
    const [conversationsChecked, setConversationsChecked] = useState(false);
    const [foldersChecked, setFoldersChecked] = useState(false);
    const [publishingName, setPublishingName] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [allowedCategories, setAllowedCategories] = useState<Array<{name:string, category:string}>>([]);

    const getSubCategories = async (category:string)  => {
        return await getCategory(category);
    }

    const handlePromptsCheck = (checked:boolean) => {
        // if checked, add all prompts to selected, else remove them
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
                        const folderConversations = conversationsRef.current.filter((conversation:Conversation)=> conversation.folderId === folder.id);
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

    const canPublish = () => {

        return publishingName.length > 3
            && (selectedPromptsState.length > 0 || selectedConversationsState.length > 0 || selectedFoldersState.length > 0)
            && (publishedDescription && publishedDescription?.length > 0)
            && (selectedCategory && selectedCategory?.length > 0)
    }

    const handlePublish = async () => {
        //onSave(selectedItems);
        setIsPublishing(true);

        // Go through the prompts and look for ones that have a value for prompt.data.rootPromptId and
        // automatically find those prompts and add them to the list of prompts to share if they are not already there
        // This is necessary because the root prompt is needed for the prompt to work properly.
        const rootPromptsToAdd = selectedPromptsState.filter(prompt => {
            if (prompt.data && prompt.data.rootPromptId) {
                // @ts-ignore
                const rootPrompt = promptsRef.current.find((p:Prompt) => p.id === prompt.data.rootPromptId);
                if (rootPrompt && !selectedPromptsState.some((p:Prompt) => p.id === rootPrompt.id)) {
                    return true;
                }
            }
            return false;
        })
            .map(prompt => prompt.data?.rootPromptId)
            .map(id => promptsRef.current.find((p:Prompt) => p.id === id))
            .filter(prompt => prompt !== undefined) as Prompt[];


        const newPromptFolder:FolderInterface = {
            id: v4(),
            date: getDate(),
            name: "Mkt: "+publishingName,
            type: "prompt"
        }

        const newConversationsFolder:FolderInterface = {
            id: v4(),
            date: getDate(),
            name: "Mkt: "+publishingName,
            type: "chat"
        }

        const allPrompts = [...selectedPromptsState, ...rootPromptsToAdd].map(
            prompt => {
                return {
                    ...prompt,
                    folderId: newPromptFolder.id
                }
            }
        );

        const allConversations = selectedConversationsState.map(
            conversation => {
                return {
                    ...conversation,
                    folderId: newConversationsFolder.id
                }
            });

        const foldersToAdd = [];
        if(allPrompts.length > 0) {
            foldersToAdd.push(newPromptFolder);
        }
        if(allConversations.length > 0) {
            foldersToAdd.push(newConversationsFolder);
        }

        const sharedData = await createExport(
            allConversations,
            foldersToAdd,
            allPrompts, "market publish"); // may need parameter  ,false 


        if (publishingName && publishedDescription) {
            try {
                const result = await publish(publishingName,
                    publishedDescription,
                    selectedCategory,
                    selectedTags,
                    sharedData);

                if (result.success) {

                    statsService.marketItemPublishEvent(
                        publishingName,
                        publishedDescription,
                        selectedCategory,
                        selectedTags,
                        sharedData
                    );

                    setIsPublishing(false);
                    toast("Published successfully");
                    onShare([...selectedPromptsState, ...selectedConversationsState, ...selectedFoldersState]);
                } else {
                    setIsPublishing(false);
                    alert("Publishing failed, please try again.");
                }
            } catch (e) {
                setIsPublishing(false);
                alert("Publishing failed, please try again.");
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
            <div>
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

            setSelectedPrompts([...selectedPrompts]);
            setSelectedConversations([...selectedConversations]);
            setSelectedFolders([...selectedFolders]);

            try {
                getCategories().then((categories) => {
                    try {
                        const base = {category: "", name: "Please select a category"};
                        setAllowedCategories([base, ...categories.data]);
                        setSelectedCategory(base.category);
                    } catch (e) {
                        alert("Unable to reach the market. Please try again later.");
                    }
                });
            }catch (e) {
                alert("Unable to reach the market. Please try again later.");
            }
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
                        className="border-neutral-400 dark:border-neutral-600 inline-block transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 py-5 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:max-w-lg sm:p-6 sm:align-middle"
                        role="dialog"
                    >
                        {isPublishing && (
                            <div className="flex flex-col items-center justify-center">
                                <LoadingIcon/>
                                <span className="text-black dark:text-white text-xl font-bold mt-4">Publishing to Market...</span>
                            </div>
                        )}

                        {!isPublishing && (
                            <>
                                <h2 className="text-black dark:text-white text-xl font-bold">Publish to the Market</h2>

                                <div className="overflow-y-auto" style={{maxHeight: "calc(100vh - 200px)"}}>

                                    <h3 className="text-black dark:text-white text-lg mt-2 border-b">Name</h3>
                                    <textarea
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        style={{resize: 'none'}}
                                        placeholder={
                                            "Provide a concise name for what you are publishing (required)."
                                        }
                                        value={publishingName || ''}
                                        onChange={(e) => setPublishingName(e.target.value)}
                                        rows={1}
                                    />

                                    <h3 className="text-black dark:text-white text-lg mt-2 border-b">Description</h3>
                                    <textarea
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        style={{resize: 'none'}}
                                        placeholder={
                                            "Describe what you are publishing in 2-3 sentences (required)."
                                        }
                                        value={publishedDescription || ''}
                                        onChange={(e) => setPublishedDescription(e.target.value)}
                                        rows={2}
                                    />

                                    <h3 className="text-black dark:text-white text-lg mt-2 border-b">Category</h3>
                                    <div className="flex flex-col p-2">

                                        <select
                                                value={selectedCategory}
                                                onChange={(e) => {
                                                    const newCategory = e.target.value;
                                                    setSelectedCategory(newCategory);
                                                }}
                                                className="text-black text-lg mt-2 rounded">
                                            {allowedCategories.map((option, index) => (
                                                <option key={option.category} value={option.category}>{option.name}</option>
                                            ))}
                                        </select>

                                        <TagsList label={"Add Tags"}
                                                  addMessage={"Tags to help people find this:"}
                                                  tags={selectedTags}
                                                  setTags={setSelectedTags}/>
                                    </div>

                                    <h3 className="text-black dark:text-white text-lg mt-3 mb-2 border-b">Select What to Publish</h3>
                                    <div style={{height: "150px", overflowY: "scroll"}}>

                                    {includePrompts && (
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

                                    {includeConversations && (
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

                                    {includeFolders && (
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

                                </div>
                            </>
                        )}

                        <div className="pt-4 flex justify-end items-center border-t border-gray-200">

                            <button
                                type="button"
                                className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            {!isPublishing && (
                                <button
                                    type="button"
                                    style={{opacity: !canPublish() ? 0.3 : 1}}
                                    className="ml-2 w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300 ${selectedPeople.length === 0 || (selectedPromptsState.length === 0 && selectedConversationsState.length === 0 && selectedFoldersState.length === 0) ? 'cursor-not-allowed' : ''}"
                                    onClick={handlePublish}
                                    disabled={!canPublish()}
                                >
                                    Publish
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
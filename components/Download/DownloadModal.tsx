import {FolderInterface} from "@/types/folder";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message} from "@/types/chat";
import React, {FC, useContext, useEffect, useRef, useState} from "react";
import {Prompt} from "@/types/prompt";
import {createExport} from "@/utils/app/importExport";
import { useSession } from "next-auth/react"
import {IconDownload} from '@tabler/icons-react';
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {ConversionOptions, convert} from "@/services/downloadService";

export interface DownloadModalProps {
    onDownloadReady: (url: string) => void;
    onCancel: () => void;
    includeConversations: boolean;
    includePrompts: boolean;
    includeFolders: boolean;
    selectedPrompts?: Prompt[];
    selectedConversations?: Conversation[];
    selectedFolders?: FolderInterface[];
    selectedMessages?: Message[];
    showHeaders?: boolean;
    showInclude?: boolean;
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

export const DownloadModal: FC<DownloadModalProps> = (
    {
        onDownloadReady,
        onCancel,
        includePrompts,
        includeConversations,
        includeFolders,
        selectedPrompts = [],
        selectedConversations = [],
        selectedFolders = [],
        selectedMessages= [],
        showHeaders= true,
        showInclude = true,
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
    const [isSharing, setIsDownloading] = useState(false);
    const [includeConversationName, setIncludeConversationName] = useState(false);
    const [selectedPromptsState, setSelectedPrompts] = useState([...selectedPrompts]);
    const [selectedMessagesState, setSelectedMessagesState] = useState<Message[]>([...selectedMessages]);
    const [selectedConversationsState, setSelectedConversations] = useState([...selectedConversations]);
    const [selectedFoldersState, setSelectedFolders] = useState([...selectedFolders]);
    const [downloadUrl, setDownloadUrl] = useState<string|null>(null);

    const [format, setFormat] = useState<string>("docx");
    const [includeMode, setIncludeMode] = useState<string>("assistant");
    const [conversationHeader, setConversationHeader] = useState<string>("# ");
    const [userMessageHeader, setUserMessageHeader] = useState<string>("");
    const [assistantMessageHeader, setAssistantMessageHeader] = useState<string>("");
    const [messageHeader, setMessageHeader] = useState<string>("");
    const itemRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});
    const [promptsChecked, setPromptsChecked] = useState(false);
    const [conversationsChecked, setConversationsChecked] = useState(false);
    const [foldersChecked, setFoldersChecked] = useState(false);

    const powerPointTemplateOptions = [
        "none",
        "vanderbilt_1.pptx",
        "celestial.pptx",
        "frame.pptx",
        "gallery.pptx",
        "integral.pptx",
        "ion.pptx",
        "parcel.pptx",
        "vapor.pptx",
        "vusn.pptx",
    ];

    const wordTemplateOptions = [
        "none",
    ];
    const shadow = "rounded p-0.5 shadow-[1px_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]";

    const [templateSelection, setTemplateSelection] = useState<string>(wordTemplateOptions[0]);
    const [templateOptions, setTemplateOptions] = useState<string[]>(wordTemplateOptions);

    const handlePromptsCheck = (checked: boolean) => {
        // if checked, add all prompts to selected, else remove them
        setSelectedPrompts(checked ? promptsRef.current : []);
        setPromptsChecked(checked);
    };

    const handleConversationsCheck = (checked: boolean) => {
        setSelectedConversations(checked ? conversationsRef.current : []);
        setConversationsChecked(checked);
    };

    const handleFoldersCheck = (checked: boolean) => {
        setSelectedFolders(checked ? foldersRef.current : []);
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
        return (selectedPromptsState.length > 0 || selectedConversationsState.length > 0 || selectedFoldersState.length > 0);
    }

    const handleDownload = async () => {
        //onSave(selectedItems);
        setIsDownloading(true);

        try {
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
                .map((prompt:Prompt) => prompt.data?.rootPromptId)
                .map(id => promptsRef.current.find((p:Prompt) => p.id === id))
                .filter(prompt => prompt !== undefined) as Prompt[];

            let exportedConversations:Conversation[] = [];

            if(selectedMessagesState.length > 0
                && selectedConversationsState
                && selectedConversationsState.length > 0){
                exportedConversations = [
                    {...selectedConversations[0], messages: [...selectedMessagesState]}
                ]
            }
            else {
                exportedConversations = selectedConversationsState.map(conversation => {
                    let includedMessages: Message[];

                    switch (includeMode) {
                        case "assistant":
                            includedMessages = conversation.messages.filter(message => message.role === 'assistant');
                            break;

                        case "user":
                            includedMessages = conversation.messages.filter(message => message.role === 'user');
                            break;

                        case "all":
                            includedMessages = conversation.messages;
                            break;

                        case "starred":
                            includedMessages = conversation.messages.filter((message, index) => {
                                if (message.data && message.data.rating) {
                                    return true;
                                } else if (message.role === 'user' && conversation.messages.length > index + 1) {
                                    const next = conversation.messages[index + 1];
                                    return next.role === 'assistant' && next.data && next.data.rating;
                                } else {
                                    return false;
                                }
                            });
                            break;

                        case "starred_assistant":
                            includedMessages = conversation.messages.filter(message => message.role === "assistant" && message.data && message.data.rating);
                            break;

                        case "starred_user":
                            includedMessages = conversation.messages.filter(message => message.role === "user" && message.data && message.data.rating);
                            break;

                        default:
                            includedMessages = conversation.messages;
                    }

                    return {...conversation, messages: includedMessages};
                });
            }

            const sharedData = await createExport(
                exportedConversations,
                selectedFoldersState,
                [...selectedPromptsState, ...rootPromptsToAdd], "download");

            const withNewline = (s:string) => {
                return s ? s + "\n\n" : s;
            }

            const conversionOptions: ConversionOptions = {
                assistantHeader: withNewline(assistantMessageHeader),
                conversationHeader: withNewline(conversationHeader),
                format: format,
                messageHeader: withNewline(messageHeader),
                userHeader: withNewline(userMessageHeader),
                includeConversationName: includeConversationName
            }

            if(templateSelection !== 'none'){
               conversionOptions.templateName = templateSelection;
            }

            const result = await convert(conversionOptions, await sharedData);

            statsService.downloadItemEvent(conversionOptions, await sharedData);

            let resultArrived = false;
            let triesLeft = 60;

            const checkReady = async (url:string) => {
                try {
                    triesLeft = triesLeft - 1;
                    const result = await fetch(url);
                    if(result.ok){
                        resultArrived = true;
                        setDownloadUrl(url);
                        setIsDownloading(false);
                    }
                    else if(triesLeft > 0){
                        setTimeout(()=>checkReady(url), 1000);
                    }
                    else {
                        alert("Unable to download. Please check your Internet connection and try again.");
                        setIsDownloading(false);
                    }
                } catch (e) {
                    alert("Failed to reach the download service. Please check your Internet connection and try again.");
                    setIsDownloading(false);
                }
            }

            if (result.success) {
                const downloadUrl = result.data.url;
                checkReady(downloadUrl);
            } else {
                alert("Failed to reach the download service. Please check your Internet connection and try again.");
                setIsDownloading(false);
            }

        } catch (e) {
            alert("Failed to reach the download service. Please check your Internet connection and try again.");
            setIsDownloading(false);
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
            <div style={{height: "140px", overflowY: "scroll"}}>
                {items.map((item) =>
                    renderItem(item, itemType)
                )}
            </div>
        );
    };

    useEffect(() => {

        const firstSelectedId =
            selectedPrompts[0]?.id || selectedConversations[0]?.id || selectedFolders[0]?.id;

        // @ts-ignore
        itemRefs.current[firstSelectedId]?.current?.scrollIntoView({
            block: 'center',
        });

        setSelectedPrompts([...selectedPrompts]);
        setSelectedConversations([...selectedConversations]);
        setSelectedFolders([...selectedFolders]);
        setSelectedMessagesState([...selectedMessages]);

    }, []);

    function extractEmails(inputText: string): string[] {
        const regex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const emails = inputText.match(regex);
        return emails ?? [];  // return an empty array if no emails found.
    }


    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div
                    className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"/>
                    <div
                        className="border-neutral-400 dark:border-neutral-600 inline-block transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 py-5 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:p-6 sm:align-middle"
                        role="dialog" style={{width: window.innerWidth / 2}}
                    >
                        {isSharing && (
                            <div className="flex flex-col items-center justify-center">
                                <LoadingIcon/>
                                <span className="text-black dark:text-white text-xl font-bold mt-4">Preparing download...</span>
                            </div>
                        )}
                        {!isSharing && downloadUrl != null && (
                            <div className="flex flex-row items-center justify-center mb-6 text-2xl button">
                                <a href={downloadUrl || ""}
                                   className="bg-blue-500 hover:bg-green-500 text-white font-bold py-2 px-4 rounded"
                                >
                                    <IconDownload size={34}/>
                                    <h1>Click to Download</h1>
                                </a>
                            </div>
                        )}

                        {!isSharing && downloadUrl == null && (
                            <>
                                <h2 className="text-black dark:text-white text-xl font-bold">Download</h2>

                                <div className="overflow-y-auto" style={{maxHeight: "calc(100vh - 200px)"}}>

                                    <h3 className="text-black dark:text-white text-lg mt-2 border-b">Options</h3>


                                    <div className="grid grid-cols-2 w-full items-center p-2 text-black dark:text-white">

                                        <div>Format</div>
                                        <div className="ml-2 rounded w-full text-black pr-2 pt-2">
                                        <select
                                            className={shadow}
                                            onChange={(e) => {
                                                if(e.target.value === 'pptx'){
                                                    setTemplateOptions(powerPointTemplateOptions);
                                                    setTemplateSelection("vanderbilt_1.pptx");
                                                }
                                                else {
                                                    setTemplateOptions(wordTemplateOptions);
                                                }

                                                setFormat(e.target.value);
                                            }}
                                            value={format}
                                        >
                                            <option value="docx">Word</option>
                                            <option value="pptx">PowerPoint</option>
                                        </select>
                                        </div>

                                        <div>Template</div>
                                        <div className="ml-2 rounded w-full text-black pr-2 pt-2">
                                            <select
                                                className={shadow}
                                                onChange={(e) => {
                                                    setTemplateSelection(e.target.value );
                                                }}
                                                value={templateSelection}
                                            >
                                                {templateOptions.map((template,index)=>(
                                                    <option key="index" value={template}>{template}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>Include Conversation Name</div>
                                        <div className="ml-2 rounded w-full text-black pr-2 pt-2">
                                            <select
                                                className={shadow}
                                                onChange={(e) => {
                                                    setIncludeConversationName(e.target.value === 'true');
                                                }}
                                                value={""+includeConversationName}
                                            >
                                                <option value="true">Yes</option>
                                                <option value="false">No</option>
                                            </select>
                                        </div>

                                        {showInclude && (
                                        <div className="mt-2">Include</div>
                                            )}
                                        {showInclude && (
                                        <div className="ml-2 rounded text-black pr-2 pt-2">
                                            <select
                                                className={shadow}
                                                onChange={(e) => {
                                                    setIncludeMode(e.target.value);
                                                }}
                                                value={includeMode}
                                            >
                                                <option value="assistant">Assistant Messages</option>
                                                <option value="user">User Prompts</option>
                                                <option value="all">All Messages & Prompts</option>
                                                <option value="starred">Starred Prompts & Messages</option>
                                                <option value="starred_assistant">Starred Messages</option>
                                                <option value="starred_user">Starred Prompts</option>
                                            </select>
                                        </div>
                                            )}

                                        {showHeaders && (
                                        <div>Conversation Header</div>
                                            )}
                                        {showHeaders && (
                                        <div className="ml-2">
                                            <textarea
                                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                style={{resize: 'none'}}
                                                placeholder={
                                                    "A markdown header to insert at the start of a conversation"
                                                }
                                                value={conversationHeader || ''}
                                                onChange={(e) => setConversationHeader(e.target.value)}
                                                rows={1}
                                            />
                                        </div>
                                            )}


                                        {showHeaders && (
                                        <div>Message Header</div>
                                            )}
                                        {showHeaders && (
                                        <div className="ml-2">
                                            <textarea
                                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                style={{resize: 'none'}}
                                                placeholder={
                                                    ""
                                                }
                                                value={messageHeader || ''}
                                                onChange={(e) => setMessageHeader(e.target.value)}
                                                rows={1}
                                            />
                                        </div>
                                            )}

                                        {showHeaders && (
                                        <div>User Message Header</div>
                                            )}
                                        {showHeaders && (
                                        <div className="ml-2">
                                            <textarea
                                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                style={{resize: 'none'}}
                                                placeholder={
                                                    ""
                                                }
                                                value={userMessageHeader || ''}
                                                onChange={(e) => setUserMessageHeader(e.target.value)}
                                                rows={1}
                                            />
                                        </div>
                                            )}
                                        {showHeaders && (
                                        <div>Assistant Header</div>
                                            )}
                                        {showHeaders && (
                                        <div className="ml-2">
                                            <textarea
                                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                style={{resize: 'none'}}
                                                placeholder={
                                                    ""
                                                }
                                                value={assistantMessageHeader || ''}
                                                onChange={(e) => setAssistantMessageHeader(e.target.value)}
                                                rows={1}
                                            />
                                        </div>
                                        )}
                                    </div>

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
                            </>
                        )}

                        <div className="pt-4 flex justify-end items-center border-t border-gray-200">
                            {downloadUrl == null && (
                            <button
                                type="button"
                                className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            )}
                            {!isSharing && downloadUrl != null && (
                                <button
                                    type="button"
                                    className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                    onClick={onCancel}
                                >
                                    Done
                                </button>
                            )}
                            {!isSharing && downloadUrl == null && (
                                <button
                                    type="button"
                                    style={{opacity: !canShare() ? 0.3 : 1}}
                                    className="ml-2 w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300 ${(selectedPromptsState.length === 0 && selectedConversationsState.length === 0 && selectedFoldersState.length === 0) ? 'cursor-not-allowed' : ''}"
                                    onClick={handleDownload}
                                    disabled={!canShare()}
                                >
                                    Download
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
import {FolderInterface} from "@/types/folder";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation} from "@/types/chat";
import React, {FC, useContext, useEffect, useRef, useState} from "react";
import {Prompt} from "@/types/prompt";
import {createExport, importData} from "@/utils/app/importExport";
import {loadSharedItem} from "@/services/shareService";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {ExportFormatV4, LatestExportFormat} from "@/types/export";
import {useSession} from "next-auth/react";
import { isAssistant } from "@/utils/app/assistants";
import { conversationWithCompressedMessages, saveConversations } from "@/utils/app/conversation";
import { saveFolders } from "@/utils/app/folders";
import { savePrompts } from "@/utils/app/prompts";
import { DefaultModels } from "@/types/model";
import toast from "react-hot-toast";
import { ItemSelect } from "../ReusableComponents/ItemsSelect";
import { baseAssistantFolder, isBaseFolder, isBasePrompt } from "@/utils/app/basePrompts";
import { Modal } from "../ReusableComponents/Modal";
import { IconNote } from "@tabler/icons-react";

export interface ImportModalProps {
    onImport: (importData: ExportFormatV4) => void;
    onCancel: () => void;
    importKey: string;
    note: string;
    importFetcher?: ImportFetcher;
    isImportingLabel?: string;
    importButtonLabel?: string;
    title?: string;
    customImportFn?: (conversations:Conversation[], folders:FolderInterface[], prompts:Prompt[]) => void;
}

export interface ImportFetcher {
    (): Promise<{success:boolean, message:string, data: ExportFormatV4|null}>;
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

export const ImportAnythingModal: FC<ImportModalProps> = (
    {
        onImport,
        onCancel,
        importKey,
        note,
        importFetcher,
        customImportFn,
        isImportingLabel = "Importing...",
        importButtonLabel = "Accept Items",
        title = "Choose Shared Items to Accept",
    }) => {


    const {
        state: {folders: localFolders, conversations: localConversations,  prompts:localPrompts},
        dispatch: homeDispatch, handleSelectConversation, getDefaultModel
    } = useContext(HomeContext);

    const foldersRef = useRef(localFolders);

    useEffect(() => {
        foldersRef.current = localFolders;
    }, [localFolders]);

    const promptsRef = useRef(localPrompts);

    useEffect(() => {
        promptsRef.current = localPrompts;
      }, [localPrompts]);


    const conversationsRef = useRef(localConversations);

    useEffect(() => {
        conversationsRef.current = localConversations;
    }, [localConversations]);


    const { data: session } = useSession();
    const user = session?.user;


    let isImportingRef = useRef<boolean | null>(null);
    if (isImportingRef.current === null) isImportingRef.current = true;
    // Individual states for selected prompts, conversations, and folders
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [folders, setFolders] = useState<FolderInterface[]>([]);
    const [selectedPromptsState, setSelectedPrompts] = useState<Prompt[]>([]);
    const [selectedConversationsState, setSelectedConversations] = useState<Conversation[]>([]);
    const [selectedFoldersState, setSelectedFolders] = useState<FolderInterface[]>([]);

    const [canImport, setCanImport] = useState<boolean>(false);
    
    
    useEffect(() => {
        setCanImport(!!checkCanImport());
    }, [selectedPromptsState, selectedConversationsState, selectedFoldersState]);
    


    const checkCanImport = () => {
        return (selectedPromptsState.length > 0 || selectedConversationsState.length > 0 || selectedFoldersState.length > 0);
    }

    const handleImport = async () => {

        if(customImportFn) {
            customImportFn(selectedConversationsState, selectedFoldersState, selectedPromptsState);
            return;
        }
        
        const compressedConversationsState = selectedConversationsState.map((c:Conversation) => {
            if (c.messages && !c.compressedMessages) return conversationWithCompressedMessages(c);
            return c;
        });

        //onSave(selectedItems);
        const exportData = await createExport(compressedConversationsState, selectedFoldersState, selectedPromptsState, "import", false);

        // update folders based on if we already have them or not
        const duplicateFolderIds: string[] = []; 
        exportData.folders.forEach((folder: FolderInterface) => {
            const existing = foldersRef.current.find((f:FolderInterface) => f.name === folder.name);
            if (existing) {
                duplicateFolderIds.push(folder.id);
                if (folder.type === 'chat') {
                    exportData.history.forEach((c: Conversation) => {
                        if (c.folderId === folder.id) c.folderId = existing.id;
                    })
                } else if (folder.type === 'prompt') {
                    exportData.prompts.forEach((p: Prompt) => {
                        if (p.folderId === folder.id)  p.folderId = existing.id;
                    })
                }
            }
        });

        exportData.folders = exportData.folders.filter((f:FolderInterface) => !duplicateFolderIds.includes(f.id) );

        const needsFolderReset = (item: Conversation | Prompt) => {
            return item.folderId != null &&
                !exportData.folders.some((folder: FolderInterface) => folder.id === item.folderId) &&
                !foldersRef.current.some((folder:FolderInterface) => folder.id === item.folderId)
        };

        // Check if any of the folders of the prompts or conversations don't exist in local folders
        // and if so, set the folder to null
        const promptsToSetFolderToNull = exportData.prompts.filter(needsFolderReset);
        const conversationsToSetFolderToNull = exportData.history.filter(needsFolderReset);

        console.log("Prompts needing folder reset: ", promptsToSetFolderToNull);
        console.log("Conversations needing folder reset: ", conversationsToSetFolderToNull);

        const cleanedUpExport = await createExport(
            exportData.history.map(conversation => {
                return conversationsToSetFolderToNull.some(c => c.id === conversation.id) ? {
                    ...conversation,
                    folderId: null
                } : conversation;
            }),
            exportData.folders,
            exportData.prompts.map(prompt => {
                // already prepped before sending out, but backup prep
                if (isAssistant(prompt) && prompt?.data) {
                    const hasWorkflow = prompt.data.baseWorkflowTemplateId;
                    const hasEmailEventsTag = prompt.data?.emailEvents?.tag;
                    if (!hasWorkflow && !hasEmailEventsTag && prompt.data?.access) {
                        prompt.data.access = {read: true, write: false};
                        prompt.data.noCopy = true;
                        prompt.data.noEdit = true;
                        prompt.data.noShare = true;
                        prompt.data.noDelete = true;
                    }
                    // clean up user specific workflow version
                    if (hasWorkflow || hasEmailEventsTag) {
                        delete prompt.data.workflowTemplateId;
                        delete prompt.data.assistant?.definition?.data?.workflowTemplateId;
                        delete prompt.data.emailEvents?.tag;
                        delete prompt.data.assistant?.definition?.data?.emailEvents?.tag;
                        // remove assistantIds
                        delete prompt.data.assistant?.definition?.assistantId;
                    }

                } 
                return promptsToSetFolderToNull.some(p => p.id === prompt.id) ? {...prompt, folderId: null} : prompt;
            }), "import", false);

        
        const [workflowAssistants, filteredPrompts] = cleanedUpExport.prompts.reduce(
            ([workflowAssistants, otherPrompts], prompt) => {
                return isAssistant(prompt) && (prompt.data?.baseWorkflowTemplateId || prompt.data?.emailEvents) ?
                                  [[...workflowAssistants, prompt], otherPrompts] :
                                  [workflowAssistants, [...otherPrompts, prompt]]
            },
            [[], []] as [Prompt[], Prompt[]]
        );
        
        cleanedUpExport.prompts = filteredPrompts;

        // open workflow assistants if any
        if (workflowAssistants.length > 0) window.dispatchEvent(new CustomEvent('openAstModalTrigger', { detail: { assistants: [...workflowAssistants] }} ));
        // console.log("Cleaned up export: ", cleanedUpExport);
        const {history, folders, prompts}: LatestExportFormat = importData(cleanedUpExport, conversationsRef.current, promptsRef.current, foldersRef.current, getDefaultModel(DefaultModels.DEFAULT));

        // console.log("Imported prompts, conversations, and folders: ", prompts, history, folders);

        homeDispatch({field: 'conversations', value: history});
        saveConversations(history);

        if (selectedConversationsState.length > 0) {
            // tab switch
            window.dispatchEvent(new CustomEvent('homeChatBarTabSwitch', { detail: { tab: "Chats" , side: "left"}} ));
            const lastIdx = exportData.history.length - 1
            const openTo: Conversation = exportData.history[lastIdx];
            toast(`Chat Opened: ${openTo.name}`);
            handleSelectConversation(openTo);
        }
        // if (prompts && prompts.length > 0) // open ast folder
        homeDispatch({field: 'folders', value: folders});
        saveFolders(folders);
        homeDispatch({field: 'prompts', value: prompts});
        savePrompts(prompts);

        onImport(exportData);
        resetSelection();
    }

    // Add necessary useEffects

    function resetSelection() {
        setSelectedPrompts([]);
        setSelectedConversations([]);
        setSelectedFolders([]);
    }

    const initWithImportData = (sharedData: ExportFormatV4) => {
        setPrompts(sharedData.prompts);
        setSelectedPrompts(sharedData.prompts);
        setConversations(sharedData.history);
        setSelectedConversations(sharedData.history);
        setFolders(sharedData.folders);
        setSelectedFolders(sharedData.folders);
    }

    useEffect(() => {


        const fetchData = async () => {
            if (user && user.email) {
                const shareFetcher:ImportFetcher = async () => {

                    const result = await loadSharedItem(importKey);
                    if (result.success) {
                        const sharedData = JSON.parse(result.item) as ExportFormatV4;
                        return {success: true, message:"Loaded share successfully.", data: sharedData};
                    } else {
                        return {success: false, message:"Failed to load share.", data: null};
                    }
                }

                console.log("Import fetcher: ", importFetcher);

                const result = (importFetcher) ?
                    await importFetcher() :
                    await shareFetcher();

                if (result.success) {
                    const sharedData = result.data;
                    console.log(sharedData);

                    if(sharedData) {
                        initWithImportData(sharedData);
                    } else {
                        alert("Unable to find item. It may have been removed.");
                    }
                    isImportingRef.current = false;
                } else {
                    alert("Unable to find shared item. It may have been deleted.");
                    onClose();
                }
            }
        };
        fetchData();

    }, []);

    const onClose = () => {
        resetSelection();
        onCancel();
    }

    const isImporting = () => {
        return isImportingRef.current ?? true
    }

    return (
        <Modal 
        width={() => window.innerWidth * (isImporting() ? 0.3 : 0.45)}
        height={() => !isImporting() ? window.innerHeight * 0.72 : 280} 
        title={!isImporting() ? title: ""}
        onCancel={onClose} 
        onSubmit={handleImport}
        submitLabel={importButtonLabel}
        disableSubmit={!canImport}
        showSubmit={!isImporting()}
        resizeOnVarChange={isImporting()}
        content={
            isImporting() ? (
            <div className="flex flex-col items-center justify-center pb-2 border-b">
                <LoadingIcon/>
                <span className="text-black dark:text-white text-xl font-bold mt-4">{isImportingLabel}</span>
            </div>) :
                <>
                    <div className="overflow-y-auto" style={{maxHeight: "calc(100vh - 200px)"}}>

                        <h3 className="flex flex-row text-black dark:text-white text-lg mt-2 border-b ">
                            <IconNote className="mt-1.5 mx-2" size={18}/>
                            Note
                        </h3>
                        <div className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                        >{note} </div>


                        <ItemSelect
                            promptOptions={prompts}
                            conversationOptions={conversations}
                            folderOptions={folders}

                            selectedPromptsState={selectedPromptsState}
                            setSelectedPrompts={setSelectedPrompts}
                            includePrompts={prompts.length > 0}                                                                 
                            promptFilter={ (p:Prompt[]) =>  p.filter((prompt:Prompt) => !prompt.groupId && !isBasePrompt(prompt.id) ) }

                            selectedConversationsState={selectedConversationsState}
                            setSelectedConversations={setSelectedConversations}
                            includeConversations={conversations.length > 0}
                        
                            selectedFoldersState={selectedFoldersState}
                            setSelectedFolders={setSelectedFolders}
                            includeFolders={folders.length > 0}
                            folderFilter={(f:FolderInterface[]) => f.filter((folder:FolderInterface) => 
                                                                    !isBaseFolder(folder.id) && !folder.isGroupFolder &&
                                                                    folder.id!== baseAssistantFolder.id)}
                            handleRootPromptIds={true}
                        />

                    </div>
                </>
                
        }
    />
    );
};
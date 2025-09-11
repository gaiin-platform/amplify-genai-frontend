import { FC, useContext, useEffect, useRef, useState } from "react";
import {
    IconTrash, IconDotsVertical,
    IconX, IconShare, IconTags,
    IconCheck, IconFolderOpen, 
    IconFolder, IconCalendar, IconAbc,
    IconTrashFilled,
    IconEye,
    IconRefresh
} from '@tabler/icons-react';
import { KebabActionItem, actionItemAttr, KebabItem, KebabMenuItems } from "./KebabItems";
import { ShareAnythingModal } from "@/components/Share/ShareAnythingModal";
import { TagsList } from "@/components/Chat/TagsList";
import { Conversation } from "@/types/chat";
import { getAssistant, isAssistant } from "@/utils/app/assistants";
import { DEFAULT_ASSISTANT } from "@/types/assistant";
import HomeContext from "@/pages/api/home/home.context";
import { Prompt } from "@/types/prompt";
import { deleteAssistant } from "@/services/assistantService";
import { DefaultModels } from "@/types/model";
import { FolderInterface, SortType } from "@/types/folder";
import {v4 as uuidv4} from 'uuid';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from "@/utils/app/const";
import { CheckItemType } from "@/types/checkItem";
import { savePrompts } from "@/utils/app/prompts";
import { fetchAllRemoteConversations, fetchEmptyRemoteConversations, fetchMultipleRemoteConversations, fetchRemoteConversation, uploadConversation } from '@/services/remoteConversationService';
import { conversationWithUncompressedMessages, deleteConversationCleanUp, isRemoteConversation, saveConversations } from "@/utils/app/conversation";
import { getDateName } from "@/utils/app/date";
import React from "react";
import toast from "react-hot-toast";
import { getArchiveNumOfDays, getHiddenGroupFolders, saveArchiveNumOfDays, saveFolders } from "@/utils/app/folders";
import { updateWithRemoteConversations } from "@/utils/app/conversationStorage";
import { IconArchive } from '@tabler/icons-react';

// Kebab menu navigation structure
interface KebabMenuNavigation {
  section?: 'Folders';
  subsection?: 'Sort' | 'Archive';
}


interface Props {
    label: string; 
    items: any[];
    handleSearchTerm: (searchTerm: string) => void;
    setFolderSort: (s: SortType) => void;
  } 

  export const KebabMenu: FC<Props> = ({label, items, handleSearchTerm, setFolderSort}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [actionItem, setActionItem] = useState<actionItemAttr | null>(null);
    const [tags, setTags] = useState<Array<string>>([]);
    const [isShareDialogVisible, setIsShareDialogVisible] = useState<boolean>(false);
    const [isTagsDialogVisible, setIsTagsDialogVisible] = useState<boolean>(false); 
    const [allItemsChecked, setAllItemsChecked] = useState<boolean>(false);
    const [showReSync, setShowReSync] = useState<boolean>(false);

    const [archiveConversationPastNumOfDays, setArchiveConversationPastNumOfDays] = useState<number>(getArchiveNumOfDays());

    const {
        state: { statsService, selectedAssistant, checkedItems, folders, prompts, conversations,
                 selectedConversation, checkingItemType, syncingConversations, syncingPrompts}, handleDeleteFolder,
        dispatch: homeDispatch, handleCreateFolder, handleSelectConversation, getDefaultModel
    } = useContext(HomeContext);

    const isConvSide = label === 'Conversations';

    const [isSyncing, setIsSyncing] = useState<boolean>(isConvSide ? syncingConversations : syncingPrompts); 
    

    useEffect(() => {
        setIsSyncing(((isConvSide && syncingConversations) || (!isConvSide && syncingPrompts)));
    }, [syncingConversations, syncingPrompts]);

    // Event listener for programmatic kebab menu navigation
    useEffect(() => {
        const handleOpenKebabMenu = (event: CustomEvent<KebabMenuNavigation>) => {
            const { section, subsection } = event.detail;
            // Open the main kebab menu
            setIsMenuOpen(true);
            
            // Navigate to the specified section/subsection with delays
            setTimeout(() => {
                if (section === 'Folders') {
                    const foldersButton = document.getElementById('folders-menu');
                    if (foldersButton) {
                        console.log('Clicking Folders button');
                        foldersButton.click();
                        
                        // 3. If there's a subsection, navigate to it
                        if (subsection) {
                            setTimeout(() => {
                                const subsectionId = `${subsection.toLowerCase()}-menu`;
                                const button = document.getElementById(subsectionId);
                                if (button) {
                                    console.log(`Clicking ${subsection} button`);
                                    button.click();
                                }
                            }, 100);
                        }
                    }
                }
            }, 100);
        };

        window.addEventListener('openKebabMenu', handleOpenKebabMenu as EventListener);
        return () => window.removeEventListener('openKebabMenu', handleOpenKebabMenu as EventListener);
    }, []);

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


    const checkedItemsRef = useRef(checkedItems);

    useEffect(() => {
        checkedItemsRef.current = checkedItems;
    }, [checkedItems]);



    const checkIsActiveSide = () => {
        if (checkingItemType) {
            const activeSide = isConvSide ? checkingItemType.includes("Conv") || checkingItemType.includes("Chat")
                                 :  checkingItemType.includes("Prompt");
            if (!activeSide) setActionItem(null);
            return activeSide;
        } 
        return false;
    }

    const hasHiddenGroupFolders = () => {
        return getHiddenGroupFolders().length > 0;
    }
    

    const unHideHiddenGroupFolders = () => {
        const hiddenFolders = getHiddenGroupFolders();
        const updatedFolders = [...folders, ...hiddenFolders];
        homeDispatch({ field: 'folders', value: updatedFolders });
        saveFolders(updatedFolders);
        localStorage.setItem('hiddenGroupFolders', JSON.stringify([]));
    }

    const toggleDropdown = () => {
        if (checkingItemType) clear();
        setIsMenuOpen(!isMenuOpen);
        handleSearchTerm('');
    }

    const clear = () => {
        homeDispatch({field: 'checkingItemType', value: null});
        setActionItem(null);
        setAllItemsChecked(false);
        homeDispatch({field: 'checkedItems', value: []}); 
    }
      

    const openCloseFolders = (isOpen: boolean) => {
        if (isConvSide) homeDispatch({field: 'allFoldersOpenConvs', value: isOpen}); 
        if (!isConvSide ) homeDispatch({field: 'allFoldersOpenPrompts', value: isOpen});
    }


    useEffect(() => {
        function handleClickOutside(event: { target: any; }) {
            if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen, setIsMenuOpen, menuRef]);

    const getItemsInFolders = () => {
        const folderIdSet = new Set(checkedItemsRef.current.map((folder:FolderInterface) => folder.id));
        return items.filter(i => i.folderId ? folderIdSet.has(i.folderId) : false);
    }



    const handleDeleteConversations = (conversations: Conversation[] = checkedItemsRef.current) => {
        handleSearchTerm('');
        const updatedConversations = items.filter( (c: Conversation) => {
                                        const remove = !!conversations.find((conv: Conversation) => c.id === conv.id);
                                        
                                        if (remove) {
                                            statsService.deleteConversationEvent(c);
                                            deleteConversationCleanUp(c);
                                        }
                                        return !remove;
                                     });
        
        const updatedLength = updatedConversations.length;
        if (updatedLength > 0) {
            let lastConversation = updatedConversations[updatedLength - 1];
        
            let selectedConversation: Conversation = {...lastConversation};
            if (lastConversation.name !== 'New Conversation') { 
                
                const date = getDateName();
            
                // See if there is a folder with the same name as the date
                let folder = foldersRef.current.find((f: FolderInterface) => f.name === date);
                if (!folder) {
                    folder = handleCreateFolder(date, "chat");
                }
                
                const newConversation: Conversation = {
                    id: uuidv4(),
                    name: 'New Conversation',
                    messages: [],
                    model: lastConversation?.model ?? getDefaultModel(DefaultModels.DEFAULT),
                    prompt: DEFAULT_SYSTEM_PROMPT,
                    temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                    folderId: folder.id,
                    promptTemplate: null
                };
                updatedConversations.push(newConversation)
                selectedConversation = {...newConversation}
            }
    
            handleSelectConversation(selectedConversation);
    
        } else {
            homeDispatch({
                field: 'selectedConversation',
                value: {
                    id: uuidv4(),
                    name: 'New Conversation',
                    messages: [],
                    model: getDefaultModel(DefaultModels.DEFAULT),
                    prompt: DEFAULT_SYSTEM_PROMPT,
                    temperature: DEFAULT_TEMPERATURE,
                    folderId: null,
                },
            });
        
            localStorage.removeItem('selectedConversation');
        };
        homeDispatch({ field: 'conversations', value: updatedConversations });
        saveConversations(updatedConversations)
        clear();
    }

    const handleDeletePrompts = () => {
        const failedAssistants: string[] = [];

        const updatedPrompts = promptsRef.current.filter((p:Prompt) => !checkedItemsRef.current.includes(p));
        homeDispatch({ field: 'prompts', value: updatedPrompts });
        savePrompts(updatedPrompts);
        handleSearchTerm('');


        checkedItemsRef.current.forEach( async (prompt: Prompt) => {
            const canDelete = (!prompt.data || !prompt.data.noDelete);

            statsService.deletePromptEvent(prompt);
            if (selectedAssistant && prompt?.data?.assistant?.definition.assistantId === selectedAssistant.definition.assistantId) homeDispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT }); 
            
            if(isAssistant(prompt) && canDelete ){
               const assistant = getAssistant(prompt);
               if(assistant && assistant.assistantId){
                   try {
                       const result = await deleteAssistant(assistant.assistantId);
                       if(!result){
                           failedAssistants.push(assistant.name);
                           return;
                       }
                   } catch (e) {
                        failedAssistants.push(assistant.name);
                       return;
                   }
               }
            }
        })
        if (failedAssistants.length > 0)  alert(`Assistant${failedAssistants.length === 1 ? '': 's'}: ${failedAssistants.join(", ")} failed to delete.`);
        clear();

    }

    const handleDeleteFolders = () => {
        handleSearchTerm('');
        // console.log(checkedItemsRef.current)
        if (isConvSide) {
            
            const conversationInFolders: Conversation[] = [];
            checkedItemsRef.current.forEach((f: FolderInterface) => {
                                            conversationInFolders.push(...conversationsRef.current.filter((c:Conversation) => c.folderId === f.id));
                                            handleDeleteFolder(f.id);
                                        });
            handleDeleteConversations(conversationInFolders)
        } else {
            checkedItemsRef.current.forEach((f: FolderInterface) => handleDeleteFolder(f.id));
        }
        clear();
    }

    const cleanEmptyConversations = async () => {
        const { remoteConversationIdMap, localEmptyConversations } = conversationsRef.current.reduce<{
            remoteConversationIdMap: { [key: string] : Conversation};
            localEmptyConversations: Conversation[];
        }>((acc, c:Conversation) => {
            if (isRemoteConversation(c)) {
                acc.remoteConversationIdMap[c.id] = c;
            } else if (conversationWithUncompressedMessages(c).messages.length === 0) {
                acc.localEmptyConversations.push(c);
            }
            return acc;
        }, { remoteConversationIdMap: {}, localEmptyConversations: [] });

        const remoteConversationIds: string[] = Object.keys(remoteConversationIdMap);
        if (remoteConversationIds.length > 0 || localEmptyConversations.length > 0 ) {
            toast("Removing Empty Conversations...");
            const fetchRemoteConversations = await fetchEmptyRemoteConversations();

            let emptyRemoteConversations:Conversation[] = [];
            if (fetchRemoteConversations.data) {
                // console.log("Contains empty conversations");
                emptyRemoteConversations = fetchRemoteConversations.data;
                const emptyRemoteConversationIds: string[] = emptyRemoteConversations.map((c:Conversation) => c.id);

                // remove no such key conversations
                const presentIds: string[] =  [...fetchRemoteConversations.nonEmptyIds, ...emptyRemoteConversationIds];
                const possibleNoSuchKeyIds = remoteConversationIds.filter((id: string) => !presentIds.includes(id));
                 //check that it is truly a no such key  
                const fetchPossibleNoSuchKey = await fetchMultipleRemoteConversations(possibleNoSuchKeyIds);
                if (fetchPossibleNoSuchKey.failedByNoSuchKey) {
                     // add the no such key conversations 
                    fetchPossibleNoSuchKey.failedByNoSuchKey.forEach((id: string) => {
                        emptyRemoteConversations.push(remoteConversationIdMap[id]);
                    });
                }
            }
            handleDeleteConversations([...localEmptyConversations, ...emptyRemoteConversations]);
        }  else {
            toast("No Empty Conversations To Remove");
        }
        
    }

    const cleanEmptyFolders = async () => {
        let emptyFolderIds: (string | null)[] = [];
        let allFolderIds: string[] = [];
        let occupiedFolderIds: Set<string | null> = new Set(); 
        
        if (isConvSide) {
            allFolderIds = folders.filter((f: FolderInterface) => f.type === 'chat')
                                  .map((f: FolderInterface) => f.id);
            occupiedFolderIds = new Set<string | null>(conversationsRef.current.map((c: Conversation) => c.folderId));
        } else {
            allFolderIds = folders.filter((f: FolderInterface) => f.type === 'prompt')
                                  .map((f: FolderInterface) => f.id);
            occupiedFolderIds = new Set<string | null>(promptsRef.current.map((p: Prompt) => (p.folderId)));
        }

        emptyFolderIds = [...allFolderIds].filter(id => !occupiedFolderIds.has(id));

        if (emptyFolderIds.length > 0) {
            toast("Removing Empty Folders...");

            console.log("empty folders total len: ", emptyFolderIds.length);

            const updatedFolders = foldersRef.current.filter((f:FolderInterface) => !emptyFolderIds.includes(f.id));
    
            homeDispatch({ field: 'folders', value: updatedFolders });
            saveFolders(updatedFolders);

        } else {
            toast("No Empty Folders To Remove");
        }
    }

    const handleCheckAll = (isChecked: boolean) => {
        setAllItemsChecked(isChecked);
        if (!isChecked) {
            homeDispatch({field: 'checkedItems', value: []}); 
            return;
        }
        let allItems: any[] = items;
        switch (actionItem?.type) {
            case ('ChatFolders'):
                allItems = foldersRef.current.filter((f:FolderInterface) => f.type === 'chat');
                break;

            case ('PromptFolders'):
                allItems = foldersRef.current.filter((f:FolderInterface) => f.type === 'prompt');
                break;
        }
        homeDispatch({field: 'checkedItems', value: allItems}); 
    }

    const handleArchiveFolderNum = (numOfDays: number) => {
        // Get the current archive setting before changing it
        const previousArchiveDays = getArchiveNumOfDays();
        
        setArchiveConversationPastNumOfDays(numOfDays);
        saveArchiveNumOfDays(numOfDays);
        // Dispatch event to update archive threshold
        window.dispatchEvent(new CustomEvent('updateArchiveThreshold', { 
            detail: { threshold: numOfDays } 
        }));

        // If the new archive days is larger than the previous setting,
        // we need to re-sync to get more historical conversations
        // Special case: 0 means "show all" so we need to sync everything
        // But if we were already at 0 (show all), no need to re-sync
        if (previousArchiveDays !== 0 && (numOfDays > previousArchiveDays || numOfDays === 0)) {
            const syncDays = numOfDays === 0 ? undefined : numOfDays;
            console.log(`Archive days changed from ${previousArchiveDays} to ${numOfDays}. Re-syncing conversations${syncDays ? ` with ${syncDays} days limit` : ' with no time limit'}...`);
            reSyncConversations(syncDays);
        }
    }

    const isShowingAllFolders = () => {
        return archiveConversationPastNumOfDays === 0;
    }

    const reSyncConversations = async (days?: number) => {
        homeDispatch({ field: 'syncingConversations', value: true });
        try {
            const allRemoteConvs = await fetchAllRemoteConversations(days);
            if (allRemoteConvs) {
                const newCloudFolders = await updateWithRemoteConversations(allRemoteConvs, conversations, folders, homeDispatch, getDefaultModel(DefaultModels.DEFAULT));
                const updatedFolders = [...folders, ...newCloudFolders.newfolders];
                homeDispatch({ field: 'folders', value: updatedFolders });
                saveFolders(updatedFolders);
                toast("Cloud conversations successfully synced");
            }
        } catch (e) {
            console.log("Failed to sync cloud conversations: ", e);
            toast.error("Failed to sync cloud conversations.");
        }
        homeDispatch({ field: 'syncingConversations', value: false });
    }
        

    return (
        <React.Fragment>
        <div className="flex items-center pb-1" style={{pointerEvents: isMenuOpen ? 'none' : 'auto'}}
         onMouseEnter={() => setShowReSync(true)}
         onMouseLeave={() => setShowReSync(false)}>
          <div className="flex w-full items-center ml-1 text-black dark:text-neutral-200">
            <span className="sidebar-title text-xs uppercase tracking-wide opacity-60">{label}</span>
            { isConvSide && !actionItem && !isSyncing && (showReSync || isMenuOpen) &&
               <button
                    title='Re-sync Conversations'
                    disabled={isSyncing}
                    className={`-mt-2 ml-2 text-sidebar flex-shrink-0 select-none items-center gap-3 rounded-md border dark:border-white/20 p-1.5 dark:text-white transition-colors duration-200 ${!isSyncing ? "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" : ""}`}
                    onClick={async () => reSyncConversations()}
                >  <IconRefresh size={16}/>
                </button>
            }
            { isSyncing && 
                <div className="ml-auto mr-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 dark:border-blue-400/20 backdrop-blur-sm">
                    <div className="sync-dot w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
                    <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wide">Syncing</span>
                </div>}
          </div>
            {actionItem && checkIsActiveSide() && (
                <div className="text-xs flex flex-row gap-1">
                    {`${actionItem.actionLabel}...`} 
                    <div className="flex flex-row gap-0.5 bg-transparent rounded-md overflow-hidden shadow-sm">
                         <button
                                id="confirmItem" 
                                className="text-green-500 hover:bg-green-500/10 transition-colors duration-200" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (checkedItemsRef.current.length > 0) {
                                        actionItem.clickAction();
                                    } else {
                                        clear();
                                    }
                                }}
                                
                                title={`${actionItem.name} Items`} 
                            >
                                <IconCheck size={16} />
                            </button>
                        
                        <button
                            id="cancelItem"
                            className="text-red-500 hover:bg-red-500/10 transition-colors duration-200"
                            onClick={(e) => {
                                e.stopPropagation();
                                clear();
                            }}
                            title={"cancel"}
                        >
                            <IconX size={16} />
                        </button>
                    </div>
                </div>
            )}

          <div className="relative inline-block text-left" >
            { actionItem && checkIsActiveSide() ?
                <div id="selectAllCheck" className={`z-10 p-0.5 rounded-sm ${ checkingItemType?.includes("Folder")? "": ""}`}>
                    <input
                    type="checkbox"
                    className="transition-all duration-200"
                    checked={allItemsChecked}
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    />
                </div> :
                <button
                    disabled={isSyncing}
                    id="promptHandler"
                    className={`outline-none focus:outline-none p-0.5 transition-all duration-200 rounded-md ${isMenuOpen ? 'bg-neutral-200 dark:bg-[#343541]/90' : ''}`}
                    onClick={toggleDropdown}>
                    <IconDotsVertical size={20} className="flex-shrink-0 text-neutral-500 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 enhanced-icon transition-transform duration-300"/>
                </button>
            }
            
            {isMenuOpen && (
                <div
                    ref={menuRef}
                    className="absolute bg-neutral-100 dark:bg-[#202123] text-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-600 dark:text-white z-50 shadow-md"
                    id="subMenu"
                    style={{ top: '95%', right: '0', pointerEvents: 'auto', width: '180px' }}>
                    <div className="overflow-y-auto" style={{maxHeight: window.innerHeight * 0.7}}>
                        <KebabActionItem label="Delete" type={label as CheckItemType} handleAction={()=>{isConvSide ? handleDeleteConversations() : handleDeletePrompts()}} 
                                         setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconTrash size={14} />} />
                        <KebabActionItem label="Share" type={label as CheckItemType} handleAction={()=>{setIsShareDialogVisible(true)}} setIsMenuOpen={setIsMenuOpen} 
                                         setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconShare size={14} />} />
                        {isConvSide  && <KebabActionItem label="Tag" type={label as CheckItemType} handleAction={()=>{setIsTagsDialogVisible(true)}} 
                                         setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconTags size={14} />} />}
                        
                        {isConvSide  &&  <KebabItem label="Clean" handleAction={() => { cleanEmptyConversations() }} icon={<IconTrashFilled size={14} />} title="Remove Empty Conversations" />}
                        <KebabMenuItems label="Folders" id="folders-menu">

                            <KebabMenuItems label="Sort" id="sort-menu">
                                <KebabItem label="Name" handleAction={() => {setFolderSort('name')}} icon={<IconAbc size={18}/>}  title="Sort Folders By Name"/>
                                <KebabItem label="Date" handleAction={() => { setFolderSort('date') } } icon={<IconCalendar size={14}/>} title="Sort Folders By Date" />
                            </KebabMenuItems>


                            <KebabActionItem label="Delete" type={`${isConvSide?'Chat':'Prompt'}Folders`} handleAction={() => { handleDeleteFolders() }} 
                                             setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconTrash size={14} />} />
                            <KebabActionItem label="Share" type={`${isConvSide?'Chat':'Prompt'}Folders`} handleAction={()=>{setIsShareDialogVisible(true)}} 
                                             setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconShare size={14} />} />
                            {<KebabItem label="Clean" handleAction={() => { cleanEmptyFolders() }} icon={<IconTrashFilled size={14} />} title="Remove Empty Folders" />}
                            <KebabItem label="Open All" handleAction={() => { openCloseFolders(true) } } icon={<IconFolderOpen size={13} />}  title="Open All Folders" />
                            <KebabItem label="Close All" handleAction={() => { openCloseFolders(false) }} icon={<IconFolder size={13}/>}   title="Close All Folders"/>
                            {!isConvSide && hasHiddenGroupFolders()  &&  <KebabItem label="Unhide" handleAction={() => { unHideHiddenGroupFolders() }} icon={<IconEye size={14} />} title="Unhide Hidden Group Folders" /> }
                            
                            {isConvSide && (
                              <KebabMenuItems label="Archive" id="archive-menu">
                                <KebabItem 
                                  label={isShowingAllFolders() ? "Archive Folders ": "Show All Folders"} 
                                  handleAction={() => handleArchiveFolderNum(isShowingAllFolders() ? 7 : 0)} 
                                  icon={<IconArchive size={14} />} 
                                  title={`Disable archiving any folders`} 
                                />
                                <div className={`border-b dark:border-white/20 p-2 ${isShowingAllFolders() ? 'opacity-50' : ''}`}>
                                  <div className="w-full flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                      <label className="sidebar-text text-xs text-gray-600 dark:text-gray-300">Hide folders older than:</label>
                                    </div>
                                    <div className="flex flex-row flex-wrap gap-1 mt-1">
                                      {[7, 14, 30, 90].map((days) => (
                                        <button
                                          key={days}
                                          onClick={() => handleArchiveFolderNum(days)}
                                          className={`sidebar-text text-xs px-2 py-1 rounded-md transition-all duration-200 ${archiveConversationPastNumOfDays === days ? 
                                            'bg-blue-500 dark:bg-blue-600 text-white' : 
                                            'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'}`}
                                        >
                                          {days} days
                                        </button>
                                      ))}
                                    </div>
                                    <p className="sidebar-text text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      Pinned folders are always visible
                                    </p>
                                  </div>
                                </div>
                              </KebabMenuItems>
                            )}
                        </KebabMenuItems>
                    </div>
                </div>
            )}
          </div>
        </div>

        {isShareDialogVisible && (<ShareAnythingModal
        open={isShareDialogVisible}
        onCancel={()=>{
            setIsShareDialogVisible(false);
            clear();
        }}
        onShare={()=>{
          setIsShareDialogVisible(false);
          clear();
        }}
        includePrompts={!isConvSide }
        includeConversations={isConvSide }
        includeFolders={actionItem ? actionItem.type.includes('Folders') : false}
        selectedPrompts={ (actionItem && actionItem.type.includes('Folders')) ? getItemsInFolders()
                                       : ( !isConvSide ?  checkedItemsRef.current : [] )
            }
        selectedConversations={ (actionItem && actionItem.type.includes('Folders')) ?  getItemsInFolders()
                                : (isConvSide ?  checkedItemsRef.current : [] )
            }
        selectedFolders={actionItem ? checkedItemsRef.current : []}
        />)}

        {isTagsDialogVisible && 
        <div className="fixed inset-0 bg-black bg-opacity-50 h-full w-full">
            <div className="flex items-center justify-center min-h-screen">
              <div className="border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-[#202123] rounded-lg md:rounded-lg shadow-lg overflow-hidden mx-auto max-w-lg w-[400px] transition-all duration-300"
              >
                <div id="tagAddModal" className="p-2 h-[60px] overflow-y-auto">
                <TagsList tags={tags} 
                    setTags={(tags) => {
                                setTags(tags);
                                checkedItemsRef.current.forEach(async (item: Conversation) => {
                                    const itemTags = item.tags || [];
                                    item.tags = [...itemTags, ...tags.filter(tag => !itemTags.includes(tag))]
                                    if (isRemoteConversation(item)) {
                                        try {
                                            const fullConv = await fetchRemoteConversation(item.id);
                                            if (fullConv) uploadConversation({...fullConv, tags: item.tags}, foldersRef.current);
                                        } catch {
                                            console.log("Failed to update remote conversation with new tags")
                                        } 
                                    }
                                })
                            }}
                    removeTag={(tag) => {
                        checkedItemsRef.current.forEach(async (item: Conversation) => {
                            item.tags = item.tags?.filter(x => x != tag)
                            if (isRemoteConversation(item)) {
                                try {
                                    const fullConv = await fetchRemoteConversation(item.id);
                                    if (fullConv) uploadConversation({...fullConv, tags: item.tags}, foldersRef.current);
                                } catch {
                                    console.log("Failed to update remote conversation with updated tags")
                                }
                            }
                        })
                    }}
                /> 
                </div>
                <div className="p-2">
                  <button
                        type="button"
                        id="doneButton"
                        className="sidebar-text w-full mb-1 px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300 transition-all duration-200 hover:transform hover:translate-y-[-1px]"
                        onClick={() => {setIsTagsDialogVisible(false);
                                        clear();
                                        if (tags.length > 0)  {
                                            homeDispatch({ field: 'conversations', value: items });
                                            saveConversations(items);
                                            const updatedSelected = items.find((c) => (selectedConversation) ? c.id === selectedConversation.id : false);
                                            if (updatedSelected) {
                                                const selectedWithTags = {...selectedConversation, tags: updatedSelected.tags};
                                                homeDispatch({ field: 'selectedConversation', value: selectedWithTags});
                                            }
                                        }
                                        setTags([]);
                                        }}
                        >Done
                  </button>
                  </div>
              </div>
            </div>
          </div>
        }
        </React.Fragment>
      );
      
}

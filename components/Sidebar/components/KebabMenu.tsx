import { FC, useContext, useEffect, useRef, useState } from "react";
import {
    IconTrash, IconDotsVertical,
    IconX, IconShare, IconTags,
    IconCheck, IconFolderOpen, 
    IconFolder, IconCalendar, IconAbc
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
import { OpenAIModelID, OpenAIModels } from "@/types/openai";
import { FolderInterface, SortType } from "@/types/folder";
import {v4 as uuidv4} from 'uuid';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from "@/utils/app/const";
import { CheckItemType } from "@/types/checkItem";
import { savePrompts } from "@/utils/app/prompts";
import { saveFolders } from "@/utils/app/folders";
import { isRemoteConversation } from '@/utils/app/conversationStorage';
import { deleteRemoteConversation, fetchMultipleRemoteConversations, uploadConversation } from '@/services/remoteConversationService';

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

    const {
        state: { statsService, selectedAssistant, defaultModelId, checkedItems, folders, prompts, selectedConversation}, handleDeleteFolder,
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    useEffect(() => {
        checkedItemsRef.current = checkedItems;
      }, [checkedItems]);

    const checkedItemsRef = useRef(checkedItems);

    const isConvSide = label === 'Conversations';

    const toggleDropdown = () => {
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


    const handleDeleteConversation = () => {
        handleSearchTerm('');
        const updatedConversations = items.filter( (c: Conversation) => 
                                    { const remove = checkedItemsRef.current.includes(c) 
                                          if (remove) {
                                            statsService.deleteConversationEvent(c);
                                              if (isRemoteConversation(c)) deleteRemoteConversation(c.id);
                                          }
                                          return !remove;
                                     });
        
        const updatedLength = updatedConversations.length;
        if (updatedLength > 0) {
            let lastConversation = updatedConversations[updatedLength - 1];
        
            let selectedConversation: Conversation = {...lastConversation};
            if (lastConversation.name !== 'New Conversation') { 
                
                const date = new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
            
                // See if there is a folder with the same name as the date
                let folder = folders.find((f: FolderInterface) => f.name === date);
                if (!folder) {
                    const newFolder: FolderInterface = {
                        id: uuidv4(),
                        date: new Date().toISOString().slice(0, 10),
                        name: date,
                        type: "chat"
                    };

                    folder = newFolder;
                    const updatedFolders = [...folders, newFolder];

                    homeDispatch({ field: 'folders', value: updatedFolders });
                    saveFolders(updatedFolders);
                }
                
                const newConversation: Conversation = {
                    id: uuidv4(),
                    name: 'New Conversation',
                    messages: [],
                    model: lastConversation?.model ?? OpenAIModels[defaultModelId as OpenAIModelID],
                    prompt: DEFAULT_SYSTEM_PROMPT,
                    temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                    folderId: folder.id,
                    promptTemplate: null
                };
                updatedConversations.push(newConversation)
                selectedConversation = {...newConversation}
            }
        
            localStorage.setItem('selectedConversation', JSON.stringify(selectedConversation));
            homeDispatch({ field: 'selectedConversation', value: selectedConversation});
    
        } else {
            defaultModelId &&
            homeDispatch({
                field: 'selectedConversation',
                value: {
                    id: uuidv4(),
                    name: 'New Conversation',
                    messages: [],
                    model: OpenAIModels[defaultModelId],
                    prompt: DEFAULT_SYSTEM_PROMPT,
                    temperature: DEFAULT_TEMPERATURE,
                    folderId: null,
                },
            });
        
            localStorage.removeItem('selectedConversation');
        };
        homeDispatch({ field: 'conversations', value: updatedConversations });
        localStorage.setItem('conversationHistory', JSON.stringify(updatedConversations));
        clear();
    }

    const handleDeletePrompts = () => {
        const failedAssistants: string[] = [];

        const updatedPrompts = prompts.filter((p) => !checkedItemsRef.current.includes(p));
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
        checkedItemsRef.current.forEach((folder: FolderInterface) => {handleDeleteFolder(folder.id) });
        clear();
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
                allItems = folders.filter((f:FolderInterface) => f.type === 'chat');
                break;

            case ('PromptFolders'):
                allItems = folders.filter((f:FolderInterface) => f.type === 'prompt');
                break;
        }
        homeDispatch({field: 'checkedItems', value: allItems}); 
    }

    return (
        <div>
        <div className="flex items-center border-b dark:border-white/20" style={{pointerEvents: isMenuOpen ? 'none' : 'auto'}}>
          <div className="pb-1 flex w-full text-lg ml-1 text-black dark:text-neutral-200 flex items-center">
            {label} 
          </div>
            {actionItem && (
                <div className="text-xs flex flex-row gap-1">
                    {`${actionItem.actionLabel}...`} 
                    <div className="flex flex-row gap-0.5 bg-neutral-200 dark:bg-[#343541]/90 rounded">
                         <button 
                                className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100" 
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
                            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 "
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

          <div className="relative inline-block text-left">
            { !actionItem ?
                <button
                    className={`outline-none focus:outline-none p-0.5 ${isMenuOpen ? 'bg-neutral-200 dark:bg-[#343541]/90' : ''}`}
                    onClick={toggleDropdown}>
                    <IconDotsVertical size={20} className="flex-shrink-0 text-neutral-500 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"/>
                </button> :
                <div className="z-10 p-1">
                    <input
                    type="checkbox"
                    checked={allItemsChecked}
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    />
                </div>
            }
            
            {isMenuOpen && (
                <div
                    ref={menuRef}
                    className="ml-[-200%] absolute bg-neutral-100 dark:bg-[#202123] text-neutral-900 rounded border border-neutral-200 dark:border-neutral-600 dark:text-white z-50"
                    style={{ top: '90%', pointerEvents: 'auto' }}>
                    <div>
                        <KebabActionItem label="Delete" type={label as CheckItemType} handleAction={()=>{isConvSide ? handleDeleteConversation() : handleDeletePrompts()}} 
                                         setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconTrash size={14} />}/>
                        <KebabActionItem label="Share" type={label as CheckItemType} handleAction={()=>{setIsShareDialogVisible(true)}} setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconShare size={14} />}/>
                        {isConvSide  && <KebabActionItem label="Tag" type={label as CheckItemType} handleAction={()=>{setIsTagsDialogVisible(true)}} setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconTags size={14} />}/>}
                        
                        <KebabMenuItems label="Folders" xShift={224} minWidth={84}>
                            <KebabMenuItems label="Sort" xShift={176}>
                                <KebabItem label="Name" handleAction={() => {setFolderSort('name')}} icon={<IconAbc size={18}/>} />
                                <KebabItem label="Date" handleAction={() => { setFolderSort('date') } } icon={<IconCalendar size={14}/>} />
                            </KebabMenuItems>
                            <KebabActionItem label="Delete" type={`${isConvSide?'Chat':'Prompt'}Folders`} handleAction={() => { handleDeleteFolders() }}
                                setIsMenuOpen={setIsMenuOpen} setActiveItem={setActionItem} dropFolders={openCloseFolders} icon={<IconTrash size={14} />} />
                            <KebabItem label="Open All" handleAction={() => { openCloseFolders(true) } } icon={<IconFolderOpen size={13} />} minWidth={84} />
                            <KebabItem label="Close All" handleAction={() => { openCloseFolders(false) }} icon={<IconFolder size={14}/>} minWidth={84} />
                            
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
        includeFolders={false}
        selectedPrompts={!isConvSide  ? checkedItems : []}
        selectedConversations={isConvSide  ? checkedItems : []}
        />)}

        {isTagsDialogVisible && 
        <div className="fixed inset-0 bg-black bg-opacity-50 h-full w-full">
            <div className="flex items-center justify-center min-h-screen">
              <div className="border border-neutral-300 dark:border-netural-400 bg-white dark:bg-[#202123] rounded-lg md:rounded-lg shadow-lg overflow-hidden mx-auto max-w-lg w-[400px]"
              >
                <div className="p-2 h-[60px] overflow-y-auto">
                <TagsList tags={tags} 
                    setTags={(tags) => {
                                setTags(tags);
                                checkedItems.forEach(async (item: Conversation) => {
                                    const itemTags = item.tags || [];
                                    item.tags = [...itemTags, ...tags.filter(tag => !itemTags.includes(tag))]
                                    if (isRemoteConversation(item)) {
                                        try {
                                            const fullConv = await fetchMultipleRemoteConversations([item.id]);
                                            if (fullConv.length > 0) uploadConversation({...fullConv[0], tags: item.tags});
                                        } catch {
                                            console.log("Failed to update remote conversation with new tags")
                                        } 
                                    }
                                })
                            }}
                    removeTag={(tag) => {
                        checkedItems.forEach(async (item: Conversation) => {
                            item.tags = item.tags?.filter(x => x != tag)
                            if (isRemoteConversation(item)) {
                                try {
                                    const fullConv = await fetchMultipleRemoteConversations([item.id]);
                                    if (fullConv.length > 0) uploadConversation({...fullConv[0], tags: item.tags});
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
                        className="w-full mb-1 px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                        onClick={() => {setIsTagsDialogVisible(false);
                                        clear();
                                        if (tags.length > 0)  {
                                            homeDispatch({ field: 'conversations', value: items });
                                            localStorage.setItem('conversationHistory', JSON.stringify(items));
                                            const updatedSelected = items.find((c) => (selectedConversation) ? c.id === selectedConversation.id : false);
                                            if (updatedSelected) {
                                                const selectedWithTags = {...selectedConversation, tags: updatedSelected.tags};
                                                homeDispatch({ field: 'selectedConversation', value: selectedWithTags});
                                                localStorage.setItem('selectedConversation', JSON.stringify(selectedWithTags))
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
        </div>
      );
      
}

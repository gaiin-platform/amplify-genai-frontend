import HomeContext from "@/pages/api/home/home.context";
import { Conversation } from "@/types/chat";
import { FolderInterface } from "@/types/folder";
import { Prompt } from "@/types/prompt";
import React from "react";
import { FC, useContext, useEffect, useRef, useState } from "react";

interface Props {
    selectedPromptsState? : Prompt[];
    setSelectedPrompts? : React.Dispatch<React.SetStateAction<Prompt[]>>;
    includePrompts? : boolean;
    promptFilter? : (p:Prompt[]) => Prompt[];
    

    selectedConversationsState? : Conversation[];
    setSelectedConversations? :  React.Dispatch<React.SetStateAction<Conversation[]>>;
    includeConversations? : boolean;
    conversationFilter? : (c:Conversation[]) => Conversation[];

    selectedFoldersState? : FolderInterface[];
    setSelectedFolders? : React.Dispatch<React.SetStateAction<FolderInterface[]>>;
    includeFolders? : boolean;
    folderFilter? : (f:FolderInterface[]) => FolderInterface[];
}


export const ItemSelect: FC<Props> = (
    { selectedPromptsState = [], setSelectedPrompts = (p) => {},
      includePrompts = false, promptFilter = (p) => p,

      selectedConversationsState = [], setSelectedConversations = (C) => {},
      includeConversations = false, conversationFilter = (c) => c,

      selectedFoldersState = [], setSelectedFolders = (F) => {},
      includeFolders = false, folderFilter = (f) => f
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

    const itemRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});

    const [promptsChecked, setPromptsChecked] = useState(false);
    const [conversationsChecked, setConversationsChecked] = useState(false);
    const [foldersChecked, setFoldersChecked] = useState(false);
    
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
                setSelectedPrompts((prevItems: Prompt[]) => toggleItem(prevItems, item as Prompt));
                break;
            }
            case 'Conversation': {
                setSelectedConversations((prevItems: Conversation[]) => toggleItem(prevItems, item as Conversation));
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
                        const folderPrompts = promptsRef.current.filter((p:Prompt) => p.folderId === folder.id);
                        setSelectedPrompts(prevPrompts => [...prevPrompts.filter((p:Prompt) => p.folderId !== folder.id), 
                                                           ...folderPrompts]);
                    } else if (folder.type === 'chat') {
                        const folderConversations = conversationsRef.current.filter((c:Conversation) => c.folderId === folder.id);
                        setSelectedConversations(prevConversations => [...prevConversations.filter((c:Conversation) => c.folderId !== folder.id), 
                                                                       ...folderConversations]);
                    }
                }

                setSelectedFolders((prevItems: FolderInterface[]) => toggleItem(prevItems, folder));

                break;
            }
            default:
                return;
        }
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

    const toggleItem = <T, >(items: Array<T>, item: T) => {
        return items.some(i => i === item) ? items.filter(i => i !== item) : [...items, item];
    }


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
    
        const renderScrollableSection = (isVisible: boolean, isChecked: boolean, handleCheck: (e :boolean) => void,
                                         items: Array<Prompt | Conversation | FolderInterface>, itemType: string) => {
            return isVisible ? (
                <>
                    <div className="mt-4 flex items-center border-b">
                        <input
                            type="checkbox"
                            className="mx-2 form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                            checked={isChecked}
                            onChange={(e) => handleCheck(e.target.checked)}
                        />
                        <h3 className="ml-2 text-black dark:text-white text-lg">{`${itemType}s`}</h3>
                    </div>

                    <div>
                        {items.map((item) =>
                            renderItem(item, itemType)
                        )}
                    </div>
                </>
                ) : null};
            
    return (
        <>
        <div className="overflow-y-auto" style={{maxHeight: "calc(100vh - 200px)"}}>
        
            {renderScrollableSection(includePrompts, promptsChecked, handlePromptsCheck, 
                                     promptFilter(promptsRef.current), 'Prompt')}
        
            {renderScrollableSection(includeConversations, conversationsChecked,handleConversationsCheck,
                                     conversationFilter(conversationsRef.current), 'Conversation')}

            {renderScrollableSection(includeFolders, foldersChecked, handleFoldersCheck, 
                                     folderFilter(foldersRef.current), 'Folder')}

        </div>
        </>
    );


}
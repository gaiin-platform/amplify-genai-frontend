import HomeContext from "@/pages/api/home/home.context";
import { Conversation } from "@/types/chat";
import { FolderInterface } from "@/types/folder";
import { Prompt } from "@/types/prompt";
import React from "react";
import { FC, useContext, useEffect, useRef, useState } from "react";
import Checkbox from "./CheckBox";
import { IconFolder, IconMessage, IconRobot, IconChevronUp, IconChevronDown } from "@tabler/icons-react";

interface Props {
    promptOptions?: Prompt[];
    conversationOptions? : Conversation[];
    folderOptions? : FolderInterface[];

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

    scrollToFirstSelected?: boolean;
    handleRootPromptIds?: boolean;
}

const ITEM_TYPES = ['Conversation', 'Folder', 'Prompt'] as const;
type ItemType = typeof ITEM_TYPES[number];

export const ItemSelect: FC<Props> = (
    { promptOptions, conversationOptions, folderOptions, 

      selectedPromptsState = [], setSelectedPrompts = (p) => {},
      includePrompts = false, promptFilter = (p) => p,

      selectedConversationsState = [], setSelectedConversations = (C) => {},
      includeConversations = false, conversationFilter = (c) => c,

      selectedFoldersState = [], setSelectedFolders = (F) => {},
      includeFolders = false, folderFilter = (f) => f,

      scrollToFirstSelected = false,
      handleRootPromptIds = false
    }) => {

    const {
        state: {prompts, conversations, folders},
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

    const getItems = (itemType: ItemType) => {
        switch (itemType) {
            case 'Prompt':
                return (includePrompts ? promptFilter(promptOptions ?? promptsRef.current) : []) as Prompt[];
            case 'Conversation':
                return (includeConversations ? conversationFilter(conversationOptions ?? conversationsRef.current) : []) as Conversation[];
            case 'Folder':
                return (includeFolders ? folderFilter(folderOptions ?? foldersRef.current) : []) as FolderInterface[];
            default:
                return [] as any;
        }
    };

    const itemRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});

    const [allPromptsChecked, setAllPromptsChecked] = useState(false);
    const [allConversationsChecked, setAllConversationsChecked] = useState(false);
    const [allFoldersChecked, setAllFoldersChecked] = useState(false);
    
    // Expandable section state
    const [expandedSection, setExpandedSection] = useState<ItemType | null>(null);
    const [hoveredSection, setHoveredSection] = useState<ItemType | null>(null);
    
    const noItems = ITEM_TYPES.every(type => getItems(type).length === 0);
    
    // Calculate which sections are visible and their heights
    const visibleSections = ITEM_TYPES.filter(type => getItems(type).length > 0);
    const numVisibleSections = visibleSections.length;
    
    // Calculate dynamic heights
    const calculateSectionHeight = (sectionType: ItemType) => {
        if (numVisibleSections === 1) return '400px'; // Single section takes full height
        
        if (expandedSection) {
            if (sectionType === expandedSection) {
                return '300px'; // Expanded section
            } else {
                return '100px'; // Collapsed sections
            }
        }
        
        // Even distribution
        const baseHeight = Math.floor(400 / numVisibleSections);
        return `${baseHeight}px`;
    };

    
    const handlePromptsCheck = (checked:boolean) => {
        // if checked, add all prompts to selected, else remove them
        setSelectedPrompts(checked ? promptOptions ?? promptsRef.current : []);
        setAllPromptsChecked(checked);
    };


    const handleConversationsCheck = (checked:boolean) => {
        setSelectedConversations(checked ? conversationOptions ?? conversationsRef.current : []);
        setAllConversationsChecked(checked);
    };


    const handleFoldersCheck = (checked:boolean) => {
        setSelectedFolders(checked ? folderOptions ?? foldersRef.current : []);
        setAllFoldersChecked(checked);
    };
    
    // Handle section expand/collapse
    const handleSectionToggle = (sectionType: ItemType) => {
        if (numVisibleSections <= 1) return; // Don't allow expand/collapse if only one section
        
        if (expandedSection === sectionType) {
            setExpandedSection(null); // Collapse if already expanded
        } else {
            setExpandedSection(sectionType); // Expand this section
        }
    };

    useEffect(() => {
        const promptSelection: Prompt[] = getItems("Prompt");
        let updatedCheck = null;
        if (handleRootPromptIds) {
            const ids = promptSelection.map((p: Prompt) => p.id);
            const selectedIds = new Set(selectedPromptsState.map(p => p.id));
            updatedCheck = ids.every(id => selectedIds.has(id));
        } else {
            updatedCheck = selectedPromptsState.length === promptSelection.length;
        }
                             
        if (updatedCheck !== allPromptsChecked) setAllPromptsChecked(updatedCheck);
    }, [selectedPromptsState]);


    useEffect(() => {
        const conversationSelection = getItems("Conversation");
        const updatedCheck = selectedConversationsState.length === conversationSelection.length;
        if (updatedCheck !== allConversationsChecked) setAllConversationsChecked(updatedCheck);
    }, [selectedConversationsState]);


    useEffect(() => {
        const folderSelection = getItems("Folder");
        const updatedCheck = selectedFoldersState.length === folderSelection.length;
        if (updatedCheck !== allFoldersChecked) setAllFoldersChecked(updatedCheck);
    }, [selectedFoldersState]);
    
     const getIcon = (item: any, itemType: ItemType) => {
        switch (itemType) {
            case 'Folder':
                return <IconFolder size={18}/>;
            case 'Prompt': {
                if (item.data && item.data.assistant) return (<IconRobot size={18} />)
                // otherwise return default
            }
            default: {
                return <IconMessage size={18}/>;
            }
        }
    }

    const handleItemSelect = (item: Prompt | Conversation | FolderInterface, itemType: ItemType) => {
        switch (itemType) {
            case 'Prompt': {
                const prompt = item as Prompt;

                if (handleRootPromptIds && !selectedPromptsState.some(i => i.id === prompt.id)) {
                    let promptsToSelect = [prompt];

                    // See if the prompt has a data.rootPromptId that is in the selected prompts
                    // and if not, select it
                    if (prompt.data?.rootPromptId) {
                        const rootPrompt = prompts.find(p => p.id === prompt.data?.rootPromptId);
                        if (rootPrompt && !selectedPromptsState.some(i => i.id === rootPrompt.id)) {
                            promptsToSelect.push(rootPrompt);
                        }
                    }
                    setSelectedPrompts([...selectedPromptsState, ...promptsToSelect]);
                } else {
                    setSelectedPrompts((prevItems: Prompt[]) => toggleItem(prevItems, item as Prompt));
                }

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
                        const promptSelection: Prompt[] = promptOptions ?? promptsRef.current;
                        const folderPrompts = promptSelection.filter((p:Prompt) => p.folderId === folder.id);
                        setSelectedPrompts(prevPrompts => [...prevPrompts.filter((p:Prompt) => p.folderId !== folder.id), 
                                                           ...folderPrompts]);
                    } else if (folder.type === 'chat') {
                        const conversationSelection = conversationOptions ?? conversationsRef.current;
                        const folderConversations = conversationSelection.filter((c:Conversation) => c.folderId === folder.id);
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

    useEffect(() => {
        if (scrollToFirstSelected) {
             const firstSelectedId =
             selectedPromptsState[0]?.id || selectedConversationsState[0]?.id || selectedFoldersState[0]?.id;

            // @ts-ignore
            itemRefs.current[firstSelectedId]?.current?.scrollIntoView({
                block: 'center',
            });
        }
    }, []);

    const isSelected = (item: { id: string; }, itemType: ItemType) => {
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


    const renderItem = (item: Prompt | Conversation | FolderInterface, itemType: ItemType) => {
            // Create a new ref for each item if it does not exist yet.
            if (!itemRefs.current[item.id]) {
                itemRefs.current[item.id] = React.createRef();
            }
    
            return (
                <div id="checkBoxItem" className="flex items-center p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#40414F]" ref={itemRefs.current[item.id]} key={item.id}>
                    <Checkbox
                        id={item.id}
                        label={``}
                        checked={isSelected(item, itemType)}
                        onChange={(checked: boolean) => handleItemSelect(item, itemType)}
                    />
                    <div id="checkBoxName" className="ml-2 mb-1 text-black dark:text-white font-medium flex flex-row gap-2 ">
                        {getIcon(item, itemType)} {item.name}
                    </div>
                </div>
            );
        };
    
        const renderScrollableSection = (isChecked: boolean, handleCheck: (e :boolean) => void, itemType: ItemType) => {
            const items:Array<Prompt | Conversation | FolderInterface> = getItems(itemType);
            if (items.length === 0) return null;
            
            const sectionHeight = calculateSectionHeight(itemType);
            const isExpanded = expandedSection === itemType;
            const showCaret = numVisibleSections > 1;
            const isHovered = hoveredSection === itemType;
            
            return (
                <div 
                    className="relative mt-6 flex flex-col transition-all duration-300"
                    style={{ height: sectionHeight }}
                    onMouseEnter={() => setHoveredSection(itemType)}
                    onMouseLeave={() => setHoveredSection(null)}
                >
                    {/* Header with checkbox and title */}
                    <div className="flex items-center border-b border-b-black dark:border-b-white pb-2">
                        <div className="ml-2" title={`${isChecked ? "Deselect": "Select"} All ${itemType}s`}>
                            <Checkbox
                                id={itemType}
                                label={``}
                                checked={isChecked}
                                onChange={(checked: boolean) => handleCheck(checked)}
                            />
                        </div>
                        <h3 className="ml-2 mb-1 text-black dark:text-white text-lg">{`${itemType}s`}</h3>
                    </div>

                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto mt-2">
                        {items.map((item) =>
                            renderItem(item, itemType)
                        )}
                    </div>
                    
                    {/* Expandable caret - only show if multiple sections and (hovered or collapsed when expanded) */}
                    {showCaret && (isHovered || (expandedSection && !isExpanded)) && (
                        <div className="absolute bottom-[-15px] left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <button
                                onClick={() => handleSectionToggle(itemType)}
                                className="bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500 rounded-full p-1 transition-colors duration-200 shadow-lg"
                                title={isExpanded ? `Collapse ${itemType}s` : `Expand ${itemType}s`}
                            >
                                {isExpanded ? (
                                    <IconChevronUp size={16} className="text-white" />
                                ) : (
                                    <IconChevronDown size={16} className="text-white" />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            );
        };
            
    return (

        noItems ? 
        <div className="mt-4"> No items available to select </div>
        :
        <>
            {renderScrollableSection(allPromptsChecked, handlePromptsCheck, 'Prompt')}
        
            {renderScrollableSection(allConversationsChecked,handleConversationsCheck, 'Conversation')}

            {renderScrollableSection(allFoldersChecked, handleFoldersCheck, 'Folder')}

        </>
    );

}
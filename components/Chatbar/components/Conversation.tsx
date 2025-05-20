import {
  IconCheck,
  IconMessage,
  IconPencil,
  IconTrash,
  IconX,
  IconCloudFilled,
  IconCloud
} from '@tabler/icons-react';
import {
  DragEvent,
  KeyboardEvent,
  MouseEventHandler,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Conversation } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import ChatbarContext from '@/components/Chatbar/Chatbar.context';
import { uploadConversation } from '@/services/remoteConversationService';
import { isLocalConversation, isRemoteConversation } from '@/utils/app/conversation';
import ActionButton from '@/components/ReusableComponents/ActionButton';

interface Props {
  conversation: Conversation;
}

export const ConversationComponent = ({ conversation}: Props) => {
  const {
    state: { selectedConversation, messageIsStreaming, artifactIsStreaming, checkingItemType, checkedItems, folders},
    handleSelectConversation,
    handleUpdateConversation,
    dispatch: homeDispatch
  } = useContext(HomeContext);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);

  const { handleDeleteConversation } = useContext(ChatbarContext);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [checkConversations, setCheckConversations] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    
    if (selectedConversation?.id === conversation.id) {
      // Wait a tick (or 100ms) to ensure the folder is open and DOM has updated
      const timeoutId = setTimeout(() => {
        if (conversationRef.current && !isInViewport(conversationRef.current, 100)) {
          // Find the sidebar container
          const sidebarContainer = conversationRef.current.closest('.enhanced-sidebar');
          if (sidebarContainer) {
            // Instead of scrollIntoView which can be too aggressive, use scrollBy
            // to scroll just enough to make the element visible
            const rect = conversationRef.current.getBoundingClientRect();
            const containerRect = sidebarContainer.getBoundingClientRect();
            
            // Calculate how much we need to scroll to make the element visible
            // but without scrolling all the way to center it
            if (rect.top < containerRect.top + 80) {
              // Element is above the visible area or too close to top
              sidebarContainer.scrollBy({
                top: rect.top - containerRect.top - 80, // Leave space at the top
                behavior: 'smooth'
              });
            } else if (rect.bottom > containerRect.bottom - 20) {
              // Element is below the visible area or too close to bottom
              sidebarContainer.scrollBy({
                top: rect.bottom - containerRect.bottom + 20, // Leave space at the bottom
                behavior: 'smooth'
              });
            }
          }
        } 
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedConversation]);

  const handleEnterDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      selectedConversation && handleRename(selectedConversation);
    }
  };

  const handleDragStart = (
    e: DragEvent<HTMLButtonElement>,
    conversation: Conversation,
  ) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('conversation', JSON.stringify(conversation));
    }
  };

  const handleRename = async (conversation: Conversation) => {
    if (renameValue.trim().length > 0) {
      handleUpdateConversation(conversation, {
        key: 'name',
        value: renameValue,
      });
      // you can only rename a conversation that is the cur selected conversation. this is where we have the updated conversation
      if (isRemoteConversation(conversation) && selectedConversation) {
        const renamedSelected = {...selectedConversation, name: renameValue};
        homeDispatch({field: 'selectedConversation', value: renamedSelected});
        uploadConversation(renamedSelected, foldersRef.current);
      }
      setRenameValue('');
      setIsRenaming(false);
    }
  };

  const handleConfirm: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    if (isDeleting) {
      handleDeleteConversation(conversation);
    } else if (isRenaming) {
      handleRename(conversation);
    }
    setIsDeleting(false);
    setIsRenaming(false);
  };

  const handleCancel: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsDeleting(false);
    setIsRenaming(false);
  };

  const handleOpenRenameModal: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsRenaming(true);
    selectedConversation && setRenameValue(selectedConversation.name);
  };
  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsDeleting(true);
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  useEffect(() => {
    if (checkingItemType === 'Conversations') setCheckConversations(true);
    if (checkingItemType === null) setCheckConversations(false);
  }, [checkingItemType]);


  useEffect(() => {
    setIsChecked((checkedItems.includes(prompt) ? true : false)); 
  }, [checkedItems]);

  const handleCheckboxChange = (checked: boolean) => {
    if (checked){
      homeDispatch({field: 'checkedItems', value: [...checkedItems, conversation]}); 
    } else {
      homeDispatch({field: 'checkedItems', value: checkedItems.filter((i:any) => i !== conversation)});
    }
  }

  function isInViewport(el: HTMLElement, padding: number = 0) {
    const rect = el.getBoundingClientRect();
    const sidebarContainer = el.closest('.enhanced-sidebar');
    
    if (sidebarContainer) {
      // Check visibility within the sidebar container instead of the whole window
      const containerRect = sidebarContainer.getBoundingClientRect();
      return (
        // Add padding to ensure element isn't just barely visible
        rect.top >= containerRect.top + padding &&
        rect.bottom <= containerRect.bottom - padding
      );
    }
    
    // Fallback to window viewport check if no container found
    return (
      rect.top >= padding &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - padding &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  

  return (
    <div ref={conversationRef} className="relative flex items-center overflow-visible">
      {isRenaming && selectedConversation?.id === conversation.id ? (
        <div className="flex w-full items-center gap-3 rounded-md bg-neutral-200 dark:bg-[#343541]/90 p-3">
          {isLocalConversation(conversation) ? 
            <IconMessage size={18} className="text-blue-500" /> 
            :  
            <div>
              <IconCloud className="block dark:hidden text-blue-500" size={18} />
              <IconCloudFilled className="hidden dark:block text-blue-400" size={18} />
            </div>
          }
          <input
            className="mr-12 flex-1 ml-[-8px] overflow-hidden overflow-ellipsis border-b border-neutral-300 dark:border-neutral-600 bg-transparent text-left text-[13px] leading-5 dark:text-white outline-none focus:border-blue-500 px-1 py-0.5"
            id="isRenamingInput"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleEnterDown}
            autoFocus
          />
        </div>
      ) : (
        <button
          id="chatClick"
          className={`enhanced-conversation-item group flex w-full cursor-pointer items-center gap-3 text-sm transition-all duration-200 ${
            messageIsStreaming || artifactIsStreaming? 'opacity-70 disabled:cursor-not-allowed' : ''
          } ${
            selectedConversation?.id === conversation.id
              ? 'selected'
              : ''
          }`}
          onClick={() => handleSelectConversation(conversation)}
          disabled={messageIsStreaming || artifactIsStreaming}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, conversation)}
          title="View Conversation"
        >
         <div className="relative flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full ${selectedConversation?.id === conversation.id ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700/20'} 
                          transform scale-0 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100`}></div>
            {isLocalConversation(conversation) ? 
              <IconMessage size={20} className={`${selectedConversation?.id === conversation.id ? 'text-blue-500 drop-shadow-sm' : 'text-gray-600 dark:text-gray-400'}`} /> 
              : 
              <div className="relative">
                <IconCloud className={`block dark:hidden ${selectedConversation?.id === conversation.id ? 'text-blue-500' : 'text-gray-600'}`} size={20} />
                <IconCloudFilled className={`hidden dark:block ${selectedConversation?.id === conversation.id ? 'text-blue-400' : 'text-gray-400'}`} size={20} />
              </div>
            }
          </div>
         
          <div
            id="chatName"
            className={`sidebar-text relative max-h-5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap break-all text-left ${
              selectedConversation?.id === conversation.id ? 'pr-12 font-medium' : 'pr-1'
            } ${conversation.name === 'New Conversation' ? 'conversation-title-new' : ''}`}
          >
            {conversation.name}
          </div>
        </button>
      )}

      {(isDeleting || isRenaming) &&
        selectedConversation?.id === conversation.id && (
          <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded-md shadow-sm overflow-hidden fade-in">
            <ActionButton 
              id="handleConfirm" 
              handleClick={handleConfirm}
              className="enhanced-action-button text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
            >
              <IconCheck size={18} />
            </ActionButton>
            <ActionButton 
              id="handleCancel" 
              handleClick={handleCancel}
              className="enhanced-action-button text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <IconX size={18} />
            </ActionButton>
          </div>
        )}


      { checkConversations &&  (
        <div className="relative flex items-center">
          <div key={conversation.id} className="absolute right-4 z-10">
              <input
              type="checkbox"
              checked={checkedItems.includes(conversation)}
              onChange={(e) => handleCheckboxChange(e.target.checked)}
              />
          </div>
        </div>
      )}  

      {selectedConversation?.id === conversation.id &&
        !isDeleting && !isRenaming && !checkConversations &&
        ( <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded-md shadow-sm overflow-hidden fade-in">
            <ActionButton 
              handleClick={handleOpenRenameModal} 
              id="isRenaming" 
              title="Rename Conversation"
              className="enhanced-action-button hover:bg-green-100 dark:hover:bg-green-900/20"
            >
              <IconPencil size={18} className="text-green-600 dark:text-green-400" />
            </ActionButton>
            <ActionButton 
              handleClick={handleOpenDeleteModal} 
              id="isDeleting" 
              title="Delete Conversation"
              className="enhanced-action-button hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <IconTrash size={18} className="text-red-500" />
            </ActionButton>
          </div>
        )}
    </div>
  );
};

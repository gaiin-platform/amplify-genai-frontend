import { IconFolderPlus, IconMistOff, IconPlus, IconSparkles, IconX } from '@tabler/icons-react';
import { ReactNode, useContext, useState, useEffect, FC } from 'react';
import { useTranslation } from 'react-i18next';
import Search from '../Search';
import { KebabMenu } from '@/components/Sidebar/components/KebabMenu';
import { SortType } from '@/types/folder';
import HomeContext from '@/pages/api/home/home.context';


interface Props<T> {
  isOpen: boolean;
  addItemButtonTitle: string;
  side: 'left' | 'right';
  items: T[];
  itemComponent: ReactNode;
  folderComponent: ReactNode;
  footerComponent?: ReactNode;
  searchTerm: string;
  handleSearchTerm: (searchTerm: string) => void;
  handleCreateItem: () => void;
  handleCreateFolder?: () => void;
  handleDrop: (e: any) => void;
  handleCreateAssistantItem: () => void;
  setFolderSort: (s: SortType) => void;
}

const Sidebar = <T,>({
  isOpen,
  addItemButtonTitle,
  side,
  items,
  itemComponent,
  folderComponent,
  footerComponent,
  searchTerm,
  handleSearchTerm,
  handleCreateItem,
  handleCreateFolder,
  handleDrop,
  handleCreateAssistantItem,
  setFolderSort,
}: Props<T>) => {

  const { state: { messageIsStreaming }} = useContext(HomeContext);
  const { t } = useTranslation('promptbar');
  const [isAnimated, setIsAnimated] = useState(false);

  // Trigger animation when sidebar is opened
  useEffect(() => {
    if (isOpen) resetAnimation();
  }, [isOpen]);

  const resetAnimation = () => {
    setIsAnimated(true);
    const timer = setTimeout(() => setIsAnimated(false), 300);
    return () => clearTimeout(timer);
  }

  const allowDrop = (e: any) => {
    e.preventDefault();
  };

  const highlightDrop = (e: any) => {
    e.target.classList.add('bg-neutral-200', 'dark:bg-[#343541]/90');
    e.target.style.transition = 'background-color 0.15s ease-in-out';
  };

  const removeHighlight = (e: any) => {
    e.target.classList.remove('bg-neutral-200', 'dark:bg-[#343541]/90');
  };

  const addItemButton = (width: string) => ( 
    <button 
      id="promptButton" 
      className={`enhanced-add-button text-sidebar flex ${width} flex-shrink-0 select-none items-center gap-3
      ${side === 'left' && messageIsStreaming ? "opacity-60 cursor-not-allowed" : ""}`}
      disabled={side === 'left' && messageIsStreaming}
      onClick={() => {
        handleCreateItem();
        handleSearchTerm('');
      }}
    >
      <IconPlus size={18} className="enhanced-icon" />
      <span className="sidebar-text font-medium">{addItemButtonTitle}</span>
    </button>
  );


  const addButtonForSide = (side: string) => {
    if (side === 'left') return addItemButton("flex-1 min-w-0")

    const addAssistantButton = (
      <button
        id="addAssistantButton"
        className="enhanced-add-button flex flex-1 min-w-0 flex-shrink-0 select-none items-center gap-2"
        onClick={() => {
          handleCreateAssistantItem();
          handleSearchTerm('');
        }}
      >
        <IconSparkles size={18} className="enhanced-icon text-purple-500 flex-shrink-0" />
        <span className="sidebar-text font-medium truncate">Assistant</span>
      </button>
    );

    return addAssistantButton
  }

  return (
    <div className={`overflow-x-hidden h-full`}>
      <div
        className={`enhanced-sidebar fixed top-0 ${side}-0 z-40 flex h-full w-[270px] flex-none flex-col space-y-3 
                   p-3 text-[14px] transition-all sm:relative sm:top-0 ${isAnimated ? 'slide-in' : ''}`}
        style={{ height: footerComponent ? 'calc(100% - 50px)' : '100%' }}
      >
        <div className="flex items-center justify-between w-full gap-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {addButtonForSide(side)}
           {handleCreateFolder && <button
              className="enhanced-folder-button flex-shrink-0"
              onClick={handleCreateFolder}
              id="createFolderButton"
              title="Create Folder"
              style={{ minWidth: '32px', width: '32px', height: '38px' }}
            >
              <IconFolderPlus size={16} className="enhanced-icon" />
            </button> }
          </div>
        </div>
        {side === 'right' && addItemButton('')}
        <Search
          placeholder={t('Search...') || ''}
          searchTerm={searchTerm}
          onSearch={handleSearchTerm}
        />

        <KebabMenu
          label={side === 'left' ? "Conversations": "Prompts"} 
          items={items}
          handleSearchTerm={handleSearchTerm}
          setFolderSort={setFolderSort}
        />
        
        <div className="relative flex-grow w-[268px] enhanced-sidebar overflow-y-auto" id="sidebarScroll" style={{ height: 'calc(100vh - 170px)', display: 'flex', flexDirection: 'column' }}>
          {items?.length > 0 && (
            <div className="flex border-b dark:border-white/20 pb-3 mb-2">
              {folderComponent}
            </div>
          )}

          {items?.length > 0 ? (
              <div
              onDrop={handleDrop}
              onDragOver={allowDrop}
              onDragEnter={highlightDrop}
              onDragLeave={removeHighlight}
            >
              {itemComponent}
            </div>
          ) : (
            <div className="empty-state mt-8">
              <IconMistOff className="empty-state-icon mx-auto mb-3" size={24} />
              <span className="empty-state-text">
                {t('No data.')}
              </span>
            </div>
          )}
        </div>
        {footerComponent}
      </div>
      {footerComponent && (
        <div 
          className={`fixed bottom-0 ${side}-0 z-40 w-[270px] bg-white dark:bg-[#202123] border-t border-neutral-300 dark:border-neutral-600`}
          style={{ left: side === 'left' ? '0' : 'auto', right: side === 'right' ? '0' : 'auto' }}
        >
          {footerComponent}
        </div>
      )}
    </div>
  );
};

export default Sidebar;

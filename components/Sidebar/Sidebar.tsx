import { IconFolderPlus, IconMistOff, IconPlus, IconSparkles, IconX } from '@tabler/icons-react';
import { ReactNode, useContext, useState, useEffect, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { KebabMenu } from '@/components/Sidebar/components/KebabMenu';
import { SortType } from '@/types/folder';
import HomeContext from '@/pages/api/home/home.context';

// Inline Search component to avoid import issues
interface SearchProps {
  placeholder: string;
  searchTerm: string;
  onSearch: (searchTerm: string) => void;
  disabled?: boolean;
  paddingY?: string;
}

const SearchComponent: FC<SearchProps> = ({ placeholder, searchTerm, onSearch, disabled=false, paddingY="py-3"}) => {
  const { t } = useTranslation('sidebar');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const clearSearch = () => {
    onSearch('');
  };

  return (
    <div className="relative flex items-center">
      <input
        id="SearchBar"
        className={`w-full flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-[#202123] px-4 ${paddingY} pr-10 text-[14px] leading-3 dark:text-white`}
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
        disabled={disabled}
        autoComplete={'off'}
        spellCheck={false}
      />

      {searchTerm && (
        <IconX
          className="absolute right-4 cursor-pointer text-neutral-300 hover:text-neutral-400"
          size={18}
          onClick={clearSearch}
        />
      )}
    </div>
  );
};


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
  toggleOpen: () => void;
  handleCreateItem: () => void;
  handleCreateFolder: () => void;
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
  toggleOpen,
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
    if (isOpen) {
      setIsAnimated(true);
      const timer = setTimeout(() => setIsAnimated(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
      <IconPlus size={16} className="enhanced-icon" />
      <span className="sidebar-text">{addItemButtonTitle}</span>
    </button>
  );


  const addButtonForSide = (side: string) => {
    if (side === 'left') return addItemButton("w-[205px]")

    const addAssistantButton = (
      <button
        id="addAssistantButton"
        className="enhanced-add-button flex w-[205px] flex-shrink-0 select-none items-center gap-3"
        onClick={() => {
          handleCreateAssistantItem();
          handleSearchTerm('');
        }}
      >
        <IconSparkles size={16} className="enhanced-icon text-purple-500" />
        <span className="sidebar-text">{"Assistant"}</span>
      </button>
    );

    return addAssistantButton
  }

  return (
    <div className={`border-t dark:border-white/20 overflow-x-hidden h-full`}>
      <div
        className={`enhanced-sidebar fixed top-0 ${side}-0 z-40 flex h-full w-[270px] flex-none flex-col space-y-3 
                   p-3 text-[14px] transition-all sm:relative sm:top-0 ${isAnimated ? 'slide-in' : ''}`}
      >
        <div className="flex items-center gap-2">
          {addButtonForSide(side)}
          <button
            className="enhanced-folder-button"
            onClick={handleCreateFolder}
            id="createFolderButton"
            title="Create Folder"
          >
            <IconFolderPlus size={16} className="enhanced-icon" />
          </button>
        </div>
        {side === 'right' && addItemButton('')}
        <div>
          <SearchComponent
            placeholder={t('Search...') || ''}
            searchTerm={searchTerm}
            onSearch={handleSearchTerm}
          />
        </div>

        <KebabMenu
          label={side === 'left' ? "Conversations": "Prompts"} 
          items={items}
          handleSearchTerm={handleSearchTerm}
          setFolderSort={setFolderSort}
        />
        
        <div className="relative flex-grow overflow-y-auto w-[268px] enhanced-sidebar">
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
              className="fade-in"
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
    </div>
  );
};

export default Sidebar;


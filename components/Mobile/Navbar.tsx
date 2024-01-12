import { IconPencil } from '@tabler/icons-react';
import { FC, useContext, useState } from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarContext';
import { OpenSidebarButton, CloseSidebarButton } from '@/components/Sidebar/components/OpenCloseButton';
import styles from './Navbar.module.css';
import { Conversation } from '@/types/chat';
import HomeContext from '@/pages/api/home/home.context';

interface Props {
  selectedConversation: Conversation | undefined;
  onNewConversation: () => void;
}

export const Navbar: FC<Props> = ({
  selectedConversation,
  onNewConversation,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(selectedConversation?.name || '');

  const { handleUpdateConversation } = useContext(HomeContext);

  const { state: { lightMode } } = useContext(HomeContext);

  const handleRename = () => {
    if (renameValue.trim().length > 0 && selectedConversation) {
      handleUpdateConversation(selectedConversation, { key: 'name', value: renameValue.trim() });
      setIsRenaming(false);
    }
  };

  const handleEnterDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleRename();
    }
  };

  const handleOpenRenameInput = () => {
    setIsRenaming(true);
    setRenameValue(selectedConversation?.name || '');
  };

  const handleRenameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRenameValue(event.target.value);
  };

  
  const { leftSidebarOpen, setLeftSidebarOpen, rightSidebarOpen, setRightSidebarOpen } = useSidebar();

  const toggleLeftSidebar = () => {
    setLeftSidebarOpen(!leftSidebarOpen);
  };

  const toggleRightSidebar = () => {
    setRightSidebarOpen(!rightSidebarOpen);
  };

  return (
    <nav className={`${styles.stickyNavbar} ${lightMode === 'light' ? styles.lightMode : ''}`}>
      <div className="flex-1 flex items-center justify-start">
        {leftSidebarOpen ?
          <CloseSidebarButton onClick={toggleLeftSidebar} side="left" isSidebarOpen={leftSidebarOpen} /> :
          <OpenSidebarButton onClick={toggleLeftSidebar} side="left" isSidebarOpen={leftSidebarOpen} />
        }
      </div>

      <div className="flex-1 text-center overflow-hidden text-ellipsis whitespace-nowrap">
        {isRenaming ? (
          <input
            className={`rename-input ${lightMode === 'dark' ? styles.darkModeInput : ''}`}
            type="text"
            value={renameValue}
            onChange={handleRenameInputChange}
            onKeyDown={handleEnterDown}
            autoFocus
          />
        ) : (
          selectedConversation?.name
        )}
      </div>
      
      <IconPencil
        className={`icon cursor-pointer hover:text-neutral-400 ml-4 ${lightMode === 'light' ? 'dark-text' : ''}`}
        onClick={isRenaming ? handleRename : handleOpenRenameInput}
      />

      <div className="flex-1 flex items-center justify-end">
        {rightSidebarOpen ?
          <CloseSidebarButton onClick={toggleRightSidebar} side="right" isSidebarOpen={rightSidebarOpen} /> :
          <OpenSidebarButton onClick={toggleRightSidebar} side="right" isSidebarOpen={rightSidebarOpen} />
        }
      </div>
    </nav>
  );
};
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { savePrompts } from '@/utils/app/prompts';

import { OpenAIModels } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { PromptFolders } from './components/PromptFolders';
import { PromptbarSettings } from './components/PromptbarSettings';
import { Prompts } from './components/Prompts';

import Sidebar from '../Sidebar';
import PromptbarContext from './PromptBar.context';
import { PromptbarInitialState, initialState } from './Promptbar.state';

import { v4 as uuidv4 } from 'uuid';
import {MessageType} from "@/types/chat";
import {PromptModal} from "@/components/Promptbar/components/PromptModal";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {FolderInterface} from "@/types/folder";

const Promptbar = () => {
  const { t } = useTranslation('promptbar');

  const promptBarContextValue = useCreateReducer<PromptbarInitialState>({
    initialState,
  });

  const [isShareDialogVisible, setIsShareDialogVisible] = useState(false);
  const [sharedPrompts, setSharedPrompts] = useState<Prompt[]>([])
  const [sharedFolders, setSharedFolders] = useState<FolderInterface[]>([])

  const {
    state: { prompts, defaultModelId, showPromptbar, statsService, featureFlags },
    dispatch: homeDispatch,
    handleCreateFolder,
  } = useContext(HomeContext);

  const {
    state: { searchTerm, filteredPrompts },
    dispatch: promptDispatch,
  } = promptBarContextValue;

  const handleTogglePromptbar = () => {
    homeDispatch({ field: 'showPromptbar', value: !showPromptbar });
    localStorage.setItem('showPromptbar', JSON.stringify(!showPromptbar));
  };

  const handleSharePrompt = (prompt: Prompt) => {
    setSharedPrompts([prompt]);
    setIsShareDialogVisible(true);
  }

  const handleShareFolder = (folder: FolderInterface) => {
    setSharedFolders([folder]);
    setIsShareDialogVisible(true);
  }

  const createPrompt = ():Prompt => {
    return {
      id: uuidv4(),
      name: `Prompt ${prompts.length + 1}`,
      description: '',
      content: '',
      model: (defaultModelId)? OpenAIModels[defaultModelId] : OpenAIModels["gpt-3.5-turbo"],
      folderId: null,
      type: MessageType.PROMPT
    };
  }

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(createPrompt());

  const handleAddPrompt = (prompt: Prompt) => {
    const updatedPrompts = [...prompts, prompt];

    homeDispatch({ field: 'prompts', value: updatedPrompts });

    savePrompts(updatedPrompts);
  }


  const handleCreatePrompt = () => {
    if (defaultModelId) {

      const newPrompt = createPrompt();

      statsService.createPromptEvent(newPrompt);

      const updatedPrompts = [...prompts, newPrompt];

      homeDispatch({ field: 'prompts', value: updatedPrompts });

      savePrompts(updatedPrompts);

      setPrompt(newPrompt);
      setShowModal(true);
    }
  };

  const handleDeletePrompt = (prompt: Prompt) => {
    statsService.deletePromptEvent(prompt);
    const prompts: Prompt[] = JSON.parse(localStorage.getItem('prompts') || '[]');
    const updatedPrompts = prompts.filter((p) => p.id !== prompt.id);

    homeDispatch({ field: 'prompts', value: updatedPrompts });
    savePrompts(updatedPrompts);

  };

  const handleCancelNewPrompt = () => {
    statsService.editPromptCanceledEvent(prompt);

    handleDeletePrompt(prompt);
    setShowModal(false);
  }

  const handleUpdatePrompt = (prompt: Prompt) => {

    statsService.editPromptCompletedEvent(prompt);

    const updatedPrompts = prompts.map((p) => {
      if (p.id === prompt.id) {
        return prompt;
      }

      return p;
    });
    homeDispatch({ field: 'prompts', value: updatedPrompts });

    savePrompts(updatedPrompts);
  };

  const handleDrop = (e: any) => {
    if (e.dataTransfer) {
      const prompt = JSON.parse(e.dataTransfer.getData('prompt'));

      const updatedPrompt = {
        ...prompt,
        folderId: e.target.dataset.folderId,
      };

      handleUpdatePrompt(updatedPrompt);

      e.target.style.background = 'none';
    }
  };

  useEffect(() => {

    const visiblePrompts = (featureFlags.overrideInvisiblePrompts) ? 
        prompts : prompts.filter((prompt) => !prompt.data?.hidden);

    if (searchTerm) {

      statsService.searchPromptsEvent(searchTerm);

      promptDispatch({
        field: 'filteredPrompts',
        value: visiblePrompts.filter((prompt) => {
          const searchable =
            prompt.name.toLowerCase() +
            ' ' +
            prompt.description.toLowerCase() +
            ' ' +
            prompt.content.toLowerCase();
          return searchable.includes(searchTerm.toLowerCase());
        }),
      });
    } else {
      promptDispatch({ field: 'filteredPrompts', value: visiblePrompts });
    }
  }, [searchTerm, prompts]);

  return (
    <PromptbarContext.Provider
      value={{
        ...promptBarContextValue,
        handleCreatePrompt,
        handleDeletePrompt,
        handleUpdatePrompt,
        handleAddPrompt,
        handleSharePrompt,
        handleShareFolder
      }}
    >
      <Sidebar<Prompt>
        side={'right'}
        isOpen={showPromptbar}
        addItemButtonTitle={t('Prompt Template')}
        itemComponent={
          <Prompts
            prompts={filteredPrompts.filter((prompt) => !prompt.folderId)}
          />
        }
        folderComponent={<PromptFolders />}
        items={filteredPrompts}
        searchTerm={searchTerm}
        handleSearchTerm={(searchTerm: string) =>
          promptDispatch({ field: 'searchTerm', value: searchTerm })
        }
        toggleOpen={handleTogglePromptbar}
        handleCreateItem={handleCreatePrompt}
        handleCreateFolder={() => {
          const name = window.prompt("Folder name:");
          handleCreateFolder(name || "New Folder", 'prompt')
        }}
        handleDrop={handleDrop}
      />

      <ShareAnythingModal
          open={isShareDialogVisible}
          onCancel={()=>{setIsShareDialogVisible(false)}}
          onShare={()=>{
            setIsShareDialogVisible(false);
          }}
          includePrompts={true}
          includeConversations={false}
          includeFolders={false}
          selectedPrompts={sharedPrompts}
          selectedFolders={sharedFolders}
      />

      {showModal && (
          <PromptModal
              prompt={prompt}
              onCancel={() => handleCancelNewPrompt()}
              onSave={() => setShowModal(false)}
              onUpdatePrompt={handleUpdatePrompt}
          />
      )}
    </PromptbarContext.Provider>
  );
};

export default Promptbar;

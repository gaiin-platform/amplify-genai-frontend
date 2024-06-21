import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { savePrompts } from '@/utils/app/prompts';

import { OpenAIModelID, OpenAIModels } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { PromptFolders } from './components/PromptFolders';
import { Prompts } from './components/Prompts';

import Sidebar from '../Sidebar';
import PromptbarContext from './PromptBar.context';
import { PromptbarInitialState, initialState } from './Promptbar.state';

import { v4 as uuidv4 } from 'uuid';
import {MessageType} from "@/types/chat";
import {PromptModal} from "@/components/Promptbar/components/PromptModal";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {FolderInterface, SortType} from "@/types/folder";
import { AssistantModal } from '../Promptbar/components/AssistantModal';
import { getAssistants, handleUpdateAssistantPrompt} from '@/utils/app/assistants';
import { AssistantDefinition } from '@/types/assistant';
import { useSession } from 'next-auth/react';




const Promptbar = () => {
  const { t } = useTranslation('promptbar');
  const { data: session } = useSession();


  const promptBarContextValue = useCreateReducer<PromptbarInitialState>({
    initialState,
  });

  const [isShareDialogVisible, setIsShareDialogVisible] = useState(false);
  const [sharedPrompts, setSharedPrompts] = useState<Prompt[]>([]);
  const [sharedFolders, setSharedFolders] = useState<FolderInterface[]>([]);
  const [folderSort, setFolderSort] = useState<SortType>('name');


  const {
    state: { prompts, defaultModelId, showPromptbar, statsService, featureFlags},
    dispatch: homeDispatch,
    handleCreateFolder,
  } = useContext(HomeContext);

  const promptsRef = useRef(prompts);

  useEffect(() => {
      promptsRef.current = prompts;
    }, [prompts]);
  
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

  const createPrompt = (name: string):Prompt => {
    return {
      id: uuidv4(),
      name: name,
      description: '',
      content: '',
      model: (defaultModelId)? OpenAIModels[defaultModelId as OpenAIModelID] : OpenAIModels["gpt-3.5-turbo"],
      folderId: null,
      type: MessageType.PROMPT
    };
  }

  const [showModal, setShowModal] = useState(false);
  const [showAssistantModal, setAssistantShowModal] = useState(false);

  const [prompt, setPrompt] = useState<Prompt>(createPrompt("Prompt 0"));
  const [assistantPrompt, setAssistantPrompt] = useState<Prompt>(createPrompt("Assistant 0"));


  const handleAddPrompt = (prompt: Prompt) => {
    const updatedPrompts = [...promptsRef.current, prompt];

    homeDispatch({ field: 'prompts', value: updatedPrompts });

    savePrompts(updatedPrompts);
  }


  const handleCreatePrompt = () => {
    if (defaultModelId) {

      const newPrompt = createPrompt(`Prompt ${promptsRef.current.length + 1}`);

      statsService.createPromptEvent(newPrompt);

      const updatedPrompts = [...promptsRef.current, newPrompt];

      homeDispatch({ field: 'prompts', value: updatedPrompts });

      savePrompts(updatedPrompts);

      setPrompt(newPrompt);
      setShowModal(true);
    }
  };

  const handleCreateAssistant = () => {
    if (defaultModelId) {
      const promptName = `Assistant ${getAssistants(promptsRef.current).length + 1}`
      const newPrompt = createPrompt(promptName);
      newPrompt.folderId = "assistants";

      const assistantDef: AssistantDefinition = {
                            name: newPrompt.name,
                            description: "",
                            instructions: "",
                            tools: [],
                            tags: [],
                            dataSources: [],
                            version: 1,
                            fileKeys: [],
                            provider: 'Amplify'
                          }

      if (!newPrompt.data) newPrompt.data = {};  
      if (!newPrompt.data.assistant) newPrompt.data.assistant = {};

      newPrompt.data.assistant.definition = assistantDef;
      setAssistantPrompt(newPrompt);
      setAssistantShowModal(true);
    }
  }

  const handleDeletePrompt = (prompt: Prompt) => {
    statsService.deletePromptEvent(prompt);
    const updatedPrompts = promptsRef.current.filter((p:Prompt) => p.id !== prompt.id);

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

    const updatedPrompts = promptsRef.current.map((p:Prompt) => {
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

    const visiblePrompts = (featureFlags.overrideInvisiblePrompts) ? prompts 
                             : prompts.filter((prompt: Prompt) => !prompt.data?.hidden);

    if (searchTerm) {

      statsService.searchPromptsEvent(searchTerm);

      promptDispatch({
        field: 'filteredPrompts',
        value: visiblePrompts.filter((prompt: Prompt) => {
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
        folderComponent={<PromptFolders sort={folderSort}/>}
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
        handleCreateAssistantItem={handleCreateAssistant}
        setFolderSort={setFolderSort}
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
      {showAssistantModal && (
        <AssistantModal
        assistant={assistantPrompt} 
        onCancel={() => {setAssistantShowModal(false)}}
        onSave={() => { setAssistantShowModal(false)
                statsService.createPromptEvent(assistantPrompt);
               }}
        onUpdateAssistant={async (assistantPrompt) => {
              handleUpdateAssistantPrompt(assistantPrompt, promptsRef.current, homeDispatch);
            }}
        loadingMessage='Creating assistant...'
        loc="add_assistant"
        />
      )}
      
    </PromptbarContext.Provider>
  );
};

export default Promptbar;

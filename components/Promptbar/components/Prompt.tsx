import {
  IconBulbFilled,
  IconEdit,
  IconCheck,
  IconTrash,
  IconX,
  IconDots,
  IconShare,
} from '@tabler/icons-react';
import {
  DragEvent,
  MouseEventHandler,
  useContext,
  useEffect,
  useState,
} from 'react';

import HomeContext from '@/pages/api/home/home.context';

import { Prompt } from '@/types/prompt';

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';

import PromptbarContext from '../PromptBar.context';
import { PromptModal } from './PromptModal';
import { ShareModal } from './ShareModal';
import { useChatService } from '@/hooks/useChatService';


interface Props {
  prompt: Prompt;
}

export const PromptComponent = ({ prompt }: Props) => {
  const {
    dispatch: promptDispatch,
    handleUpdatePrompt,
    handleDeletePrompt,
  } = useContext(PromptbarContext);

  const {
    state: { prompts, defaultModelId, showPromptbar },
    dispatch: homeDispatch,
    handleCreateFolder,
    handleNewConversation,
    handleSelectConversation,
    addPreProcessingCallback,
    removePreProcessingCallback,
    addPostProcessingCallback,
    removePostProcessingCallback,
  } = useContext(HomeContext);

  const [showShareModal, setShowShareModal] = useState(false);

  const { sendChatRequest } = useChatService();


  const handleSharePrompt = async () => {
    setShowShareModal(true);
  };

  const closeModal = () => {
    setShowShareModal(false);
  };

  const [showModal, setShowModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const handleStartPromptBuilder = () => {
    handleNewConversation(
        {
          name: "AI Prompt Helper",
          prompt:"You are a prompt engineering expert. " +
              "You help users write amazing prompts for GPT-4. " +
              "I will tell you what I am trying to do and you will write an amazing prompt for me" +
              "that includes chain of thought reasoning, step by step breakdown of the task, enriched" +
              "details from the domain, and any other helpful wording. You will then ask me if I like the prompt " +
              "and want to add it as an app that I can reuse later. At any point, if I indicate that I like the " +
              "prompt and want to use it in the future, you will output the special marker: " +
              "" +
              //"http://localhost?add_prompt=\"THE PROMPT YOU CREATED\"" +
              "<<DONE>>",
          messages: [
            {role: "assistant", content:"Tell me what you want the prompt to do and I will write it for you."}
          ],
          processors: [],
          tools:[],
        })
  }

  const dateTimeString = () => {
    let date = new Date();

    let month = ('0' + (date.getMonth() + 1)).slice(-2); // getMonth() starts from 0, so add 1
    let day = ('0' + date.getDate()).slice(-2);
    let year = date.getFullYear().toString().substr(-2); // take the last 2 digit of the year

    let hours = ('0' + date.getHours()).slice(-2);
    let minutes = ('0' + date.getMinutes()).slice(-2);

    let formattedDate = `${month}/${day}/${year} ${hours}:${minutes}`;
    return formattedDate;
  }

  const handleStartConversation = (prompt: Prompt) => {
    handleNewConversation(
        {
          name: prompt.name + " " +dateTimeString(),
          messages: [],
          promptTemplate: prompt,
          processors: [],
          tools:[],
        })
  }

  const handleUpdate = (prompt: Prompt) => {
    handleUpdatePrompt(prompt);
    promptDispatch({ field: 'searchTerm', value: '' });
  };

  const handleDelete: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();

    if (isDeleting) {
      handleDeletePrompt(prompt);
      promptDispatch({ field: 'searchTerm', value: '' });
    }

    setIsDeleting(false);
  };

  const handleCancelDelete: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsDeleting(false);
  };

  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsDeleting(true);
  };

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, prompt: Prompt) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('prompt', JSON.stringify(prompt));
    }
  };


  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  // @ts-ignore
  // @ts-ignore
  return (
      <div className="relative flex items-center">
        <div className="flex w-full">
          <button
              className="flex-grow cursor-pointer items-center gap-1 rounded-lg p-1 text-sm transition-colors duration-200 hover:bg-[#343541]/90"
              draggable="true"
              onClick={(e) => {
                e.stopPropagation();
                //setShowModal(true);
                handleStartConversation(prompt)
              }}
              onDragStart={(e) => handleDragStart(e, prompt)}
              onMouseLeave={() => {
                setIsDeleting(false);
                setIsRenaming(false);
                setRenameValue('');
              }}
          >
            {/*<IconEdit size={18} />*/}

            <div className="relative flex-1 overflow-hidden pr-4 text-left text-[12.5px] leading-3">
              <div style={{ maxWidth: '300px', overflowWrap: 'anywhere', hyphens: 'auto', lineHeight: '1.5em' }}>
                {prompt.name}
              </div>
            </div>
          </button>

          <div className="flex-shrink-0 flex items-center space-x-1">

            {!isDeleting && !isRenaming && (
                <SidebarActionButton handleClick={() => setShowModal(true)}>
                  <IconEdit size={18} />
                </SidebarActionButton>
            )}

            {!isDeleting && !isRenaming && (
                <SidebarActionButton handleClick={handleSharePrompt}>
                  <IconShare size={18} />
                </SidebarActionButton>
            )}

            {!isDeleting && !isRenaming && (
                <SidebarActionButton handleClick={handleOpenDeleteModal}>
                  <IconTrash size={18} />
                </SidebarActionButton>
            )}

            {(isDeleting || isRenaming) && (
                <>
                  <SidebarActionButton handleClick={handleDelete}>
                    <IconCheck size={18} />
                  </SidebarActionButton>

                  <SidebarActionButton handleClick={handleCancelDelete}>
                    <IconX size={18} />
                  </SidebarActionButton>
                </>
            )}
          </div>
        </div>

        {showModal && (
            <PromptModal
                prompt={prompt}
                onClose={() => setShowModal(false)}
                onUpdatePrompt={handleUpdate}
            />
        )}

        {showShareModal && (
            <ShareModal
                prompt={prompt}
                onClose={() => setShowShareModal(false)}
                onSharePrompt={(p)=>{alert("Share"+p.name)}}
            />
        )}
      </div>
  );
};

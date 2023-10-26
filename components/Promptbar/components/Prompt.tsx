import {
  IconBulbFilled,
  IconEdit,
    IconCopy,
  IconCheck,
  IconApiApp,
  IconMessage2,
  IconMessageChatbot,
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
import {v4 as uuidv4} from "uuid";
import {fillInTemplate, parsePromptVariables, VariableFillOptions} from "@/utils/app/prompts";
import {AttachedDocument} from "@/types/attacheddocument";


interface Props {
  prompt: Prompt;
}

export const PromptComponent = ({ prompt }: Props) => {
  const {
    dispatch: promptDispatch,
      handleAddPrompt,
    handleUpdatePrompt,
    handleDeletePrompt,
  } = useContext(PromptbarContext);

  const {
    state: { prompts, defaultModelId, showPromptbar, apiKey },
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
  const [isHovered, setIsHovered] = useState(false);

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

    let rootPromptObj = (prompt.data?.rootPromptId)?
        prompts.find((p) => p.id == prompt.data?.rootPromptId) : null;

    let rootPrompt = null;
    if(rootPromptObj != null && rootPromptObj?.content){
       let variables = parsePromptVariables(rootPromptObj?.content);
       let variableValues = variables.map((v) => "");
       rootPrompt = fillInTemplate(rootPromptObj?.content , variables, variableValues, [], true);
    }

    const getPromptTags = (prompt:Prompt|null|undefined) => {
      return (prompt && prompt.data && prompt.data.conversationTags) ? prompt.data.conversationTags : [];
    }

    let tags:string[] = [...getPromptTags(rootPromptObj), ...getPromptTags(prompt)]
    if(prompt.type == "automation"){
        tags.push("automation");
    }


    handleNewConversation(
        {
          name: prompt.name + " " +dateTimeString(),
          messages: [],
          promptTemplate: prompt,
          processors: [],
          tools:[],
          tags: tags,
          ...(rootPrompt != null && { prompt: rootPrompt }),
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

  const handleCopy = () => {
    const newPrompt = { ...prompt, id: uuidv4(), name: prompt.name + ' (copy)' };
    handleAddPrompt(newPrompt);
  }


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
      <div className="relative flex items-center"
           onMouseEnter={() => setIsHovered(true)}
           onMouseLeave={() => {
             setIsDeleting(false);
             setIsRenaming(false);
             setRenameValue('');
             setIsHovered(false)}
           }
      >
        <div className="relative flex w-full">
          <button
              className="w-full  cursor-pointer p-1 items-center gap-1 rounded-lg p-2 text-sm transition-colors duration-200 hover:bg-[#343541]/90"
              draggable="true"
              onClick={(e) => {
                e.stopPropagation();
                //setShowModal(true);
                handleStartConversation(prompt)
              }}
              onDragStart={(e) => handleDragStart(e, prompt)}
          >
            {/*<IconEdit size={18} />*/}

            <div className="relative flex items-center overflow-hidden text-left text-[12.5px] leading-3">
              <div className="pr-2">
                { (prompt.type === "automation") ? <IconApiApp/> : <IconMessage2/>}
              </div>
              <div className="overflow-hidden flex-1 text-ellipsis whitespace-nowrap break-all text-left text-[12.5px] leading-3">
                {prompt.name}
              </div>
            </div>

          </button>

          {isHovered &&
              <div className="absolute top-1 right-0 flex-shrink-0 flex flex-row items-center space-y-0 bg-gray-900 rounded">

                {!isDeleting && !isRenaming && (
                    <SidebarActionButton handleClick={handleCopy}>
                      <IconCopy size={18}/>
                    </SidebarActionButton>
                )}

                {!isDeleting && !isRenaming && (
                    <SidebarActionButton handleClick={() => setShowModal(true)}>
                      <IconEdit size={18}/>
                    </SidebarActionButton>
                )}

                {/*{!isDeleting && !isRenaming && (*/}
                {/*    <SidebarActionButton handleClick={handleSharePrompt}>*/}
                {/*      <IconShare size={18}/>*/}
                {/*    </SidebarActionButton>*/}
                {/*)}*/}

                {!isDeleting && !isRenaming && (
                    <SidebarActionButton handleClick={handleOpenDeleteModal}>
                      <IconTrash size={18}/>
                    </SidebarActionButton>
                )}

                {(isDeleting || isRenaming) && (
                    <>
                      <SidebarActionButton handleClick={handleDelete}>
                        <IconCheck size={18}/>
                      </SidebarActionButton>

                      <SidebarActionButton handleClick={handleCancelDelete}>
                        <IconX size={18}/>
                      </SidebarActionButton>
                    </>
                )}

              </div>
          }

        </div>

        {showModal && (
            <PromptModal
                prompt={prompt}
                onCancel={() => setShowModal(false)}
                onSave={() => setShowModal(false)}
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

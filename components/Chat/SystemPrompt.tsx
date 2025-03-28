import {
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';

import {Conversation, MessageType} from '@/types/chat';
import { Prompt } from '@/types/prompt';

import { PromptList } from './PromptList';
import { VariableModal } from './VariableModal';
import {Model} from "@/types/model";
import {AttachedDocument} from "@/types/attacheddocument";
import {fillInTemplate} from "@/utils/app/prompts";

interface Props {
  models: Model[];
  conversation: Conversation;
  prompts: Prompt[];
  onChangePrompt: (prompt: string) => void;
  handleUpdateModel: (model: Model) => void;
}

export const SystemPrompt: FC<Props> = ({
  conversation,
  prompts,
  onChangePrompt,
    models,
    handleUpdateModel
}) => {
  const { t } = useTranslation('chat');

  const [value, setValue] = useState<string>('/');
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [showPromptList, setShowPromptList] = useState(false);
  const [promptInputValue, setPromptInputValue] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [selectedPromptId, setSelectedPromptId] = useState<string>("default");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptListRef = useRef<HTMLUListElement | null>(null);

  const filteredPrompts = prompts.filter((prompt) =>
    prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()) && prompt.type === MessageType.ROOT,
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const maxLength = conversation.model.inputContextWindow;

    if (value.length > maxLength) {
      alert(
        t(
          `Prompt limit is {{maxLength}} characters. You have entered {{valueLength}} characters.`,
          { maxLength, valueLength: value.length },
        ),
      );
      return;
    }

    setValue(value);
    updatePromptListVisibility(value);

    if (value.length > 0) {
      onChangePrompt(value);
    }
  };

  const handleInitModal = () => {
    const selectedPrompt = filteredPrompts[activePromptIndex];
    setValue((prevVal) => {
      const newContent = prevVal?.replace(/\/\w*$/, selectedPrompt.content);
      return newContent;
    });
    handlePromptSelect(selectedPrompt);
    setShowPromptList(false);
  };

  const parseVariables = (content: string) => {
    const regex = /{{(.*?)}}/g;
    const foundVariables = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      foundVariables.push(match[1]);
    }

    return foundVariables;
  };

  const updatePromptListVisibility = useCallback((text: string) => {
    const match = text.match(/\/\w*$/);

    if (match) {
      setShowPromptList(true);
      setPromptInputValue(match[0].slice(1));
    } else {
      setShowPromptList(false);
      setPromptInputValue('');
    }
  }, []);

  const handlePromptSelect = (prompt: Prompt) => {
    const parsedVariables = parseVariables(prompt.content);
    setVariables(parsedVariables);

    if (parsedVariables.length > 0) {
      setIsModalVisible(true);
    } else {
      const updatedContent = value?.replace(/\/\w*$/, prompt.content);

      setValue(updatedContent);
      onChangePrompt(updatedContent);

      updatePromptListVisibility(prompt.content);
    }
  };

  const handleSubmit = (updatedVariables: string[], documents: AttachedDocument[] | null) => {
    const newContent = fillInTemplate(prompts[activePromptIndex].content || "", variables, updatedVariables, documents, true);

    console.log("newContent", newContent);

    setValue(newContent);
    onChangePrompt(newContent);

    if (textareaRef && textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPromptList) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex < prompts.length - 1 ? prevIndex + 1 : prevIndex,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex > 0 ? prevIndex - 1 : prevIndex,
        );
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setActivePromptIndex((prevIndex) =>
          prevIndex < prompts.length - 1 ? prevIndex + 1 : 0,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleInitModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowPromptList(false);
      } else {
        setActivePromptIndex(0);
      }
    }
  };

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
    }
  }, [value]);

  useEffect(() => {
    if (conversation.prompt) {
      setValue(conversation.prompt);
    } else {
      setValue(DEFAULT_SYSTEM_PROMPT);
    }
  }, [conversation]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        promptListRef.current &&
        !promptListRef.current.contains(e.target as Node)
      ) {
        setShowPromptList(false);
      }
    };

    window.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {t('Custom Instructions')}
      </label>

      <select
          id="customInstructionsSelect"
          className="w-full rounded-lg border border-neutral-200 bg-transparent px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-neutral-100 custom-shadow"
        onChange={(e) => {
          setSelectedPromptId(e.target.value);
          if(e.target.value === "default") {
            onChangePrompt(DEFAULT_SYSTEM_PROMPT);
          }
          else {
            onChangePrompt(prompts.find(p => p.id === e.target.value)?.content || "");
          }
        }}
        value={selectedPromptId}
      >
        <option key="default" value="default">Default</option>
        {prompts.filter(p => p.type === MessageType.ROOT).map((prompt, index) => (
          <option key={index} value={prompt.id}>{prompt.name}</option>
        ))}
      </select>
      {/*<textarea*/}
      {/*  ref={textareaRef}*/}
      {/*  className="w-full rounded-lg border border-neutral-200 bg-transparent px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"*/}
      {/*  style={{*/}
      {/*    resize: 'none',*/}
      {/*    bottom: `${textareaRef?.current?.scrollHeight}px`,*/}
      {/*    maxHeight: '300px',*/}
      {/*    overflow: `${*/}
      {/*      textareaRef.current && textareaRef.current.scrollHeight > 400*/}
      {/*        ? 'auto'*/}
      {/*        : 'hidden'*/}
      {/*    }`,*/}
      {/*  }}*/}
      {/*  placeholder={*/}
      {/*    t(`Enter a prompt or type "/" to select a prompt...`) || ''*/}
      {/*  }*/}
      {/*  value={t(value) || ''}*/}
      {/*  rows={1}*/}
      {/*  onChange={handleChange}*/}
      {/*  onKeyDown={handleKeyDown}*/}
      {/*/>*/}

      {showPromptList && filteredPrompts.length > 0 && (
        <div>
          <PromptList
            activePromptIndex={activePromptIndex}
            prompts={filteredPrompts}
            onSelect={handleInitModal}
            onMouseOver={setActivePromptIndex}
            promptListRef={promptListRef}
          />
        </div>
      )}

      {isModalVisible && (
        <VariableModal
            models={models}
            handleUpdateModel={handleUpdateModel}
          prompt={prompts[activePromptIndex]}
          variables={variables}
          onSubmit={handleSubmit}
          onClose={() => setIsModalVisible(false)}
        />
      )}
    </div>
  );
};

import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import {Conversation, Message} from "@/types/chat";
import Mermaid from "@/components/Chat/ChatContentBlocks/MermaidBlock";
import VegaVis from "@/components/Chat/ChatContentBlocks/VegaVisBlock";
import {useEffect, useRef, useState} from "react";
import {useTranslation} from "next-i18next";

interface Props {
    message: Message;
    handleEditMessage: () => void;
    setIsEditing: (isEditing: boolean) => void;
    isEditing: boolean;
    messageContent: string;
    setMessageContent: (content: string) => void;
}

const UserMessageEditor: React.FC<Props> = (
    {   message,
        handleEditMessage,
        setIsEditing,
        isEditing,
        messageContent,
        setMessageContent}) => {

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const {t} = useTranslation('chat');

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageContent(event.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
            e.preventDefault();
            handleEditMessage();
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);

    return (<div className="flex w-full flex-col">
                                      <textarea
                                          ref={textareaRef}
                                          id="editResponse"
                                          className="w-full resize-none whitespace-pre-wrap border-none dark:bg-[#343541]"
                                          value={messageContent}
                                          onChange={handleInputChange}
                                          onKeyDown={handlePressEnter}
                                          onCompositionStart={() => setIsTyping(true)}
                                          onCompositionEnd={() => setIsTyping(false)}
                                          style={{
                                              fontFamily: 'inherit',
                                              fontSize: 'inherit',
                                              lineHeight: 'inherit',
                                              padding: '0',
                                              margin: '0',
                                              overflow: 'hidden',
                                          }}
                                      />

        <div className="mt-10 flex justify-center space-x-4">
            <button
                id="saveTextChange"
                className="h-[40px] rounded-md bg-blue-500 px-4 py-1 text-sm font-medium text-white enabled:hover:bg-blue-600 disabled:opacity-50"
                onClick={handleEditMessage}
                disabled={messageContent.trim().length <= 0}
            >
                {t('Save & Submit')}
            </button>
            <button
                id="cancelTextChange"
                className="h-[40px] rounded-md border border-neutral-300 px-4 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                onClick={() => {
                    setMessageContent(message.content);
                    setIsEditing(false);
                }}
            >
                {t('Cancel')}
            </button>
        </div>
    </div>);

}

export default UserMessageEditor;
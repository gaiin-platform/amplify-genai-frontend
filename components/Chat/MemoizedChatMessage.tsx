import { IconCheck, IconCopy, IconEdit, IconRobot, IconTrash, IconUser, IconExternalLink, IconReload } from '@tabler/icons-react';
import { FC, memo, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { updateConversation } from '@/utils/app/conversation';
import { Message } from '@/types/chat';
import { CodeBlock } from '../Markdown/CodeBlock';
import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';
import HomeContext from '@/components/Home/Home.context';

export interface Props {
  message: Message;
  messageIndex: number;
  onEdit?: (editedMessage: Message) => void;
  onChatRewrite?: (message: Message, updateIndex: number, toRewrite: string, prefix: string, suffix: string, feedback: string) => Promise<void>;
  onSendPrompt?: (prompt: any) => void;
  handleCustomLinkClick?: (message: Message, href: string) => void;
}

export const MemoizedChatMessage: FC<Props> = memo(
  ({ message, messageIndex, onEdit }) => {
    const { t } = useTranslation('chat');
    const {
      state: { selectedConversation, conversations, currentMessage, messageIsStreaming },
      dispatch: homeDispatch,
    } = useContext(HomeContext);

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content || '');
    const [messagedCopied, setMessageCopied] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Update content when streaming
    useEffect(() => {
      setMessageContent(message.content || '');
    }, [message.content]);

    const toggleEditing = () => {
      setIsEditing(!isEditing);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessageContent(event.target.value);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'inherit';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    };

    const handleEditSave = () => {
      if (message.content !== messageContent) {
        if (selectedConversation && onEdit) {
          onEdit({ ...message, content: messageContent });
        }
      }
      setIsEditing(false);
    };

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
        e.preventDefault();
        handleEditSave();
      }
    };

    const copyOnClick = () => {
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(message.content || '').then(() => {
        setMessageCopied(true);
        setTimeout(() => {
          setMessageCopied(false);
        }, 2000);
      });
    };

    return (
      <div
        className={`group md:px-4 ${
          message.role === 'assistant'
            ? 'border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100'
            : 'border-b border-black/10 bg-white text-gray-800 dark:border-gray-900/50 dark:bg-[#343541] dark:text-gray-100'
        }`}
        style={{ overflowWrap: 'anywhere' }}
      >
        <div className="relative m-auto flex p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
          <div className="min-w-[40px] text-right font-bold">
            {message.role === 'assistant' ? (
              <IconRobot size={30} />
            ) : (
              <IconUser size={30} />
            )}
          </div>

          <div className="prose mt-[-2px] w-full dark:prose-invert">
            {message.role === 'user' ? (
              <div className="flex w-full">
                {isEditing ? (
                  <div className="flex w-full flex-col">
                    <textarea
                      ref={textareaRef}
                      className="w-full resize-none whitespace-pre-wrap border-none outline-none dark:bg-[#343541]"
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
                        className="h-[40px] rounded-md bg-blue-500 px-4 py-1 text-sm font-medium text-white enabled:hover:bg-blue-600 disabled:opacity-50"
                        onClick={handleEditSave}
                        disabled={messageContent.trim().length <= 0}
                      >
                        {t('Save & Submit')}
                      </button>
                      <button
                        className="h-[40px] rounded-md border border-neutral-300 px-4 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setMessageContent(message.content || '');
                          setIsEditing(false);
                        }}
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose whitespace-pre-wrap dark:prose-invert flex-1">
                    {message.content || ''}
                  </div>
                )}

                {!isEditing && (
                  <div className="ml-1 flex flex-col items-center justify-end gap-4 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
                    <button
                      className="invisible text-gray-500 hover:text-gray-700 focus:visible group-hover:visible dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={toggleEditing}
                    >
                      <IconEdit size={20} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-row">
                <MemoizedReactMarkdown
                  className="prose dark:prose-invert flex-1"
                  children={messageContent}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      if (children && children.length) {
                        if (children[0] == '▍') {
                          return <span className="animate-pulse cursor-default mt-1">▍</span>;
                        }

                        if (!inline) {
                          return (
                            <CodeBlock
                              key={Math.random()}
                              language={(className || '').replace(/^language-/, '')}
                              value={String(children).replace(/\n$/, '')}
                              {...props}
                            />
                          );
                        }
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    table({ children }) {
                      return (
                        <table className="border-collapse border border-black px-3 py-1 dark:border-white">
                          {children}
                        </table>
                      );
                    },
                    th({ children }) {
                      return (
                        <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="break-words border border-black px-3 py-1 dark:border-white">
                          {children}
                        </td>
                      );
                    },
                  }}
                />

                <div className="ml-1 flex flex-col items-center justify-end gap-4 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
                  {messagedCopied ? (
                    <IconCheck
                      size={20}
                      className="text-green-500 dark:text-green-400"
                    />
                  ) : (
                    <button
                      className="invisible text-gray-500 hover:text-gray-700 focus:visible group-hover:visible dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={copyOnClick}
                    >
                      <IconCopy size={20} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Re-render when content changes (for streaming) or index changes
    return (
      prevProps.message.content === nextProps.message.content &&
      prevProps.messageIndex === nextProps.messageIndex
    );
  },
);

MemoizedChatMessage.displayName = 'MemoizedChatMessage';

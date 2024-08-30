import {
    IconCheck,
    IconCopy,
    IconRobot,
    IconDownload,
    IconUser,
} from '@tabler/icons-react';
import { FC, memo, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Message } from '@/types/chat';
import HomeContext from '@/pages/api/home/home.context';
import ChatFollowups from './ChatFollowups';
import ChatContentBlock from "@/components/Chat/ChatContentBlocks/ChatContentBlock";
import { Prompt } from "@/types/prompt";
import { Stars } from "@/components/Chat/Stars";
import {DownloadModal} from "@/components/Download/DownloadModal";
import Loader from "@/components/Loader/Loader";



export interface Props {
    message: Message;
    messageIndex: number;
    onEdit?: (editedMessage: Message) => void,
    onSend: (message: Message[]) => void,
    onSendPrompt: (prompt: Prompt) => void,
    onChatRewrite: (message: Message, updateIndex: number, requestedRewrite: string, prefix: string, suffix: string, feedback: string) => void,
    handleCustomLinkClick: (message: Message, href: string) => void,
}


export const RemoteMessage: FC<Props> = memo(({
                                                message,
                                                messageIndex,
                                                onEdit,
                                                onSend,
                                                onSendPrompt,
                                                handleCustomLinkClick,
                                                onChatRewrite
                                            }) => {
    const {t} = useTranslation('chat');

    const {
        state: { selectedConversation, conversations, currentMessage, messageIsStreaming },
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);


    const markdownComponentRef = useRef<HTMLDivElement>(null);

    const [isDownloadDialogVisible, setIsDownloadDialogVisible] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);
    const divRef = useRef<HTMLDivElement>(null);


    const copyOnClick = () => {
        if (!navigator.clipboard) return;

        navigator.clipboard.writeText(message.content).then(() => {
            setMessageCopied(true);
            setTimeout(() => {
                setMessageCopied(false);
            }, 2000);
        });
    };


    useEffect(() => {
        setMessageContent(message.content);
    }, [message.content]);


    // @ts-ignore
    return (
        <div
            className={`group md:px-0 ${message.role === 'assistant'
                ? 'border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100'
                : 'border-b border-black/10 bg-white text-gray-800 dark:border-gray-900/50 dark:bg-[#343541] dark:text-gray-100'
            }`}
            style={{ overflowWrap: 'anywhere' }}
        >

            {isDownloadDialogVisible && (
                <DownloadModal
                    includeConversations={false}
                    includePrompts={false}
                    includeFolders={false}
                    showHeaders={false}
                    showInclude={false}
                    selectedMessages={[message]}
                    selectedConversations={selectedConversation ? [selectedConversation] : []}
                    onCancel={() => {
                        setIsDownloadDialogVisible(false);
                    }}
                    onDownloadReady={function (url: string): void {

                    }}/>
            )}

            <div
                className="relative m-auto flex py-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                <div className="min-w-[40px] text-right font-bold">
                    {message.role === 'assistant' ? (
                        <IconRobot size={30} />
                    ) : (
                        <IconUser size={30} />
                    )}
                </div>

                <div className="prose mt-[-2px] w-full dark:prose-invert">
                    {message.role === 'user' ? (
                        <div className="flex flex-grow">

                            <div className="flex flex-grow flex-col">
                                <div className="flex flex-row">
                                   <div className="prose whitespace-pre-wrap dark:prose-invert flex-1">
                                            {message.content}
                                   </div>
                                </div>
                                <div className="flex flex-row">
                                        <ChatFollowups promptSelected={(p) => {
                                            onSendPrompt(p)
                                        }}/>
                                </div>
                            </div>


                                <div className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-col gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">
                                    <div>
                                    <button
                                        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={copyOnClick}
                                    >
                                        <IconCopy size={20} />
                                    </button>
                                    </div>
                                    <div>
                                    <button
                                        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={()=>setIsDownloadDialogVisible(true)}
                                    >
                                        <IconDownload size={20} />
                                    </button>
                                    </div>
                                </div>
                        </div>
                    ) : (
                        <div className="flex flex-col w-full" ref={markdownComponentRef}>
                            <div className="flex flex-row w-full">

                                    <div className="flex flex-grow"
                                            ref={divRef}
                                        >
                                        <ChatContentBlock
                                            messageIsStreaming={messageIsStreaming}
                                            messageIndex={messageIndex}
                                            message={message}
                                            selectedConversation={selectedConversation}
                                            handleCustomLinkClick={handleCustomLinkClick}
                                            />
                                    </div>


                                <div
                                    className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-col gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">
                                    {messagedCopied ? (
                                        <IconCheck
                                            size={20}
                                            className="text-green-500 dark:text-green-400"
                                        />
                                    ) : (
                                        <button
                                            className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                            onClick={copyOnClick}
                                        >
                                            <IconCopy size={20} />
                                        </button>
                                    )}
                                    <button
                                        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={()=>setIsDownloadDialogVisible(true)}
                                    >
                                        <IconDownload size={20} />
                                    </button>

                                </div>
                            </div>
                            {(messageIsStreaming) ? null : (
                                <ChatFollowups promptSelected={(p) => {
                                    onSendPrompt(p)
                                }}/>
                            )}
                            {(messageIsStreaming) ? null : (
                                <Stars starRating={message.data && message.data.rating || 0} setStars={(r) => {
                                    if (onEdit) {
                                        onEdit({...message, data: {...message.data, rating: r}});
                                    }
                                }} />
                            )}
                            {(messageIsStreaming && messageIndex == (selectedConversation?.messages.length ?? 0) - 1) ?
                                // <LoadingIcon />
                                <Loader type="ping" size="48"/>
                                : null}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
});
RemoteMessage.displayName = 'RemoteMessages';

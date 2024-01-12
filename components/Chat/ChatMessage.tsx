import {
    IconCheck,
    IconCopy,
    IconEdit,
    IconRobot,
    IconTrash,
    IconWriting,
    IconDownload,
    IconFileCheck,
    IconUser,
    IconTemplate,
} from '@tabler/icons-react';
import { FiCommand } from "react-icons/fi";
import styled, { keyframes } from 'styled-components';
import React, { FC, memo, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { updateConversation } from '@/utils/app/conversation';
import { DataSource, Message } from '@/types/chat';
import { useChatService } from "@/hooks/useChatService";
import HomeContext from '@/pages/api/home/home.context';
import ChatFollowups from './ChatFollowups';
import { VariableModal } from "@/components/Chat/VariableModal";
import ChatContentBlock from "@/components/Chat/ChatContentBlocks/ChatContentBlock";
import UserMessageEditor from "@/components/Chat/ChatContentBlocks/UserMessageEditor";
import AssistantMessageEditor from "@/components/Chat/ChatContentBlocks/AssistantMessageEditor";
import { Style } from "css-to-react-native";
import { Prompt } from "@/types/prompt";
import { Stars } from "@/components/Chat/Stars";
import { DownloadModal } from "@/components/Download/DownloadModal";
import Loader from "@/components/Loader/Loader";
import { getFileDownloadUrl } from "@/services/fileService"
import { FileList } from "@/components/Chat/FileList";
import { LoadingDialog } from "@/components/Loader/LoadingDialog";

export interface Props {
    message: Message;
    messageIndex: number;
    onEdit?: (editedMessage: Message) => void,
    onSend: (message: Message[]) => void,
    onSendPrompt: (prompt: Prompt) => void,
    onChatRewrite: (message: Message, updateIndex: number, requestedRewrite: string, prefix: string, suffix: string, feedback: string) => void,
    handleCustomLinkClick: (message: Message, href: string) => void,
}

const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 1rem;
  animation: ${animate} 2s infinite;
`;

export const ChatMessage: FC<Props> = memo(({
    message,
    messageIndex,
    onEdit,
    onSend,
    onSendPrompt,
    handleCustomLinkClick,
    onChatRewrite
}) => {
    const { t } = useTranslation('chat');

    const {
        state: { selectedConversation, conversations, currentMessage, messageIsStreaming },
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);


    const markdownComponentRef = useRef<HTMLDivElement>(null);

    const [isDownloadDialogVisible, setIsDownloadDialogVisible] = useState<boolean>(false);
    const [isFileDownloadDatasourceVisible, setIsFileDownloadDatasourceVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);
    const [editSelection, setEditSelection] = useState<string>("");
    const divRef = useRef<HTMLDivElement>(null);

    const toggleEditing = () => {
        setIsEditing(!isEditing);
    };

    const handleEditMessage = () => {

        if (message.content != messageContent) {
            if (selectedConversation && onEdit) {
                onEdit({ ...message, content: messageContent });
            }
        }
        setIsEditing(false);
    };

    const handleDeleteMessage = () => {
        if (!selectedConversation) return;

        const { messages } = selectedConversation;
        const findIndex = messages.findIndex((elm) => elm === message);

        if (findIndex < 0) return;

        // Find the index of the next 'user' message after findIndex
        let nextUserIndex = findIndex + 1;
        for (let i = findIndex + 1; i < messages.length; i++) {
            nextUserIndex = i;
            if (messages[i].role === 'user') {
                break;
            }
        }

        if (nextUserIndex === messages.length - 1) {
            nextUserIndex = messages.length;
        }

        let deleteCount = nextUserIndex - findIndex;
        console.log("Find Index: " + findIndex + " Next User Index: " + nextUserIndex
            + " Messages Length: " + messages.length + " Delete Count: " + (nextUserIndex - findIndex));

        if (
            findIndex < messages.length - 1 &&
            messages[findIndex + 1].role === 'assistant' &&
            deleteCount > 0
        ) {
            messages.splice(findIndex, deleteCount);
        } else {
            messages.splice(findIndex, 1);
        }
        const updatedConversation = {
            ...selectedConversation,
            messages,
        };

        const { single, all } = updateConversation(
            updatedConversation,
            conversations,
        );
        homeDispatch({ field: 'selectedConversation', value: single });
        homeDispatch({ field: 'conversations', value: all });
    };

    const copyOnClick = () => {
        if (!navigator.clipboard) return;

        navigator.clipboard.writeText(message.content).then(() => {
            setMessageCopied(true);
            setTimeout(() => {
                setMessageCopied(false);
            }, 2000);
        });
    };


    //
    // useEffect(() => {
    //     setMessageContent(message.content);
    // }, [message.content]);


    const handleDownload = async (dataSource: DataSource) => {
        //alert("Downloading " + dataSource.name + " from " + dataSource.id);
        try {
            setIsFileDownloadDatasourceVisible(true);
            const response = await getFileDownloadUrl(dataSource.id);
            setIsFileDownloadDatasourceVisible(false);
            window.open(response.downloadUrl, "_blank");
        }
        catch (e) {
            setIsFileDownloadDatasourceVisible(false);
            console.log(e);
            alert("Error downloading file. Please try again.");
        }
    }

    // @ts-ignore
    return (
        <div
            className={`group md:px-4 ${message.role === 'assistant'
                ? 'border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100'
                : 'border-b border-black/10 bg-white text-gray-800 dark:border-gray-900/50 dark:bg-[#343541] dark:text-gray-100'
                }`}
            style={{ overflowWrap: 'anywhere' }}
        >
            {isFileDownloadDatasourceVisible && (
                <LoadingDialog open={true} message={"Preparing to download..."} />
            )}

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

                    }} />
            )}

            <div
                className="relative m-auto flex p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
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
                            {isEditing ? (

                                <UserMessageEditor
                                    messageIsStreaming={messageIsStreaming}
                                    messageIndex={messageIndex}
                                    message={message}
                                    handleEditMessage={handleEditMessage}
                                    selectedConversation={selectedConversation}
                                    setIsEditing={setIsEditing}
                                    isEditing={isEditing}
                                    messageContent={messageContent}
                                    setMessageContent={setMessageContent} />

                            ) : (
                                <div className="flex flex-grow flex-col">
                                    <div className="flex flex-col">
                                        <div className="prose whitespace-pre-wrap dark:prose-invert flex-1">
                                            {message.label || message.content}
                                        </div>
                                        {message.data && message.data.dataSources && message.data.dataSources.length > 0 && (
                                            <div className="flex flex-col w-full mt-5 text-gray-800">
                                                <div className="mr-3 dark:text-white">Included documents:</div>

                                                <div className="flex flex-col">
                                                    {message.data && message.data.dataSources && message.data.dataSources.map((d: any, i: any) => (
                                                        <div
                                                            key={i}
                                                            className="bg-yellow-400 dark:bg-[#B0BEC5] rounded-md shadow-lg h-12"
                                                        >
                                                            <div className="flex flex-row">
                                                                <div
                                                                    className="w-14 h-12 flex-none bg-cover rounded-l text-center overflow-hidden"
                                                                    style={{ backgroundImage: 'url("/sparc_apple.png")' }}
                                                                    title={d.name}>
                                                                </div>
                                                                <div className="ml-3 mt-3">
                                                                    <IconFileCheck />
                                                                </div>
                                                                <div className="mt-3 ml-1 flex-grow p-0 truncate">
                                                                    {i + 1}. {d.name}
                                                                </div>
                                                                {d.id && d.id.startsWith("s3://") && (
                                                                    <div className="mt-3 mr-3 ml-1 p-0 truncate"
                                                                    >
                                                                        <button onClick={() => {
                                                                            handleDownload(d);
                                                                        }}>
                                                                            <IconDownload />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-row">
                                        {(isEditing || messageIsStreaming) ? null : (

                                            <ChatFollowups promptSelected={(p) => {
                                                onSendPrompt(p)
                                            }} />

                                        )}
                                    </div>
                                </div>
                            )}

                            {!isEditing && (
                                <div
                                    className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-col gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">
                                    {/*<div*/}
                                    {/*    className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-row gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">*/}
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
                                            onClick={() => setIsDownloadDialogVisible(true)}
                                        >
                                            <IconDownload size={20} />
                                        </button>
                                    </div>
                                    <div>
                                        <button
                                            className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                            onClick={toggleEditing}
                                        >
                                            <IconEdit size={20} />
                                        </button>
                                    </div>
                                    <div>
                                        <button
                                            className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                            onClick={handleDeleteMessage}
                                        >
                                            <IconTrash size={20} />
                                        </button>
                                    </div>
                                    {/*<div>*/}
                                    {/*    <button*/}
                                    {/*        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"*/}
                                    {/*        onClick={() => { }}*/}
                                    {/*    >*/}
                                    {/*        <IconTemplate size={20} />*/}
                                    {/*    </button>*/}
                                    {/*</div>*/}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col w-full" ref={markdownComponentRef}>
                            <div className="flex flex-row w-full">
                                {!isEditing && (
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
                                )}
                                {isEditing && (
                                    <AssistantMessageEditor
                                        messageIsStreaming={messageIsStreaming}
                                        messageIndex={messageIndex}
                                        message={message}
                                        handleEditMessage={handleEditMessage}
                                        selectedConversation={selectedConversation}
                                        setIsEditing={setIsEditing}
                                        isEditing={isEditing}
                                        messageContent={messageContent}
                                        setMessageContent={setMessageContent} />
                                )}

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
                                        onClick={() => setIsDownloadDialogVisible(true)}
                                    >
                                        <IconDownload size={20} />
                                    </button>
                                    <button
                                        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={toggleEditing}
                                    >
                                        <IconEdit size={20} />
                                    </button>

                                </div>
                            </div>
                            {(messageIsStreaming || isEditing) ? null : (
                                <ChatFollowups promptSelected={(p) => {
                                    onSendPrompt(p)
                                }} />
                            )}
                            {(messageIsStreaming || isEditing) ? null : (
                                <Stars starRating={message.data && message.data.rating || 0} setStars={(r) => {
                                    if (onEdit) {
                                        onEdit({ ...message, data: { ...message.data, rating: r } });
                                    }
                                }} />
                            )}
                            {(messageIsStreaming && messageIndex == (selectedConversation?.messages.length ?? 0) - 1) ?
                                // <LoadingIcon />
                                <Loader type="ping" size="48" />
                                : null}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
});
ChatMessage.displayName = 'ChatMessage';

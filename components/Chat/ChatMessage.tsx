import {
    IconCheck,
    IconCopy,
    IconEdit,
    IconRobot,
    IconTrash,
    IconWriting,
    IconDownload,
    IconUser,
} from '@tabler/icons-react';
import { FiCommand } from "react-icons/fi";
import styled, { keyframes } from 'styled-components';
import { FC, memo, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { updateConversation } from '@/utils/app/conversation';
import { Message } from '@/types/chat';
import { useChatService } from "@/hooks/useChatService";
import HomeContext from '@/pages/api/home/home.context';
import ChatFollowups from './ChatFollowups';
import {VariableModal} from "@/components/Chat/VariableModal";
import ChatContentBlock from "@/components/Chat/ChatContentBlocks/ChatContentBlock";
import UserMessageEditor from "@/components/Chat/ChatContentBlocks/UserMessageEditor";
import AssistantMessageEditor from "@/components/Chat/ChatContentBlocks/AssistantMessageEditor";
import {Style} from "css-to-react-native";
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
    const {t} = useTranslation('chat');

    const {
        state: { selectedConversation, conversations, currentMessage, messageIsStreaming },
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);


    const markdownComponentRef = useRef<HTMLDivElement>(null);

    // const userFollowupButtonsConfig = [
    //     {
    //         title: 'Suggest Prompt Improvements', handler: () => {
    //             onSend([newMessage({
    //                 role: "user", content: "Given the prompt: " +
    //                     "---------------------------------\n" +
    //                     "" + message.content +
    //                     "\n---------------------------------\n" +
    //                     "Suggest an enhanced version of it.\n" +
    //                     "1. Start with clear, precise instructions placed at the beginning of the prompt.\n" +
    //                     "2. Include specific details about the desired context, outcome, length, format, and style.\n" +
    //                     "3. Provide examples of the desired output format, if possible.\n" +
    //                     "4. Use appropriate leading words or phrases to guide the desired output, especially if code generation is involved.\n" +
    //                     "5. Avoid any vague or imprecise language. \n" +
    //                     "6. Rather than only stating what not to do, provide guidance on what should be done instead.\n" +
    //                     "\n" +
    //                     "Remember to ensure the revised prompt remains true to the user's original intent. At the end, ask me if you should respond to this prompt."
    //             })])
    //
    //         }
    //     },
    // ];

    // const followUpButtonsConfig = [
    //     {
    //         title: 'Follow-up Prompts',
    //         handler: () => onSend([newMessage({
    //             role: "user",
    //             content: "Act as an expert prompt engineer. Suggest really five really innovative, creative, follow-up prompts that would generate concrete outputs or analyses that would help me do something related to this content. Be very very specific with the wording of your suggestions and all of them should include building a step by step plan as part of the prompt. All of them should include a persona."
    //         })])
    //     },
    //     {
    //         title: 'Follow-up Questions',
    //         handler: () => onSend([newMessage({role: "user", content: "What are follow-up questions I should ask?"})])
    //     },
    //     {
    //         title: 'Fact List',
    //         handler: () => onSend([newMessage({role: "user", content: "Create a bulleted list of facts related to this content that should be checked to determine its veracity."})])
    //     },
    // ];

    const [isDownloadDialogVisible, setIsDownloadDialogVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);
    const [rating, setRating] = useState<number>(message.data && message.data.rating || 0);
    const [editSelection, setEditSelection] = useState<string>("");
    const [editBucket, setEditBucket] = useState<string>("");
    const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
    const [contentParts, setContentParts] = useState<string[]>([]);
    const [popupStyle, setPopupStyle] = useState<Style>({marginTop: '0px', marginLeft: '0px', display: 'none'});
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

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
            e.preventDefault();
            handleEditMessage();
        }
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

    const handleTextHighlight = (selection: string) => {
        if (selection && selection.toString().length > 0) {
            setEditSelection(selection.toString());
        } else {
            setEditSelection("");
        }
    };

    const checkTextHighlight = () => {
        const selection = document.getSelection();
        if (!selection || selection.toString().length === 0){
            setEditSelection("");
            return false;
        }

        return true;
    }

    useEffect(() => {
        function handleSelectionChange() {
            const selection = document.getSelection();
            if (selection && selection.rangeCount > 0) {
                // process selection
                handleTextHighlight(selection.toString());
            }
        }

        // Fires whenever the document's selection changes
        document.onselectionchange = handleSelectionChange;

        if(markdownComponentRef.current) {
            markdownComponentRef.current.onmouseup = handleSelectionChange;
        }

        return () => {
            // Cleanup
            if(markdownComponentRef.current) {
                markdownComponentRef.current.onmouseup = null;
            }
            document.onselectionchange = null;
        }

    }, []);


    const handleRightClick = (event: any) => {
        // Implement your logic for right-click event handling
    };

    const handleDoChatEdit = (selection: string, feedback: string) => {
        console.log("Do chat edit:", selection);

        function findUniquePrefix(a: string, b: string) {
            let prefix = '';
            let matches = 0;

            for (let i = 0; i < a.length; i++) {
                prefix += a[i];
                matches = b.split(prefix).length - 1; // Subtract 1 because split always returns at least one element

                if (matches === 1) {
                    return prefix;
                }
            }

            // If a unique prefix wasn't found, return null
            return null;
        }

        function findUniqueSuffix(a: string, b: string) {
            let suffix = '';
            let matches = 0;

            for (let i = a.length - 1; i >= 0; i--) {
                suffix = a[i] + suffix;
                matches = b.split(suffix).length - 1; // Subtracting 1 because split always returns at least one element

                if (matches === 1) {
                    return suffix;
                }
            }

            // If a unique suffix wasn't found, return null
            return null;
        }

        // The selection may contain additional text from code block controls, etc.
        // that make the selection hard to match against the message content. We have to
        // try and figure out how the selection corresponds to the message in order to
        // rewrite it. We do this by finding a unique prefix from the selection that
        // matches the message content, and a unique suffix from the selection that
        // matches the message content. We then rewrite the message content by
        // identifying the seciton based on matching the prefix and suffix to the message content.
        const matchPrefix = findUniquePrefix(selection, message.content);
        const matchSuffix = findUniqueSuffix(selection, message.content);
        if (!(matchPrefix && matchSuffix)) {
            alert("Please select text that starts / ends outside of a code block, and is not empty.");
            return;
        }

        const start = message.content.indexOf(matchPrefix);
        const end = message.content.lastIndexOf(matchSuffix) + matchSuffix.length;

        const toRewrite = message.content.substring(start, end);
        const startPrefix = message.content.substring(0, start);
        const endSuffix = message.content.substring(end);

        if (start < 0 || end < 0 || start >= end) {
            alert("Please select text that starts / ends outside of a code block, and is not empty.");
        } else {
            onChatRewrite(message, messageIndex, toRewrite, startPrefix, endSuffix, feedback);
        }

    }


    useEffect(() => {
        setMessageContent(message.content);
    }, [message.content]);


    // @ts-ignore
    return (
        <div
            className={`group md:px-4 ${message.role === 'assistant'
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

            {editModalVisible && (
                <VariableModal
                    models={[]}
                    variables={["How do you want to change this?"]}
                    handleUpdateModel={() => {
                    }}
                    onSubmit={(variables) => {
                        setEditModalVisible(false);
                        const feedback = variables[0];
                        handleDoChatEdit(editBucket, feedback);
                    }}
                    onClose={() => {
                        setEditBucket("");
                        setEditModalVisible(false);
                    }}
                    showModelSelector={false}
                />
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
                                    setMessageContent={setMessageContent}/>

                            ) : (
                                <div className="flex flex-grow flex-col">
                                    <div className="flex flex-row">
                                        <div className="prose whitespace-pre-wrap dark:prose-invert flex-1">
                                            {message.content}
                                        </div>
                                    </div>
                                    <div className="flex flex-row">
                                        {(isEditing || messageIsStreaming) ? null : (

                                            <ChatFollowups promptSelected={(p) => {
                                                onSendPrompt(p)
                                            }}/>

                                        )}
                                    </div>
                                </div>
                            )}

                            {!isEditing && (
                                <div className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-col gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">
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
                                        onClick={()=>setIsDownloadDialogVisible(true)}
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
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col w-full" ref={markdownComponentRef}>
                            <div className="flex flex-row w-full">
                                {!isEditing && (
                                    <div className="flex flex-grow"
                                            ref={divRef}
                                            onMouseMove={event => {
                                                const rect = divRef.current?.getBoundingClientRect();

                                                const valid = checkTextHighlight();
                                                // Calculate mouse position relative to the div
                                                const x = event.clientX - (rect?.left ?? 0);
                                                const y = event.clientY - (rect?.top ?? 0);

                                                setPopupStyle({
                                                    cursor: 'pointer',
                                                    display: (valid)? 'block' : 'none',
                                                    position: 'absolute',
                                                    marginLeft: `-30px`,
                                                    marginTop: `${y - 25}px`,
                                                });
                                            }}
                                            onMouseOut={() => {
                                                setPopupStyle({marginTop: '0px', marginLeft: '-25px', display: 'none'});
                                            }}
                                        >

                                        <ChatContentBlock
                                            messageIsStreaming={messageIsStreaming}
                                            messageIndex={messageIndex}
                                            message={message}
                                            selectedConversation={selectedConversation}
                                            handleCustomLinkClick={handleCustomLinkClick}
                                            handleTextHighlight={()=>{}}/>
                                        {editSelection.length > 0 && (
                                            <div style={popupStyle} className="bg-neutral-200 dark:bg-neutral-600 dark:text-white rounded">
                                                <button
                                                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setEditBucket(editSelection);
                                                        setEditModalVisible(true);
                                                    }}
                                                >
                                                    <IconWriting size={25}/>
                                                </button>
                                            </div>
                                        )}
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
                                        setMessageContent={setMessageContent}/>
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
                                        onClick={()=>setIsDownloadDialogVisible(true)}
                                    >
                                        <IconDownload size={20} />
                                    </button>
                                    <button
                                        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={toggleEditing}
                                    >
                                        <IconEdit size={20} />
                                    </button>


                                    {/*{editSelection.length > 0 && (*/}
                                    {/*    <button*/}
                                    {/*        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"*/}
                                    {/*        onClick={(e) => {*/}
                                    {/*            e.preventDefault();*/}
                                    {/*            e.stopPropagation();*/}
                                    {/*            setEditBucket(editSelection);*/}
                                    {/*            setEditModalVisible(true);*/}
                                    {/*        }}*/}
                                    {/*    >*/}
                                    {/*        <IconWriting size={20}/>*/}
                                    {/*    </button>*/}
                                    {/*)}*/}
                                </div>
                            </div>
                            {(messageIsStreaming || isEditing) ? null : (
                                <ChatFollowups promptSelected={(p) => {
                                    onSendPrompt(p)
                                }}/>
                            )}
                            {(messageIsStreaming || isEditing) ? null : (
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
ChatMessage.displayName = 'ChatMessage';

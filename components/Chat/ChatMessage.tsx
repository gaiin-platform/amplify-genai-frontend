import {
    IconCheck,
    IconCopy,
    IconEdit,
    IconTrash,
    IconBolt,
    IconDownload,
    IconMail,
    IconArrowFork,
    IconHighlight,
    IconLibrary,
} from '@tabler/icons-react';
import React, {FC, memo, useContext, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'next-i18next';
import {isRemoteConversation, saveConversations, updateConversation} from '@/utils/app/conversation';
import {Conversation, DataSource, Message} from '@/types/chat';
import HomeContext from '@/pages/api/home/home.context';
import ChatFollowups from './ChatFollowups';
import ChatContentBlock from "@/components/Chat/ChatContentBlocks/ChatContentBlock";
import UserMessageEditor from "@/components/Chat/ChatContentBlocks/UserMessageEditor";
import AssistantMessageEditor from "@/components/Chat/ChatContentBlocks/AssistantMessageEditor";
import {Prompt} from "@/types/prompt";
import {DownloadModal} from "@/components/Download/DownloadModal";
import Loader from "@/components/Loader/Loader";
import PromptingStatusDisplay from "@/components/Status/PromptingStatusDisplay";
import ChatSourceBlock from "@/components/Chat/ChatContentBlocks/ChatSourcesBlock";
import DataSourcesBlock from "@/components/Chat/ChatContentBlocks/DataSourcesBlock";
import ChatCodeInterpreterFileBlock from './ChatContentBlocks/ChatCodeInterpreterFilesBlock';import { uploadConversation } from '@/services/remoteConversationService';
import { downloadDataSourceFile } from '@/utils/app/files';
import { Stars } from './Stars';
import { saveUserRating } from '@/services/groupAssistantService';
import { ArtifactsBlock } from './ChatContentBlocks/ArtifactsBlock';
import { Amplify, User } from './Avatars';
import AssistantMessageHighlight from './ChatContentBlocks/AssistantMessageHighlight';
import { getSettings } from '@/utils/app/settings';
import { lzwCompress } from '@/utils/app/lzwCompression';
import { inferArtifactType } from '@/utils/app/artifacts';
import { Artifact } from '@/types/artifacts';
import { getDateName } from '@/utils/app/date';
import AgentLogBlock from '@/components/Chat/ChatContentBlocks/AgentLogBlock';
import { Settings } from '@/types/settings';
import RagEvaluationBlock from './ChatContentBlocks/RagEvaluationBlock';
import { AssistantReasoningMessage } from './ChatContentBlocks/AssistantReasoningMessage';
import { LargeTextDisplay } from './LargeTextDisplay';
import { generatePlaceholderText } from '@/utils/app/largeText';

export interface Props {
    message: Message;
    messageIndex: number;
    onEdit?: (editedMessage: Message) => void,
    onSendPrompt: (prompt: Prompt) => void,
    onChatRewrite: (message: Message, updateIndex: number, requestedRewrite: string, prefix: string, suffix: string, feedback: string) => void,
    handleCustomLinkClick: (message: Message, href: string) => void,
}


export const ChatMessage: FC<Props> = memo(({
                                                message,
                                                messageIndex,
                                                onEdit,
                                                onSendPrompt,
                                                handleCustomLinkClick,
                                                onChatRewrite
                                                
                                            }) => {
    const {t} = useTranslation('chat');

    const {
        state: {selectedConversation, conversations, messageIsStreaming, artifactIsStreaming, status, folders, featureFlags, statsService},
        dispatch: homeDispatch,
        setLoadingMessage,
        handleUpdateSelectedConversation,
        handleForkConversation
    } = useContext(HomeContext);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    let settingRef = useRef<Settings | null>(null);
    // prevent recalling the getSettings function
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);
    
    useEffect(() => {
        const handleEvent = (event:any) => settingRef.current = getSettings(featureFlags)
        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => window.removeEventListener('updateFeatureSettings', handleEvent)
    }, []);
    

    const markdownComponentRef = useRef<HTMLDivElement>(null);

    const [isDownloadDialogVisible, setIsDownloadDialogVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);
    const [editSelection, setEditSelection] = useState<string>("");
    const divRef = useRef<HTMLDivElement>(null);
    const [currentRating, setCurrentRating] = useState<number | undefined>(message.data?.rating);
    const [showFeedbackInput, setShowFeedbackInput] = useState(false);
    const [isHighlightDisplay, setIsHighlightDisplay] = useState(false);

    const [feedbackText, setFeedbackText] = useState('');

    const assistantRecipient = (message.role === "user" && message.data && message.data.assistant) ?
        message.data.assistant : null;

    // Function to render message content with inline large text blocks
    const renderMessageWithLargeText = (message: Message) => {
        if (!message.data?.hasLargeText || !message.data?.largeTextBlocks) {
            return message.label || message.content;
        }

        const largeTextBlocks = message.data.largeTextBlocks;
        let labelText = message.label || message.content;
        let result: React.ReactNode[] = [];
        let lastIndex = 0;
        
        // Sort blocks by their position in the text for proper rendering order
        const sortedBlocks = [...largeTextBlocks].sort((a, b) => {
            const aPlaceholder = generatePlaceholderText(a);
            const bPlaceholder = generatePlaceholderText(b);
            const aPos = labelText.indexOf(aPlaceholder);
            const bPos = labelText.indexOf(bPlaceholder);
            return aPos - bPos;
        });
        
        sortedBlocks.forEach((block, index) => {
            const placeholder = generatePlaceholderText(block);
            const blockPosition = labelText.indexOf(placeholder, lastIndex);
            
            if (blockPosition >= 0) {
                // Add text before this block
                if (blockPosition > lastIndex) {
                    result.push(labelText.substring(lastIndex, blockPosition));
                }
                
                // Add the large text block component
                result.push(
                    <div key={`large-text-${block.id}`} className="my-2">
                        <LargeTextDisplay 
                            message={{
                                ...message,
                                data: {
                                    ...message.data,
                                    largeTextData: block
                                }
                            }} 
                            messageIndex={messageIndex}
                            showRemoveButton={false}
                        />
                    </div>
                );
                
                lastIndex = blockPosition + placeholder.length;
            }
        });
        
        // Add any remaining text after the last block
        if (lastIndex < labelText.length) {
            result.push(labelText.substring(lastIndex));
        }
        
        return (
            <>
                {result.map((item, index) => 
                    typeof item === 'string' ? (
                        // Check if this text segment contains placeholder patterns and style them
                        item.match(/[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]/g) ? (
                            <span key={`text-${index}`} dangerouslySetInnerHTML={{
                                __html: item.replace(/([⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽])/g, '<span style="font-style: italic; color: #6b7280;">$1</span>')
                            }} />
                        ) : (
                            <span key={`text-${index}`}>{item}</span>
                        )
                    ) : (
                        item
                    )
                )}
            </>
        );
    };

    const toggleEditing = () => {
        setIsEditing(!isEditing);
    };

    const handleEditMessage = () => {

        if (message.content != messageContent) {
            if (selectedConversation && onEdit) {
                onEdit({...message, content: messageContent});
            }
        }
        setIsEditing(false);
    };

    const handleDeleteMessage = () => {
        if (!selectedConversation) return;

        const {messages} = selectedConversation;
        const findIndex = messages.findIndex((elm:Message) => elm === message);

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

        const {single, all} = updateConversation(
            updatedConversation,
            conversationsRef.current,
        );
        homeDispatch({ field: 'selectedConversation', value: updatedConversation });
        if (isRemoteConversation(updatedConversation)) uploadConversation(updatedConversation, foldersRef.current);
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


    // needed to avoid editing bug when switching between conversations
    useEffect(() => {
        setMessageContent(message.content);
    }, [message.content]);


    const handleCreateArtifactFromMessage = (content: string) => {
        if (selectedConversation) {
            const artifactId = `Artifact${Math.floor(100000 + Math.random() * 900000)}`;
            const inferenceType = inferArtifactType(content);
            const artifactDetail = {
                            artifactId: artifactId,
                            name: "Artifact", 
                            createdAt: getDateName(),
                            description: '',
                            version: 1 
                        }

            const artifact: Artifact = {...artifactDetail, 
                                            contents: lzwCompress(content), 
                                            tags: [],
                                            type: inferenceType
                                        }
            
            homeDispatch({field: "selectedArtifacts", value: [artifact]});
            window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: true, artifactIndex:  0}} ));

            const updatedConversation = {...selectedConversation};
            updatedConversation.artifacts = {...(updatedConversation.artifacts ?? {}), [artifactId]: [artifact] };
            const messageData = updatedConversation.messages[messageIndex].data;
            updatedConversation.messages[messageIndex].data.artifacts = [...(messageData.artifacts ?? []), artifactDetail];
    
            handleUpdateSelectedConversation(updatedConversation);
        }
    }

    const handleDownload = async (dataSource: DataSource) => {
        //alert("Downloading " + dataSource.name + " from " + dataSource.id);
        try {
            setLoadingMessage("Preparing to Download...");
            downloadDataSourceFile(dataSource);
            
        } catch (e) {
            console.log(e);
            alert("Error downloading file. Please try again.");
        }
        setLoadingMessage("");
    }


    const isActionResult = message.data && message.data.actionResult;
    const isAssistant = message.role === 'assistant';

    let msgStyle = 'enhanced-chat-message';
    if (isActionResult){
        msgStyle = 'enhanced-chat-message action-message text-amber-400';
    } else if(isAssistant){
        msgStyle = 'enhanced-chat-message assistant-message';
    } else {
        msgStyle = 'enhanced-chat-message user-message';
    }

    const enableTools = !isActionResult;

    const getIcon = () => {
        if (isActionResult) {
            return <IconBolt size={30}/>;
        } else if (isAssistant) {
            return <Amplify/>; 
        } else {
            return <User/> 
        }
    }

    const getAtBlock = () => {
        if(!isActionResult &&
            assistantRecipient &&
            assistantRecipient.definition &&
            assistantRecipient.definition.name &&
            assistantRecipient.definition.assistantId) {
            return (<span className="enhanced-at-block">
                                                        {"@" + assistantRecipient.definition.name + ":"}
                                                    </span>);
        } else if(!isActionResult) {
            return (<span className="enhanced-at-block">
                                                        @Amplify:
                                                    </span>);
        } else {
           return (<span className="enhanced-at-block action-block">
                                                        {'\u2713 Action Completed:'}
                                                    </span>);
        }
    }

    const handleRatingSubmit = (r: number) => {
        setCurrentRating(r);
        if (selectedConversation) {
            const updatedMessage = { ...message, data: { ...message.data, rating: r } };
            let updatedConversation: Conversation = { ...selectedConversation };
            updatedConversation.messages[messageIndex] = updatedMessage;
            handleUpdateSelectedConversation(updatedConversation);

            statsService.saveUserRatingEvent(selectedConversation.id, r);
            saveUserRating(selectedConversation.id, r)
                .then((result) => {
                    if (!result.success) {
                        console.error('Failed to save user rating');
                    } else {
                        setShowFeedbackInput(true);
                    }
                })
                .catch((error) => {
                    console.error('Error saving user rating');
                });
        }
    };


    const handleFeedbackSubmit = () => {
        if (selectedConversation && currentRating !== undefined) {
            statsService.saveUserRatingEvent(selectedConversation.id, currentRating, feedbackText);
            saveUserRating(selectedConversation.id, currentRating, feedbackText)
                .then((result) => {
                    if (result.success) {
                        setShowFeedbackInput(false);
                        setFeedbackText('');
                    } else {
                        console.error('Failed to save user feedback');
                    }
                })
                .catch((error) => {
                    console.error('Error saving user feedback');
                });
        } else {
            console.error('No rating available or conversation not selected');
        }
    };

    const [isHovered, setIsHovered] = useState(false);
    const [iconsPosition, setIconsPosition] = useState({ top: 0, right: 0 });
    const messageRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        setIsHovered(true);
        updateIconsPosition();
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const isMessageShorterThanViewport = (): boolean => {
        if (!messageRef.current) return true; // Default to true if ref not available
        
        const messageHeight = messageRef.current.getBoundingClientRect().height;
        const viewportHeight = window.innerHeight;
        
        return messageHeight < viewportHeight;
    };

    const updateIconsPosition = () => {
        if (messageRef.current) {
            const rect = messageRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const messageHeight = rect.height;
            
            // Step 1: Determine ideal top position
            let idealTop;
            if (messageHeight > viewportHeight) {
                // Long message: use viewport center
                idealTop = viewportHeight / 2;
            } else {
                // Short message: use message center
                idealTop = rect.top + messageHeight / 2;
            }
            
            // Step 2: Constrain within message boundaries (with padding)
            const messageTop = rect.top;
            const messageBottom = rect.bottom;
            const padding = 150; // Minimum distance from message edges - tightened constraint
            
            const constrainedTop = Math.max(
                messageTop + padding, 
                Math.min(messageBottom - padding, idealTop)
            );
            
            // Step 3: Calculate right position relative to message container
            const messageLeft = rect.left;
            const messageRight = rect.right;
            const iconsPadding = 2; // Distance from the right edge of the message
            const viewportWidth = window.innerWidth;
            
            // Position icons relative to the message's right edge, but ensure they stay within viewport
            const idealRight = viewportWidth - messageRight + iconsPadding;
            const constrainedRight = Math.max(iconsPadding, idealRight);
            
            setIconsPosition({
                top: constrainedTop,
                right: constrainedRight
            });
        }
    };

    useEffect(() => {
        
        const handleScroll = (event: Event) => {
            if (isHovered) updateIconsPosition();
        };
        
        // Try multiple scroll targets to find the right one
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Also try listening on the message's parent containers
        const messageElement = messageRef.current;
        if (messageElement) {
            let parent = messageElement.parentElement;
            while (parent) {
                parent.addEventListener('scroll', handleScroll, { passive: true });
                parent = parent.parentElement;
                if (parent === document.body) break; // Don't go beyond body
            }
        }
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            
            // Remove from parent containers
            const messageElement = messageRef.current;
            if (messageElement) {
                let parent = messageElement.parentElement;
                while (parent) {
                    parent.removeEventListener('scroll', handleScroll);
                    parent = parent.parentElement;
                    if (parent === document.body) break;
                }
            }
        };
    }, [isHovered]);

    // @ts-ignore
    return (
        <div
            className={`group md:px-4 ${msgStyle}`}
            style={{overflowWrap: 'anywhere'}}
            ref={messageRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >

            {isDownloadDialogVisible && (
                <DownloadModal
                    includeConversations={false}
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
                className="enhanced-message-content relative m-[30px] flex p-2 text-base md:gap-6 md:py-2">
                <div className="flex-shrink-0 ml-[45px] min-w-[40px] text-right font-bold">
                    {getIcon()}
                </div>

                <div id="chatHover" className="max-w-none prose mt-[-2px] w-full dark:prose-invert mr-5">
                    {message.role === 'user' ? (
                        <div className="flex flex-grow">
                            {isEditing ? (

                                <UserMessageEditor
                                    message={message}
                                    handleEditMessage={handleEditMessage}
                                    setIsEditing={setIsEditing}
                                    isEditing={isEditing}
                                    messageContent={messageContent}
                                    setMessageContent={setMessageContent}/>

                            ) : (
                                <div className="flex flex-grow flex-col">
                                    <div className="flex flex-col">
                                        <div className="flex flex-row">
                                            <div id="userMessage" className="prose whitespace-pre-wrap dark:prose-invert flex-1  max-w-none w-full">
                                                {getAtBlock()} {message.data?.hasLargeText ? 
                                                    // For large text messages, parse and render with inline large text blocks
                                                    renderMessageWithLargeText(message)
                                                    : (message.label || message.content)
                                                }
                                            </div>
                                        </div>
                                        <DataSourcesBlock message={message} handleDownload={handleDownload}/>
                                        
                                        {isActionResult && (
                                            <ChatSourceBlock
                                                messageIsStreaming={messageIsStreaming}
                                                message={message}
                                            />
                                        )}
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
                                <div
                                    className={isMessageShorterThanViewport() 
                                        ? "enhanced-chat-icons px-1 py-2 md:-mr-10 md:ml-4 flex flex-col md:flex-col items-center md:items-start justify-end md:justify-start sticky top-1/2 transform -translate-y-1/2"
                                        : "enhanced-chat-icons px-1 py-2 flex flex-col gap-1 items-center transition-all duration-300 ease-in-out"
                                    }
                                    style={!isMessageShorterThanViewport() ? {
                                        position: 'fixed',
                                        top: `${iconsPosition.top}px`,
                                        right: `${iconsPosition.right}px`,
                                        transform: 'translateY(-50%)',
                                        opacity: isHovered && !messageIsStreaming ? 1 : 0,
                                        visibility: isHovered && !messageIsStreaming ? 'visible' : 'hidden',
                                        zIndex: 50
                                    } : undefined}
                                >
                                    <div className="flex-shrink-0">
                                        {messagedCopied ? (
                                            <IconCheck
                                                size={20}
                                                className="text-green-500 dark:text-green-400"
                                            />
                                        ) : (
                                            <button
                                                className={"enhanced-chat-icon-button"}
                                                onClick={copyOnClick}
                                                title="Copy Prompt"
                                                id="copyPrompt"
                                            >
                                                <IconCopy size={20}/>
                                            </button>
                                        )}
                                    </div>
                                    {!isActionResult && (
                                    <div>
                                        <button
                                            className={"enhanced-chat-icon-button"}
                                            onClick={() => setIsDownloadDialogVisible(true)}
                                            title="Download Prompt"
                                            id="downloadPrompt"
                                        >
                                            <IconDownload size={20}/>
                                        </button>
                                    </div>)
                                    }
                                    <div>
                                        <button
                                            className={"enhanced-chat-icon-button"}
                                            onClick={toggleEditing}
                                            title="Edit Prompt"
                                            id="editPrompt"
                                        >
                                            <IconEdit size={20}/>
                                        </button>
                                    </div>
                                    <button
                                        className={"enhanced-chat-icon-button"}
                                        onClick={() => handleForkConversation(messageIndex)}
                                        title="Branch Into New Conversation"
                                        id="branchPrompt"
                                    >
                                        <IconArrowFork size={20}/>
                                    </button>
                                    {!isActionResult && (
                                    <div>
                                        <button
                                            id="deletePromptChat"
                                            className={"enhanced-chat-icon-button"}
                                            onClick={handleDeleteMessage}
                                            title="Delete Prompt"
                                        >
                                            <IconTrash size={20}/>
                                        </button>
                                    </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : ( // Assistant message
                        <div className="flex flex-col w-full" ref={markdownComponentRef}>
                            <div className="flex flex-row w-full">
                                <div className="flex flex-col w-full">
                                    {(selectedConversation?.messages?.length === messageIndex + 1) && (
                                        <PromptingStatusDisplay statusHistory={status}/>
                                    )}

                                     {!messageIsStreaming && 
                                     <AssistantReasoningMessage 
                                        message={message}
                                        messageIndex={messageIndex}
                                        selectedConversation={selectedConversation}
                                     />}

                                     {featureFlags.highlighter && settingRef.current.featureOptions.includeHighlighter && 
                                      isHighlightDisplay && !isEditing && 

                                        <AssistantMessageHighlight
                                            messageIndex={messageIndex}
                                            message={message}
                                            selectedConversation={selectedConversation}
                                            setIsHighlightDisplay={setIsHighlightDisplay}
                                        />
                                        
                                        }
                                    {!isEditing && !isHighlightDisplay && (
                                      <>
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

                                          <AgentLogBlock
                                            messageIsStreaming={messageIsStreaming}
                                            message={message}
                                            conversationId={selectedConversation?.id || ""}
                                          />

                                          {featureFlags.artifacts &&
                                            <ArtifactsBlock
                                              message={message}
                                              messageIndex={messageIndex}
                                            />}

                                          {featureFlags.codeInterpreterEnabled &&
                                            <ChatCodeInterpreterFileBlock
                                                messageIsStreaming={messageIsStreaming}
                                                message={message}
                                                selectedConversation={selectedConversation}
                                                updateConversation={handleUpdateSelectedConversation}
                                            />}
                                          <ChatSourceBlock
                                            messageIsStreaming={messageIsStreaming}
                                            message={message}
                                          />
                                          {featureFlags.ragEvaluation && 
                                          <RagEvaluationBlock
                                            messageIsStreaming={messageIsStreaming}
                                            message={message}
                                          />}
                                      </>
                                    )}

                                    {isEditing && (
                                      <AssistantMessageEditor
                                        message={message}
                                        handleEditMessage={handleEditMessage}
                                            setIsEditing={setIsEditing}
                                            isEditing={isEditing}
                                            messageContent={messageContent}
                                            setMessageContent={setMessageContent}/>
                                    )}
                                </div>

                                { !isEditing && <div
                                    className={isMessageShorterThanViewport() 
                                        ? "enhanced-chat-icons px-1 py-2 md:-mr-10 md:ml-4 flex flex-col md:flex-col items-center md:items-start justify-end md:justify-start sticky top-1/2 transform -translate-y-1/2"
                                        : "enhanced-chat-icons mr-8 px-1 py-2 flex flex-col gap-1 items-center transition-all duration-300 ease-in-out"
                                    }
                                    style={!isMessageShorterThanViewport() ? {
                                        position: 'fixed',
                                        top: `${iconsPosition.top}px`,
                                        right: `${iconsPosition.right}px`,
                                        transform: 'translateY(-50%)',
                                        opacity: isHovered && !messageIsStreaming ? 1 : 0,
                                        visibility: isHovered && !messageIsStreaming ? 'visible' : 'hidden',
                                        zIndex: 50
                                    } : undefined}
                                >
                                    {messagedCopied ? (
                                        <IconCheck
                                            size={20}
                                            className="text-green-500 dark:text-green-400"
                                        />
                                    ) : (
                                        <button
                                        className={"enhanced-chat-icon-button"}
                                            onClick={copyOnClick}
                                            title="Copy Response"
                                            id="copyResponse"
                                        >
                                            <IconCopy size={20}/>
                                        </button>
                                    )}

                                    <button
                                        className={"enhanced-chat-icon-button"}
                                        onClick={() => handleCreateArtifactFromMessage(messageContent)}
                                        title="Turn Into Artifact"
                                        id="turnIntoArtifact"
                                    >
                                        <IconLibrary size={20}/>
                                    </button>

                                    <button
                                        className={"enhanced-chat-icon-button"}
                                        onClick={() => setIsDownloadDialogVisible(true)}
                                        title="Download Response"
                                        id="downloadResponse"
                                    >
                                        <IconDownload size={20}/>
                                    </button>
                                    <button
                                        className={"enhanced-chat-icon-button"}
                                        title="Email Response"
                                        id="emailResponse"
                                    >
                                        <a className={"enhanced-chat-icon-button"}
                                           href={`mailto:?body=${encodeURIComponent(messageContent)}`}>
                                            <IconMail size={20}/>
                                        </a>
                                    </button>

                                    {featureFlags.highlighter && 
                                     settingRef.current.featureOptions.includeHighlighter && 
                                        <button
                                            className={"enhanced-chat-icon-button"}
                                            onClick={() => {setIsHighlightDisplay(!isHighlightDisplay)}}
                                            title="Prompt On Highlight"
                                        >
                                            <IconHighlight size={20}/>
                                        </button>
                                    }
                                    <button
                                        className={"enhanced-chat-icon-button"}
                                        onClick={toggleEditing}
                                        title="Edit Response"
                                        id="editResponse"
                                    >
                                        <IconEdit size={20}/>
                                    </button>
                                    <button
                                        className={"enhanced-chat-icon-button"}
                                        onClick={() => handleForkConversation(messageIndex)}
                                        title="Branch Into New Conversation"
                                        id="branchIntoNewConversation"
                                    >
                                        <IconArrowFork size={20}/>
                                    </button>

                                </div>}
                            </div>
                            {(messageIsStreaming || isEditing) ? null : (
                                <ChatFollowups promptSelected={(p) => {
                                    onSendPrompt(p)
                                }}/>
                            )}
                            {message.data?.state?.currentAssistantId && message.data?.state?.currentAssistantId.startsWith('astgp') && !messageIsStreaming && !isEditing && (
                                <>
                                    <Stars
                                        starRating={message.data?.rating || 0}
                                        setStars={handleRatingSubmit}
                                    />
                                    {showFeedbackInput && (
                                        <div className="mt-2">
                                            <textarea
                                                className="w-full p-2 border rounded bg-white text-gray-800 dark:bg-gray-700 dark:text-white"
                                                value={feedbackText}
                                                onChange={(e) => setFeedbackText(e.target.value)}
                                                placeholder="Please provide any additional feedback"
                                            />
                                            <button
                                                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
                                                onClick={() => {
                                                    handleFeedbackSubmit();
                                                    setShowFeedbackInput(false);
                                                }}
                                            >
                                                Submit Feedback
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            {((messageIsStreaming || artifactIsStreaming) && messageIndex == (selectedConversation?.messages?.length ?? 0) - 1) ?
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

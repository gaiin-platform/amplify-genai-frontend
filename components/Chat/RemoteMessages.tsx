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
import {FiCommand} from "react-icons/fi";
import styled, {keyframes} from 'styled-components';
import {FC, memo, useContext, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'next-i18next';
import {updateConversation} from '@/utils/app/conversation';
import {Conversation, Message} from '@/types/chat';
import HomeContext from '@/pages/api/home/home.context';
import ChatFollowups from './ChatFollowups';
import {VariableModal} from "@/components/Chat/VariableModal";
import ChatContentBlock from "@/components/Chat/ChatContentBlocks/ChatContentBlock";
import UserMessageEditor from "@/components/Chat/ChatContentBlocks/UserMessageEditor";
import AssistantMessageEditor from "@/components/Chat/ChatContentBlocks/AssistantMessageEditor";
import {Style} from "css-to-react-native";
import {Prompt} from "@/types/prompt";
import {Stars} from "@/components/Chat/Stars";
import {DownloadModal} from "@/components/Download/DownloadModal";
import Loader from "@/components/Loader/Loader";
import {getRemoteConversation} from "@/services/remoteMessagesService";
import {ExportFormatV4} from "@/types/export";
import {MemoizedRemoteMessages} from "@/components/Chat/MemoizedRemoteMessages";
import {RemoteMessage} from "@/components/Chat/RemoteMessage";


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

export const RemoteMessages: FC<Props> = memo(({
                                                   message,
                                                   messageIndex,
                                                   onEdit,
                                                   onSend,
                                                   onSendPrompt,
                                                   handleCustomLinkClick,
                                                   onChatRewrite
                                               }) => {
    const {t} = useTranslation('chat');
    const [remoteData, setRemoteData] = useState<Conversation | null>(null);

    const uri = message.data?.uri;

    const {
        state: {selectedConversation, conversations, currentMessage, messageIsStreaming},
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);


    const [isFetchingRemoteMessage, setIsFetchingRemoteMessage] = useState<boolean>(true);

    useEffect(() => {
        getRemoteConversation(uri).then((response) => {
            console.log(response);
            if (response.success) {
                setRemoteData(response.data as Conversation);
                setIsFetchingRemoteMessage(false);
            }
        });
    }, [uri]);


    // @ts-ignore
    return (
        <div
            className={`bg-gray-50 text-gray-800 dark:bg-[#444654] dark:text-gray-100`}
            style={{overflowWrap: 'anywhere'}}
        >
            <>
                {isFetchingRemoteMessage && (
                    <div className="flex flex-row items-center">
                        <div><Loader type="ring" size="24"/></div>
                        <div className="text-xs text-gray-500 ml-2">Loading messages...</div>
                    </div>)}

                {remoteData?.messages.map((message, index) => (
                    <RemoteMessage
                        key={index}
                        message={message}
                        messageIndex={messageIndex}
                        onChatRewrite={onChatRewrite}
                        onSend={onSend}
                        onSendPrompt={onSendPrompt}
                        handleCustomLinkClick={handleCustomLinkClick}
                        onEdit={onEdit}
                    />
                ))}
            </>
        </div>
    );
});
RemoteMessages.displayName = 'RemoteMessages';

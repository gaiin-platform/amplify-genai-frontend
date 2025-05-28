import {IconCloud, IconCloudFilled,
    IconCloudOff
} from '@tabler/icons-react';

import { FC, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';
import { handleSelectedConversationStorageChange} from '@/utils/app/conversationStorage';
import { isRemoteConversation, isLocalConversation } from '@/utils/app/conversation';
import { Conversation } from '@/types/chat';


interface Props {
  iconSize: number | string;
}



export const CloudStorage: FC<Props> = ({
  iconSize
}) => {
  const { 
    state: { selectedConversation, conversations, folders, statsService, messageIsStreaming}, dispatch: homeDispatch, handleUpdateSelectedConversation
  } = useContext(HomeContext);

  const conversationsRef = useRef(conversations);

  useEffect(() => {
      conversationsRef.current = conversations;
  }, [conversations]);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);


   const checkConvLocked = () => {
    const curConv = conversationsRef.current.find((c:Conversation) => selectedConversation ? c.id === selectedConversation.id : false);
    return curConv ? !isRemoteConversation(curConv) : true;
  }
 
  const { t } = useTranslation('conversationStorage');
  const [inCloud, setInCloud] = useState<boolean>(checkConvLocked());


  useEffect(() => {
    if (checkConvLocked() !== inCloud) setInCloud(!inCloud);
  }, [selectedConversation]);

const confirmationMessage = () => {
    return inCloud ? "Are you sure you want this conversation to be stored in the cloud? You will be able to access this conversation from any device." 
                    : "Are you sure you want to make this conversation private and ensure it will only be accessible from this browser?";
}

const title = () => {
    return inCloud ? "This conversation is currently set to private and only accessible from this browser. "
                    : "This conversation is currently stored in the cloud for access from any device. ";
}

const handleConversationLockChange = async () => {
    if (selectedConversation) { // should always be true
      const updatedConversation = await handleSelectedConversationStorageChange(selectedConversation, foldersRef.current, statsService);
      // in case failure happens, update isLocked. it should match isLocked otherwise.         
      setInCloud(!!isLocalConversation(updatedConversation)); 
      handleUpdateSelectedConversation(updatedConversation);
    }
}

return  <button
    className={`ml-2 ${messageIsStreaming ? "cursor-not-allowed": "cursor-pointer"} hover:opacity-50 pr-2`}
    disabled={messageIsStreaming}
    onClick={(e) => {
        if (confirm(title() + confirmationMessage())) handleConversationLockChange();
    }}
    title={title()}
    >
    { inCloud ? <IconCloudOff className="block text-neutral-500 dark:text-neutral-200" size={iconSize} /> : 
    <div>
      <IconCloud className="block dark:hidden" size={18} style={{ stroke: '#000000', fill: '#D3D3D3' }}/>
      <IconCloudFilled className="hidden dark:block dark:text-neutral-200" size={18} />
    </div>} 
</button>
};

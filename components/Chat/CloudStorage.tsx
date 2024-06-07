import {IconCloud, IconCloudFilled,
    IconCloudOff
} from '@tabler/icons-react';

import { FC, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import HomeContext from '@/home/home.context';
import { handleConversationIsLocalChange, isRemoteConversation } from '@/utils/app/conversationStorage';
import { saveConversations } from '@/utils/app/conversation';


interface Props {
  iconSize: number | string;
}



export const CloudStorage: FC<Props> = ({
  iconSize
}) => {
  const { 
    state: { selectedConversation, conversations, folders, statsService}, dispatch: homeDispatch
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
    const curConv = conversationsRef.current.find(c => selectedConversation ? c.id === selectedConversation.id : false);
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
      setInCloud(!inCloud);
      const updatedConversations = await handleConversationIsLocalChange(selectedConversation, conversationsRef.current, foldersRef.current, statsService);
      // in case failure happens, update isLocked. it should match isLocked otherwise.   
      //@ts-ignore       
      setInCloud(selectedConversation.isLocal); 
      homeDispatch({field: 'conversations', value: updatedConversations});
      saveConversations(updatedConversations); 
    }
}

return  <button
    className="ml-2 cursor-pointer hover:opacity-50 pr-2"
    onClick={(e) => {
        if (confirm(title() + confirmationMessage())) handleConversationLockChange();
    }}
    title={title()}
    >
    { inCloud ? <IconCloudOff className="block text-neutral-900 dark:text-neutral-200" size={iconSize} /> : 
    <div>
      <IconCloud className="block dark:hidden" size={18} style={{ stroke: '#000000', fill: '#D3D3D3' }}/>
      <IconCloudFilled className="hidden dark:block dark:text-neutral-200" size={18} />
    </div>} 
</button>
};

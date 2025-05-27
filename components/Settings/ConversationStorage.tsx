import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconCloud, IconMessage,
    IconCloudFilled
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import { handleStorageSelection, saveStorageSettings } from '@/utils/app/conversationStorage';
import { ConversationStorage } from "@/types/conversationStorage";
import { saveConversations } from '@/utils/app/conversation';
import React from 'react';
import { InfoBox } from '../ReusableComponents/InfoBox';
import toast from 'react-hot-toast';



interface Props {
  open: boolean;
}


export const ConversationsStorage: FC<Props> = ({ open }) => {

  const { dispatch: homeDispatch, state:{conversations, selectedConversation, folders, statsService, storageSelection} } = useContext(HomeContext);

  const storageRef = useRef(storageSelection);

  useEffect(() => {
    storageRef.current = storageSelection;
  }, [storageSelection]);

  const [selectedOption, setSelectedOption] = useState( storageRef.current || '');
  const [hasChanges, setHasChanges] = useState(false);


  const { t } = useTranslation('conversationStorage');

  

  const conversationsRef = useRef(conversations);

  useEffect(() => {
      conversationsRef.current = conversations;
  }, [conversations]);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);

  const handleSelectedOptionChanged = (option: string) => {
      if (!hasChanges) toast('Click "Apply Changes" to save your selection.'); 
      setSelectedOption(option);
      setHasChanges(true);
  }


  const handleSave = async () => {
    setHasChanges(false);
    saveStorageSettings(selectedOption as ConversationStorage);
    homeDispatch({field: 'storageSelection', value: selectedOption});

    const updatedConversations = await handleStorageSelection(selectedOption, conversationsRef.current, foldersRef.current, statsService);
    if (updatedConversations) {
      homeDispatch({field: 'conversations', value: updatedConversations});
      saveConversations(updatedConversations);
      if (selectedConversation) {
        const updateSelected = updatedConversations.find((c) => c.id === selectedConversation.id);
        homeDispatch({field: 'selectedConversation', value: updateSelected});
      }
    }
    toast("Storage Settings Saved");
    
  };
  
  const confirmationMessage = () => {
    switch (selectedOption) {
      case 'local-only':
        return "Any conversations stored in the cloud will be moved locally to your browser. All conversations created in the future will be stored locally.";
      case 'cloud-only':
        return "Any conversations stored locally will be moved to the cloud. All conversations created in the future will automatically be uploaded to the cloud.";
      case 'future-local':
        return "Only new conversations will be stored locally. Existing conversations will remain where they are currently stored.";
      case 'future-cloud':
        return "Only new conversations will be uploaded to the cloud. Existing conversations will remain where they are currently stored.";
    }
  }

  return ( open ? (
        <div className="settings-card">
            <div className="settings-card-header flex flex-row items-center gap-4">
              <h3 className="settings-card-title">{t('Conversation Storage')}</h3>
              <p className="settings-card-description">Choose your preferred conversation storage</p>
            </div>

            <InfoBox
              content = { 
              <div className='w-full flex justify-center text-center'>
                  <span className="ml-2 text-xs"> 
                  {"These are default settings that could be manually overwritten at the conversation level as indicated by the cloud icon."}
                  <br className='mb-2'></br>
                  {"If you are concerned with privacy, you can store your conversations locally, but they will not be available across multiple devices or browsers."}
                  <div className='mt-1 text-black dark:text-neutral-300 text-sm text-center'> {"*** This configuration applies to the current browser only ***"} </div>
                  </span>
                </div>
              }
            />


          <div className="flex flex-row justify-center text-sm font-bold mt-4 text-black dark:text-neutral-200">
            {t('Where would you like to store your conversations?')}
            <button
              type="button"
              id="applyConversationStorage"
              title='Apply Conversation Storage Changes To The Current Browser'
              className={`text-xs ml-10 p-2 py-1 rounded-lg shadow-md focus:outline-none  bg-neutral-100 text-black hover:bg-neutral-200
                          ${hasChanges ? 'border-2 border-green-500' : 'border border-neutral-800'}`}
              onClick={() => {
                  if (confirm(`${confirmationMessage()} \n\n Would you like to continue?`)) handleSave();
              }}
              >
              <>{t('Apply Changes')}
                {hasChanges && <span className='ml-0.5 text-[0.9rem]'>*</span>}
              </>
              </button>
          </div>
       
       <div className="m-4 storage-options-container">
              {/* Local Storage Card */}
              <div className="storage-option-card">
                <div className="storage-option-header">
                  <div className="storage-option-icon-wrapper local">
                    <IconMessage size={24} className="storage-option-icon" />
                  </div>
                  <div className="storage-option-title-section">
                    <h3 className="storage-option-title">Local Storage</h3>
                    <p className="storage-option-subtitle">Private & secure on this device</p>
                  </div>
                </div>
                
                <div className="storage-option-choices">
                  <label className={`storage-choice ${selectedOption === 'local-only' ? 'storage-choice-selected' : ''}`}>
                    <input
                      type="radio"
                      id="local-only"
                      name="storageOption"
                      value="local-only"
                      checked={selectedOption === 'local-only'}
                      onChange={(e) => handleSelectedOptionChanged(e.target.value)}
                      className="storage-choice-radio"
                    />
                    <div className="storage-choice-content">
                      <div className="storage-choice-title">All Conversations Local</div>
                      <div className="storage-choice-description">Move all existing conversations to local storage and store all new ones locally</div>
                    </div>
                    <div className="storage-choice-indicator"></div>
                  </label>
                  
                  <label className={`storage-choice ${selectedOption === 'future-local' ? 'storage-choice-selected' : ''}`}>
                    <input
                      type="radio"
                      id="future-local"
                      name="storageOption"
                      value="future-local"
                      checked={selectedOption === 'future-local'}
                      onChange={(e) => handleSelectedOptionChanged(e.target.value)}
                      className="storage-choice-radio"
                    />
                    <div className="storage-choice-content">
                      <div className="storage-choice-title">New Conversations Only</div>
                      <div className="storage-choice-description">Store only new conversations locally, keep existing ones where they are</div>
                    </div>
                    <div className="storage-choice-indicator"></div>
                  </label>
                </div>
              </div>

              {/* Cloud Storage Card */}
              <div className="storage-option-card">
                <div className="storage-option-header">
                  <div className="storage-option-icon-wrapper cloud">
                    <IconCloud size={24} className="storage-option-icon block dark:hidden" />
                    <IconCloudFilled size={24} className="storage-option-icon hidden dark:block" />
                  </div>
                  <div className="storage-option-title-section">
                    <h3 className="storage-option-title">Cloud Storage</h3>
                    <p className="storage-option-subtitle">Access from any device</p>
                  </div>
                </div>
                
                <div className="storage-option-choices">
                  <label className={`storage-choice ${selectedOption === 'cloud-only' ? 'storage-choice-selected' : ''}`}>
                    <input
                      type="radio"
                      id="cloud-only"
                      name="storageOption"
                      value="cloud-only"
                      checked={selectedOption === 'cloud-only'}
                      onChange={(e) => handleSelectedOptionChanged(e.target.value)}
                      className="storage-choice-radio"
                    />
                    <div className="storage-choice-content">
                      <div className="storage-choice-title">All Conversations Cloud</div>
                      <div className="storage-choice-description">Move all existing conversations to cloud and store all new ones in cloud</div>
                    </div>
                    <div className="storage-choice-indicator"></div>
                  </label>
                  
                  <label className={`storage-choice ${selectedOption === 'future-cloud' ? 'storage-choice-selected' : ''}`}>
                    <input
                      type="radio"
                      id="future-cloud"
                      name="storageOption"
                      value="future-cloud"
                      checked={selectedOption === 'future-cloud'}
                      onChange={(e) => handleSelectedOptionChanged(e.target.value)}
                      className="storage-choice-radio"
                    />
                    <div className="storage-choice-content">
                      <div className="storage-choice-title">New Conversations Only</div>
                      <div className="storage-choice-description">Store only new conversations in cloud, keep existing ones where they are</div>
                    </div>
                    <div className="storage-choice-indicator"></div>
                  </label>
                </div>
              </div>        
        </div>
      </div>
  ) : <></>)
};

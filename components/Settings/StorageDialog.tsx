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


export const StorageDialog: FC<Props> = ({ open }) => {

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
          <div className="storage-dialog-container">
            {/* Information Banner */}
            <div className="storage-info-banner">
              <div className="storage-info-icon">
                ℹ️
              </div>
              <div className="storage-info-content">
                <p className="storage-info-text">
                  Choose where to store your conversations. This setting applies to this browser only and can be overridden per conversation.
                </p>
                <p className="storage-info-privacy">
                  🔒 Local storage keeps conversations private to this device • ☁️ Cloud storage enables access from any device
                </p>
              </div>
            </div>

            {/* Storage Options */}
            <div className="storage-options-container">
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

            {/* Apply Changes Button */}
            {hasChanges && (
              <div className="storage-apply-section">
                <button
                  type="button"
                  id="applyConversationStorage"
                  className="storage-apply-button"
                  onClick={() => {
                    if (confirm(`${confirmationMessage()} \n\n Would you like to continue?`)) handleSave();
                  }}
                >
                  <span className="storage-apply-text">Apply Changes</span>
                  <span className="storage-apply-indicator">*</span>
                </button>
                <p className="storage-apply-description">
                  Click to save your storage preferences and apply them to your conversations
                </p>
              </div>
            )}
          </div>
       
  ) : <></>)
};

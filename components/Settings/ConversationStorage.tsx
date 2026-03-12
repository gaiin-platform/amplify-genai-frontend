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
  setUnsavedChanges: (b: boolean) => void;
  pendingSelection: string | null;
  setPendingSelection: (selection: string | null) => void;
}


export const ConversationsStorage: FC<Props> = ({ open, setUnsavedChanges, pendingSelection, setPendingSelection }) => {

  const { dispatch: homeDispatch, state:{conversations, selectedConversation, folders, statsService, storageSelection, storageProcessing} } = useContext(HomeContext);

  const storageRef = useRef(storageSelection);

  useEffect(() => {
    storageRef.current = storageSelection;
  }, [storageSelection]);

  // Use pendingSelection from parent if it exists, otherwise use storageSelection
  const selectedOption = pendingSelection !== null ? pendingSelection : (storageSelection || '');
  const hasChanges = pendingSelection !== null && pendingSelection !== storageSelection;


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
      // Check if the new selection is different from the original
      if (option === storageSelection) {
        // Switched back to original - no changes
        setPendingSelection(null);
        setUnsavedChanges(false);
      } else {
        // Changed to something different
        setPendingSelection(option);
        setUnsavedChanges(true);
      }
  }


  const handleSave = async () => {
    if (!hasChanges) {
      console.log('[ConversationStorage] No changes to save');
      return;
    }

    console.log('[ConversationStorage] Starting save process');
    console.log('[ConversationStorage] Selected option:', selectedOption);
    console.log('[ConversationStorage] Current storageSelection:', storageSelection);
    console.log('[ConversationStorage] Total conversations:', conversationsRef.current.length);

    // Show processing bar for "all" options
    const isAllOption = selectedOption === 'local-only' || selectedOption === 'cloud-only';
    if (isAllOption) {
      homeDispatch({
        field: 'storageProcessing',
        value: {
          isProcessing: true,
          message: selectedOption === 'local-only'
            ? 'Moving all conversations to local storage...'
            : 'Moving all conversations to cloud storage...',
          progress: 0,
          total: 0,
        }
      });
      // Small delay to ensure the progress bar renders before async work starts
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      // No confirmation needed here - it's handled in SettingDialog before the event is dispatched
      setUnsavedChanges(false);
      setPendingSelection(null);

      saveStorageSettings(selectedOption as ConversationStorage);
      homeDispatch({field: 'storageSelection', value: selectedOption});
      const updatedConversations = await handleStorageSelection(
        selectedOption,
        conversationsRef.current,
        foldersRef.current,
        statsService,
        (current, total) => {
          homeDispatch({
            field: 'storageProcessing',
            value: {
              isProcessing: true,
              message: selectedOption === 'local-only'
                ? 'Moving all conversations to local storage...'
                : 'Moving all conversations to cloud storage...',
              progress: current,
              total: total,
            }
          });
        }
      );

      if (updatedConversations) {
        homeDispatch({field: 'conversations', value: updatedConversations});
        saveConversations(updatedConversations);
        if (selectedConversation) {
          const updateSelected = updatedConversations.find((c) => c.id === selectedConversation.id);
          homeDispatch({field: 'selectedConversation', value: updateSelected});
        }
      }

      toast("Storage Settings Saved");
    } catch (error) {
      console.error('[ConversationStorage] Error during save:', error);
      toast.error('Failed to save storage settings');
    } finally {
      homeDispatch({
        field: 'storageProcessing',
        value: {
          isProcessing: false,
          message: '',
          progress: 0,
          total: 0,
        }
      });
    }
  };

  useEffect(() => {
    window.addEventListener('settingsSave', handleSaveWithConfirmation);
    return () => window.removeEventListener('settingsSave', handleSaveWithConfirmation);
  }, [hasChanges, selectedOption]);

  // Reset to original value when modal closes without saving
  useEffect(() => {
    const handleCleanup = () => {
      setPendingSelection(null);
      setUnsavedChanges(false);
    };

    window.addEventListener('cleanupApiKeys', handleCleanup);
    return () => window.removeEventListener('cleanupApiKeys', handleCleanup);
  }, [setPendingSelection, setUnsavedChanges]);
  
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

  const handleSaveWithConfirmation = async () => {
    if (!hasChanges) return;

    const message = confirmationMessage();
    const confirmed = confirm(message);
    if (!confirmed) return;

    await handleSave();
  };

  return (
    <>
      {open && (
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
      )}
    </>
  )
};

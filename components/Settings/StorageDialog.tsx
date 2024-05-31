import { FC, SetStateAction, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import {
    IconInfoCircle, IconCloud, IconMessage,
    IconCloudFilled
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import { getStorageSelection, handleStorageSelection, saveStorageSettings } from '@/utils/app/conversationStorage';
import { ConversationStorage } from "@/types/conversationStorage";
import { saveConversations } from '@/utils/app/conversation';



interface Props {
  open: boolean;
  onClose: () => void;
}


export const StorageDialog: FC<Props> = ({ open, onClose }) => {
  
  const [selectedOption, setSelectedOption] = useState(getStorageSelection() || '');

  const { t } = useTranslation('conversationStorage');

  const { dispatch: homeDispatch, state:{conversations, selectedConversation, statsService} } = useContext(HomeContext);
  const modalRef = useRef<HTMLDivElement>(null);
  

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      window.removeEventListener('mouseup', handleMouseUp);
      onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  const handleSave = async () => {
    onClose();
    saveStorageSettings({ storageLocation: selectedOption } as ConversationStorage);
    homeDispatch({field: 'storageSelection', value: selectedOption});

    const updatedConversations = await handleStorageSelection(selectedOption, conversations, statsService);
    if (updatedConversations) {
      homeDispatch({field: 'conversations', value: updatedConversations});
      saveConversations(updatedConversations);
      if (selectedConversation) {
        const updateSelected = updatedConversations.find((c) => c.id === selectedConversation.id);
        homeDispatch({field: 'selectedConversation', value: updateSelected});
      }
    }
    
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
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="dark:border-netural-400 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            role="dialog"
          >
            <div className="text-lg pb-4 font-bold text-black dark:text-neutral-200 flex items-center">
              {t('Conversation Storage')}
            </div>

            <div className="text-sm font-bold mb-4 text-black dark:text-neutral-200">
              {t('Where would you like to store your conversations?')}
            </div>

            <div className="flex items-center p-2 border border-gray-400 dark:border-gray-500 rounded ">
              <IconInfoCircle size={16} className='ml-1 mb-1 flex-shrink-0 text-gray-600 dark:text-gray-400' />
              <span className="ml-2 text-xs text-gray-600 dark:text-gray-400"> 
              {"These are default settings that could be manually overwritten at the conversation level as indicated by the cloud icon."}
              <br className='mb-1'></br>
              {"If you are concerned with privacy, you can store your conversations locally, but they will not be available across multiple devices or browsers."}
              </span>
            </div>


            

        <form>
          {/* Local Storage Section */}
          <div className="mb-4">
              <div className="mt-4 pb-1 border-b border-gray-300">
                  <label className="text-base font-semibold" title='Local storage keeps your conversations only in this browser, ensuring they remain private.' >Local Storage</label>
                  <button
                      type="button"
                      className="ml-0.8 bg-transparent border-none " 
                      disabled
                      title='Local storage keeps your conversations only in this browser, ensuring they remain private.'
                      >
                      <IconMessage className='ml-2' size={18} style={{ marginBottom: '-4px' }} />
                    </button>
              </div>
              <div className="mt-2 mb-2">
                  <input
                      type="radio"
                      id="local-only"
                      name="storageOption"
                      value="local-only"
                      checked={selectedOption === 'local-only'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="local-only"> Store all existing and new conversations locally </label>
              </div>
              <div className="mb-1">
                  <input
                      type="radio"
                      id="future-local"
                      name="storageOption"
                      value="future-local"
                      checked={selectedOption === 'future-local'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="future-local"> Store only new conversations locally</label>
              </div>
          </div>

          {/* Cloud Storage Section */}
          <div className="mb-4">
              <div className="pb-1 border-b border-gray-300">
                  <label className="text-base font-semibold" title="Cloud storage allows access to your conversations from any device.">Cloud Storage</label>
                  <button
                      type="button"
                      className="ml-0.8 bg-transparent border-none " 
                      disabled
                      title='Cloud storage allows access to your conversations from any device.'
                      >
                      <div className='ml-2' style={{ marginBottom: '-4px' }} >
                        <IconCloud className="block dark:hidden" size={20} />
                        <IconCloudFilled className="hidden dark:block dark:text-neutral-200" size={20} />
                      </div>
                    </button>
              </div>
              <div className="mt-2  mb-2">
                  <input
                      type="radio"
                      id="cloud-only"
                      name="storageOption"
                      value="cloud-only"
                      checked={selectedOption === 'cloud-only'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="cloud-only"> Store all existing and new conversations in the cloud</label>
              </div>
              <div>
                  <input
                      type="radio"
                      id="future-cloud"
                      name="storageOption"
                      value="future-cloud"
                      checked={selectedOption === 'future-cloud'}
                      onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <label htmlFor="future-cloud"> Store only new conversations in the cloud</label>
              </div>
          </div>
        </form>

            <div className="flex justify-between mt-6 space-x-4"> 
                <button
                type="button"
                className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                onClick={() => onClose()}
                >
                {t('Cancel')}
                </button>


                <button
                type="button"
                className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                onClick={() => {
                    if (confirm(`${confirmationMessage()} \n\n Would you like to continue?`)) handleSave();
                }}
                >
                {t('Save')}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : <></>)
};

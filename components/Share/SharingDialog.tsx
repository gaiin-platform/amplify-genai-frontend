import React from 'react';
import { IconX, IconShare, IconUsers } from '@tabler/icons-react';
import { useTranslation } from 'next-i18next';
import SharedItemsList from './SharedItemList';

interface SharingDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SharingDialog: React.FC<SharingDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation('common');

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-[#343541] rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[85vh] overflow-hidden border border-neutral-200 dark:border-neutral-600">
        {/* Header with gradient background */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/10 dark:to-blue-900/10"></div>
          <div className="relative flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-600">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-xl">
                <IconShare size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Sharing Center
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Manage items shared with you and collaborate with others
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-200 group"
              title="Close"
            >
              <IconX size={20} className="text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="relative bg-white dark:bg-[#343541]">
          <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
            <div className="p-2">
              <SharedItemsList />
            </div>
          </div>
        </div>
        
        {/* Footer with subtle pattern */}
        <div className="relative border-t border-neutral-200 dark:border-neutral-600">
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 opacity-50"></div>
          <div className="relative px-6 py-3">
            <div className="flex items-center justify-center space-x-2 text-xs text-neutral-500 dark:text-neutral-400">
              <IconUsers size={14} />
              <span>Collaborate securely with shared conversations and prompts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharingDialog;
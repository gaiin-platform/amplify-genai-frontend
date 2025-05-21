import React from 'react';
import { IconX } from '@tabler/icons-react';
import SharedItemsList from './SharedItemList';

interface SharingDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SharingDialog: React.FC<SharingDialogProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-[#343541] rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Sharing
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <IconX size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
          <SharedItemsList />
        </div>
      </div>
    </div>
  );
};

export default SharingDialog;
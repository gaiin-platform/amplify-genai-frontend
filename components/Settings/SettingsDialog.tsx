import { FC } from 'react';
import { useTranslation } from 'next-i18next';
import { IconX } from '@tabler/icons-react';

import { SettingsBar } from './SettingsBar';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsDialog: FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation('common');

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#343541] rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-600">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <IconX size={20} className="text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <SettingsBar />
        </div>
      </div>
    </div>
  );
};
import React, { FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconAlertTriangle, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { IntegrationFileRecord } from '@/types/integrations';

export interface BatchProgress {
  total: number;
  completed: number;
  failed: Array<{ file: IntegrationFileRecord; error: string }>;
  currentFile: string | null;
  isComplete: boolean;
  scanningFolders?: boolean;
  scanningMessage?: string;
}

interface Props {
  progress: BatchProgress;
  onCancel: () => void;
  onRetry: (failedFiles: IntegrationFileRecord[]) => void;
  onClose: () => void;
}

export const BatchProcessModal: FC<Props> = ({ progress, onCancel, onRetry, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const percentComplete = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const hasErrors = progress.failed.length > 0;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={progress.isComplete ? onClose : undefined}
        onKeyDown={progress.isComplete ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); }} : undefined}
        role={progress.isComplete ? "button" : undefined}
        tabIndex={progress.isComplete ? 0 : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#343541] rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            {!progress.isComplete && !progress.scanningFolders && (
              <IconLoader2 size={20} className="animate-spin text-blue-600 dark:text-blue-400" />
            )}
            {progress.scanningFolders && (
              <IconLoader2 size={20} className="animate-spin text-yellow-600 dark:text-yellow-400" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {progress.scanningFolders
                ? 'Scanning Folders...'
                : progress.isComplete
                  ? 'Upload Complete'
                  : 'Uploading Files'}
            </h3>
          </div>
          {progress.isComplete && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <IconX size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Scanning folders message */}
          {progress.scanningFolders && progress.scanningMessage && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2">
                <IconLoader2 size={18} className="animate-spin text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                  {progress.scanningMessage}
                </p>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                Please wait while we retrieve all files...
              </p>
            </div>
          )}

          {/* Current file being processed */}
          {!progress.isComplete && !progress.scanningFolders && progress.currentFile && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Processing: <span className="font-medium text-gray-900 dark:text-white">{progress.currentFile}</span>
              </p>
            </div>
          )}

          {/* Progress bar - only show when not scanning */}
          {!progress.scanningFolders && progress.total > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {progress.completed} of {progress.total}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {percentComplete}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
          )}

          {/* Completed files */}
          {progress.completed > 0 && !progress.scanningFolders && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                Completed ({progress.completed - progress.failed.length})
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {/* We'll just show a summary since we don't track individual successes */}
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <IconCheck size={16} />
                  <span>{progress.completed - progress.failed.length} files uploaded successfully</span>
                </div>
              </div>
            </div>
          )}

          {/* Failed files */}
          {hasErrors && !progress.scanningFolders && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 uppercase flex items-center gap-1">
                <IconAlertTriangle size={16} />
                Failed ({progress.failed.length})
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {progress.failed.map((item, index) => (
                  <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-900 dark:text-red-300">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {item.error}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t dark:border-gray-700">
          {!progress.isComplete && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Cancel
            </button>
          )}

          {progress.isComplete && hasErrors && (
            <button
              onClick={() => onRetry(progress.failed.map(f => f.file))}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Retry Failed ({progress.failed.length})
            </button>
          )}

          {progress.isComplete && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level (above everything)
  return createPortal(modalContent, document.body);
};

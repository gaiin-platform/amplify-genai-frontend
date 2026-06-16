import { FC, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import HomeContext from '@/pages/api/home/home.context';

export const StorageProgressBar: FC = () => {
  const { state: { storageProcessing } } = useContext(HomeContext);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { isProcessing, message, progress, total } = storageProcessing;

  if (!isMounted || !isProcessing) {
    return null;
  }

  return createPortal(
    <div className="fixed top-0 left-0 right-0 z-[60] pointer-events-none">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg pointer-events-auto">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {message}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Feel free to continue using the application—this will run in the background
              </span>
            </div>
            {total > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-4">
                {progress} / {total}
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden mt-2">
            <div
              className="bg-green-500 h-full transition-all duration-300 ease-out"
              style={{
                width: total > 0 ? `${(progress / total) * 100}%` : '0%'
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

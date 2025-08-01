import React, { FC, useRef } from 'react';

import Loader from "@/components/Loader/Loader";

interface Props {
  open: boolean;
  message: string;
}

export const LoadingDialog: FC<Props> = ({ open, message}) => {

  const modalRef = useRef<HTMLDivElement>(null);

  // Render nothing if the dialog is not open.
  if (!open) {
    return <></>;
  }

  // Render the dialog.
  return (
    <div className="no-modal-animation fixed inset-0 flex items-center justify-center z-50 animate-in fade-in duration-300">
      {/* Enhanced backdrop with blur effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/70 to-black/80 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          ref={modalRef}
          className="no-modal-animation relative bg-gray-400 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/30 p-8 animate-in slide-in-from-bottom-4 zoom-in-95 duration-300"
          role="dialog"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/30 dark:from-blue-950/30 dark:via-transparent dark:to-purple-950/20 rounded-3xl pointer-events-none" />
          
          <div className="relative flex flex-col items-center justify-center text-center space-y-6">
            {/* Enhanced loader container */}
            <div className="relative">
              {/* Main loader */}
              <div className="relative z-10 p-4">
                <Loader size="70"/>
              </div>
            </div>
            
            {/* Enhanced message styling */}
            <div className="space-y-3">
              <div className={`font-medium text-gray-800 dark:text-gray-100 leading-relaxed ${
                message.length > 50 
                  ? "text-sm" 
                  : "text-lg"
              }`}>
                {message}
              </div>
              
              {/* Classic bouncing dots animation */}
              <div className="flex items-center justify-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-12 h-12 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-xl" />
          <div className="absolute bottom-4 left-4 w-8 h-8 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-lg" />
        </div>
      </div>
    </div>
  );
};

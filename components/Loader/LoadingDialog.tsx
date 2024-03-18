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
            <div className="flex flex-col items-center">
              <Loader size="48"/>
              <div className="text-xl">{message}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

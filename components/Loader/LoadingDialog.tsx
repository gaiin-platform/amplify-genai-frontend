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
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="shadow-[0_5px_12px_rgba(0,0,0,0.5)] inline-block max-h-[200px] transform overflow-y-auto rounded-lg border border-gray-300 dark:border-neutral-900 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 h-[300px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            role="dialog"
          >
            <div className="h-full flex flex-col gap-2 items-center justify-center text-gray-600 dark:text-neutral-100">
              <Loader size="70"/>
              <div className="text-[1.6rem]">{message}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

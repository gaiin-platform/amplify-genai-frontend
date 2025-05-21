import React, { useEffect, useRef } from 'react';
import { FC, ReactElement, useState } from 'react';
import ActionButton from './ActionButton';
import { IconX } from '@tabler/icons-react';

interface OptionButtons {
  label: string;
  handleClick: () => void; 
  isDisabled?: boolean;
}

interface Props {
  title?: string; 
  content: ReactElement;
  width?: () => number;
  height?: () => number;
  showClose?: boolean;
  showCancel?: boolean;
  showSubmit?: boolean;
  onCancel?: () => void;
  cancelLabel?: string; 
  onSubmit?: () => void; 
  submitLabel?: string;
  disableSubmit?: boolean;
  additionalButtonOptions?: OptionButtons[];
  resizeOnVarChange?: any;
  transform?: string;
}

  export const Modal: FC<Props> = ({title, content, width , height, onCancel=()=>{}, onSubmit=()=>{}, 
                                    showClose=true, showCancel=true, showSubmit=true, cancelLabel= "Close", submitLabel="Submit",
                                    additionalButtonOptions=[], disableSubmit=false, resizeOnVarChange, transform=""}) => {

 const modalRef = useRef<HTMLDivElement>(null);

 const getInnerWindowSize = () => {
  return {height: height ? height() : window.innerHeight * 0.8,
    width: width ? width() : window.innerWidth / 2}

 }
 const [innderWindow, setInnerWindow] = useState(getInnerWindowSize());


  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      window.removeEventListener('mouseup', handleMouseUp);
      onCancel();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onCancel]);

  useEffect(() => {
    setInnerWindow(getInnerWindowSize());
  }, [resizeOnVarChange]);

  useEffect(() => {
    const updateInnerWindow = () => {
        setInnerWindow(getInnerWindowSize());
    }
    // Listen to window resize to update the size
    window.addEventListener('resize', updateInnerWindow);
    return () => {
      window.removeEventListener('resize', updateInnerWindow);
    };
  }, []);


    return (
     <div className={"fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 h-full"}>
            <div className="fixed inset-0 z-10 overflow-hidden" >
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0" >
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true" 
                        />
            
                        <div
                        ref={modalRef}
                        className={`inline-block transform rounded-lg border border-gray-300 dark:border-neutral-600 bg-neutral-100 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#2b2c36] sm:my-8 py-4 px-6 sm:align-middle`}
                        style={{width: `${innderWindow.width}px`, height: `${innderWindow.height}px`, transform: transform || undefined}}
                        id="modal"
                        role="dialog"  
                        >

                        <div className='flex flex-row'>
                        <div className="text-xl pb-4 font-bold text-black dark:text-neutral-200" id="modalTitle">
                            {title && <>{title}</>}
                            </div>
                            { showClose && 
                            <div className='ml-auto mr-[-6px]'>
                            <ActionButton
                                handleClick={() => onCancel()}
                                title={"Close"}
                            >
                                <IconX size={22}/>
                            </ActionButton>
                            </div> }  
                        </div>

                        <div id="modalScroll" className="overflow-y-auto" style={{ maxHeight: `${innderWindow.height * 0.8}px` }}>
                            {content}
                            <br className='mt-[40px]'></br>
                        </div>

                        {
                         <div className="flex flex-row gap-2 mb-2 w-full fixed bottom-0 left-0 px-4 pb-2">
                          {[...additionalButtonOptions, 
                            ...(showCancel ? [{label: cancelLabel, handleClick: () => onCancel()}] : []),
                            ...(showSubmit ? [{isDisabled: disableSubmit, label: submitLabel, handleClick: () => onSubmit()}] : [])
                          ]
                                           .map((option: OptionButtons, index: number) => 
                            <button key={index}
                              type="button"
                              id="confirmationButton"
                              disabled={option.isDisabled}
                              className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-200 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 bg-neutral-100 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                              onClick={option.handleClick}
                              style={{cursor: option.isDisabled ? "not-allowed" : "pointer", opacity: option.isDisabled ? 0.4 : 1}}
                              >
                              {option.label}
                          </button>
                          )}
                         </div>}
                    </div>
                </div>
            </div>
      </div>
    )

  }

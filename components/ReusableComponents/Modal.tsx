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
  fullScreen?: boolean;
  disableContentAnimation?: boolean;
  disableClickOutside?: boolean;
}

  export const Modal: FC<Props> = ({title, content, width , height, onCancel=()=>{}, onSubmit=()=>{}, 
                                    showClose=true, showCancel=true, showSubmit=true, cancelLabel= "Cancel", submitLabel="Submit",
                                    additionalButtonOptions=[], disableSubmit=false, resizeOnVarChange, transform="", fullScreen=false, 
                                    disableContentAnimation=false, disableClickOutside=false}) => {

 const modalRef = useRef<HTMLDivElement>(null);

 const getInnerWindowSize = () => {
  if (!height && !width && fullScreen) {
    return {height: window.innerHeight * 0.99, width: window.innerWidth * 0.985}
  }
  // Ensure minimum height for small screens and leave space for buttons
  const calculatedHeight = height ? height() : Math.max(400, Math.min(window.innerHeight * 0.95, window.innerHeight - 40));
  const calculatedWidth = width ? width() : window.innerWidth * 0.8;
  
  return {height: calculatedHeight, width: calculatedWidth}
 }
 const [innderWindow, setInnerWindow] = useState(getInnerWindowSize());


  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!disableClickOutside && modalRef.current && !modalRef.current.contains(e.target as Node)) {
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
     <div className={`modal-overlay fixed inset-0 flex items-center justify-center z-50 ${fullScreen ? 'bg-[#111115] bg-opacity-70' : ' bg-black bg-opacity-50'}`}>
            <div className="fixed inset-0 z-10 overflow-hidden" >
                <div className="flex items-center justify-center min-h-screen px-2 py-4 text-center sm:px-4 sm:py-0" >
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle "
                        aria-hidden="true" 
                        />
            
                        <div
                        ref={modalRef}
                        className={`modal-content inline-block transform rounded-lg border border-gray-300 dark:border-neutral-600 bg-neutral-100 text-left align-bottom shadow-xl transition-all dark:bg-[#2b2c36] px-6 sm:align-middle relative flex flex-col`}
                        style={{width: `${innderWindow.width}px`, height: `${innderWindow.height}px`, transform: transform || undefined}}
                        id="modal"
                        role="dialog"  
                        >

                        <div className='flex flex-row pt-4' >
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

                        <div id="modalScroll" className="flex-1 overflow-y-auto text-black dark:text-white min-h-0">
                            <div className={disableContentAnimation ? "no-modal-animation" : "modal-content-inner"}>
                                {content}
                            </div>
                        </div>

                        {
                         <div className="flex flex-row gap-3 justify-end pt-4 pb-2 mt-auto border-t border-gray-200 dark:border-neutral-600">
                          {[...additionalButtonOptions, 
                            ...(showCancel ? [{label: cancelLabel, handleClick: () => onCancel()}] : []),
                            ...(showSubmit ? [{isDisabled: disableSubmit, label: submitLabel, handleClick: () => onSubmit()}] : [])
                          ]
                                           .map((option: OptionButtons, index: number) => 
                            <button key={`modal-button-${option.label}-${index}`}
                              type="button"
                              id="confirmationButton"
                              disabled={option.isDisabled}
                              className="px-4 py-1.5 border rounded-lg shadow-md border-neutral-500 text-neutral-900 hover:bg-neutral-200 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 bg-neutral-100 dark:bg-neutral-100 dark:text-black dark:hover:bg-neutral-300 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium"
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

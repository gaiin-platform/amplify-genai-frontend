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
  disableModalScroll?: boolean;
}

  export const Modal: FC<Props> = ({title, content, width , height, onCancel=()=>{}, onSubmit=()=>{}, 
                                    showClose=true, showCancel=true, showSubmit=true, cancelLabel= "Cancel", submitLabel="Submit",
                                    additionalButtonOptions=[], disableSubmit=false, resizeOnVarChange, transform="", disableModalScroll=false}) => {

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
     <div className={"fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"}>
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
                        <div className="text-xl pb-1 font-bold text-black dark:text-neutral-200" id="modalTitle">
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

                        <div id="modalScroll" className={`${disableModalScroll ? 'admin-modal-scroll' : 'overflow-y-auto'}`} style={disableModalScroll ? {} : { maxHeight: `${innderWindow.height - 140}px` }}>
                            {content}
                        </div>

                        {
                         <div className="modal-buttons-container">
                            {[...additionalButtonOptions, 
                              ...(showCancel ? [{label: cancelLabel, handleClick: () => onCancel(), type: 'cancel'}] : []),
                              ...(showSubmit ? [{isDisabled: disableSubmit, label: submitLabel, handleClick: () => onSubmit(), type: 'submit'}] : [])
                            ]
                                             .map((option: any, index: number) => 
                              <button key={index}
                                type="button"
                                id="confirmationButton"
                                disabled={option.isDisabled}
                                className={`modal-action-button ${option.type === 'submit' ? 'modal-action-button-primary' : 'modal-action-button-secondary'} ${option.isDisabled ? 'modal-action-button-disabled' : ''}`}
                                onClick={option.handleClick}
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

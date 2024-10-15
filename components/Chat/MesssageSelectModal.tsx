import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import { Conversation, Message } from "@/types/chat";
import cloneDeep from 'lodash/cloneDeep';
import React from "react";


interface Props {
    setConversation: (c: Conversation) => void;
    onSubmit: (conv: Conversation) => void;
    onCancel: () => void;
}



const MessageSelectModal: React.FC<Props> = ({setConversation, onSubmit, onCancel}) => {
    const {state:{selectedConversation}} = useContext(HomeContext);
    const [useEntireConv , setUseEntireConv] = useState<boolean>(true);
    const [startIndex, setStartIndex] = useState<number | null>(null);

    const [messages, setMessages] = useState<Message[]>(selectedConversation?.messages.filter((m:Message) => { return m.role !== 'assistant'}) || []);

    const cropMessages = () => {
        if (selectedConversation) {
            const copy = cloneDeep(selectedConversation);
            const adjustedStartIndex = startIndex ? startIndex * 2 : 0;
            copy.messages = copy.messages.slice(adjustedStartIndex);
            setConversation(copy);
            // setConversation works async so to ensure we access to the conv we just pass it on submit. 
            onSubmit(copy);
        }
    }


    return ( <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div className="fixed inset-0 z-10 overflow-hidden">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="dark:border-neutral-600 inline-block overflow-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:w-full sm:max-w-[600px] sm:align-middle "
           style={{ transform: 'translateY(+26%)', position: 'relative' }}>
            <label className="mr-2 text-lg font-bold text-black dark:text-neutral-200">Select Conversation Range for Quality Improvement Summary</label>
    
            <div className="flex justify-center w-full mt-6">
                    {/* Inline-flex for tight wrapping with border */}
                    <div className="inline-flex flex-row gap-3 border border-gray-500 p-2 items-center">
                        <label className="mx-3 text-xl text-black dark:text-neutral-200">Submit entire conversation?</label>
                        <>
                            <style>
                                {`.switch { position: relative; display: inline-block; width: 36px; height: 12px; }
                                .switch input { opacity: 0; width: 0; height: 0; }
                                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .2s; border-radius: 15px; }
                                .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 0px; bottom: -3px; background-color: #e9e9e9; transition: .2s; border-radius: 50%;}
                                input:checked + .slider { background-color: #5c90cd;}
                                input:checked + .slider:before { transform: translateX(20px); background-color: #0475f0;}
                                input:focus + .slider { box-shadow: 0 0 1px }`}
                            </style>
                            <label className="switch mr-3">
                                <input type="checkbox" checked={useEntireConv} onChange={() => {
                                    setUseEntireConv(!useEntireConv);
                                    setStartIndex(!useEntireConv ? null : 0);
                                }} />
                                <span className="slider"></span>
                            </label>
                        </>
                    </div>
                </div>


            { <div className={`mt-6 text-black dark:text-neutral-200 flex flex-col max-h-[225px]  ${useEntireConv ? 'opacity-30 pointer-events-none' : ''} `}>
                <label className="ml-10 text-lg">Select the starting message for conversation submission. </label>
                <div className="px-10 mt-4 mb-2 flex flex-row gap-20 border-b border-gray-300">
                    #
                    <label className="text-md font-bold">Your Prompts</label>
                </div>
                <div className="overflow-y-auto overflow-x-hidden">
                    {messages.map((message, index) => (
                        <div key={index} className="flex flex-row gap-20">
                            <label className="ml-10 py-2">{index + 1}</label>
                            <button
                                onClick={() => {
                                    setStartIndex(index);
                                }}
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                className={`mr-4 text-left items-start w-full rounded-lg p-2 text-sm transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-[#343541]/90 ${startIndex === index ? "bg-neutral-200 dark:bg-[#343541]/90 cursor-default": ""}`}
                            >   
                                <label className={`mx-1 flex-full truncate text-left ${startIndex === index ? "": "cursor-pointer"}`}
                                      >{message.content.slice(0,75)}</label>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            }

            <div className="flex flex-row items-center justify-end py-4 bg-white dark:bg-[#22232b]">
                <button className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300" 
                    onClick={onCancel}
                    >Cancel
                </button>
                <button className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300" 
                    onClick={cropMessages}
                    >Submit
                </button>
            </div>
              
          </div>
      </div>
  </div>
</div>
)

}

export default MessageSelectModal;
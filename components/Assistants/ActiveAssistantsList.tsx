import React, {FC, useContext, useEffect, useRef, useState} from 'react';
import {IconRobot} from '@tabler/icons-react';
import 'react-circular-progressbar/dist/styles.css';
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import HomeContext from "@/pages/api/home/home.context";
import {Assistant, AssistantProviderID} from "@/types/assistant";
import {DEFAULT_SYSTEM_PROMPT} from "@/utils/app/const";
import {MessageType} from "@/types/chat";
import { Prompt } from '@/types/prompt';

interface Props {
}

const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: #777777;
  font-size: 1.1rem;
  font-weight: bold;
  animation: ${animate} 2s infinite;
`;


export const ActiveAssistantsList: FC<Props> = ({}) => {
    const {state: {selectedConversation, prompts, selectedAssistant}, dispatch: homeDispatch} = useContext(HomeContext);

    const baseAssistant: Assistant = {
        id: 'chat',
        definition:
            {
                provider: AssistantProviderID.AMPLIFY,
                name: "Standard Conversation",
                description: "No assistant will be used.",
                instructions: selectedConversation?.prompt || DEFAULT_SYSTEM_PROMPT,
                tools: [],
                tags: [],
                fileKeys: [],
                dataSources: []
            }
    };

    const [activeAssistant, setActiveAssistant] = useState<Assistant>(baseAssistant);
    const [availableAssistants, setAvailableAssistants] = useState<Assistant[]>([baseAssistant]);
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(prompts) {

            const all:Assistant[] = prompts.filter(
                ((prompt:Prompt) => prompt.type === MessageType.ROOT && prompt.data?.assistant))
                .map((prompt:Prompt) => prompt.data?.assistant as Assistant);
            const assistants = [baseAssistant, ...all];

            setAvailableAssistants(assistants);
        }
    }, [prompts, baseAssistant]);

    useEffect(() => {
        if(selectedAssistant){
            setActiveAssistant(selectedAssistant);
        }
    }, [selectedAssistant]);

    useEffect(() => {
        function handleClickOutside(event: { target: any; }) {
            // Make sure dropdown is shown and the click is outside of the dropdown element
            if (isOpen && ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        // Bind the event listener
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, setIsOpen, ref]);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    }

    const handleSelectAssistant = (assistant:Assistant) => {
        setActiveAssistant(assistant);
        homeDispatch({field: 'selectedAssistant', value: assistant});
        setIsOpen(false);
    }

    if(availableAssistants.length < 2){
        return <></>;
    }

    return (
        <div ref={ref} className="relative" style={{width:'220px'}}>
            {isOpen && (
                <div
                    className="w-full absolute bottom-0 mb-9 border border-neutral-200 rounded overflow-scroll bg-white dark:border-neutral-600 dark:bg-[#343541]"
                    style={{height: "200px"}}
                >
                    {availableAssistants.map((assistant, index) => (
                        <div
                            key={index}
                            onClick={()=>{
                                handleSelectAssistant(assistant);
                            }}
                            className="flex flex-row items-center justify-center text-black hover:opacity-50 mt-6 dark:text-white dark:border-neutral-600 gap-3 py-2 px-4 dark:bg-[#343541] md:mb-0 md:mt-2 rounded border border-neutral-200 bg-white">

                                <IconRobot size={16}/>
                                <button key={index}
                                        className="flex w-full items-center"
                                >
                                    {assistant.definition.name.slice(0, 100)}
                                </button>
                        </div>
                    ))}
                </div>
            )}
            {activeAssistant && (
                <div
                    onClick={toggleDropdown}
                    className="flex flex-row items-center text-black hover:opacity-50 mt-6 dark:text-white dark:border-neutral-600 py-3 px-4 dark:bg-[#343541] md:mb-0 md:mt-2 rounded border border-neutral-200 bg-white">
                <IconRobot size={20}/>
                <button
                    className="ml-2 overflow-hidden text-overflow-ellipsis white-space-nowrap truncate flex w-full items-center"
                >
                    {activeAssistant.definition?.name}
                </button>
                </div>
            )}
        </div>
    );
};

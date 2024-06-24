import React, {useContext, useRef, useState} from 'react';
import {IconRobot} from "@tabler/icons-react";
import {useChatService} from "@/hooks/useChatService";
import Loader from "@/components/Loader/Loader";
import {Prompt} from "@/types/prompt";
import {parseEditableVariables, parsePromptVariables} from "@/utils/app/prompts";
import {VariableModal} from "@/components/Chat/VariableModal";
import {AttachedDocument} from "@/types/attacheddocument";
import {OpenAIModel} from "@/types/openai";
import HomeContext from "@/pages/api/home/home.context";
import {ChatBody, newMessage} from "@/types/chat";

interface PromptTextAreaProps {
    rootPromptText?: string;
    rootPromptTemplate?: Prompt;
    generateButtonText: string;
    stopButtonText?: string;
    promptTemplate?: Prompt;
    promptTemplateString?: string;
    temperature?: number;
}

const PromptTextArea: React.FC<PromptTextAreaProps> = ({temperature, stopButtonText = "Stop",rootPromptTemplate, rootPromptText, generateButtonText , promptTemplate, promptTemplateString}) => {

    const {state: {models}} = useContext(HomeContext);

    const [textAreaValue, setTextAreaValue] = useState('');
    const [selectedModel, setSelectedModel] = useState<OpenAIModel | undefined>(undefined);
    const [isGenerating, setIsGenerating] = useState(false);
    const [promptVariables, setPromptVariables] = useState<string[]>([]);

    const abortRef = useRef<boolean>(false);

    const abortController:AbortController = new AbortController();

    const {routeChatRequest} = useChatService();

    const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTextAreaValue(event.target.value);
    };


    const handleSubmit = (updatedVariables: string[], documents:AttachedDocument[]|null, prompt?:Prompt) => {

    }

    const handleStopGenerate = () => {
        abortRef.current = true;
        abortController.abort();
        setIsGenerating(false);
    }

    const handleGenerateClick = async () => {
        abortRef.current = false;
        setIsGenerating(true);

        const content = promptTemplate ? promptTemplate.content : promptTemplateString;

        const message = newMessage({content:content});

        const chatBody: ChatBody = {
            model: selectedModel || models[0],
            messages: [message],
            key: '',
            prompt: rootPromptTemplate?.content || rootPromptText || '',
            temperature: temperature || 1.0,
        };

        const response = await routeChatRequest(chatBody, abortController.signal);

        if(response.ok){
            const data = response.body;
            if(data) {
                const reader = data.getReader();
                const decoder = new TextDecoder();

                let done = false;
                let isFirst = true;
                let text = '';
                while (!done) {
                    if(abortRef.current){
                        setIsGenerating(false);
                        break;
                    }

                    const {value, done: doneReading} = await reader.read();
                    done = doneReading;
                    const chunkValue = decoder.decode(value);
                    text += chunkValue;

                    setTextAreaValue(text);
                }
                setIsGenerating(false);
            }
        }
        else {
            alert("There was an unexpected error, please try again.");
        }
    }

    return (
        <div className="flex flex-col rounded-lg w-full border border-neutral-500 dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F]">

            <textarea
                className="mt-0 mb-0 w-full rounded-t-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                id="textArea"
                value={textAreaValue}
                onChange={handleTextChange}
                rows={4}
            ></textarea>
            <div className="flex flex-row items-center justify-between mt-0">
                {!isGenerating && (
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleGenerateClick}
                        className="mr-2 w-full px-4 py-2 mt-0 border rounded-b-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                    >
                        <div className="flex flex-row items-center">
                        <div><IconRobot/></div><div className="ml-2">{generateButtonText}</div>
                        </div>
                    </button>
                </div>
                )}
                {isGenerating && (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleStopGenerate}
                            className="mr-2 w-full px-4 py-2 mt-0 border rounded-b-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                        >
                            {stopButtonText}
                        </button>
                    </div>
                )}
                <div className="mr-2">{isGenerating && (<Loader size="18"/>)}</div>
            </div>
        </div>
    );
};

export default PromptTextArea;
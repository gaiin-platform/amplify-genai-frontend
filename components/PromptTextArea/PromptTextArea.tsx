import React, { useContext, useRef, useState } from 'react';
import { IconRobot } from '@tabler/icons-react';
import { useChatService } from '@/hooks/useChatService';
import Loader from '@/components/Loader/Loader';
import { Prompt } from '@/types/prompt';
import { AttachedDocument } from '@/types/attacheddocument';
import { Model } from '@/types/model';
import HomeContext from '@/pages/api/home/home.context';
import { ChatBody, newMessage } from '@/types/chat';
import { filterModels } from '@/utils/app/models';
import { getSettings } from '@/utils/app/settings';
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';


interface PromptTextAreaProps {
    rootPromptText?: string;
    rootPromptTemplate?: Prompt;
    generateButtonText: string;
    stopButtonText?: string;
    promptTemplate?: Prompt;
    promptTemplateString?: string;
    temperature?: number;
    value?: string;
    onChange?: (value: string) => void;
    rows?: number;
    placeholder?: string;
    markdownBlockType?: string;
    codeLanguage?: string;
    postProcessor?: (text: string) => string;
}

const PromptTextArea: React.FC<PromptTextAreaProps> = ({
                                                           temperature,
                                                           stopButtonText = 'Stop',
                                                           rootPromptTemplate,
                                                           rootPromptText,
                                                           generateButtonText,
                                                           promptTemplate,
                                                           promptTemplateString,
                                                           codeLanguage,
                                                           value,
                                                           onChange,
                                                           markdownBlockType,
                                                           postProcessor=(s)=>s,
                                                           rows = 4,
                                                           placeholder = '', // ✅ default to empty string
                                                       }) => {
    const { state: { featureFlags, availableModels } } = useContext(HomeContext);

    const [internalValue, setInternalValue] = useState('');
    const [selectedModel, setSelectedModel] = useState<Model | undefined>(undefined);
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef<boolean>(false);
    const abortController: AbortController = new AbortController();

    const { routeChatRequest } = useChatService();

    const isControlled = typeof value === 'string' && typeof onChange === 'function';
    const textAreaValue = isControlled ? value : internalValue;
    const setTextAreaValue = (val: string) => {
        if (isControlled) {
            onChange?.(val);
        } else {
            setInternalValue(val);
        }
    };

    const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTextAreaValue(event.target.value);
    };

    const filteredModels = filterModels(availableModels, getSettings(featureFlags).hiddenModelIds);

    const handleStopGenerate = () => {
        abortRef.current = true;
        abortController.abort();
        setIsGenerating(false);
    };

    const extractMarkdownBlock = (text: string, blockType: string): string => {
        try {
            const startMarker = '```' + blockType;
            const startIdx = text.indexOf(startMarker);

            if (startIdx === -1) return text;

            const afterStartIdx = startIdx + startMarker.length;
            const endIdx = text.lastIndexOf('```');

            if (endIdx === -1 || endIdx <= afterStartIdx) return text;

            return text.slice(afterStartIdx, endIdx).trim();
        } catch (err) {
            console.error('Error extracting markdown block:', err);
            return text;
        }
    };

    const handleGenerateClick = async () => {
        abortRef.current = false;
        setIsGenerating(true);

        const content = promptTemplate ? promptTemplate.content : promptTemplateString;
        const message = newMessage({ content });

        const chatBody: ChatBody = {
            model: selectedModel || filteredModels[0],
            messages: [message],
            key: '',
            prompt: rootPromptTemplate?.content || rootPromptText || '',
            temperature: temperature || 1.0,
        };

        const response = await routeChatRequest(chatBody, abortController.signal);

        if (response.ok) {
            const data = response.body;
            if (data) {
                const reader = data.getReader();
                const decoder = new TextDecoder();

                let done = false;
                let text = '';

                while (!done) {
                    if (abortRef.current) {
                        setIsGenerating(false);
                        break;
                    }

                    const { value, done: doneReading } = await reader.read();
                    done = doneReading;
                    const chunkValue = decoder.decode(value);
                    text += chunkValue;
                }

                if (markdownBlockType) {
                    text = extractMarkdownBlock(text, markdownBlockType);
                }

                if(postProcessor){
                    text = postProcessor(text);
                }

                setTextAreaValue(text);
                setIsGenerating(false);
            }
        } else {
            alert('There was an unexpected error, please try again.');
        }
    };

    return (
        <div className="flex flex-col rounded-lg w-full border border-neutral-500 dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F]">

            {codeLanguage && (
                <Editor
                    value={textAreaValue}
                    onValueChange={setTextAreaValue}
                    highlight={code =>
                        Prism.highlight(code, Prism.languages[codeLanguage] || Prism.languages.python, codeLanguage)
                    }
                    padding={12}
                    style={{
                        fontFamily: '"Fira Code", monospace',
                        fontSize: 14,
                        backgroundColor: '#2d2d2d',
                        color: 'white',
                        borderRadius: '0.5rem 0.5rem 0 0',
                        minHeight: `${rows * 24}px`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}
                />
            )}
            {!codeLanguage && (
                <textarea
                    className="mt-0 mb-0 w-full rounded-t-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                    id="textArea"
                    value={textAreaValue}
                    onChange={handleTextChange}
                    rows={rows}
                    placeholder={placeholder} // ✅ placeholder applied
                ></textarea>
            )}

            <div className="flex flex-row items-center justify-between mt-0">
                {!isGenerating && (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleGenerateClick}
                            className="mr-2 w-full px-4 py-2 mt-0 border rounded-b-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                        >
                            <div className="flex flex-row items-center">
                                <IconRobot />
                                <div className="ml-2">{generateButtonText}</div>
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
                <div className="mr-2">{isGenerating && <Loader size="18" />}</div>
            </div>
        </div>
    );
};

export default PromptTextArea;
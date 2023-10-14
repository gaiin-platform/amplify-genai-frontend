import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import {Parameters, WorkflowDefinition} from "@/types/workflow";
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";
import {IconEdit, IconDots} from "@tabler/icons-react";
import {WorkflowRun} from "@/types/workflow";
import { v4 as uuidv4 } from 'uuid';

interface Props {
    workflowDefinition: WorkflowDefinition;
    onClose: () => void;
    onRunWorkflow: (workflowRun: WorkflowRun) => void;
}

const Tag: FC<{tag: string}> = ({ tag }) => (
    <span
        className="inline-flex items-center bg-blue-200 rounded-full py-1 px-2 mt-2 mr-2 text-sm font-medium text-blue-800"
    >
        {tag}
    </span>
);

const toParametersMap = (parameters:Parameters) => {
    return Object.entries(parameters)
        .map(([name, param]) => ({name:name, value:param.defaultValue}))
        .reduce((acc, val) => {
        // @ts-ignore
        acc[val.name] = val.value;
        return acc;
    });
}

export const RunWorkflowDefinitionModal: FC<Props> = ({ workflowDefinition, onClose, onRunWorkflow }) => {
    const { t } = useTranslation('workflowDefinitionbar');
    const [name, setName] = useState(workflowDefinition.name);
    const [prompt, setPrompt] = useState(workflowDefinition.generatingPrompt);
    const [description, setDescription] = useState(workflowDefinition.description);
    const [code, setCode] = useState(workflowDefinition.code);
    const [tags, setTags] = useState(workflowDefinition.tags);
    const [inputs, setInputs] = useState(JSON.stringify(workflowDefinition.inputs, null, 2));
    const [outputs, setOutputs] = useState(JSON.stringify(workflowDefinition.outputs, null, 2));
    const [workflowInputs, setWorkflowInputs] = useState(toParametersMap(workflowDefinition?.inputs.parameters));
    const [workflowRun, setWorkflowRun] = useState<WorkflowRun>({
        id: uuidv4(),
        workflowDefinition: workflowDefinition,
        inputs: {
            parameters: toParametersMap(workflowDefinition?.inputs.parameters),
            documents: []
        },
        // Create a date/time string
        startTime: new Date().toISOString(),
    });

    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                window.addEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            window.removeEventListener('mouseup', handleMouseUp);
            onClose();
        };

        window.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, [onClose]);

    const handleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {

        }
    };

    const handleRun = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        console.log("Run workflow", workflowRun);
        onRunWorkflow(workflowRun);
        onClose();
    }

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onKeyDown={handleEnter}
        >
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />

                    <div
                        ref={modalRef}
                        className="overflow-hidden dark:border-netural-400 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                        role="dialog"
                    >
                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Name
                        </div>
                        <input
                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                            value={name} onChange={e => setName(e.target.value)} />


                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Description
                        </div>
                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            {description}
                        </div>

                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200 mb-4">
                            Inputs
                        </div>
                        {Object.entries(workflowDefinition.inputs.parameters).map(([name,param], idx) => (
                         <div key={idx}>
                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {param.name}: <span className="text-sm ml-2">{param.description}</span>
                            </div>

                            <div className="flex items-center text-black space-x-2 mb-3">
                                <textarea
                                    className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    value={workflowRun.inputs.parameters[name]} onChange={e => {
                                        setWorkflowRun(
                                            {
                                                ...workflowRun,
                                                inputs: {
                                                    ...workflowRun.inputs,
                                                    parameters: {
                                                        ...workflowRun.inputs.parameters,
                                                        [name]: e.target.value
                                                    }
                                                }
                                            }
                                        )
                                    }}
                                />
                            </div>

                         </div>
                        ))}

                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Input Documents
                        </div>
                        {workflowDefinition.inputs.documents.map((doc, idx) => (
                            <div key={idx} className="flex items-center space-x-2 mb-3">
                                <IconDots className="text-lg" />
                                <span className="text-lg">{doc.fileExtension}</span>
                                <span className="text-sm ml-2">{doc.fileMimeType}</span>
                            </div>
                        ))}


                        <div className="bottom-0 left-0 w-full px-4 py-3 shadow-md flex justify-end items-center space-x-4">
                        <button
                            type="button"
                            className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={() => {
                                // const updatedWorkflowDefinition = {
                                //     ...workflowDefinition,
                                //     name,
                                //     description,
                                //     code: code.trim(),
                                // };

                                // onShareWorkflowDefinition(updatedWorkflowDefinition);
                                onClose();
                            }}
                        >
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            className="w-full px-4 ml-2 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={handleRun}
                        >
                            {t('Run')}
                        </button>
                    </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
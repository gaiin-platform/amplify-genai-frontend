import {FC, KeyboardEvent, useEffect, useRef, useState} from 'react';

import {Prompt} from '@/types/prompt';
import {AttachFile} from "@/components/Chat/AttachFile";
import {AttachedDocument} from "@/types/attacheddocument";
import {WorkflowDefinition} from "@/types/workflow";
import {OpenAIModelID, OpenAIModel} from "@/types/openai";

interface Props {
    models: OpenAIModel[];
    prompt?: Prompt;
    workflowDefinition?: WorkflowDefinition;
    variables: string[];
    handleUpdateModel: (model: OpenAIModel) => void;
    onSubmit: (updatedVariables: string[], documents: AttachedDocument[] | null) => void;
    onClose: () => void;
}

const isText = (variable: string) => {
    // return if the variable is not any of the other is* functions
    return !isFile(variable) && !isBoolean(variable) && !isOptions(variable);
}

const isFile = (variable: string) => {
    // return if the variable is suffixed with :file
    return variable.endsWith(':file');
}

const isBoolean = (variable: string) => {
    // return if the variable is suffixed with :file
    return variable.endsWith(':boolean');
}

const isOptions = (variable: string) => {
    // return if the variable contains :options[option1,option2,...]
    return variable.includes(':options[');
}

// Parse the name of a variable to remove the suffixes
export const parseVariableName = (variable: string) => {
    if (isFile(variable)) {
        return variable.split(':')[0];
    } else if (isBoolean(variable)) {
        return variable.split(':')[0];
    } else if (isOptions(variable)) {
        return variable.split(':')[0];
    } else {
        return variable;
    }
}

export const VariableModal: FC<Props> = ({
                                             models,
                                             handleUpdateModel,
                                             prompt,
                                             workflowDefinition,
                                             variables,
                                             onSubmit,
                                             onClose,
                                         }) => {

    // @ts-ignore
    const [selectedModel, setSelectedModel] = useState<OpenAIModel>((models.length>0)? models[0] : null);
    const [updatedVariables, setUpdatedVariables] = useState<{ key: string; value: any }[]>(
        variables
            .map((variable) => {
                let value: any = '';

                if (isBoolean(variable)) {
                    value = false;
                } else if (isOptions(variable)) {
                    // set the value to the first option
                    value = variable.split(':')[1].split('[')[1].split(']')[0].split(',')[0];
                }
                return {key: variable, value: value}
            })
            .filter(
                (item, index, array) =>
                    array.findIndex((t) => t.key === item.key) === index,
            ),
    );


    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLTextAreaElement>(null);

    const handleChange = (index: number, value: any) => {
        setUpdatedVariables((prev) => {
            const updated = [...prev];
            updated[index].value = value;
            return updated;
        });
    };

    const handleModelChange = (modelId: string) => {
        const model = models.find((m) => m.id === modelId);
        if (model) {
            setSelectedModel(model);
            handleUpdateModel(model);
        }
    }

    const handleSubmit = () => {
        if (updatedVariables.some((variable) => variable.value === '')) {
            alert('Please fill out all variables');
            return;
        }
        // Separate the documents into their own array
        const documents = updatedVariables
            .filter((variable) => isFile(variable.key))
            .map((variable) => {
                return {...variable.value, name: parseVariableName(variable.key)};
            });

        const justVariables = updatedVariables
            .map((variable) => (isFile(variable.key)) ? "" : variable.value);

        console.log("justVariables", justVariables);
        console.log("justDocuments", documents);

        onSubmit(justVariables, documents);
        onClose();
    };


    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        console.log("Keydown");
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            //handleSubmit();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        window.addEventListener('click', handleOutsideClick);

        return () => {
            window.removeEventListener('click', handleOutsideClick);
        };
    }, [onClose]);

    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, []);


    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onKeyDown={handleKeyDown}
        >
            <div
                ref={modalRef}
                className="dark:border-netural-400 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                role="dialog"
            >

                {prompt && (
                    <div className="mb-4 text-xl font-bold text-black dark:text-neutral-200">
                        {prompt.name}
                    </div>
                )}
                {prompt && (
                    <div className="mb-4 text-sm italic text-black dark:text-neutral-200">
                        {prompt.description}
                    </div>
                )}

                {workflowDefinition && (
                    <div className="mb-4 text-xl font-bold text-black dark:text-neutral-200">
                        {workflowDefinition.name}
                    </div>
                )}
                {workflowDefinition && (
                    <div className="mb-4 text-sm italic text-black dark:text-neutral-200">
                        {workflowDefinition.description}
                    </div>
                )}

                {updatedVariables.map((variable, index) => (
                    <div className="mb-4" key={index}>
                        {!isBoolean(variable.key) &&
                            <div className="mb-2 text-sm font-bold text-neutral-200">
                                {parseVariableName(variable.key)}
                            </div>}

                        {isText(variable.key) && (
                            <textarea
                                ref={index === 0 ? nameInputRef : undefined}
                                className="mt-1 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={`Enter a value for ${variable.key}...`}
                                value={variable.value}
                                onChange={(e) => handleChange(index, e.target.value)}
                                rows={3}
                            />
                        )}

                        {isFile(variable.key) && ( //use AttachFile component
                            <div>
                                <AttachFile id={"__idVarFile" + index} onAttach={(doc) => {
                                    handleChange(index, doc);
                                }}/>
                                {variable.value &&
                                    // @ts-ignore
                                    <span>{variable.value.name}</span>
                                }
                            </div>
                        )}

                        {isBoolean(variable.key) && (
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                    checked={variable.value === 'true'}
                                    onChange={(e) => handleChange(index, e.target.checked ? 'true' : 'false')}
                                />
                                <span className="ml-2 text-sm text-neutral-200">{parseVariableName(variable.key)}</span>
                            </div>
                        )}
                        {isOptions(variable.key) && (
                            <div className="flex items-center">
                                <select
                                    className="rounded border-gray-300 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                    value={variable.value}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                >
                                    {variable.key.split(':')[1].split('[')[1].split(']')[0].split(',').map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                    </div>
                ))}

                <div className="mb-2 text-sm font-bold text-neutral-200">
                    Model
                </div>

                {models && (
                    <div className="flex items-center">
                        <select
                            className="rounded border-gray-300 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                            value={selectedModel.id}
                            onChange={(e) => handleModelChange(e.target.value)}
                        >
                            {models.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <button
                    className="mt-6 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                    onClick={handleSubmit}
                >
                    Submit
                </button>
            </div>
        </div>
    );
};

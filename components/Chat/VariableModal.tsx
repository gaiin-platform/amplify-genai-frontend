import {FC, KeyboardEvent, useContext, useEffect, useRef, useState} from 'react';

import {Prompt} from '@/types/prompt';
import {AttachFile} from "@/components/Chat/AttachFile";
import {AttachedDocument} from "@/types/attacheddocument";
import {WorkflowDefinition} from "@/types/workflow";
import {OpenAIModelID, OpenAIModel} from "@/types/openai";
import HomeContext from "@/pages/api/home/home.context";
import JSON5 from 'json5'
import {parsePromptVariableValues} from "@/utils/app/prompts";

interface Props {
    models: OpenAIModel[];
    prompt?: Prompt;
    workflowDefinition?: WorkflowDefinition;
    variables: string[];
    handleUpdateModel: (model: OpenAIModel) => void;
    onSubmit: (updatedVariables: string[], documents: AttachedDocument[] | null, prompt?:Prompt) => void;
    onClose: (canceled:boolean) => void;
}

const isText = (variable: string) => {
    // return if the variable is not any of the other is* functions
    return variable.indexOf(":") === -1 || variable.split(":")[1].startsWith("text");
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

const isConversation = (variable: string) => {
    return variable.includes(':conversation');
}

const isConversationFolder = (variable: string) => {
    return variable.includes(':conversation-folder');
}

const isPromptTemplate = (variable: string) => {
    return variable.includes(':template');
}

const isPromptTemplateFolder = (variable: string) => {
    return variable.includes(':template-folder');
}

// Parse the name of a variable to remove the suffixes
export const parseVariableName = (variable: string) => {
    if(variable.indexOf(":") > -1) {
        return variable.split(":")[0];
    }
    else {
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

    const {
        state: { featureFlags, prompts, conversations },
    } = useContext(HomeContext);

    // @ts-ignore
    const [selectedModel, setSelectedModel] = useState<OpenAIModel>((models.length>0)? models[0] : null);
    const [isConversationDropdownOpen, setIsConversationDropdownOpen] = useState(false);
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

        // Final updates that shouldn't be visible / editable to the user
        // Transform all of the values of the updateVariables map with the getValue function
        const transformedVariables =
        updatedVariables.map((variable) => ({...variable, value: getValue(variable.key, variable.value)}));

        // Separate the documents into their own array
        const documents = transformedVariables
            .filter((variable) => isFile(variable.key))
            .map((variable) => {
                return {...variable.value, name: parseVariableName(variable.key)};
            });

        const justVariables = transformedVariables
            .map((variable) => (isFile(variable.key)) ? "" : variable.value);


        console.log("Submitting prompt :", prompt);
        onSubmit(justVariables, documents, prompt);
        onClose(false);
    };


    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            //handleSubmit();
        } else if (e.key === 'Escape') {
            onClose(true);
        }
    };

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose(true);
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



    const getConversations = (variable: string) => {
        const options = parsePromptVariableValues(variable);

        let filtered = conversations.filter((conversation) => {
           if(options.startsWith){
               console.log(conversation.name + " .startsWith " + options.startsWith + " = " + conversation.name.startsWith(options.startsWith));
               return conversation.name.startsWith(options.startsWith);
           }
           else if(options.options) {
               return options.options.includes(conversation.name);
           }
           return conversation;
        });

        return filtered;
    }

    const getConversationValue = (conversation: any) => {
        return JSON.stringify(conversation.messages);
    }

    const getPromptTemplates = (variable: string) => {
        const options = parsePromptVariableValues(variable);

        let filtered = prompts.filter((prompt) => {
            if(options.startsWith){
                return prompt.name.startsWith(options.startsWith);
            }
            else if(options.options) {
                return options.options.includes(prompt.name);
            }
            else if(options.type) {
                return prompt.type === options.type;
            }
            return prompt;
        });

        return filtered;
    }

    const getPromptTemplateValue = (prompt: any) => {
        return JSON.stringify(prompt);
    }



    const getTextValue = (variable:string, text: string) => {
        let options = parsePromptVariableValues(variable);

        console.log("Text Options:", options);

        // Append a line number to the start of every line of text
        text = (options.lineNumbers) ? text.split("\n")
            .map((line, index) => "Line "+index+": "+line).join("\n") : text;
        text = (options.escape) ? text.replaceAll("\"", "\\\"")
            .replaceAll("\n","\\n") : text;
        text = (options.truncate) ? text.slice(0, options.truncate) : text;
        text = (options.truncateFromEnd) ? text.slice(-1 * options.truncate) : text;
        return text;
    }

    const getValue = (variable: string, value: any) => {
        if(isText(variable)) {
            return getTextValue(variable, value);
        }
        else {
            return value;
        }
    }

    const truncate = (str: string, n: number) => {
        return (str.length > n) ? str.slice(0, n-1) + '...' : str;
    }

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
                                placeholder={`Enter a value for ${parseVariableName(variable.key)}...`}
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
                        {isConversation(variable.key) && (
                            <div style={{ width: '200px' }} >
                                <select
                                    className="rounded truncate border-gray-300 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                    value={variable.value}
                                    style={{ width:'100%', maxWidth: '250px' }}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onClick={()=>setIsConversationDropdownOpen(!isConversationDropdownOpen)}
                                    onBlur={()=>setIsConversationDropdownOpen(!isConversationDropdownOpen)}
                                >
                                    <option
                                        style={{ maxWidth: '250px', overflow:'hidden' }}
                                        className={'truncate'}
                                        key={"not selected"} value={''}>
                                        {'Select a Conversation...'}
                                    </option>
                                    {getConversations(variable.key).map((conversation) => (
                                        <option
                                            style={{ maxWidth: '250px', overflow:'hidden' }}
                                            className={'truncate'}
                                            key={conversation.id} value={getConversationValue(conversation)}>
                                            {truncate(conversation.name, 50)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isPromptTemplate(variable.key) && (
                            <div style={{ width: '200px' }} >
                                <select
                                    className="rounded truncate border-gray-300 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                    value={variable.value}
                                    style={{ width:'100%', maxWidth: '250px' }}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onClick={()=>setIsConversationDropdownOpen(!isConversationDropdownOpen)}
                                    onBlur={()=>setIsConversationDropdownOpen(!isConversationDropdownOpen)}
                                >
                                    <option
                                        style={{ maxWidth: '250px', overflow:'hidden' }}
                                        className={'truncate'}
                                        key={"not selected"} value={''}>
                                        {'Select a Template...'}
                                    </option>
                                    {getPromptTemplates(variable.key).map((template) => (
                                        <option
                                            style={{ maxWidth: '250px', overflow:'hidden' }}
                                            className={'truncate'}
                                            key={template.id} value={getPromptTemplateValue(template)}>
                                            {truncate(template.name, 50)}
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
                                <option key={model.id} value={model.id}
                                >
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

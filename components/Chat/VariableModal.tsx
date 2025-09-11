import {FC, KeyboardEvent, useContext, useEffect, useRef, useState} from 'react';

import {Prompt} from '@/types/prompt';
import {AttachFile} from "@/components/Chat/AttachFile";
import {AttachedDocument, AttachedDocumentMetadata} from "@/types/attacheddocument";
import {WorkflowDefinition} from "@/types/workflow";
import {Model} from "@/types/model";
import HomeContext from "@/pages/api/home/home.context";
import {getType, parsePromptVariableValues, variableTypeOptions} from "@/utils/app/prompts";
import {FileList} from "@/components/Chat/FileList";
import {COMMON_DISALLOWED_FILE_EXTENSIONS} from "@/utils/app/const";
import { includeRemoteConversationData } from '@/utils/app/conversationStorage';
import { Conversation } from '@/types/chat';
import React from 'react';
import { Modal } from '../ReusableComponents/Modal';
import { ModelSelect } from './ModelSelect';

interface Props {
    models: Model[];
    prompt?: Prompt;
    workflowDefinition?: WorkflowDefinition;
    variables: string[];
    handleUpdateModel: (model: Model) => void;
    onSubmit: (updatedVariables: string[], documents: AttachedDocument[] | null, prompt?:Prompt) => void;
    onClose: (canceled:boolean) => void;
    showModelSelector?: boolean;
}

const isRequired = (variable: string) => {
    const optional = (parsePromptVariableValues(variable).optional);

    return !optional;
}

const isText = (variable: string) => {
    // return if the variable is not any of the other is* functions
    return variable.indexOf(":") === -1 || variable.split(":")[1].startsWith("text");
}

const isFile = (variable: string) => {
    // return if the variable is suffixed with :file
    return variable.endsWith(':file') || getType(variable) === "file";
}

const isFiles = (variable: string) => {
    // return if the variable is suffixed with :file
    return variable.endsWith(':files') || getType(variable) === "files";
}

const isBoolean = (variable: string) => {
    // return if the variable is suffixed with :file
    return variable.endsWith(':boolean') || getType(variable) === "boolean";
}

const isOptions = (variable: string) => {
    // return if the variable contains :options[option1,option2,...]
    return variable.includes(':options[') || getType(variable) === "options";
}

const isConversation = (variable: string) => {
    return variable.includes(':conversation') || getType(variable) === "conversation";
}

const isConversationFolder = (variable: string) => {
    return variable.includes(':conversation-folder') || getType(variable) === "conversation-folder";
}

const isPromptTemplate = (variable: string) => {
    return variable.includes(':template') || getType(variable) === "template";
}

const isPromptTemplateFolder = (variable: string) => {
    return variable.includes(':template-folder') || getType(variable) === "template-folder";
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

const getSelectOptions = (variable: string) => {
    const options = parsePromptVariableValues(variable);
    return (options.values)? options.values : [];
}

export const VariableModal: FC<Props> = ({
                                             models,
                                             handleUpdateModel,
                                             prompt,
                                             workflowDefinition,
                                             variables,
                                             onSubmit,
                                             onClose,
                                             showModelSelector = true,
                                         }) => {

    const {
        state: { prompts, conversations },
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    // @ts-ignore
    const [selectedModel, setSelectedModel] = useState<Model>( (models.length>0) ? models[0] : null );
    const [isConversationDropdownOpen, setIsConversationDropdownOpen] = useState(false);
    const [files, setFiles] = useState<AttachedDocument[]>([]);
    const [documentKeys, setDocumentKeys] = useState<{[key:string]:string}>({});
    const [documentMetadata, setDocumentMetadata] = useState<{[key:string]:AttachedDocumentMetadata}>({});
    const [conversationVariableMap, setConversationVariableMap] = useState<Map<string, Conversation[]>>(new Map());
    const [updatedVariables, setUpdatedVariables] = useState<{ key: string; value: any }[]>(
        variables
            .map((variable) => {
                const options = parsePromptVariableValues(variable);

                let value: any = options.default || '';

                if (isBoolean(variable)) {
                    value = false;
                } else if(isFiles(variable)) {
                    value = [];
                }
                else if (isOptions(variable)) {
                    // set the value to the first option
                    const values = getSelectOptions(variable);
                    value = (values && values.length > 0) ? values[0] : '';
                }
                return {key: variable, value: value}
            })
            .filter(
                (item, index, array) =>
                    array.findIndex((t) => t.key === item.key) === index,
            ),
    );

    useEffect(() => {
        const fetchAndMapConversations = async () => {
          const conversationPromises = updatedVariables
            .filter(variable => isConversation(variable.key) && !conversationVariableMap.has(variable.key))
            .map(async variable => {
              const conversations = await getConversations(variable.key);
              return { key: variable.key, conversations };
            });
    
          const conversationResults = await Promise.all(conversationPromises);
    
          setConversationVariableMap(prevMap => {
            const newMap = new Map(prevMap);
            conversationResults.forEach(({ key, conversations }) => {
              newMap.set(key, conversations);
            });
            return newMap;
          });
        };
    
        fetchAndMapConversations();
    }, [updatedVariables]);

    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLTextAreaElement>(null);
    const [documentState, setDocumentState] = useState<{[key:string]:number}>({});
    const [documentAborts, setDocumentAborts] = useState<{[key:string]:()=>void}>({});

    useEffect(() => {
        if(models.length > 0) {
            setSelectedModel(models[0]);
            handleUpdateModel(models[0]);
        }
    },[])

    const onCancelUpload = (document:AttachedDocument) => {
        try {
            
            if (documentAborts && documentAborts[document.id]) {
                documentAborts[document.id]();
            }
            else if (documentState && documentState[document.id]) {
                // Needt to delete from server
            }
        } catch (e) {
            console.log(e);
        }
    }

    const allDocumentsDoneUploading = (documents:AttachedDocument[]) => {
        console.log("Checking if all documents are done uploading");
        console.log(documents);

        if(!documents || documents.length == 0){
            console.log("No files to check");
            return true;
        }

        const isComplete = (document:AttachedDocument) => {
            return !documentState || (!document.key) || (documentState && documentState[document.id] == 100);
        }

        return documents?.every(isComplete);
    }

    const handleDocumentAbortController = (document:AttachedDocument, abortController:any) => {
        setDocumentAborts((prevState) => {
            let newState = {...prevState, [document.id]: abortController};
            newState[document.id] = abortController;
            return newState;
        });
    }

    const handleDocumentState = (document:AttachedDocument, progress:number) => {

        setDocumentState((prevState) => {
            let newState = {...prevState, [document.id]: progress};
            newState[document.id] = progress;
            return newState;
        });

    }

    const handleSetMetadata = (document:AttachedDocument, metadata:any) => {

        setDocumentMetadata((prevState) => {
            const newMetadata = {...prevState, [document.id]: metadata};
            return newMetadata;
        });
    }

    const handleSetKey = (document:AttachedDocument, key:string) => {
        setDocumentKeys((prevState) => {
           const newKeys = {...prevState, [document.id]: key};

           return newKeys;
        });
    }

    const handleChange = (index: number, value: any) => {
        setUpdatedVariables((prev) => {
            const updated = [...prev];
            updated[index].value = value;
            return updated;
        });
    };

    const handleRemoveFile = (index: number, value: any) => {
        const newFiles:AttachedDocument[] = files.filter((file) => file !== value);
        setFiles(newFiles);
    };

    const handleAddFile = (index: number, value: AttachedDocument) => {
        const newFiles:AttachedDocument[] = [...files, value];
        setFiles(newFiles);
    };

    const handleModelChange = (modelId: string) => {
        const model = models.find((m) => m.id === modelId);
        if (model) {
            setSelectedModel(model);
            handleUpdateModel(model);
        }
    }

    const handleSubmit = () => {


        // Final updates that shouldn't be visible / editable to the user
        // Transform all of the values of the updateVariables map with the getValue function
        const transformedVariables =
        updatedVariables.map((variable) => ({...variable, value: getValue(variable.key, variable.value)}));

        // Separate the documents into their own array
        let documents = transformedVariables
            .filter((variable) => isFile(variable.key))
            .map((variable) => {
                return {...variable.value, name: parseVariableName(variable.key)};
            });

        const justVariables = transformedVariables
            .map((variable) => (isFile(variable.key)) ? "" : variable.value);


        documents = [...documents, ...files];

        const fileVars = updatedVariables.filter((variable) =>
            (getType(variable.key) === 'file')
            && !parsePromptVariableValues(variable.key).optional);

        const missingFiles = fileVars.filter((variable) =>
            !variable.value || variable.value === '' || variable.value.length === 0);

        if (missingFiles.length > 0) {
            alert('Please provide all the required files marked with "*"');
            return;
        }

        const filesVar = updatedVariables.filter((variable) =>
            (getType(variable.key) === 'files')
            && !parsePromptVariableValues(variable.key).optional);

        if(filesVar.length > 0 && files.length === 0) {
            alert('Please provide all the required files marked with "*"');
            return;
        }

        if (updatedVariables.some((variable) =>
            variable.value === '' && !parsePromptVariableValues(variable.key).optional)) {

            alert('Please fill out all required variables marked with "*"');
            return;
        }

        if(!allDocumentsDoneUploading(documents)) {
            alert('Please wait for all documents to finish uploading or remove them from the prompt.');
            return;
        }

        documents = documents.map((document) => {
            if(documentKeys[document.id]) {
                document.key = documentKeys[document.id];
            }
            return document;
        });

        onSubmit(justVariables, documents, prompt);
        onClose(false);
    };


    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {

        if (e.key === 'Enter' && !e.shiftKey) {
            //e.preventDefault();
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



    const getConversations = async (variable: string) => {
        const options = parsePromptVariableValues(variable);

        const completeConversations = await includeRemoteConversationData(conversationsRef.current, "resolve", true);

        let filtered = completeConversations.filter((conversation) => {
           if(options.startsWith){
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

        let filtered = promptsRef.current.filter((prompt:Prompt) => {
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
        if(value) {

            if (isText(variable)) {
                return getTextValue(variable, value);
            } else {
                return value;
            }
        }
        else {
            const info = parsePromptVariableValues(variable);

            if(info.default) {
                return info.default;
            }
            else if (info.type === "file"){
                return {name:"", raw:""};
            }
            else {
                return "";
            }
        }
    }

    const truncate = (str: string, n: number) => {
        return (str.length > n) ? str.slice(0, n-1) + '...' : str;
    }

    return (
            <Modal 
                title={prompt ? prompt.name : ""}
                height={() => window.innerHeight * 0.75}
                width={() => window.innerWidth * 0.55}
                onCancel={()=>onClose(false)} 
                onSubmit={() => {
                    handleSubmit();
                }}
                content={

                <>
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
                            <div id="variableName" className="mb-2 text-sm font-bold text-black dark:text-neutral-200">
                                {parseVariableName(variable.key)}{isRequired(variable.key) && "*"}
                            </div>}

                        {isText(variable.key) && (
                            <textarea
                                ref={index === 0 ? nameInputRef : undefined}
                                className="mt-1 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                id="variableInputText"
                                placeholder={`Enter a value...`}
                                value={variable.value}
                                onChange={(e) => handleChange(index, e.target.value)}
                                rows={3}
                            />
                        )}

                        {isFile(variable.key) && ( //use AttachFile component
                            <div>
                                <AttachFile id={"__idVarFile" + index}
                                            disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                            onSetKey={handleSetKey}
                                            onSetMetadata={handleSetMetadata}
                                            onSetAbortController={handleDocumentAbortController}
                                            onUploadProgress={handleDocumentState}
                                            onAttach={(doc) => {
                                    handleChange(index, doc);
                                }}/>
                                {variable.value &&
                                    // @ts-ignore
                                    <FileList documents={[variable.value]}
                                              onCancelUpload={onCancelUpload}
                                              documentStates={documentState}
                                              setDocuments={()=>handleChange(index, '')}/>
                                    // <span>{variable.value.name}</span>
                                }
                            </div>
                        )}

                        {isFiles(variable.key) && ( //use AttachFile component
                            <div>
                                <AttachFile id={"__idVarFile" + index}
                                            disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                            onSetKey={handleSetKey}
                                            onSetMetadata={handleSetMetadata}
                                            onSetAbortController={handleDocumentAbortController}
                                            onUploadProgress={handleDocumentState}
                                            onAttach={(doc) => {
                                    // handleChange(index, doc);
                                    handleAddFile(index, doc);
                                }}/>
                                <FileList documents={files}
                                          onCancelUpload={onCancelUpload}
                                          documentStates={documentState}
                                          setDocuments={setFiles}/>
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
                                <span className="ml-2 text-sm text-black dark:text-neutral-200">{parseVariableName(variable.key)}{isRequired(variable.key) && "*"}</span>
                            </div>
                        )}
                        {isOptions(variable.key) && (
                            <div className="flex items-center">
                                <select
                                    className="rounded border-gray-300 text-neutral-900 shadow-sm focus:border-neutral-500 focus:ring focus:ring-neutral-500 focus:ring-opacity-50"
                                    id="selectTool"
                                    value={variable.value}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                >
                                    {getSelectOptions(variable.key).map((option:any) => (
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
                                    {(conversationVariableMap.get(variable.key), []).map((conversation: Conversation) => (
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
                                    {getPromptTemplates(variable.key).map((template:any) => (
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

                {showModelSelector && models && (
                    <div className="relative" style={{overflow: 'visible', zIndex: 1}}>
                    <ModelSelect
                        isTitled={true}
                        modelId={selectedModel.id}
                        handleModelChange={(modelId:string) => {
                            handleModelChange(modelId)
                        }}
                    />
                    </div>
                )}
                <div className="mb-2 mt-6 text-sm font-bold text-black dark:text-neutral-200">
                    Required fields are marked with *
                </div>
               
            </>
        }/>
    );
};

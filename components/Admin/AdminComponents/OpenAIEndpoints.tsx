import { FC, useState } from "react";
import {  titleLabel, UserAction } from "../AdminUI";
import { AdminConfigTypes, Endpoint, OpenAIModelsConfig} from "@/types/admin";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import InputsMap from "@/components/ReusableComponents/InputMap";
import Checkbox from "@/components/ReusableComponents/CheckBox";

interface Props {
    openAiEndpoints: OpenAIModelsConfig;
    setOpenAiEndpoints: (e: OpenAIModelsConfig) => void;
    updateUnsavedConfigs: (t: AdminConfigTypes) => void;
}

export const OpenAIEndpointsTab: FC<Props> = ({openAiEndpoints, setOpenAiEndpoints, updateUnsavedConfigs}) => {

    const [isDeletingEndpoint, setIsDeletingEndpoint] = useState<string | null>(null);
    const [deleteEndpointsList, setDeleteEndpointsList] = useState<number[]>([]);
    const [hoveredEndpoint, setHoveredEndpoint] = useState<{ model: string; index: number } | null>(null);
    const [editingModelName, setEditingModelName] = useState<{[key: string]: string}>({});
    const [modelValidation, setModelValidation] = useState<{[key: string]: {isValid: boolean, message: string}}>({});

    const handleUpdateEndpoints = (updatedModels: OpenAIModelsConfig) => {
        setOpenAiEndpoints(updatedModels);
        updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPOINTS);
    }

    const validateModelName = (modelName: string, modelIndex: number, currentModelName: string, hasEndpoints: boolean) => {
        let isValid = true;
        let message = 'Add Endpoint';
        
        // Only validate if this model has no endpoints
        if (!hasEndpoints) {
            // Check if model name is still the default
            if (currentModelName === 'modelid') {
                isValid = false;
                message = 'Please change the model name from the default "modelid" before adding endpoints';
            } else {
                // Check if model name is unique (excluding current model)
                const allModelNames = openAiEndpoints.models.flatMap((model, idx) => 
                    Object.keys(model).filter((name) => !(idx === modelIndex && name === modelName))
                );
                
                if (allModelNames.includes(currentModelName)) {
                    isValid = false;
                    message = `Model name "${currentModelName}" already exists. Please choose a unique name`;
                }
            }
        }
        
        return {isValid, message};
    }

    return <div className="admin-style-settings-card">
        <div className="admin-style-settings-card-header">
            <div className="flex flex-row items-center gap-3 mb-2">
                <h3 className="admin-style-settings-card-title">OpenAI Endpoints</h3>
                <button
                    title='Add Model'
                    id={`addModelButton`}
                    className={`ml-2 py-2 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10`}
                    onClick={async () => {
                        const newModel = { modelid: { endpoints: [] } };
                        const updatedModels = [newModel, ...openAiEndpoints.models];
                        setOpenAiEndpoints({ models: updatedModels });
                        updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPOINTS);
                        
                        // Immediately validate the new model
                        const validation = validateModelName('modelid', 0, 'modelid', false);
                        setModelValidation(prev => ({
                            ...prev,
                            [`0-modelid`]: validation
                        }));
                    }}
                >
                    <IconPlus size={16}/>
                </button>
            </div>
            <p className="admin-style-settings-card-description">Configure OpenAI API endpoints and authentication keys</p>
        </div>

        {openAiEndpoints.models.length > 0 ?
        <div className="ml-2">
        {openAiEndpoints.models.map((modelData: any, modelIndex: number) => {
            return Object.keys(modelData).map((modelName: string) => {
                return (
                    <div key={modelName} id="openAiEndpoint" className={`ml-4 flex flex-col gap-2 ${modelIndex > 0 ? 'mt-6': 'mt-2'}`}>
                        <div className="flex flex-row gap-2">
                            {modelData[modelName].endpoints.length === 0 ? (
                                <input
                                    id={`editModelName-${modelName}-${modelIndex}`}
                                    className="p-2 text-[0.95rem] border border-neutral-300 dark:border-white/20 rounded dark:bg-[#40414F] dark:text-neutral-100 text-neutral-900 max-w-[160px]"
                                    value={editingModelName[`${modelIndex}-${modelName}`] ?? modelName}
                                    onChange={(e) => {
                                        const newValue = e.target.value;
                                        setEditingModelName(prev => ({
                                            ...prev,
                                            [`${modelIndex}-${modelName}`]: newValue
                                        }));
                                    }}
                                    onBlur={() => {
                                        const currentModelName = editingModelName[`${modelIndex}-${modelName}`] || modelName;
                                        const hasEndpoints = modelData[modelName].endpoints.length > 0;
                                        
                                        // Validate the model name
                                        const validation = validateModelName(modelName, modelIndex, currentModelName, hasEndpoints);
                                        
                                        // Update validation state
                                        setModelValidation(prev => ({
                                            ...prev,
                                            [`${modelIndex}-${modelName}`]: validation
                                        }));
                                        
                                        const newModelName = editingModelName[`${modelIndex}-${modelName}`];
                                        if (newModelName && newModelName !== modelName && newModelName.trim() !== '') {
                                            const updatedModels = [...openAiEndpoints.models];
                                            const model = updatedModels[modelIndex];
                                            const endpoints = model[modelName].endpoints;
                                            delete model[modelName];
                                            model[newModelName] = { endpoints };
                                            setOpenAiEndpoints({ models: updatedModels });
                                            updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPOINTS);
                                        }
                                        // Clear the editing state
                                        setEditingModelName(prev => {
                                            const newState = { ...prev };
                                            delete newState[`${modelIndex}-${modelName}`];
                                            return newState;
                                        });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    placeholder="Enter model name"
                                />
                            ) : (
                                <label id="endpointModelName" className="py-2 text-[0.95rem]">{modelName}</label>
                            )}
                            {(() => {
                                const validation = modelValidation[`${modelIndex}-${modelName}`] || {isValid: true, message: 'Add Endpoint'};
                                const isDisabled = modelData[modelName].endpoints.length === 0 && !validation.isValid;
                                
                                return (
                                    <button
                                        title={validation.message}
                                        id={`addEndpointButton-${modelName}`}
                                        disabled={isDisabled}
                                        className={`ml-2 mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${
                                            isDisabled 
                                                ? 'opacity-50 cursor-not-allowed' 
                                                : 'cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10'
                                        }`}
                                        onClick={async () => {
                                            // Get the current model name (might be from editing state)
                                            const currentModelName = editingModelName[`${modelIndex}-${modelName}`] || modelName;
                                            const hasEndpoints = modelData[modelName].endpoints.length > 0;
                                            
                                            // Final validation check as safety net
                                            const validation = validateModelName(modelName, modelIndex, currentModelName, hasEndpoints);
                                            if (!validation.isValid) {
                                                alert(validation.message);
                                                return;
                                            }
                                            
                                            // If editing name is different, apply the name change first
                                            if (currentModelName !== modelName) {
                                                const updatedModels = [...openAiEndpoints.models];
                                                const model = updatedModels[modelIndex];
                                                const endpoints = model[modelName].endpoints;
                                                delete model[modelName];
                                                model[currentModelName] = { endpoints };
                                                setOpenAiEndpoints({ models: updatedModels });
                                                setEditingModelName(prev => {
                                                    const newState = { ...prev };
                                                    delete newState[`${modelIndex}-${modelName}`];
                                                    return newState;
                                                });
                                            }
                                            
                                            const newEndpoint = { url: '', key: '', isNew: true};
                                            const updatedModels = [...openAiEndpoints.models];
                                            const model = updatedModels[modelIndex];
                                            model[currentModelName || modelName].endpoints.push(newEndpoint);
                                            setOpenAiEndpoints({ models: updatedModels });
                                            updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPOINTS);
                                        }}
                                    >
                                        <IconPlus size={16}/>
                                    </button>
                                );
                            })()}

                            { modelData[modelName].endpoints.length > 0 ?
                            <button
                                title="Delete Endpoints"
                                id={`deleteEndpointButton-${modelName}`}
                                disabled={isDeletingEndpoint === modelName}
                                className={`mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-neutral-100 transition-colors duration-200 ${isDeletingEndpoint !== modelName ? "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" : ""}`}
                                onClick={() => {
                                    setIsDeletingEndpoint(modelName);
                                    setDeleteEndpointsList([]);
                                }}
                            >
                                <IconTrash size={16} />
                            </button>
                            :
                            <button
                                title="Delete Model"
                                id={`deleteModelButton-${modelName}`}
                                className={`mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-neutral-100 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10`}
                                onClick={() => {
                                    const updatedModels = openAiEndpoints.models.filter((_, index) => index !== modelIndex);
                                    setOpenAiEndpoints({ models: updatedModels });
                                    updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPOINTS);
                                }}
                            >
                                <IconTrash size={16} />
                            </button>
                            }
                        
                            {isDeletingEndpoint === modelName && (
                                <>
                                <UserAction
                                    label={"Remove Endpoints"}
                                    onConfirm={() => {
                                        const updatedModels = [...openAiEndpoints.models];
                                        const model = updatedModels[modelIndex];
                                        model[modelName].endpoints = model[modelName].endpoints.filter(
                                            (_, idx) => !deleteEndpointsList.includes(idx)
                                        );
                                        handleUpdateEndpoints({ models: updatedModels });

                                    }}
                                    onCancel={() => {
                                        setIsDeletingEndpoint(null);
                                        setDeleteEndpointsList([]);
                                    }}
                                />
                                <div className="mt-1.5">
                                    <Checkbox
                                        id={`selectAll${modelName}${AdminConfigTypes.OPENAI_ENDPOINTS}`}
                                        label=""
                                        checked={deleteEndpointsList.length === modelData[modelName].endpoints.length}
                                        onChange={(isChecked: boolean) => {
                                            if (isChecked) {
                                                setDeleteEndpointsList(Array.from({ length: modelData[modelName].endpoints.length }, (_, i) => i));
                                            } else {
                                                setDeleteEndpointsList([]);
                                            }
                                        }}
                                    />
                                </div>
                                </>
                            )}
                            
                        </div> 

                        {modelData[modelName].endpoints.map((endpoint: Endpoint, index:number) => 
                            <div id={`urlKeyHover-${modelName}-${index}`} className="flex flex-row mr-10 mt-2" key={index}
                                onMouseEnter={() => setHoveredEndpoint({ model: modelName, index })}
                                onMouseLeave={() => setHoveredEndpoint(null)}
                            >
                                <div className="min-w-[30px] flex items-center"> 
                                    {isDeletingEndpoint === modelName ? (
                                            <Checkbox
                                                id={`${modelName}${index}${AdminConfigTypes.OPENAI_ENDPOINTS}`}
                                                label=""
                                                checked={deleteEndpointsList.includes(index)}
                                                onChange={(isChecked: boolean) => {
                                                    if (isChecked) {
                                                        setDeleteEndpointsList((prev) => [...prev, index]);
                                                    } else {
                                                    setDeleteEndpointsList((prev) => prev.filter((i) => i !== index));
                                                    }
                                                }}
                                            />
                                    ) : 
                                    <>
                                    {hoveredEndpoint &&
                                    hoveredEndpoint.model === modelName &&
                                    hoveredEndpoint.index === index && (
                                        <button
                                            type="button"
                                            id="deleteCreatedEndpoint"
                                            className="p-0.5 ml-[-4px] text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                            onClick={() => {
                                                const updatedModels = [...openAiEndpoints.models];
                                                const model = updatedModels[modelIndex];
                                                model[modelName].endpoints.splice(index, 1);
                                                handleUpdateEndpoints({ models: updatedModels });
                                            }}
                                        >
                                            <IconTrash size={20} />
                                        </button>
                                    )}
                                    </>}
                                </div>

                                <div className="w-full">
                                    <InputsMap
                                        id = {`${AdminConfigTypes.OPENAI_ENDPOINTS}-${modelName}-${index}`}
                                        inputs={[ {label: 'Url', key: 'url', placeholder: 'OpenAI Endpoint'},
                                                {label: 'Key', key: 'key', placeholder: 'Api key'},
                                                ]}
                                        state ={{url : endpoint.url, 
                                                key : endpoint.key}}
                                        inputChanged = {(key:string, value:string) => {
                                            const updatedModels = [...openAiEndpoints.models];
                                            const model = updatedModels[modelIndex];
                                            if (key === 'url') {
                                                model[modelName].endpoints[index].url = value;
                                            } else if (key === 'key') {
                                                model[modelName].endpoints[index].key = value;
                                            }
                                            handleUpdateEndpoints({ models: updatedModels });
                                        }}
                                        obscure={true}
                                    />
                                </div>
                                
                            </div>

                        )}
        
                    </div>)
                    
                })
            })}
        </div>
        : <>No OpenAi Endpoints Retrieved</>}
    </div>
}
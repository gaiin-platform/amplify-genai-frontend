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

    const handleUpdateEndpoints = (updatedModels: OpenAIModelsConfig) => {
        setOpenAiEndpoints(updatedModels);
        updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPONTS);
    }

    return  <>
    {titleLabel('OpenAi Endpoints')}
    {openAiEndpoints.models.length > 0 ?
    <div className="ml-2">
    {openAiEndpoints.models.map((modelData: any, modelIndex: number) => {
        return Object.keys(modelData).map((modelName: string) => {
            return (
                <div key={modelName} id="openAiEndpoint" className={`ml-4 flex flex-col gap-2 ${modelIndex > 0 ? 'mt-6': 'mt-2'}`}>
                    <div className="flex flex-row gap-2">
                        <label id="endpointModelName" className="py-2 text-[0.95rem]">{modelName}</label>
                        <button
                            title='Add Endpoint'
                            id={`addEndpointButton-${modelName}`}
                            className={`ml-2 mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10`}
                            onClick={async () => {
                                const newEndpoint = { url: '', key: '', isNew: true};
                                const updatedModels = [...openAiEndpoints.models];
                                const model = updatedModels[modelIndex];
                                model[modelName].endpoints.push(newEndpoint);
                                setOpenAiEndpoints({ models: updatedModels });
                                updateUnsavedConfigs(AdminConfigTypes.OPENAI_ENDPONTS);
                            }
                            }
                        >
                            <IconPlus size={16}/>
                        </button>

                        { modelData[modelName].endpoints.length > 0 &&
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
                        </button>}
                    
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
                                    id={`selectAll${modelName}${AdminConfigTypes.OPENAI_ENDPONTS}`}
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
                                            id={`${modelName}${index}${AdminConfigTypes.OPENAI_ENDPONTS}`}
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
                                    id = {`${AdminConfigTypes.OPENAI_ENDPONTS}-${modelName}-${index}`}
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
    </>

}
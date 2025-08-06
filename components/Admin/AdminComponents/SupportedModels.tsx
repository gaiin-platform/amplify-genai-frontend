import { FC, useEffect, useRef, useState } from "react";
import {  Amplify_Groups, AmplifyGroupSelect, camelToTitleCase, titleLabel, UserAction } from "../AdminUI";
import { AdminConfigTypes, DefaultModelsConfig, FeatureFlagConfig, ModelProviders, SupportedModel, SupportedModelsConfig} from "@/types/admin";
import { InfoBox } from "@/components/ReusableComponents/InfoBox";
import { IconCheck, IconPlus, IconX, IconEdit, IconTrash, IconEye, IconEyeOff } from "@tabler/icons-react";
import Search from "@/components/Search";
import InputsMap from "@/components/ReusableComponents/InputMap";
import ActionButton from "@/components/ReusableComponents/ActionButton";
import toast from "react-hot-toast";
import { capitalize } from "@/utils/app/data";


interface Props {
    availableModels: SupportedModelsConfig;
    setAvailableModels: (m: SupportedModelsConfig) => void;

    defaultModels: DefaultModelsConfig;
    setDefaultModels: (m: DefaultModelsConfig) => void;

    ampGroups: Amplify_Groups;

    isAvailableCheck: (isAvailable: boolean, handleClick: () => void, styling?: string) => JSX.Element

    updateUnsavedConfigs: (t: AdminConfigTypes) => void;
    
    featureFlags: FeatureFlagConfig;
}

export const SupportedModelsTab: FC<Props> = ({availableModels, setAvailableModels, ampGroups, 
                                              isAvailableCheck, updateUnsavedConfigs, featureFlags, 
                                              defaultModels, setDefaultModels}) => {


    const supportedModelsRef = useRef<HTMLDivElement>(null);  // to help control the scroll bar 
    const [isAddingAvailModel, setIsAddingAvailModel] = useState< { model: SupportedModel, 
                                                                    action: 'Adding' | 'Editing'} | null>(null);  
    const [hoveredAvailModel, setHoveredAvailModel] = useState<string>(''); 
    const [hoveredModelIcons, setHoveredModelIcons] = useState<string>(''); 
    const [modelsSearchTerm, setModelsSearchTerm] = useState<string>(''); 
    const [showModelsSearch, setShowModelsSearch] = useState<boolean>(true); 
    const [hideUncheckedModels, setHideUncheckedModels] = useState<boolean>(false);


    const handleUpdateSupportedModels = (updatedModels: SupportedModelsConfig) => {
        setAvailableModels(updatedModels);
        updateUnsavedConfigs(AdminConfigTypes.AVAILABLE_MODELS);
    }

    const handleUpdateDefaultModels = (key: keyof DefaultModelsConfig, modelId: string) => {
        const updatedModels = {...defaultModels, [key]: modelId};
        setDefaultModels(updatedModels);
        updateUnsavedConfigs(AdminConfigTypes.DEFAULT_MODELS);
    }

    const scrollToWithOffset = () => {
        const element = supportedModelsRef.current;
        if (!element) return;
        
        // Check if element is already in viewport
        const rect = element.getBoundingClientRect();
        const isInViewport = (
            rect.top >= 0 &&
            rect.top <= window.innerHeight - 300
        );
        
        if (!isInViewport) {
            element.style.position = 'relative';
            element.style.top = '-55px';
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            setTimeout(() => {
            element.style.position = '';
            element.style.top = '';
            }, 50);
        }
        };
      
    
        useEffect(() => {
            if (isAddingAvailModel && supportedModelsRef.current) {
                scrollToWithOffset();
            }
          }, [isAddingAvailModel]); // Run when isAddingAvailModel changes
        
    



    const handleAddOrUpdateAvailableModels = () => {
        if (isAddingAvailModel) {
            const newModel = {...isAddingAvailModel.model};
            if (isAddingAvailModel.action === 'Adding') {
                // check required fields
                if (!newModel.id || !newModel.name || !newModel.provider ||
                        // for availabel models we require inputcontent windonw and token limit otehrwise we dont
                    !(newModel.isAvailable ? newModel.inputContextWindow && newModel.outputTokenLimit : true)
                ) {
                alert("Required fields missing: Please provide ID, name, and provider. If the model is available, include input context window and output token limit. Ensure all required data is set and try again.");
                    return;
                }
            }
            handleUpdateSupportedModels({...availableModels, [newModel.id]: newModel});
        }
    }
    
       
    const modelActiveCheck = (key: string, isActive: boolean, title: string) => 
        isAddingAvailModel ? 
        <button title={title} id={key}
                className="cursor-pointer flex flex-row gap-7 dark:text-neutral-200 text-neutral-900"
                onClick={() => {
                    let updated = {...isAddingAvailModel.model, [key]: !isActive};
                    setIsAddingAvailModel({...isAddingAvailModel, model: updated});
                }}>
            {isActive ? <IconCheck className= 'w-[84px] text-green-600 hover:opacity-60' size={18} /> 
                        : <IconX  className='w-[84px] text-red-600 hover:opacity-60' size={18} />}
            {camelToTitleCase(key)}          
        </button>  : null;
    
        
    const modelNumberInputs = (key: string, value: number | null, step: number, parseInteger: boolean, description: string) => 
        isAddingAvailModel ? <div id={key} title={description} className="flex flex-row gap-3 dark:text-neutral-200 text-neutral-900">
        <input type="number" id={`${key}Input`} title={description}
                className="text-center w-[100px] dark:bg-[#40414F] bg-gray-200"
                min={0} step={step} value={value ?? 0 }
                onChange={(e) => {
                    const value = e.target.value;
                    const val = parseInteger ? parseInt(value) : parseFloat(value);
                    let updated = {...isAddingAvailModel.model, [key]: val};
                    setIsAddingAvailModel({...isAddingAvailModel, model: updated});
                }}
        /> 
        {camelToTitleCase(key.replace('Cost', 'Cost$'))} </div>: null;
    
    

    return  <>
            <div ref={supportedModelsRef} className="flex flex-row gap-3 mb-2" >
            {titleLabel('Supported Models')}
            <button
                title={isAddingAvailModel ? '' : 'Add Model'}
                id="addModel"
                disabled={isAddingAvailModel !== null}
                className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingAvailModel ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                onClick={() => {
                    setIsAddingAvailModel({ model: emptySupportedModel(), action: 'Adding'});
                }
                }
            >
                <IconPlus size={16}/>
            </button>

            {isAddingAvailModel && 
                <UserAction
                top={"mt-4"}
                label={"Add Model"}
                onConfirm={() => {
                    setModelsSearchTerm('');
                    handleAddOrUpdateAvailableModels();
                }}
                onCancel={() => {
                    setIsAddingAvailModel(null);
                }}
            />
            
            }
            { showModelsSearch && Object.keys(availableModels).length > 0 && !isAddingAvailModel &&
            <div className="ml-auto mr-16 flex items-center gap-3">
                <button
                    title={hideUncheckedModels ? 'Show all models' : 'Hide unavailable models'}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-neutral-300 dark:border-white/20 hover:bg-neutral-200 dark:hover:bg-gray-500/10 transition-colors duration-200"
                    onClick={() => setHideUncheckedModels(!hideUncheckedModels)}
                >
                    {hideUncheckedModels ? (
                        <>
                            <IconEye size={16} className="text-neutral-600 dark:text-neutral-400" />
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">Show All Models</span>
                        </>
                    ) : (
                        <>
                            <IconEyeOff size={16} className="text-neutral-600 dark:text-neutral-400" />
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">Hide Unavailable Models</span>
                        </>
                    )}
                </button>
                <Search
                placeholder={'Search Models...'}
                searchTerm={modelsSearchTerm}
                onSearch={(searchTerm: string) => setModelsSearchTerm(searchTerm.toLocaleLowerCase())}
                />
            </div>}
            </div>
            <div className="mx-4"> 
                {isAddingAvailModel && 
                    <div className="flex flex-col mx-8 mb-6">
                    <label className="text-[1.05rem] w-full text-center"> {isAddingAvailModel.action} Model</label>

                    <div className="flex flex-row gap-6 mb-4 w-full"> 
                        <div className="flex-grow">
                            <InputsMap
                            id = {AdminConfigTypes.AVAILABLE_MODELS}
                            inputs={ [ {label: 'Model ID', key: 'id', placeholder: 'Model ID', disabled: isAddingAvailModel.model.isBuiltIn},
                                        {label: 'Name', key: 'name', placeholder: 'Model Name'},
                                        {label: "Description", key: 'description', placeholder: 'Description Displayed to the User'},
                                        {label: 'System Prompt', key: 'systemPrompt', placeholder: 'Additional System Prompt', 
                                         description: "This will be appended to the system prompt as an additional set of instructions." 
                                        },
                                    ]}
                            state = {{id : isAddingAvailModel.model.id, 
                                    description : isAddingAvailModel.model.description, 
                                    name: isAddingAvailModel.model.name, 
                                    systemPrompt: isAddingAvailModel.model.systemPrompt
                                }}
                            inputChanged = {(key:string, value:string) => {
                                let updated = {...isAddingAvailModel.model, [key]: value};
                                setIsAddingAvailModel({...isAddingAvailModel, model: updated});
                            }}
                            /> 
                            <div className="flex flex-row"> 
                                <div className="w-[122px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                                    title={"Provider"}
                                    >
                                    {"Provider"}
                                </div>

                                <div className="max-w-[730px]">
                                { ModelProviders.map((p:string) => 
                                    <button key={p}
                                    id={`provider${p}`}
                                    className={`w-[182.5px] h-[39px] rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-300 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 
                                    ${p === isAddingAvailModel.model.provider ? "cursor-default" : "opacity-60 hover:opacity-80"}`}
                                    disabled={p === isAddingAvailModel.model.provider}
                                    onClick={() => {
                                        let updated = {...isAddingAvailModel.model, provider: p};
                                        setIsAddingAvailModel({...isAddingAvailModel, model: updated})
                                    }}>
                                    {p}
                                    </button>
                                    
                                )}
                                </div>
                            </div>


                        </div>

                        <div className="mx-6 flex flex-col gap-1 mt-3"> 
                            {modelNumberInputs('inputContextWindow', isAddingAvailModel.model.inputContextWindow, 1000, true,
                                    "Models Conversation Input Token Context Window" )}

                            {modelNumberInputs('inputTokenCost', isAddingAvailModel.model.inputTokenCost, .0001, false,
                                    "Models Input Token Cost/1k" )}

                            {modelNumberInputs('outputTokenLimit', isAddingAvailModel.model.outputTokenLimit, 1000, true, 
                                "Output Token Limit Set By Models Provider" )}

                            {modelNumberInputs('outputTokenCost', isAddingAvailModel.model.outputTokenCost, .0001, false,
                                    "Models Output Token Cost/1k" )}

                            {modelNumberInputs('cachedTokenCost', isAddingAvailModel.model.cachedTokenCost, .0001, false,
                                    "Models Cached Token Cost/1k" )}

                            {modelActiveCheck('supportsSystemPrompts', isAddingAvailModel.model.supportsSystemPrompts, "Model Supports System Prompts" )}
                            
                            {!isAddingAvailModel.model.id.includes('embed') && <>
                            {modelActiveCheck('supportsReasoning', isAddingAvailModel.model.supportsReasoning,
                                                "Model Supports Various Levels of Reasoning" ) } 
                            {modelActiveCheck('supportsImages', isAddingAvailModel.model.supportsImages,
                                                "Model Supports Base-64 Encoded Images Attached to Prompts" )}
                            {modelActiveCheck('isAvailable', isAddingAvailModel.model.isAvailable, 
                                                "Is Available to All Amplify Users as a Model Selection Options" )}
                            </>}
                        </div> 

                    </div>  

                        <InfoBox content={
                            <span className="text-xs w-full text-center"> 
                            If the Model is not available for all users, it will be exclusively available for the following Amplify Groups
                            </span>
                        }/>
                        
                        <AmplifyGroupSelect 
                            groups={Object.keys(ampGroups)}
                            selected={isAddingAvailModel.model.exclusiveGroupAvailability ?? []}
                            setSelected={(selectedGroups: string[]) => {
                                const updated = {...isAddingAvailModel.model, 
                                                    exclusiveGroupAvailability: selectedGroups};
                                setIsAddingAvailModel({...isAddingAvailModel, model: updated})
                            }}
                        />
                    </div>    
                }

                {Object.keys(availableModels).length > 0 ?
                <div className="mr-4 mb-4">
                    <div className="w-full text-[1rem] text-center text-neutral-900 dark:text-neutral-300 font-bold">
                    Default Models 
                    <span className="ml-2 mt-[-2px] text-sm text-[#0bb9f4]">(* Required) </span>
                    </div>
                    <div className="mt-4 flex flex-row justify-between mr-8"> 
                        <ModelDefaultSelect 
                            models={Object.values(availableModels).filter((m:SupportedModel) => 
                                    m.isAvailable && !m.id.includes('embedding'))}
                            defaultModels={defaultModels}
                            selectedKey="user"
                            description="This will be the default selected model for user conversations"
                            onSelect={(selected: SupportedModel, key: keyof DefaultModelsConfig) =>  handleUpdateDefaultModels(key, selected.id)}
                        /> 
                        
                        <ModelDefaultSelect 
                            models={Object.values(availableModels).filter((m:SupportedModel) => 
                                    m.isAvailable && !m.id.includes('embedding'))}
                            defaultModels={defaultModels}
                            label="Simple Task Model"
                            selectedKey='cheapest'
                            description="The simple task model is used for requests requiring less complex reasoning and is automatically utilized by Amplify when required."
                            onSelect={(selected: SupportedModel, key: keyof DefaultModelsConfig) =>  handleUpdateDefaultModels(key, selected.id)}
                        />

                        <ModelDefaultSelect 
                            models={Object.values(availableModels).filter((m:SupportedModel) => 
                                    m.isAvailable && !m.id.includes('embedding'))}
                            defaultModels={defaultModels}
                            label="Advanced Task Model"
                            selectedKey="advanced"
                            description="The advanced task model is used for requests needing more complex reasoning and is automatically utilized by Amplify when required."
                            onSelect={(selected: SupportedModel, key: keyof DefaultModelsConfig) =>  handleUpdateDefaultModels(key, selected.id)}
                        />

                        {Object.keys(featureFlags).includes('cachedDocuments') &&
                        <ModelDefaultSelect 
                            models={Object.values(availableModels).filter((m:SupportedModel) => 
                                    !m.id.includes('embedding') && m.cachedTokenCost > 0)}
                            defaultModels={defaultModels}
                            selectedKey='documentCaching'
                            description="This model is used when handling document context processing in chats when Retrieval Augmented Generation (RAG) is turned off. For optimal cost efficiency, choose a model with cached token support."
                            onSelect={(selected: SupportedModel, key: keyof DefaultModelsConfig) =>  handleUpdateDefaultModels(key, selected.id)}
                        />}

                        {Object.keys(featureFlags).includes('agentAssistantType') &&
                        <ModelDefaultSelect 
                            models={Object.values(availableModels).filter((m:SupportedModel) => 
                                    !m.id.includes('embedding'))}
                            defaultModels={defaultModels}
                            selectedKey='agent'
                            description="The agent model is used by 'Agent' type assistants."
                            onSelect={(selected: SupportedModel, key: keyof DefaultModelsConfig) =>  handleUpdateDefaultModels(key, selected.id)}
                        />}

                        <ModelDefaultSelect 
                            models={Object.values(availableModels).filter((m:SupportedModel) => 
                                    m.id.includes('embed'))}
                            defaultModels={defaultModels}
                            selectedKey='embeddings'
                            description="The embedding model will be used when requesting embeddings"
                            onSelect={(selected: SupportedModel, key: keyof DefaultModelsConfig) =>  handleUpdateDefaultModels(key, selected.id)}
                        />
                        
                        
                    </div>

                    <table id="supportedModelsTable" className="mt-4 border-collapse w-full" >
                        <thead>
                        <tr className="gradient-header text-sm">
                            {['Name', 'ID',  'Provider', 'Available', 'Supports Images', 'Supports Reasoning',
                                'Supports System Prompts', 'Additional System Prompt',
                                'Description', 'Input Context Window', 'Output Token Limit', 
                                'Input Token Cost / 1k', 'Output Token Cost / 1k', 'Cached Token Cost / 1k',
                                'Available to User via Amplify Group Membership',
                            ].map((title, i) => (
                            <th id={title} key={i}
                                className="text-[0.75rem] px-1 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300" >
                                {title}
                            </th>
                            ))}
                                
                        </tr>
                        </thead>
                        <tbody>
                        {Object.values(availableModels)
                                .filter((availModel: SupportedModel) => 
                                (isAddingAvailModel?.model.id !== availModel.id) && 
                                (modelsSearchTerm ? availModel.name.toLowerCase()
                                                    .includes(modelsSearchTerm) : true))
                                .filter((availModel: SupportedModel) => 
                                    hideUncheckedModels ? availModel.isAvailable : true)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((availModel: SupportedModel) => 
                            <tr key={availModel.id}  className={`text-xs ${hoveredModelIcons === availModel.id ? 'hover:bg-gray-200 dark:hover:bg-[#40414f]' : ''}`}
                                onMouseEnter={() => setHoveredAvailModel(availModel.id)}
                                onMouseLeave={() => setHoveredAvailModel('')}>
                                <td id="supportedModelTitle" className="border border-neutral-500 p-2">
                                    {availModel.name}
                                </td>

                                <td className="border border-neutral-500 p-2 break-words max-w-[160px]">
                                    {availModel.id}
                                </td>

                                <td className="border border-neutral-500 break-words ">
                                    <div className="flex justify-center p-2 dark:bg-[#40414F]">
                                        <select 
                                            value={availModel.provider ?? 'Unknown Provider'}
                                            onChange={(e) => {
                                                const updatedModel = {...availableModels[availModel.id], provider: e.target.value};
                                                const updatedModels = {...availableModels, [availModel.id]: updatedModel};
                                                handleUpdateSupportedModels(updatedModels);
                                            }}
                                            className="bg-transparent text-center border-none focus:outline-none cursor-pointer text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded px-1"
                                            title="Click to change provider"
                                        >
                                            {ModelProviders.map((provider: string) => (
                                                <option key={provider} value={provider} className="bg-white dark:bg-[#40414F] text-neutral-900 dark:text-neutral-100">
                                                    {provider}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </td>

                                <td className="border border-neutral-500 p-2 w-[60px]"
                                    title="Available to All Users">
                                    {availModel.id.includes('embed') ? 
                                    <div className="text-center">N/A</div> :
                                    <div className="flex justify-center">
                                        {isAvailableCheck(availModel.isAvailable, () => {
                                            const updatedModel = {...availableModels[availModel.id], isAvailable: !availModel.isAvailable};
                                            const updatedModels = {...availableModels, [availModel.id]: updatedModel};
                                            handleUpdateSupportedModels(updatedModels);
                                            const firstAvailableForDefault = Object.values(updatedModels)
                                                                                   .filter((m:SupportedModel) => m.isAvailable && !m.id.includes('embedding'));
                                            if (firstAvailableForDefault.length === 1) toast("Double check the default model selections before saving");
                                        })}   
                                    </div>}
                                </td>

                                <td className="border border-neutral-500 px-4 py-2 w-[60px]"
                                    title="Model Support for Base64-Encoded Images">
                                    {availModel.id.includes('embed') ? 
                                    <div className="text-center">N/A</div> :
                                        <div className="flex justify-center">
                                        {availModel.supportsImages ? <IconCheck className= 'text-green-600 opacity-60' size={18} /> 
                                                                : <IconX  className='text-red-600 opacity-60' size={18} />}
                                    </div> }                          
                                </td>

                                {["supportsReasoning", "supportsSystemPrompts"].map((s:string) => 
                                    <td className="border border-neutral-500 px-4 py-2 w-[74px]" key={s}
                                        title={`Model ${camelToTitleCase(s)}`}>
                                        <div className="flex justify-center">
                                            {availModel[s as keyof SupportedModel] ? <IconCheck className= 'text-green-600 opacity-60' size={18} /> : 
                                            <IconX  className='text-red-600 opacity-60' size={18} />}
                                        </div>                           
                                    </td>
                                )}

                                {["systemPrompt", "description"].map((s:string) => 
                                    <td className="border border-neutral-500 text-center" key={s}>
                                        {availModel[s as keyof SupportedModel] ?
                                        <div className=" flex justify-center break-words overflow-y-auto w-[200px]" >  
                                            <textarea
                                            className="w-full rounded-r border border-neutral-500 px-1 bg-transparent dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                            value={availModel[s as keyof SupportedModel] as string}
                                            disabled={true}
                                            rows={2} 
                                            /> 
                                        </div>: 'N/A'}
                                    </td>
                                )}

                                {["inputContextWindow", "outputTokenLimit"].map((s: string) => 
                                    <td className="border border-neutral-500 p-2 w-[68px]" key={s}>
                                        <div className="flex justify-center"> 
                                            {availModel[s as keyof SupportedModel]} </div>
                                    </td>
                                )}

                                {["inputTokenCost", "outputTokenCost", "cachedTokenCost"].map((s: string) => 
                                    <td className="border border-neutral-500 p-2 w-[85px]"  key={s}>
                                        <div className="flex justify-center">  
                                            ${availModel[s as keyof SupportedModel]} </div>
                                    </td>
                                )}

                                <td className="border border-neutral-500 text-center">
                                    {availModel.id.includes('embed') ? 
                                    <div className="text-center">N/A</div> :
                                    <AmplifyGroupSelect 
                                        label={"Amp Gorup"}
                                        groups={Object.keys(ampGroups)}
                                        selected={availModel.exclusiveGroupAvailability ?? []}
                                        setSelected={(selectedGroups: string[]) => {
                                            const updatedModel = {...availableModels[availModel.id], exclusiveGroupAvailability: selectedGroups};
                                            const updatedModels = {...availableModels, [availModel.id]: updatedModel};
                                            handleUpdateSupportedModels(updatedModels);
                                        }}
                                    />}
                                </td>
                                <td className="bg-gray-100 dark:bg-[#2b2c36]">
                                        <div className="w-[30px]">
                                        {hoveredAvailModel === availModel.id && (!isAddingAvailModel 
                                        || (isAddingAvailModel.action === 'Adding' && JSON.stringify(isAddingAvailModel.model) === JSON.stringify(emptySupportedModel()))) ?
                                        <div className="flex flex-row gap-1" onMouseEnter={() => setHoveredModelIcons(availModel.id)} 
                                                                             onMouseLeave={() => setHoveredModelIcons('')}> 
                                        <ActionButton
                                            handleClick={() => {setIsAddingAvailModel( {model: availModel, action: "Editing" })}}
                                            title="Edit Model Data">
                                            <IconEdit size={22} />
                                        </ActionButton> 

                                        <ActionButton
                                            handleClick={() => {
                                                const  { [availModel.id]: _, ...remainingModels } = availableModels;
                                                handleUpdateSupportedModels(remainingModels);
                                            }}
                                            title="Delete Model">
                                            <IconTrash size={22} />
                                        </ActionButton> 
                                        </div>
                                        : null}
                                    </div>

                                </td>
                            </tr>     
                        )}
                        </tbody>
                    </table>
    
                        </div>
                    :
                    <>No Supported Models listed. Please add a new model.</>
                }
            
            </div> 
        </>

}




interface SelectProps {
    models: SupportedModel[];
    defaultModels: DefaultModelsConfig;
    selectedKey:  keyof DefaultModelsConfig;
    description: string;
    onSelect: (selected: SupportedModel, key: keyof DefaultModelsConfig) => void;
    label?: string;
}
// keyof SupportedModel,
const ModelDefaultSelect: FC<SelectProps> = ({models, defaultModels, selectedKey, description, onSelect, label}) => {
    const [selected, setSelected] = useState<SupportedModel | undefined>(models.find((model:SupportedModel) => model.id === defaultModels[selectedKey]));

    return (
        <div className="flex flex-col gap-2 text-center text-[14px] " title={description}>
            <label id={`${capitalize(selectedKey)}Model`} className="font-bold text-[#0bb9f4]">{label ?? `${camelToTitleCase(selectedKey)} Model`}</label>
            <select id="modelSelect" className={`mb-2 text-center rounded-lg border py-2 text-neutral-900 shadow focus:outline-none dark:bg-[#40414F] dark:text-neutral-100  custom-shadow
                                ${!!selected ? 'border-neutral-500 dark:border-neutral-800 dark:border-opacity-50' : 'border-red-500' }`} 
                value={selected?.name ?? ''}
                onChange={(e) => {
                    const newSelected = models.find((model) => model.name === e.target.value);
                    if (newSelected) {
                        setSelected(newSelected);
                        onSelect(newSelected, selectedKey);
                    }
                }}
            > 
                {/* Placeholder option when no model is selected */}
                <option value="" disabled hidden>
                    Select Model
                </option>
                {models.sort((a, b) => a.name.localeCompare(b.name))
                       .map((model:SupportedModel) => (
                    <option key={model.id} value={model.name}>
                        {model.name}
                    </option>
                ))}
                
            </select>
        </div>
    );
}






// empty data 
export const emptySupportedModel = () => {
    return {
    id: '',
    name: '',
    provider: '',
    inputContextWindow: 0, // maximum length of a message
    outputTokenLimit: 0, // max num of tokens a model will respond with (most models have preset max of 4096)
    outputTokenCost: 0.0,
    inputTokenCost: 0.0,
    cachedTokenCost: 0.0,
    description: '',
    exclusiveGroupAvailability: [],
    supportsImages: false,
    supportsReasoning: false,
    supportsSystemPrompts: false, 
    systemPrompt: '',

    isAvailable: false,
    isBuiltIn: false
    } as SupportedModel;
};



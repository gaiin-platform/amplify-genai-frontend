import React, { useState, useEffect, useContext } from 'react';
import { getAgentTools } from '@/services/agentService';
import ApiIntegrationsPanel from '../AssistantApi/ApiIntegrationsPanel';
import HomeContext from '@/pages/api/home/home.context';
import { IconAsterisk, IconCheck, IconChevronDown, IconChevronRight, IconCirclePlus, IconCode, IconInfoCircle, IconLoader2, IconSettings, IconTags, IconTool, IconTools, IconX } from '@tabler/icons-react';
import { getOperationIcon } from '@/utils/app/integrations';
import { AgentTool } from '@/types/agentTools';
import { ActiveTabs } from '../ReusableComponents/ActiveTabs';
import { getOpsForUser } from '@/services/opsService';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import ActionSetList from './ActionSets';
import { ScheduledTaskButton } from './ScheduledTasks';
import { OpBindingMode, OpBindings, OpDef } from '@/types/op';
import ApiParameterBindingEditor from '../AssistantApi/ApiParameterBindingEditor';


interface OperationSelectorProps {
    operations?: AgentTool[];
    initialHeader?: React.ReactNode; // Optional header content
    onActionAdded?: (operation: AgentTool, parameters: OpBindings, customName?: string, customDescription?: string) => void;
    onActionSetAdded?: (actionSet: any) => void; // Callback when "Add Action Set" is clicked
    onCancel?: () => void; // Callback when cancel button is clicked
    initialAction?: { // Optional initial action for editing
        name: string;
        customName?: string;
        customDescription?: string;
        parameters?: OpBindings;
    };
    editMode?: boolean; // Whether the component is in edit mode
}

// Utility function to add spaces before uppercase characters
const formatOperationName = (name: string): string => {
    // First split by underscores and capitalize first letter of each part
    const underscoreSplit = name.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Then add spaces before uppercase characters (for camelCase/PascalCase)
    return underscoreSplit.replace(/([A-Z])/g, ' $1').trim()
        // Remove any extra spaces that might have been created
        .replace(/\s+/g, ' ');
};

const OperationSelector: React.FC<OperationSelectorProps> = ({
    operations,
    initialHeader = null,
    onActionAdded,
    onActionSetAdded,
    onCancel,
    initialAction,
    editMode: initialEditMode = false,
}) => {
    const { state: {featureFlags} } = useContext(HomeContext);
    // const [isLoadingTab, setIsLoadingTab] = useState<string[]>([...(operations ? [""] : ["Actions"]), "Action Sets"]);
    const [allOperations, setAllOperations] = useState<any[] | null>(operations ?? null);
    const [selectedOp, setSelectedOp] = useState<AgentTool | null>(null);
    const [paramModes, setParamModes] = useState<Record<string, OpBindingMode>>({});
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [customName, setCustomName] = useState<string>(initialAction?.customName || '');
    const [customDescription, setCustomDescription] = useState<string>(initialAction?.customDescription || '');
    // Internal edit mode state - can change when user selects different operations
    const [editMode, setEditMode] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<string>('Actions');
    // State for agent tools
    const [agentTools, setAgentTools] = useState<AgentTool[] | null>(null);
    // State for selected action set
    const [selectedActionSet, setSelectedActionSet] = useState<any>(null);

    const handleParamModeChange = (param: string, mode: OpBindingMode) => {
        setParamModes({ ...paramModes, [param]: mode });
    };

    const handleParamValueChange = (param: string, value: string) => {
        setParamValues({ ...paramValues, [param]: value });
    };

    // const handleLoadedTab = (tab: string) => {
    //     setIsLoadingTab(isLoadingTab.filter(t => t !== tab));
    // }

    // const isTabLoading = (tab: string) => {
    //     return isLoadingTab.find(t => t === tab);
    // }

    const emptyPage = (message: string) => {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center p-6">
                    <div className="flex justify-center mb-3">
                        <IconChevronRight size={24} stroke={1.5} className="text-gray-400 dark:text-gray-600" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                       {message}
                    </p>
                </div>
            </div>
        )
    }

    useEffect(() => {
        const fetchOps = async () => {
            if (!featureFlags?.integrations) return;

            const opsResponse = await getOpsForUser();
            if (opsResponse.success && Array.isArray(opsResponse.data)) {
                const filtered = await filterSupportedIntegrationOps(opsResponse.data);
                if (filtered) {
                    setAllOperations(filtered);
                }
            }
            // handleLoadedTab("Actions");
        };

        fetchOps();
    }, [featureFlags]);

    
    // Fetch agent tools and combine with operations
    useEffect(() => {
        const fetchAgentTools = async () => {
            try {
                const result = await getAgentTools();
                
                if (result && result.data) {
                    // The tools are properties of the data object, not an array
                    const toolEntries = Object.entries(result.data);
                    
                    // Convert to AgentTool format
                    const tools: AgentTool[] = toolEntries.map(([key, tool]: [string, any]) => {
                        // Start with existing tags or empty array, then add 'Agent Tool' and 'native'
                        const tags = [...(tool.tags || []), 'Agent Tool', 'native'];
                        
                        return {
                            id: tool.tool_name,
                            name: tool.tool_name || key,
                            tool_name: tool.tool_name || key,
                            description: tool.description || '',
                            schema: tool.parameters || {},
                            parameters: tool.parameters || {},
                            tags: tags,
                            type: "builtIn"
                        };
                    });
                    
                    setAgentTools(tools);
                }
            } catch (error) {
                console.error('Error fetching agent tools:', error);
            }
        };
        
        fetchAgentTools();
    }, [operations]);

    // Initialize with the initial action if provided
    useEffect(() => {
        if (initialAction && allOperations && allOperations.length > 0) {
            const matchingOp = allOperations.find(op => op.name === initialAction.name);
            if (matchingOp) {
                setSelectedOp(matchingOp);
                
                // Set edit mode based on initialEditMode
                setEditMode(initialEditMode);
                
                // Initialize parameter values and modes if provided
                if (initialAction.parameters) {
                    const modes: Record<string, OpBindingMode> = {};
                    const values: Record<string, string> = {};
                    
                    Object.entries(initialAction.parameters).forEach(([key, param]) => {
                        modes[key] = param.mode;
                        values[key] = param.value;
                    });
                    
                    setParamModes(modes);
                    setParamValues(values);
                }
            }
        }
    }, [initialAction, allOperations, initialEditMode]);


    const paramSource = selectedOp ? (selectedOp.schema || selectedOp.parameters) : undefined;

    // When used in JSX
    const getIcon = (name: string | undefined) => {
        const IconComponent = getOperationIcon(name);
        return <IconComponent size={18} stroke={1.5} />
    }

    const loading =  (label: string) => <span className="flex flex-row gap-2 ml-10 text-sm text-gray-500 w-full justify-center w-full">
    <IconLoader2 className="animate-spin w-5 h-5 inline-block" />
    Loading {label}...
    </span>

    const clearAttributes = () => {
        setCustomName('');
        setCustomDescription('');
        setParamModes({});
        setParamValues({});
    }


    return (
        <div className="flex h-[400px] w-full border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg bg-white dark:bg-[#22232b] overflow-hidden">
            {/* Left Pane - Operations List */}
            <div className="w-1/2 border-r border-gray-300 dark:border-gray-700 overflow-auto bg-gray-50 dark:bg-[#2b2c35]">
                <div className="relative bg-gray-100 dark:bg-[#343541] pl-4 pb-3 border-b border-gray-200 dark:border-gray-700 overflow-x-hidden text-black dark:text-neutral-100">
                 
                <ActiveTabs
                        id="OperationSelectorTabs"
                        // initialActiveTab={lastActiveTab.current}
                        onTabChange={(tabIdx, tabLabel) => {
                            setViewMode(tabLabel);
                            // Reset selections when switching tabs
                            if (tabLabel === 'Actions') {
                                setSelectedActionSet(null);
                            } else if (tabLabel === 'Action Sets') {
                                setSelectedOp(null);
                            }
                        }}
                        tabs={[
                          {label: "Actions", 
                           content: 
                            <div className="flex flex-col gap-2 pl-1 pr-2">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                                    <IconTool size={16} stroke={1.5} className="mr-2" />
                                    Available Operations
                                </h3>

                                { featureFlags.integrations &&
                                    <ApiIntegrationsPanel
                                        // API-related props
                                        availableApis={allOperations}
                                        onClickApiItem={(api: OpDef) => {
                                            const apiAsTool: AgentTool = {
                                                id: api.id,
                                                name: api.name,
                                                tool_name: api.name,
                                                description: api.description || '',
                                                parameters: api.parameters,
                                                tags: ['API', 'Integration'],
                                                type: "api",
                                                iconSize: 12
                                            };
                                            setSelectedOp(apiAsTool);
                                            clearAttributes();
                                        }}
                                        // Agent tools props
                                        availableAgentTools={agentTools}
                                        onClickAgentTool={ (tool: AgentTool) => {
                                            setSelectedOp(tool);
                                            clearAttributes();
                                        }}
                                        allowCreatePythonFunction={false}
                                        hideApisPanel={['external']}
                                        labelPrefix=""
                                        showDetails={false}
                                        compactDisplay={true}
                                />}

                            </div> },
                        
                         {label: "Action Sets", 
                            content: 
                            <div className="flex flex-col gap-2 pl-1 pr-2">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                                    <IconTools size={16} stroke={1.5} className="mr-2" />
                                    Available Action Sets
                                </h3>
                            <ActionSetList
                               onLoad={(actionSet) => { 
                                console.log(actionSet);
                                setSelectedActionSet(actionSet);
                               }}
                            />
                            </div>
                         }
                        ]
                    }
                /> 
                
                </div>
            </div>

            {/* Right Pane - Operation Details */}
            <div className="w-2/3 overflow-auto ">
                { viewMode === 'Actions' && <>
                {selectedOp ? (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                {getIcon(selectedOp.name)}
                                <span className="ml-2">
                                    {formatOperationName(selectedOp.name)}
                                </span>
                            </h2>
                            <div className="flex gap-2">
                                {onCancel && (
                                    <button
                                        className="flex items-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 shadow-sm"
                                        onClick={onCancel}
                                    >
                                        <IconX size={16} stroke={1.5} className="mr-1" />
                                        Cancel
                                    </button>
                                )}
                                <button
                                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 shadow-sm"
                                    onClick={() => {
                                        if (onActionAdded && selectedOp) {
                                            const formattedParams = Object.fromEntries(
                                                Object.keys(paramSource?.properties || {}).map((key) => [
                                                    key,
                                                    {
                                                        value: paramValues[key] || '',
                                                        mode: paramModes[key] || 'ai'
                                                    }
                                                ])
                                            );
                                            onActionAdded(selectedOp, formattedParams, customName, customDescription);
                                        }
                                    }}
                                >
                                    {editMode ? (
                                        <> <IconCheck size={16} stroke={1.5} className="mr-1" />
                                            Save Changes </>
                                    ) : (
                                        <> <IconCirclePlus size={16} stroke={1.5} className="mr-1" />
                                            Add Action </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {selectedOp.description ? (
                            <div className="bg-blue-50 dark:bg-[#3e3f4b] border border-blue-100 dark:border-neutral-600 rounded-md p-3 mb-6 flex items-start">
                                <IconInfoCircle size={18} stroke={1.5} className="text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {selectedOp.description}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-[#3e3f4b] border border-gray-200 dark:border-neutral-600 rounded-md p-3 mb-6 flex items-start">
                                <IconInfoCircle size={18} stroke={1.5} className="text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    No description available for this operation.
                                </p>
                            </div>
                        )}

                        {/* Custom Name input field */}
                        <div className="mb-4">
                            <label className="flex items-center justify-between font-medium text-sm text-gray-900 dark:text-white mb-2">
                              <div className="flex items-center">
                                <IconTags size={14} stroke={1.5} className="text-blue-500 mr-2" />
                                Custom Name
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                Optional – only needed for multiple copies of the same action
                              </span>
                            </label>
                            <input
                              type="text"
                              placeholder="Enter a custom name..."
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-[#343541] border-gray-300 dark:border-neutral-600
                              text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500
                              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow duration-150"
                            />
                        </div>

                        {/* Custom Description input field */}
                        <div className="mb-6">
                            <label className="flex items-center justify-between font-medium text-sm text-gray-900 dark:text-white mb-2">
                              <div className="flex items-center">
                                <IconInfoCircle size={14} stroke={1.5} className="text-blue-500 mr-2" />
                                Custom Description
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                Optional – only needed if you want to give the AI special notes on how to use the action
                              </span>
                            </label>
                            <textarea
                              placeholder="Enter special notes for the AI on how to use this action..."
                              value={customDescription}
                              onChange={(e) => setCustomDescription(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-[#343541] border-gray-300 dark:border-neutral-600
                              text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500
                              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow duration-150"
                            />
                        </div>

                        {paramSource?.properties && (
                            <ApiParameterBindingEditor
                                paramSource={paramSource}
                                paramModes={paramModes}
                                paramValues={paramValues}
                                onParamModeChange={handleParamModeChange}
                                onParamValueChange={handleParamValueChange}
                            />
                        )}

                        <details className="mt-6 bg-gray-50 dark:bg-[#343541] border border-gray-300 dark:border-neutral-600 rounded-md">
                            <summary className="cursor-pointer px-4 py-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                <span className="font-medium flex items-center">
                  <IconCode size={14} stroke={1.5} className="mr-2" />
                  Technical Details
                </span>
                                <IconChevronDown size={14} stroke={1.5} />
                            </summary>
                            <div className="border-t border-gray-300 dark:border-neutral-600">
                <pre className="p-4 text-xs overflow-auto rounded-b-md text-gray-800 dark:text-gray-200 font-mono">
                  {JSON.stringify(selectedOp, null, 2)}
                </pre>
                            </div>
                        </details>
                    </div>
                ) : 
                // (!!isTabLoading("Actions") ? 
                //         <div className="h-full flex items-center justify-center">
                //             {loading("Actions")}
                //         </div>
                //     :
                    <div className="h-full flex items-center justify-center">
                        {initialHeader ? (
                            // Custom header content when provided
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                {initialHeader}
                            </div>
                        ) : ( emptyPage("Select an operation from the list to view details") )}
                    </div>
                }
                </>}
                { viewMode === 'Action Sets' && <>
                    {selectedActionSet ? (
                        <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <IconTools size={20} stroke={1.5} className="mr-2" />
                                <span className="mr-3">{selectedActionSet.name || 'Unnamed Action Set'}</span>
                                {featureFlags.scheduledTasks && <ScheduledTaskButton
                                    taskType={'actionSet'} 
                                    objectInfo={{objectId: selectedActionSet.id, objectName: selectedActionSet.name}}
                                />}
                            </h2>
                            <div className="flex gap-2">
                                {onCancel && (
                                    <button
                                        className="flex items-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 shadow-sm"
                                        onClick={onCancel}
                                    >
                                        <IconX size={16} stroke={1.5} className="mr-1" />
                                        Cancel
                                    </button>
                                )}
                                {onActionSetAdded && (
                                    <button
                                        className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 shadow-sm"
                                        onClick={() => onActionSetAdded(selectedActionSet)}
                                    >
                                         <> <IconCirclePlus size={16} stroke={1.5} className="mr-1" />
                                         Add Action Set </>
                                    </button>
                                )}
                            </div>
                        </div>
        
                        {/* Tags display */}
                        {selectedActionSet.tags && selectedActionSet.tags.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2">
                                {selectedActionSet.tags.map((tag: string, index: number) => (
                                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                        <IconTags size={12} className="mr-1" />
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
        
                        {/* Actions list */}
                        <div className="space-y-3 mt-4">
                            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 flex items-center mb-2">
                                Actions ({selectedActionSet.actions?.length || 0})
                            </h3>
                            {selectedActionSet.actions && selectedActionSet.actions.length > 0 ? (
                                <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="divide-y divide-gray-300 dark:divide-gray-700">
                                        {selectedActionSet.actions.map((action: any, index: number) => (
                                            <div key={index} className="p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <div className="flex items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center">
                                                            {getIcon(action.name)}
                                                            <h4 className="font-medium text-gray-900 dark:text-white ml-2">
                                                                {action.customName || formatOperationName(action.name) || 'Unnamed Action'}
                                                            </h4>
                                                            {action.operation?.tags && (
                                                                <div className="ml-2 flex flex-wrap gap-1">
                                                                    {action.operation.tags.map((tag: string, tagIndex: number) => (
                                                                        <span key={tagIndex} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {action.customDescription ? (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                                {action.customDescription}
                                                            </p>
                                                        ) : action.operation?.description ? (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                                {action.operation.description.split('\n')[0]}
                                                            </p>
                                                        ) : null}
                                                        
                                                        {/* Parameters display */}
                                                        {action.parameters && Object.keys(action.parameters).length > 0 && (
                                                            <div className="mt-3">
                                                                <details className="text-sm">
                                                                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center">
                                                                        <IconSettings size={14} className="mr-1" />
                                                                        Parameters ({Object.keys(action.parameters).length})
                                                                    </summary>
                                                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                                                                        {Object.entries(action.parameters).map(([paramName, paramDetails]: [string, any]) => {
                                                                            const isRequired = action.operation?.schema?.required?.includes(paramName);
                                                                            return (
                                                                                <div key={paramName} className="flex flex-col">
                                                                                    <div className="flex items-center">
                                                                                        {isRequired && <IconAsterisk size={12} className="text-blue-500 mr-1" />}
                                                                                    
                                                                                        <span title={`${isRequired ? "Required" : "Optional"} Parameter`}
                                                                                            className="font-medium text-gray-700 dark:text-gray-300">
                                                                                            {formatOperationName(paramName)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="ml-5 mt-1 flex items-center">
                                                                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                                                                            paramDetails.mode === 'manual' 
                                                                                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' 
                                                                                                : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                                                                        }`}>
                                                                                            {paramDetails.mode === 'manual' ? 'Manual' : 'AI Generated'}
                                                                                        </span>
                                                                                        {paramDetails.mode === 'manual' && paramDetails.value && (
                                                                                            <span className="ml-2 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded truncate max-w-[150px]">
                                                                                                {paramDetails.value}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </details>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Show operation details button */}
                                                        {action.operation && (
                                                            <details className="mt-2 text-sm">
                                                                <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center">
                                                                    <IconInfoCircle size={14} className="mr-1" />
                                                                    View operation details
                                                                </summary>
                                                                <div className="mt-2 pl-2 text-xs text-gray-600 dark:text-gray-400 border-l-2 border-gray-200 dark:border-gray-700">
                                                                    <p className="whitespace-pre-line">{action.operation.description}</p>
                                                                </div>
                                                            </details>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                                    No actions in this action set
                                </div>
                            )}
                        </div>
                    </div>
                    ) :
                    <div className="h-full flex items-center justify-center">
                        {initialHeader ? (
                            // Custom header content when provided
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                {initialHeader}
                            </div>
                        ) : (  emptyPage("Select an action set from the list to view details") )}
                    </div>
                    
                    }
                </>}
            </div>
        </div>
    );
};

export default OperationSelector;


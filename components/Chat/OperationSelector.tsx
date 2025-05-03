import React, { useState, useMemo, useEffect } from 'react';
import {
    IconChevronRight,
    IconTool,
    IconSettings,
    IconInfoCircle,
    IconCheck,
    IconCode,
    IconUserCog,
    IconRobot,
    IconAlertCircle,
    IconCirclePlus,
    IconChevronDown,
    IconFiles,
    IconSend,
    IconDeviceSdCard,
    IconBrain,
    IconBulb,
    IconActivity,
    IconSettingsAutomation,
    IconLayoutList,
    IconTags,
    IconFolder,
    IconSearch,
    IconX
} from '@tabler/icons-react';
import { getAgentTools } from '@/services/agentService';

// Define the interfaces needed for the component
interface AgentTool {
    name: string;
    description?: string;
    schema?: any;
    parameters?: any;
    tags?: string[];
}

interface OperationSelectorProps {
    operations: AgentTool[];
    initialHeader?: React.ReactNode; // Optional header content
    onActionAdded?: (operation: AgentTool, parameters: Record<string, { value: string; mode: 'ai' | 'manual' }>, customName?: string, customDescription?: string) => void;
    onCancel?: () => void; // Callback when cancel button is clicked
    initialAction?: { // Optional initial action for editing
        name: string;
        customName?: string;
        customDescription?: string;
        parameters?: Record<string, { value: string; mode: 'ai' | 'manual' }>;
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
    onCancel,
    initialAction,
    editMode: initialEditMode = false,
}) => {
    const [viewMode, setViewMode] = useState<'name' | 'tag'>('name');
    const [selectedOp, setSelectedOp] = useState<AgentTool | null>(null);
    const [paramModes, setParamModes] = useState<Record<string, 'ai' | 'manual'>>({});
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [customName, setCustomName] = useState<string>(initialAction?.customName || '');
    const [customDescription, setCustomDescription] = useState<string>(initialAction?.customDescription || '');
    // Internal edit mode state - can change when user selects different operations
    const [editMode, setEditMode] = useState<boolean>(initialEditMode);
    // State for agent tools
    const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
    const [combinedOperations, setCombinedOperations] = useState<AgentTool[]>(operations);

    const handleParamModeChange = (param: string, mode: 'ai' | 'manual') => {
        setParamModes({ ...paramModes, [param]: mode });
    };

    const handleParamValueChange = (param: string, value: string) => {
        setParamValues({ ...paramValues, [param]: value });
    };

    const clearSearch = () => {
        setSearchQuery('');
    };
    
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
                            description: tool.description || '',
                            schema: tool.parameters || {},
                            parameters: tool.parameters || {},
                            tags: tags,
                            type: "builtIn"
                        };
                    });
                    
                    setAgentTools(tools);
                    
                    // Combine with operations, avoiding duplicates
                    const combined = [...operations];
                    for (const tool of tools) {
                        if (!combined.some(op => op.name === tool.name)) {
                            combined.push(tool);
                        }
                    }
                    setCombinedOperations(combined);
                }
            } catch (error) {
                console.error('Error fetching agent tools:', error);
            }
        };
        
        fetchAgentTools();
    }, [operations]);

    // Initialize with the initial action if provided
    useEffect(() => {
        if (initialAction && combinedOperations.length > 0) {
            const matchingOp = combinedOperations.find(op => op.name === initialAction.name);
            if (matchingOp) {
                setSelectedOp(matchingOp);
                
                // Set edit mode based on initialEditMode
                setEditMode(initialEditMode);
                
                // Initialize parameter values and modes if provided
                if (initialAction.parameters) {
                    const modes: Record<string, 'ai' | 'manual'> = {};
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
    }, [initialAction, combinedOperations, initialEditMode]);

    // Reset selected operation if it's filtered out
    useEffect(() => {
        if (selectedOp && filteredOperations.length > 0) {
            const isSelected = filteredOperations.some(op => op.name === selectedOp.name);
            if (!isSelected) {
                setSelectedOp(null);
            }
        }
    }, [searchQuery, combinedOperations]);

    const paramSource = selectedOp ? (selectedOp.schema || selectedOp.parameters) : undefined;

    // Helper function to get an appropriate icon for an operation based on its name
    const getOperationIcon = (name: string | undefined) => {
        if (!name) return <IconTool size={18} stroke={1.5} />;

        const nameLower = name.toLowerCase();
        if (nameLower.includes('search')) return <IconBulb size={18} stroke={1.5} />;
        if (nameLower.includes('code') || nameLower.includes('script')) return <IconCode size={18} stroke={1.5} />;
        if (nameLower.includes('config') || nameLower.includes('setting')) return <IconSettings size={18} stroke={1.5} />;
        if (nameLower.includes('file') || nameLower.includes('document')) return <IconFiles size={18} stroke={1.5} />;
        if (nameLower.includes('api') || nameLower.includes('request')) return <IconSend size={18} stroke={1.5} />;
        if (nameLower.includes('data') || nameLower.includes('storage')) return <IconDeviceSdCard size={18} stroke={1.5} />;
        if (nameLower.includes('ai') || nameLower.includes('ml')) return <IconBrain size={18} stroke={1.5} />;
        if (nameLower.includes('analyze') || nameLower.includes('monitor')) return <IconActivity size={18} stroke={1.5} />;
        if (nameLower.includes('automate')) return <IconSettingsAutomation size={18} stroke={1.5} />;
        return <IconTool size={18} stroke={1.5} />;
    };

    // Filter operations based on search query
    const filteredOperations = useMemo(() => {
        if (!searchQuery.trim()) return combinedOperations;

        const query = searchQuery.toLowerCase();
        return combinedOperations.filter(op => {
            // Search in name
            if (op.name.toLowerCase().includes(query)) return true;

            // Search in description
            if (op.description?.toLowerCase().includes(query)) return true;

            // Search in tags
            if (op.tags?.some(tag => tag.toLowerCase().includes(query))) return true;

            return false;
        });
    }, [combinedOperations, searchQuery]);

    // Group operations by tags
    const { sortedOperations, tagGroups, noTagOperations } = useMemo(() => {
        // Sort operations alphabetically
        const sorted = [...filteredOperations].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
        );

        if (viewMode === 'name') {
            return {
                sortedOperations: sorted,
                tagGroups: {},
                noTagOperations: []
            };
        }

        // Group by tags for tag view
        const groups: Record<string, AgentTool[]> = {};
        const noTag: AgentTool[] = [];

        sorted.forEach(op => {
            if (op.tags && op.tags.length > 0) {
                op.tags.forEach(tag => {
                    if (!groups[tag]) groups[tag] = [];
                    groups[tag].push(op);
                });
            } else {
                noTag.push(op);
            }
        });

        // Sort the tag keys alphabetically
        const sortedGroups: Record<string, AgentTool[]> = {};
        Object.keys(groups).sort().forEach(key => {
            sortedGroups[key] = groups[key];
        });

        return {
            sortedOperations: sorted,
            tagGroups: sortedGroups,
            noTagOperations: noTag
        };
    }, [filteredOperations, viewMode]);

    return (
        <div className="flex h-[400px] w-[800px] border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg bg-white dark:bg-[#22232b] overflow-hidden">
            {/* Left Pane - Operations List */}
            <div className="w-1/3 border-r border-gray-300 dark:border-gray-700 overflow-auto bg-gray-50 dark:bg-[#2b2c35]">
                <div className="sticky top-0 bg-gray-100 dark:bg-[#343541] px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col gap-2">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                            <IconTool size={16} stroke={1.5} className="mr-2" />
                            Available Operations
                        </h3>
                        <div className="flex items-center bg-white dark:bg-[#343541] border border-gray-300 dark:border-neutral-600 rounded-md overflow-hidden mt-1">
                            <div
                                className={`flex items-center px-3 py-1.5 cursor-pointer text-xs ${
                                    viewMode === 'name'
                                        ? 'bg-blue-100 dark:bg-[#40414F]/80 text-blue-700 dark:text-blue-400 font-medium'
                                        : 'bg-white dark:bg-[#343541] text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => setViewMode('name')}
                            >
                                <IconLayoutList size={14} stroke={1.5} className="mr-1" />
                                <span>By Name</span>
                            </div>
                            <div
                                className={`flex items-center px-3 py-1.5 cursor-pointer text-xs ${
                                    viewMode === 'tag'
                                        ? 'bg-blue-100 dark:bg-[#40414F]/80 text-blue-700 dark:text-blue-400 font-medium'
                                        : 'bg-white dark:bg-[#343541] text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => setViewMode('tag')}
                            >
                                <IconTags size={14} stroke={1.5} className="mr-1" />
                                <span>By Tag</span>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mt-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <IconSearch size={14} stroke={1.5} className="text-gray-400 dark:text-gray-500" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search operations..."
                                className="pl-9 pr-8 py-1.5 w-full text-sm border rounded-md bg-white dark:bg-[#343541] border-gray-300
                  dark:border-neutral-600 text-gray-800 dark:text-gray-200 placeholder-gray-400
                  dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  focus:outline-none transition-shadow duration-150"
                            />
                            {searchQuery && (
                                <button
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    onClick={clearSearch}
                                >
                                    <IconX size={14} stroke={1.5} />
                                </button>
                            )}
                        </div>
                        {searchQuery && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Found {filteredOperations.length} operation{filteredOperations.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {viewMode === 'name' ? (
                        // Name View - flat alphabetical list
                        sortedOperations.length > 0 ? (
                            sortedOperations.map((op, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        // If selecting a different operation during edit mode,
                                        // reset the form to add mode
                                        if (selectedOp && selectedOp.name !== op.name && editMode) {
                                            // Reset custom name and description when switching operations
                                            setCustomName('');
                                            setCustomDescription('');
                                            // Reset params when switching operations
                                            setParamModes({});
                                            setParamValues({});
                                            // Change mode from edit to add
                                            setEditMode(false);
                                        }
                                        setSelectedOp(op);
                                    }}
                                    className={`px-4 py-3 cursor-pointer transition-colors duration-150 
                    hover:bg-blue-50 dark:hover:bg-[#40414F]/70 flex items-center justify-between
                    ${selectedOp?.name === op.name
                                        ? 'bg-blue-100 dark:bg-[#40414F] border-l-4 border-blue-500 dark:border-blue-400'
                                        : 'border-l-4 border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center">
                                        {getOperationIcon(op.name)}
                                        <span className="ml-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                                            {formatOperationName(op.name)}
                                        </span>
                                    </div>
                                    {selectedOp?.name === op.name && (
                                        <IconChevronRight size={16} stroke={1.5} className="text-blue-500 dark:text-blue-400" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                                No operations match your search
                            </div>
                        )
                    ) : (
                        // Tag View - grouped by tags
                        <>
                            {Object.keys(tagGroups).length > 0 || noTagOperations.length > 0 ? (
                                <>
                                    {/* Tagged operations */}
                                    {Object.entries(tagGroups).map(([tag, ops]) => (
                                        <div key={tag} className="border-b border-gray-100 dark:border-gray-700">
                                            <div className="px-4 py-2 bg-gray-50 dark:bg-[#2d2e37] flex items-center">
                                                <IconFolder size={14} stroke={1.5} className="text-gray-500 dark:text-gray-400 mr-1.5" />
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                                                    {tag}
                                                </span>
                                            </div>
                                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                                {ops.map((op, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                        // If selecting a different operation during edit mode,
                                        // reset the form to add mode
                                        if (selectedOp && selectedOp.name !== op.name && editMode) {
                                            // Reset custom name and description when switching operations
                                            setCustomName('');
                                            setCustomDescription('');
                                            // Reset params when switching operations
                                            setParamModes({});
                                            setParamValues({});
                                            // Change mode from edit to add
                                            setEditMode(false);
                                        }
                                        setSelectedOp(op);
                                    }}
                                                        className={`px-4 py-3 pl-6 cursor-pointer transition-colors duration-150 
                              hover:bg-blue-50 dark:hover:bg-[#40414F]/70 flex items-center justify-between
                              ${selectedOp?.name === op.name
                                                            ? 'bg-blue-100 dark:bg-[#40414F] border-l-4 border-blue-500 dark:border-blue-400'
                                                            : 'border-l-4 border-transparent'
                                                        }`}
                                                    >
                                                        <div className="flex items-center">
                                                            {getOperationIcon(op.name)}
                                                            <span className="ml-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                                                                {formatOperationName(op.name)}
                                                            </span>
                                                        </div>
                                                        {selectedOp?.name === op.name && (
                                                            <IconChevronRight size={16} stroke={1.5} className="text-blue-500 dark:text-blue-400" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Operations with no tags */}
                                    {noTagOperations.length > 0 && (
                                        <div>
                                            <div className="px-4 py-2 bg-gray-50 dark:bg-[#2d2e37] flex items-center">
                                                <IconFolder size={14} stroke={1.5} className="text-gray-500 dark:text-gray-400 mr-1.5" />
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                                                    Uncategorized
                                                </span>
                                            </div>
                                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                                {noTagOperations.map((op, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                        // If selecting a different operation during edit mode,
                                        // reset the form to add mode
                                        if (selectedOp && selectedOp.name !== op.name && editMode) {
                                            // Reset custom name and description when switching operations
                                            setCustomName('');
                                            setCustomDescription('');
                                            // Reset params when switching operations
                                            setParamModes({});
                                            setParamValues({});
                                            // Change mode from edit to add
                                            setEditMode(false);
                                        }
                                        setSelectedOp(op);
                                    }}
                                                        className={`px-4 py-3 pl-6 cursor-pointer transition-colors duration-150 
                              hover:bg-blue-50 dark:hover:bg-[#40414F]/70 flex items-center justify-between
                              ${selectedOp?.name === op.name
                                                            ? 'bg-blue-100 dark:bg-[#40414F] border-l-4 border-blue-500 dark:border-blue-400'
                                                            : 'border-l-4 border-transparent'
                                                        }`}
                                                    >
                                                        <div className="flex items-center">
                                                            {getOperationIcon(op.name)}
                                                            <span className="ml-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                                                                {formatOperationName(op.name)}
                                                            </span>
                                                        </div>
                                                        {selectedOp?.name === op.name && (
                                                            <IconChevronRight size={16} stroke={1.5} className="text-blue-500 dark:text-blue-400" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No operations match your search
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right Pane - Operation Details */}
            <div className="w-2/3 overflow-auto">
                {selectedOp ? (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                {getOperationIcon(selectedOp.name)}
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
                                        <>
                                            <IconCheck size={16} stroke={1.5} className="mr-1" />
                                            Save Changes
                                        </>
                                    ) : (
                                        <>
                                            <IconCirclePlus size={16} stroke={1.5} className="mr-1" />
                                            Add Action
                                        </>
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
                            <div className="space-y-5">
                                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 flex items-center mb-3">
                                    <IconSettings size={16} stroke={1.5} className="mr-1" />
                                    Parameters
                                </h3>

                                {Object.entries(paramSource.properties).map(([paramName, paramInfo]: [string, any]) => (
                                    <div key={paramName} className="bg-gray-50 dark:bg-[#40414F] rounded-lg p-4 border border-gray-300 dark:border-neutral-600">
                                        <label className="flex items-center justify-between font-medium text-sm text-gray-900 dark:text-white mb-2">
                                            <div className="flex items-center">
                                                {paramSource.required?.includes(paramName) ? (
                                                    <IconAlertCircle size={14} stroke={1.5} className="text-red-500 mr-2" />
                                                ) : (
                                                    <IconCheck size={14} stroke={1.5} className="text-green-500 mr-2" />
                                                )}
                                                {formatOperationName(paramName)}
                                            </div>
                                            {paramInfo.type && (
                                                <span className="text-xs font-normal py-1 px-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">
                                                    {paramInfo.type}
                                                </span>
                                            )}
                                        </label>

                                        <div className="flex items-center gap-3 mt-2">
                                            <div className="flex items-center bg-white dark:bg-[#343541] border border-gray-300 dark:border-neutral-600 rounded-md overflow-hidden">
                                                <div
                                                    className={`flex items-center px-3 py-2 cursor-pointer ${
                                                        (paramModes[paramName] || 'ai') === 'ai'
                                                            ? 'bg-blue-100 dark:bg-[#40414F]/80 text-blue-700 dark:text-blue-400'
                                                            : 'bg-white dark:bg-[#343541] text-gray-700 dark:text-gray-300'
                                                    }`}
                                                    onClick={() => handleParamModeChange(paramName, 'ai')}
                                                >
                                                    <IconRobot size={14} stroke={1.5} className="mr-1" />
                                                    <span className="text-xs">AI</span>
                                                </div>
                                                <div
                                                    className={`flex items-center px-3 py-2 cursor-pointer ${
                                                        (paramModes[paramName] || 'ai') === 'manual'
                                                            ? 'bg-blue-100 dark:bg-[#40414F]/80 text-blue-700 dark:text-blue-400'
                                                            : 'bg-white dark:bg-[#343541] text-gray-700 dark:text-gray-300'
                                                    }`}
                                                    onClick={() => handleParamModeChange(paramName, 'manual')}
                                                >
                                                    <IconUserCog size={14} stroke={1.5} className="mr-1" />
                                                    <span className="text-xs">Manual</span>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                value={paramValues[paramName] || ''}
                                                onChange={(e) => handleParamValueChange(paramName, e.target.value)}
                                                placeholder={`Enter ${formatOperationName(paramName)} value...`}
                                                className="flex-1 px-3 py-2 border rounded-md bg-white dark:bg-[#343541] border-gray-300 dark:border-neutral-600
                          text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow duration-150"
                                            />
                                        </div>

                                        {paramInfo.description && (
                                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                                                {paramInfo.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
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
                ) : (
                    <div className="h-full flex items-center justify-center">
                        {initialHeader ? (
                            // Custom header content when provided
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                {initialHeader}
                            </div>
                        ) : (
                            // Default empty state
                            <div className="text-center p-6">
                                <div className="flex justify-center mb-3">
                                    <IconChevronRight size={24} stroke={1.5} className="text-gray-400 dark:text-gray-600" />
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    {filteredOperations.length > 0
                                        ? "Select an operation from the list to view details"
                                        : "No operations match your search criteria"}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OperationSelector;
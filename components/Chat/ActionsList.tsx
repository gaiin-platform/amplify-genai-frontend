import {
    IconTool,
    IconChevronRight,
    IconX,
    IconCode,
    IconSearch,
    IconApi,
    IconDatabase,
    IconBrain,
    IconSettings,
    IconFiles,
    IconSend,
    IconWorld,
    IconTable,
    IconMail,
    IconUser,
    IconActivity,
    IconTrash,
    IconCheck,
    IconAlertTriangle,
    IconAdjustments,
    IconEdit
} from '@tabler/icons-react';
import React, { useState } from "react";

interface AgentAction {
    name: string;
    customName?: string;
}

interface ActionsListProps {
    actions: AgentAction[];
    onRemoveAction?: (index: number) => void;
    onActionClick?: (action: AgentAction, index: number) => void;
    onDeleteRequested?: (action: AgentAction, index: number) => void;
    onConfigureAction?: (action: AgentAction, index: number) => void;
}

const ActionsList: React.FC<ActionsListProps> = ({
                                                     actions,
                                                     onRemoveAction,
                                                     onActionClick,
                                                     onDeleteRequested,
                                                     onConfigureAction
                                                 }) => {
    // State to track which action is currently in delete confirmation mode
    const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

    // Function to get an icon based on the action name
    const getActionIcon = (name: string) => {
        const nameLower = name.toLowerCase();

        if (nameLower.includes('search')) return <IconSearch size={16} stroke={1.5} />;
        if (nameLower.includes('code') || nameLower.includes('script')) return <IconCode size={16} stroke={1.5} />;
        if (nameLower.includes('config') || nameLower.includes('setting')) return <IconSettings size={16} stroke={1.5} />;
        if (nameLower.includes('file') || nameLower.includes('document')) return <IconFiles size={16} stroke={1.5} />;
        if (nameLower.includes('api') || nameLower.includes('request')) return <IconApi size={16} stroke={1.5} />;
        if (nameLower.includes('data') || nameLower.includes('storage')) return <IconDatabase size={16} stroke={1.5} />;
        if (nameLower.includes('ai') || nameLower.includes('ml')) return <IconBrain size={16} stroke={1.5} />;
        if (nameLower.includes('analyze') || nameLower.includes('monitor')) return <IconActivity size={16} stroke={1.5} />;
        if (nameLower.includes('email') || nameLower.includes('mail')) return <IconMail size={16} stroke={1.5} />;
        if (nameLower.includes('table') || nameLower.includes('excel')) return <IconTable size={16} stroke={1.5} />;
        if (nameLower.includes('web') || nameLower.includes('http')) return <IconWorld size={16} stroke={1.5} />;
        if (nameLower.includes('user') || nameLower.includes('profile')) return <IconUser size={16} stroke={1.5} />;
        if (nameLower.includes('send')) return <IconSend size={16} stroke={1.5} />;

        return <IconTool size={16} stroke={1.5} />;
    };

    // Format the action name for display
    const formatActionName = (name: string): string => {
        // First split by underscores and capitalize first letter of each part
        const underscoreSplit = name.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');

        // Then add spaces before uppercase characters (for camelCase/PascalCase)
        return underscoreSplit.replace(/([A-Z])/g, ' $1').trim()
            // Remove any extra spaces that might have been created
            .replace(/\s+/g, ' ');
    };

    // Handle the initial delete button click
    const handleDeleteClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();

        if (onDeleteRequested) {
            // If there's a delete request handler, call it instead of showing confirmation UI
            onDeleteRequested(actions[index], index);
        } else {
            // Otherwise, show the confirmation UI
            setConfirmDeleteIndex(index);
        }
    };

    // Handle the configure action click
    const handleConfigureClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onConfigureAction) {
            onConfigureAction(actions[index], index);
        }
    };

    // Handle the confirm delete action
    const handleConfirmDelete = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRemoveAction) {
            onRemoveAction(index);
        }
        setConfirmDeleteIndex(null);
    };

    // Handle the cancel delete action
    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmDeleteIndex(null);
    };

    if (actions.length === 0) return null;

    return (
        <div className="pt-1 pb-1">
            <div className="flex items-center mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1 px-2">
                    Actions ({actions.length})
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <div className="flex flex-wrap gap-2 px-2">
                {actions.map((action, index) => (
                    <div
                        key={index}
                        className={`group flex items-center bg-blue-50 dark:bg-[#3e3f4b] rounded-md px-2 py-1.5 border 
                            ${confirmDeleteIndex === index
                            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                            : 'border-blue-100 dark:border-[#565869] hover:bg-blue-100 dark:hover:bg-[#4a4b59]'} 
                            transition-colors ${onActionClick ? 'cursor-pointer' : ''}`}
                        onClick={() => onActionClick && onActionClick(action, index)}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className={`${confirmDeleteIndex === index ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {confirmDeleteIndex === index
                                    ? <IconAlertTriangle size={16} stroke={1.5} />
                                    : getActionIcon(action.name)}
                            </span>
                            <span className={`text-xs font-medium ${confirmDeleteIndex === index ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-200'}`}>
                                {action.customName || formatActionName(action.name)}
                            </span>
                            {action.customName && confirmDeleteIndex !== index && (
                                <span className="hidden group-hover:inline text-xs text-gray-500 dark:text-gray-400 ml-1">
                                    ({formatActionName(action.name)})
                                </span>
                            )}
                        </div>

                        {confirmDeleteIndex === index ? (
                            <div className="flex items-center ml-2">
                                <button
                                    className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 ml-1"
                                    onClick={(e) => handleConfirmDelete(index, e)}
                                    aria-label="Confirm delete"
                                >
                                    <IconCheck size={14} stroke={1.8} />
                                </button>
                                <button
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ml-1"
                                    onClick={handleCancelDelete}
                                    aria-label="Cancel delete"
                                >
                                    <IconX size={14} stroke={1.8} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                {onConfigureAction && (
                                    <button
                                        className="ml-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                        onClick={(e) => handleConfigureClick(index, e)}
                                        aria-label="Configure action"
                                    >
                                        <IconAdjustments size={14} stroke={1.8} />
                                    </button>
                                )}
                                {(onRemoveAction || onDeleteRequested) && (
                                    <button
                                        className="ml-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                                        onClick={(e) => handleDeleteClick(index, e)}
                                        aria-label="Remove action"
                                    >
                                        <IconTrash size={14} stroke={1.8} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActionsList;
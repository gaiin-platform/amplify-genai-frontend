import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { IconCheck, IconFiles, IconPlus, IconSettings, IconTrashX, IconX } from '@tabler/icons-react';
import { AssistantModal } from '../Promptbar/components/AssistantModal';
import { Prompt } from '@/types/prompt';
import { Group, GroupAccessType, AstGroupTypeData, GroupUpdateType, Members } from '@/types/groups';
import { createEmptyPrompt } from '@/utils/app/prompts';
import { useSession } from 'next-auth/react';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { createAstAdminGroup, deleteAstAdminGroup, updateGroupAmplifyGroups, updateGroupAssistants, updateGroupMembers, updateGroupMembersPermissions, updateGroupSystemUsers, updateGroupTypes } from '@/services/groupsService';
import Search from '../Search';
import { TagsList } from '../Chat/TagsList';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { AttachFile, handleFile } from '../Chat/AttachFile';
import { COMMON_DISALLOWED_FILE_EXTENSIONS } from '@/utils/app/const';
import { AssistantDefinition, AssistantProviderID } from '@/types/assistant';
import { DataSourceSelector } from '../DataSources/DataSourceSelector';
import { AttachedDocument } from '@/types/attacheddocument';
import { ExistingFileList, FileList } from "@/components/Chat/FileList";
import { ModelSelect } from '../Chat/ModelSelect';
import { getDate, getDateName } from '@/utils/app/date';
import { FolderInterface } from '@/types/folder';
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { getGroupAssistantConversations } from '@/services/groupAssistantService';
import { getGroupAssistantDashboards } from '@/services/groupAssistantService';
import { getGroupConversationData } from '@/services/groupAssistantService';
import toast from 'react-hot-toast';
import ActionButton from '../ReusableComponents/ActionButton';
import { LoadingDialog } from '../Loader/LoadingDialog';
import { InfoBox } from '../ReusableComponents/InfoBox';
import { includeGroupInfoBox } from '../Emails/EmailsList';
import Checkbox from '../ReusableComponents/CheckBox';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';
import { Modal } from '../ReusableComponents/Modal';
import { AmplifyGroupSelect } from './AdminUI';
import { getUserAmplifyGroups } from '@/services/adminService';
import { fetchAllSystemIds } from '@/services/apiKeysService';
import { ReactElement } from 'react-markdown/lib/react-markdown';
import { checkAvailableModelId } from '@/utils/app/models';


interface Conversation {
    assistantName: string;
    user: string;
    employeeType: string;
    entryPoint: string;
    numberPrompts: number;
    modelUsed: string;
    timestamp: string;
    s3Location: string;
    userRating: number;
    systemRating: number;
    category: string;
    userFeedback: string;
    conversationId: string;
    assistantId: string;
}

const ConversationTable: FC<{ conversations: Conversation[], supportConvAnalysis: boolean }> = ({ conversations, supportConvAnalysis }) => {
    const [sortColumn, setSortColumn] = useState<keyof Conversation>('timestamp');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filteredConversations, setFilteredConversations] = useState<Conversation[]>(conversations);
    const [showColumnSelector, setShowColumnSelector] = useState<boolean>(false);

    // Initialize with columns that should always be visible
    const defaultColumns: (keyof Conversation)[] = [
        'assistantName',
        'user',
        'numberPrompts',
        'modelUsed',
        'timestamp',
        'userRating'
    ];

    // Add analysis-specific columns if supportConvAnalysis is true
    const analysisColumns: (keyof Conversation)[] = supportConvAnalysis ? [
        'employeeType',
        'entryPoint',
        'category',
        'systemRating'
    ] : [];

    const [visibleColumns, setVisibleColumns] = useState<(keyof Conversation)[]>([
        ...defaultColumns,
        ...analysisColumns
    ]);

    // Format date for better readability
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Handle search functionality
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredConversations(conversations);
        } else {
            const lowercaseSearchTerm = searchTerm.toLowerCase();
            const searchFields = ['assistantName', 'user', 'modelUsed', 'userFeedback'];

            // Only include analysis-specific fields in search if they're supported
            if (supportConvAnalysis) {
                searchFields.push('category', 'employeeType', 'entryPoint');
            }

            setFilteredConversations(conversations.filter(conv => {
                return searchFields.some(field => {
                    const value = conv[field as keyof Conversation];
                    return value && String(value).toLowerCase().includes(lowercaseSearchTerm);
                });
            }));
        }
    }, [searchTerm, conversations, supportConvAnalysis]);

    const openPopup = (conversation: Conversation) => {
        setSelectedConversation(conversation);
    };

    if (conversations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                    <IconFiles size={48} className="mx-auto mb-4 opacity-40" />
                    <p className="text-lg">No conversations available</p>
                </div>
            </div>
        );
    }

    // Define all possible columns based on supportConvAnalysis
    const allColumns: (keyof Conversation)[] = [
        ...defaultColumns,
        ...analysisColumns,
        'userFeedback',
        'conversationId',
        'assistantId'
    ];

    const toggleColumnVisibility = (column: keyof Conversation) => {
        if (visibleColumns.includes(column)) {
            setVisibleColumns(visibleColumns.filter(col => col !== column));
        } else {
            setVisibleColumns([...visibleColumns, column]);
        }
    };

    const handleSort = (column: keyof Conversation) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Render star rating
    const renderStarRating = (rating: number) => {
        if (!rating) return <span className="text-gray-400">No rating</span>;

        return (
            <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        className={`${star <= rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                    >
                        ★
                    </span>
                ))}
                <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">{rating.toFixed(1)}</span>
            </div>
        );
    };

    const sortedConversations = [...filteredConversations].sort((a, b) => {
        if (sortColumn) {
            const aValue = a[sortColumn];
            const bValue = b[sortColumn];

            // Handle empty, null, or undefined values
            if (aValue == null && bValue == null) return 0;
            if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
            if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

            // Special handling for timestamp
            if (sortColumn === 'timestamp') {
                return sortDirection === 'asc'
                    ? new Date(aValue as string).getTime() - new Date(bValue as string).getTime()
                    : new Date(bValue as string).getTime() - new Date(aValue as string).getTime();
            }

            // Special handling for specific columns
            if (['modelUsed', 'category', 'assistantName', 'user', 'employeeType', 'entryPoint'].includes(sortColumn)) {
                return sortDirection === 'asc'
                    ? String(aValue).localeCompare(String(bValue))
                    : String(bValue).localeCompare(String(aValue));
            }

            if (['userRating', 'systemRating', 'numberPrompts'].includes(sortColumn)) {
                return sortDirection === 'asc'
                    ? Number(aValue) - Number(bValue)
                    : Number(bValue) - Number(aValue);
            }

            // Default comparison for other columns
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Get column display name with proper formatting
    const getColumnDisplayName = (column: string): string => {
        return column
            .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
            .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
            .trim();
    };

    return (
        <>
            <div className="mb-4 px-4 py-3 dark:bg-gray-800 bg-white rounded-lg shadow">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1 w-full sm:w-auto">
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full px-4 py-2 pl-10 rounded-md border dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <div className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                        >
                            <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="4" y1="21" x2="4" y2="14" />
                                <line x1="4" y1="10" x2="4" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12" y2="3" />
                                <line x1="20" y1="21" x2="20" y2="16" />
                                <line x1="20" y1="12" x2="20" y2="3" />
                                <line x1="1" y1="14" x2="7" y2="14" />
                                <line x1="9" y1="8" x2="15" y2="8" />
                                <line x1="17" y1="16" x2="23" y2="16" />
                            </svg>
                            Customize Table
                        </button>
                        {showColumnSelector && (
                            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-10">
                                <div className="p-3 border-b dark:border-gray-700">
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Visible Columns</h3>
                                </div>
                                <div className="p-2 max-h-60 overflow-y-auto">
                                    {allColumns.map(column => (
                                        <div key={column} className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                                            <input
                                                type="checkbox"
                                                id={`column-${column}`}
                                                checked={visibleColumns.includes(column)}
                                                onChange={() => toggleColumnVisibility(column)}
                                                className="rounded text-blue-500 focus:ring-blue-500 dark:bg-gray-900"
                                            />
                                            <label htmlFor={`column-${column}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                                {getColumnDisplayName(column as string)}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Showing {filteredConversations.length} of {conversations.length} conversations
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto rounded-lg shadow border dark:border-gray-700" style={{ height: `${window.innerHeight * 0.65}px` }}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                        <tr>
                            {visibleColumns.map((column) => (
                                <th
                                    key={column}
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => handleSort(column)}
                                >
                                    <div className="flex items-center">
                                        {getColumnDisplayName(column as string)}
                                        {sortColumn === column && (
                                            <span className="ml-1">
                                                {sortDirection === 'asc' ? '▲' : '▼'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">View</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {sortedConversations.map((conversation, index) => (
                            <tr
                                key={conversation.conversationId}
                                className={`
                                    hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150
                                    ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
                                `}
                                onClick={() => openPopup(conversation)}
                            >
                                {visibleColumns.map((column) => {
                                    // Format different column types
                                    const value = conversation[column];

                                    if (column === 'timestamp') {
                                        return (
                                            <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {formatDate(value as string)}
                                            </td>
                                        );
                                    }

                                    if (column === 'userRating' || column === 'systemRating') {
                                        return (
                                            <td key={column} className="px-6 py-4 whitespace-nowrap">
                                                {renderStarRating(value as number)}
                                            </td>
                                        );
                                    }

                                    if (column === 'assistantName' || column === 'category') {
                                        return (
                                            <td key={column} className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                    {value || 'N/A'}
                                                </span>
                                            </td>
                                        );
                                    }

                                    if (column === 'userFeedback') {
                                        return (
                                            <td key={column} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {value || 'No feedback'}
                                            </td>
                                        );
                                    }

                                    if (column === 'numberPrompts') {
                                        return (
                                            <td key={column} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 text-center">
                                                <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">{value}</span>
                                            </td>
                                        );
                                    }

                                    if (column === 'conversationId' || column === 'assistantId') {
                                        return (
                                            <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                <span className="font-mono text-xs">{String(value).substring(0, 10)}...</span>
                                            </td>
                                        );
                                    }

                                    // Default display for other columns
                                    return (
                                        <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {value || 'N/A'}
                                        </td>
                                    );
                                })}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <span className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300">
                                        View
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedConversation && (
                <ConversationPopup
                    conversation={selectedConversation}
                    onClose={() => setSelectedConversation(null)}
                    supportConvAnalysis={supportConvAnalysis}
                />
            )}
        </>
    );
};

const ConversationPopup: FC<{ conversation: Conversation; onClose: () => void; supportConvAnalysis: boolean }> = ({ conversation, onClose, supportConvAnalysis }) => {
    const [content, setContent] = useState<string>('Loading...');
    const { state: { statsService } } = useContext(HomeContext);
    const [isLoading, setIsLoading] = useState(true);
    const [formattedMessages, setFormattedMessages] = useState<{ role: string, content: string }[]>([]);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                setIsLoading(true);
                statsService.getGroupConversationDataEvent(conversation.assistantId, conversation.conversationId);
                const result = await getGroupConversationData(conversation.assistantId, conversation.conversationId);
                if (result.success) {
                    const formattedContent = result.data.content.replace(/\\n/g, '\n').replace(/#dataSource:/g, '');
                    setContent(formattedContent);

                    // Parse the conversation content into structured messages
                    try {
                        const messageRegex = /User Prompt:([\s\S]*?)(?:AI Response:([\s\S]*?)(?=User Prompt:|$))/g;
                        const matches = [...formattedContent.matchAll(messageRegex)];

                        const parsedMessages = [];
                        if (matches.length > 0) {
                            for (const match of matches) {
                                parsedMessages.push({ role: 'user', content: match[1].trim() });
                                if (match[2]) {
                                    parsedMessages.push({ role: 'assistant', content: match[2].trim() });
                                }
                            }
                            setFormattedMessages(parsedMessages);
                        } else {
                            // Fallback if parsing fails
                            setFormattedMessages([{ role: 'system', content: formattedContent }]);
                        }
                    } catch (error) {
                        console.error('Error parsing conversation:', error);
                        setFormattedMessages([{ role: 'system', content: formattedContent }]);
                    }
                } else {
                    setContent('Error loading conversation content.');
                    setFormattedMessages([{ role: 'system', content: 'Error loading conversation content.' }]);
                }
            } catch (error) {
                setContent('Error loading conversation content.');
                setFormattedMessages([{ role: 'system', content: 'Error loading conversation content.' }]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchContent();
    }, [conversation.assistantId, conversation.conversationId]);

    // Define the fields you want to show based on supportConvAnalysis
    const baseFields: (keyof Conversation)[] = [
        'timestamp',
        'assistantName',
        'user',
        'numberPrompts',
        'modelUsed',
        'userRating'
    ];

    const analysisFields: (keyof Conversation)[] = supportConvAnalysis ? [
        'employeeType',
        'entryPoint',
        'category',
        'systemRating'
    ] : [];

    const fieldsToShow: (keyof Conversation)[] = [...baseFields, ...analysisFields];

    // Format date for better readability
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Render star rating
    const renderStarRating = (rating: number | null) => {
        if (rating === null || rating === undefined) return 'No rating';

        return (
            <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        className={`${star <= rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                    >
                        ★
                    </span>
                ))}
                <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">{rating.toFixed(1)}</span>
            </div>
        );
    };

    // Format the field value for display
    const formatFieldValue = (key: keyof Conversation, value: any) => {
        if (value === undefined || value === null) return 'N/A';

        if (key === 'timestamp') {
            return formatDate(value as string);
        }

        if (key === 'userRating' || key === 'systemRating') {
            return renderStarRating(value as number);
        }

        return String(value);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full h-[85vh] flex flex-col shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
                        <span>{conversation.assistantName}</span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {formatDate(conversation.timestamp)}
                        </span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Close"
                    >
                        <IconX size={24} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow flex overflow-hidden">
                    {/* Conversation area - 70% */}
                    <div className="w-[70%] h-full overflow-y-auto p-6 border-r border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Conversation</h3>

                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            formattedMessages.length > 0 ? (
                                <div className="space-y-4">
                                    {formattedMessages.map((message, index) => (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-lg ${message.role === 'user'
                                                ? 'bg-blue-50 dark:bg-blue-900/30 ml-4 mr-8'
                                                : message.role === 'assistant'
                                                    ? 'bg-gray-100 dark:bg-gray-800 mr-4 ml-8'
                                                    : 'bg-yellow-50 dark:bg-yellow-900/30'
                                                }`}
                                        >
                                            <div className="font-medium text-sm mb-1 text-gray-700 dark:text-gray-300">
                                                {message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'}
                                            </div>
                                            <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                                                {message.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-800 dark:text-gray-200 text-sm overflow-x-auto">
                                    {content}
                                </pre>
                            )
                        )}
                    </div>

                    {/* Metadata area - 30% */}
                    <div className="w-[30%] h-full overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Metadata</h3>

                        <div className="space-y-4">
                            {fieldsToShow.map((key) => (
                                <div key={key} className="mb-3">
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                        {formatFieldValue(key, conversation[key])}
                                    </div>
                                </div>
                            ))}

                            {conversation.userFeedback && (
                                <div className="mt-6">
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        User Feedback
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                        <p className="text-gray-800 dark:text-gray-200 italic">{conversation.userFeedback}</p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Conversation ID: <span className="font-mono">{conversation.conversationId.substring(0, 12)}...</span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Assistant ID: <span className="font-mono">{conversation.assistantId.substring(0, 12)}...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface DashboardMetrics {
    assistantId: string;
    assistantName: string;
    numUsers: number;
    totalConversations: number;
    averagePromptsPerConversation: number;
    entryPointDistribution: { [key: string]: number };
    categoryDistribution: { [key: string]: number };
    employeeTypeDistribution: { [key: string]: number };
    averageUserRating: number | null;
    averageSystemRating: number | null;
}

// Define types for our data structures
type DataPoint = {
    name: string;
    value: number;
};

// Simple bar chart implementation without external libraries
const SimpleBarChart: FC<{ data: DataPoint[], color?: string }> = ({
    data,
    color = "#0088FE"
}) => {
    // Find the maximum value for scaling
    const maxValue = Math.max(...data.map(item => item.value));

    // Sort data by value in descending order for better visualization
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="w-full">
            {sortedData.map((item, index) => (
                <div key={index} className="mb-2">
                    <div className="flex items-center">
                        <div className="w-32 text-sm truncate mr-2" title={item.name}>{item.name}</div>
                        <div className="flex-grow">
                            <div className="relative pt-1">
                                <div className="flex items-center justify-between">
                                    <div className="w-full mr-2">
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded">
                                            <div
                                                className="h-4 rounded transition-all duration-500 ease-in-out"
                                                style={{
                                                    width: `${Math.max((item.value / maxValue) * 100, 5)}%`,
                                                    backgroundColor: color
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="ml-2 text-sm whitespace-nowrap">{item.value}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Simple pie chart representation without external libraries
const SimplePieList: FC<{ data: DataPoint[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

    // Sort data by value in descending order for better visualization
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="w-full">
            {sortedData.map((item, index) => {
                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                return (
                    <div key={index} className="mb-3 flex items-center group hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded transition-colors duration-150">
                        <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <div className="text-sm flex-grow truncate" title={item.name}>{item.name}</div>
                        <div className="text-sm mr-2">{item.value}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 w-16">{percentage}%</div>
                    </div>
                );
            })}
        </div>
    );
};

const Dashboard: FC<{ metrics: DashboardMetrics, supportConvAnalysis: boolean }> = ({ metrics, supportConvAnalysis }) => {
    // Transform object data into array format for visualization
    console.log("supportConvAnalysis:", supportConvAnalysis);

    const transformDistributionData = (data: { [key: string]: number }): DataPoint[] => {
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    };

    const entryPointData = supportConvAnalysis ? transformDistributionData(metrics.entryPointDistribution) : [];
    const categoryData = supportConvAnalysis ? transformDistributionData(metrics.categoryDistribution) : [];
    const employeeTypeData = supportConvAnalysis ? transformDistributionData(metrics.employeeTypeDistribution) : [];

    // Render star rating
    const renderStarRating = (rating: number | null) => {
        if (rating === null) return 'N/A';

        return (
            <div className="flex items-center">
                <span className="mr-2">{rating.toFixed(2)}</span>
                <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                            key={star}
                            className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    ))}
                </div>
            </div>
        );
    };

    // Progress bar component for comparison
    const ProgressBar: FC<{ label: string, value: number, maxValue: number, color: string }> = ({
        label, value, maxValue, color
    }) => (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm">{label}</span>
                <span className="text-sm font-semibold">{value.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                    className="h-2.5 rounded-full"
                    style={{
                        width: `${(value / maxValue) * 100}%`,
                        backgroundColor: color
                    }}
                ></div>
            </div>
        </div>
    );

    return (
        <div
            className="p-4 text-black dark:text-white overflow-auto h-full"
            style={{
                maxHeight: `${window.innerHeight * 0.75}px`,
                overflowY: 'auto'
            }}
        >
            <h2 className="text-2xl font-bold mb-4">Dashboard Metrics for {metrics.assistantName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Assistant ID: {metrics.assistantId}
            </p>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">Unique Users</h3>
                    <p className="text-3xl font-bold">{metrics.numUsers}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">Total Conversations</h3>
                    <p className="text-3xl font-bold">{metrics.totalConversations}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">Avg. Prompts Per Conversation</h3>
                    <p className="text-3xl font-bold">{metrics.averagePromptsPerConversation.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">User Satisfaction</h3>
                    <div className="text-xl font-bold">
                        {renderStarRating(metrics.averageUserRating)}
                    </div>
                </div>
            </div>

            {/* Charts Section - Only show analysis-specific charts if supportConvAnalysis is true */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* Entry Point Distribution - Only show if supportConvAnalysis is true */}
                {supportConvAnalysis && entryPointData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <h3 className="text-lg font-semibold mb-4">Entry Point Distribution</h3>
                        <div className="h-64 overflow-y-auto">
                            <SimpleBarChart data={entryPointData} color="#0088FE" />
                        </div>
                    </div>
                )}

                {/* Category Distribution - Only show if supportConvAnalysis is true */}
                {supportConvAnalysis && categoryData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
                        <div className="h-64 overflow-y-auto">
                            <SimplePieList data={categoryData} />
                        </div>
                    </div>
                )}

                {/* Group Type Distribution - Only show if supportConvAnalysis is true */}
                {supportConvAnalysis && employeeTypeData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <h3 className="text-lg font-semibold mb-4">Group Type Distribution</h3>
                        <div className="h-64 overflow-y-auto">
                            <SimplePieList data={employeeTypeData} />
                        </div>
                    </div>
                )}

                {/* System Performance - Only show system rating if supportConvAnalysis is true */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-4">Performance</h3>
                    <div className="flex flex-col space-y-4">
                        {supportConvAnalysis && (
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">System Rating</p>
                                <div className="text-xl font-bold mt-1">
                                    {renderStarRating(metrics.averageSystemRating)}
                                </div>
                            </div>
                        )}

                        <div className="mt-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Rating{supportConvAnalysis ? 's Comparison' : ''}</p>
                            <div className="mt-2">
                                <ProgressBar
                                    label="User Rating"
                                    value={metrics.averageUserRating || 0}
                                    maxValue={5}
                                    color="#0088FE"
                                />

                                {supportConvAnalysis && (
                                    <ProgressBar
                                        label="System Rating"
                                        value={metrics.averageSystemRating || 0}
                                        maxValue={5}
                                        color="#00C49F"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface User {
    name: string;
    // dateAdded: string;
    accessLevel: GroupAccessType;
}

interface ManagementProps {
    selectedGroup: Group;
    setSelectedGroup: (g: Group | undefined) => void;
    members: Members;
    allEmails: Array<string> | null;
    setLoadingActionMessage: (s: string) => void;
    adminGroups: Group[];
    setAdminGroups: (groups: Group[]) => void;
    amplifyGroups: string[];
    systemUsers: string[];
}


const GroupManagement: FC<ManagementProps> = ({ selectedGroup, setSelectedGroup, members, allEmails, setLoadingActionMessage,
    adminGroups, setAdminGroups, amplifyGroups, systemUsers }) => {
    const { state: { featureFlags, groups, prompts, folders, statsService }, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [hasAdminAccess, setHasAdminAccess] = useState<boolean>((userEmail && selectedGroup.members[userEmail] === GroupAccessType.ADMIN) || false);
    const [groupTypes, setGroupTypes] = useState<string[]>(selectedGroup.groupTypes);
    const [groupAmpGroups, setGroupAmpGroups] = useState<string[]>(selectedGroup.amplifyGroups ?? []);
    const [groupSystemUsers, setGroupSystemUsers] = useState<string[]>(selectedGroup.systemUsers ?? []);

    const initUniqueSystemUsers = () => {
        const uniqueSystemUsers = new Set([
            ...(systemUsers ?? []),
            ...(selectedGroup?.systemUsers ?? [])
        ]);
        
        return Array.from(uniqueSystemUsers);
    }
    const [availableSystemUsers, setAvailableSystemUsers] = useState<string[]>(initUniqueSystemUsers());


    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteUsersList, setDeleteUsersList] = useState<string[]>([]);


    const [input, setInput] = useState<string>('');
    const [isAddingUsers, setIsAddingUsers] = useState<boolean>(false);
    const [newGroupMembers, setNewGroupMembers] = useState<Members>({});


    const [isEditingAccess, setIsEditingAccess] = useState<boolean>(false);
    const [editAccessMap, setEditAccessMap] = useState<Members>({});

    const [allGroupEmails, setAllGroupEmails] = useState<Array<string> | null>(allEmails);

    useEffect(() => {
        setIsDeleting(false);
        setDeleteUsersList([]);
        setIsAddingUsers(false);
        setNewGroupMembers({});
        setIsEditingAccess(false);
        setEditAccessMap({});
        setGroupTypes(selectedGroup.groupTypes);
    }, [selectedGroup]);

    const usersmap = Object.entries(members)
        .map(([email, accessLevel]) => ({
            name: email,
            dateAdded: '2023-01-15',
            accessLevel: accessLevel,
        }))
        .sort((a, b) => {
            if (a.name === userEmail) {
                return -1; // Move a to the top if it matches userEmail
            }
            if (b.name === userEmail) {
                return 1; // Move b to the top if it matches userEmail
            }
            // Otherwise, sort alphabetically by name
            return a.name.localeCompare(b.name);
        });;


    useEffect(() => {
        if (!searchTerm) {
            setUsers(usersmap);
        }

    }, [searchTerm]);

    const [users, setUsers] = useState<User[]>(usersmap);

    const onUpdateTypes = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update this group's types.");
            return
        }
        setLoadingActionMessage('Updating Group Types');
        const updateData = {
            "group_id": selectedGroup.id,
            "types": groupTypes
        };
        statsService.updateGroupTypesEvent(updateData);
        const result = await updateGroupTypes(updateData);
        if (!result) {
            alert(`Unable to update group types at this time. Please try again later.`);
            setLoadingActionMessage('');
            return;
        } else {
            toast(`Successfully updated group types.`);
        }

        //update groups home dispatch 
        const updatedGroup = { ...selectedGroup, groupTypes: groupTypes };
        setSelectedGroup(updatedGroup);
        const updatedAdminGroups = adminGroups.map((g: Group) => {
            if (selectedGroup?.id === g.id) return updatedGroup;
            return g;
        });
        setAdminGroups(updatedAdminGroups);
        setLoadingActionMessage('');
    }

    const onUpdateAmpGroups = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update this group's Amplify Group list.");
            return false;
        }
        setLoadingActionMessage('Updating Amplify Group List');
        const updateData = {
            "group_id": selectedGroup.id,
            "amplify_groups": groupAmpGroups
        };
        // statsService.updateGroupAmplifyGroupsEvent(updateData); 
        const result = await updateGroupAmplifyGroups(updateData);
        if (!result.success) {
            alert(`Unable to update amplify group list at this time. Please try again later.`);
            setLoadingActionMessage('');
            return false;;
        } else {
            toast(`Successfully updated Amplify group list.`);
        }

        //update groups home dispatch 
        const updatedGroup = { ...selectedGroup, amplifyGroups: groupAmpGroups };
        setSelectedGroup(updatedGroup);
        const updatedAdminGroups = adminGroups.map((g: Group) => {
            if (selectedGroup?.id === g.id) return updatedGroup;
            return g;
        });
        setAdminGroups(updatedAdminGroups);
        setLoadingActionMessage('');
        return true;
    }

    const onUpdateSystemUsers = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update this group's system users list.");
            return false;
        }
        setLoadingActionMessage('Updating System User List');
        const updateData = {
            "group_id": selectedGroup.id,
            "system_users": groupSystemUsers
        };
        // statsService.updateGroupSystemUsersEvent(updateData); 
        const result = await updateGroupSystemUsers(updateData);
        if (!result.success) {
            alert(`Unable to update the system users list at this time. Please try again later.`);
            setLoadingActionMessage('');
            return false;
        } else {
            toast(`Successfully updated group's system users list.`);
        }

        //update groups home dispatch 
        const updatedGroup = { ...selectedGroup, systemUsers: groupSystemUsers };
        setSelectedGroup(updatedGroup);
        const updatedAdminGroups = adminGroups.map((g: Group) => {
            if (selectedGroup?.id === g.id) return updatedGroup;
            return g;
        });
        setAdminGroups(updatedAdminGroups);
        setLoadingActionMessage('');
        return true;
    }


    function arraysEqual(a: string[], b: string[]) {
        return a.length === b.length && a.every(element => b.includes(element)) && b.every(element => a.includes(element));
    }

    const removeUserFromGroup = (groupId: string) => {
        const filteredAdminGroups = adminGroups.filter((g: Group) => g.id !== groupId);
        setAdminGroups(filteredAdminGroups);
        setSelectedGroup(filteredAdminGroups[0]);
        //update folders and prompts
        homeDispatch({ field: 'prompts', value: prompts.filter((p: Prompt) => p.groupId !== groupId) });
        homeDispatch({ field: 'folders', value: folders.filter((f: FolderInterface) => f.id !== groupId) });
        homeDispatch({ field: 'groups', value: groups.filter((g: Group) => g.id !== groupId) });

    }

    const handleDeleteGroup = async (groupId: string) => {
        if (!hasAdminAccess) {
            alert("You are not authorized to delete this group.");
            return;
        }

        if (confirm("Are you sure you want to delete this group? You will not be able to undo this change.\n\nWould you like to continue?")) {
            setLoadingActionMessage('Deleting Group');
            statsService.deleteAstAdminGroupEvent(groupId);
            const result = await deleteAstAdminGroup(groupId);

            if (result) {
                removeUserFromGroup(groupId);
                toast(`Successfully deleted group.`);
            } else {
                alert(`Unable to delete this group at this time. Please try again later.`);
            }
            setLoadingActionMessage('');
        }
    }

    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);
        let entriesWithGroupMembers: string[] = [];

        entries.forEach((e: any) => {
            if (e.startsWith('#')) {
                const group = groups.find((g: Group) => g.name === e.slice(1));
                if (group) entriesWithGroupMembers = [...entriesWithGroupMembers,
                ...Object.keys(group.members).filter((e: string) => e !== userEmail)];
            } else {
                entriesWithGroupMembers.push(e);
            }
        });

        const newEmails = entriesWithGroupMembers.filter(email => /^\S+@\S+\.\S+$/.test(email) && !Object.keys(newGroupMembers).includes(email)
            && !Object.keys(selectedGroup.members).includes(email)
        );
        setNewGroupMembers({ ...newGroupMembers, ...Object.fromEntries(newEmails.map(email => [email, GroupAccessType.READ])) } as Members);
        setInput('');
    };

    const addUsers = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to add users to the group.");
            return;
        }
        setLoadingActionMessage('Adding Users');

        const updateData = {
            "group_id": selectedGroup.id,
            "update_type": GroupUpdateType.ADD,
            "members": newGroupMembers
        };
        statsService.updateGroupMembersEvent(updateData);
        const result = await updateGroupMembers(updateData);
        if (result) {
            setIsAddingUsers(false);
            const newUserEntries = Object.entries(newGroupMembers).map(([email, accessLevel]) => ({
                name: email,
                dateAdded: getDateName(),
                accessLevel: accessLevel,
            }))
            setUsers([...users, ...newUserEntries]);
            //update groups 
            const updatedGroup = { ...selectedGroup, members: { ...selectedGroup.members, ...newGroupMembers } };
            setSelectedGroup(updatedGroup);
            const updatedAdminGroups = adminGroups.map((g: Group) => {
                if (selectedGroup?.id === g.id) return updatedGroup;
                return g;
            });
            setAdminGroups(updatedAdminGroups);
            setNewGroupMembers({});
            setInput('');
        }
        if (result) {
            toast(`Successfully added users to the group.`);
        } else {
            alert(`Unable to add users to the group at this time. Please try again later.`);
        }

        setLoadingActionMessage('');
    }

    const deleteUsers = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to delete users from the group.");
            return;
        }
        const removingSelfFromGroup = userEmail && deleteUsersList.includes(userEmail);
        if (removingSelfFromGroup) {
            if (!confirm("Are you sure you want to remove yourself from the group? You will no longer have access to the admin interface or group assistants. You will not be able to undo this change.\n\nWould you like to continue?")) return;
            removeUserFromGroup(selectedGroup.id);
        }
        setLoadingActionMessage('Deleting Users');
        const updateData = {
            "group_id": selectedGroup.id,
            "update_type": GroupUpdateType.REMOVE,
            "members": deleteUsersList
        }
        statsService.updateGroupMembersEvent(updateData);
        const result = await updateGroupMembers(updateData);

        if (result) {
            setIsDeleting(false);
            setUsers(users.filter((user: User) => !deleteUsersList.includes(user.name)));
            setAllGroupEmails([...(allEmails ?? []), ...deleteUsersList]);
            const updatedMembers = { ...selectedGroup.members };
            deleteUsersList.forEach(user => {
                delete updatedMembers[user]; // Remove the user from members
            });
            const updatedGroup = { ...selectedGroup, members: updatedMembers }
            //update groups 
            const updatedAdminGroups = adminGroups.reduce((acc: Group[], g: Group) => {
                if (removingSelfFromGroup && g.id === selectedGroup?.id) return acc;
                if (selectedGroup?.id === g.id) {
                    acc.push(updatedGroup);
                } else {
                    acc.push(g);
                }
                return acc;
            }, []);

            setAdminGroups(updatedAdminGroups);
            if (removingSelfFromGroup) {
                setSelectedGroup(updatedAdminGroups[0]);
            } else {
                setSelectedGroup(updatedGroup);
            }
            setDeleteUsersList([]);
        }
        setLoadingActionMessage('');

        if (result) {
            toast(`Successfully removed users from group.`);
        } else {
            alert(`Unable to remove users from the group at this time. Please try again later.`)

        }

    };

    const isSoleAdmin = (userEmail: string, privileges: Members) => {
        // Count the number of 'admin' users
        const adminCount = Object.values(privileges).filter(priv => priv === 'admin').length;
        // Return true if the count is exactly 1
        return adminCount === 0;
    }

    const editUsersAccess = async () => {
        if (!hasAdminAccess) {
            alert("You are not authorized to update user access to the group.");
            return;
        }
        let removingAdminInterfaceAccess = false;
        let removingAdminAceesToWrite = false;
        if (userEmail) {
            removingAdminInterfaceAccess = editAccessMap[userEmail] === GroupAccessType.READ;
            removingAdminAceesToWrite = editAccessMap[userEmail] === GroupAccessType.WRITE;

            const mergedMemberPerms = {} as Members;
            Object.keys(selectedGroup.members)
                .forEach((name: string) => {
                    if (editAccessMap.hasOwnProperty(name)) {
                        mergedMemberPerms[name] = editAccessMap[name];
                    } else {
                        mergedMemberPerms[name] = selectedGroup.members[name];
                    }

                });
            if ((removingAdminInterfaceAccess || removingAdminAceesToWrite) && isSoleAdmin(userEmail, mergedMemberPerms)) {
                alert("You are currently the only admin in the group, your admin access will be unchanged at this time. Please confirm updated user access changes again.");
                const { [userEmail]: _, ...newEditAccessMap } = editAccessMap;
                setEditAccessMap(newEditAccessMap);
                setUsers(prevUsers =>
                    prevUsers.map((u, i) =>
                        u.name === userEmail ? { ...u, accessLevel: GroupAccessType.ADMIN } : u
                    )
                );
                return;
            } else if (removingAdminInterfaceAccess) {
                if (!confirm("Please note, by setting your group access permissions to 'read', you will lose access to the group's assistant admin interface.\n\n Would you like to continue?")) return;
                // update prompts access 
                const updatedPrompts = prompts.map((p: Prompt) => {
                    if (p.groupId == selectedGroup.id) {
                        const newData = { ...p.data, noEdit: true };
                        return { ...p, data: newData };
                    }
                    return p;
                })
                homeDispatch({ field: 'prompts', value: updatedPrompts });

            } else if (removingAdminAceesToWrite && selectedGroup.members[userEmail] === GroupAccessType.ADMIN) {
                // if you are changing from admin to write but are not the only admin in the group.
                if (!confirm("Please note, by setting your group access permissions to 'write', you will no longer be able to make changes to the group itself; however, you will retain the ability to modify the group's assistants.\n\n Would you like to continue?")) return;
                setHasAdminAccess(false);
            }
        }
        setLoadingActionMessage('Updating Group Member Permissions');

        const permsData = {
            "group_id": selectedGroup.id,
            "affected_members": editAccessMap
        };

        statsService.updateGroupMembersPermissionsEvent(permsData);
        const result = await updateGroupMembersPermissions(permsData);

        if (result) {
            //update groups with edit access map, set users is already taken care of
            const updatedGroup = { ...selectedGroup, members: { ...selectedGroup.members, ...editAccessMap } };
            const updatedAdminGroups = adminGroups.reduce((acc: Group[], g: Group) => {
                if (removingAdminInterfaceAccess && g.id === selectedGroup?.id) return acc;
                if (selectedGroup?.id === g.id) {
                    acc.push(updatedGroup);
                } else {
                    acc.push(g);
                }
                return acc;
            }, []);

            setAdminGroups(updatedAdminGroups);
            if (removingAdminInterfaceAccess) {
                setSelectedGroup(updatedAdminGroups[0]);
            } else {
                setSelectedGroup(updatedGroup);
            }

            setEditAccessMap({});
            setIsEditingAccess(false);
        }
        if (result) {
            toast(`Successfully updated users group access.`);
        } else {
            alert(`Unable to update users group access at this time. Please try again later.`);
        }

        setLoadingActionMessage('');
    };

    return (
        <div key={selectedGroup.id} className="mt-[-50px] px-4 text-black dark:text-white"
            style={{ height: `${window.innerHeight * 0.78}px` }}
        >
            <h2 className="text-2xl font-bold">Group Management</h2>
            <div className='mt-4 overflow overflow-y-auto flex flex-col gap-4'>
                <GroupTypesAst
                    groupTypes={groupTypes}
                    setGroupTypes={setGroupTypes}
                    canAddTags={hasAdminAccess}
                    showControlButtons={!arraysEqual(groupTypes, selectedGroup.groupTypes)}
                    onConfirm={() => onUpdateTypes()}
                    onCancel={() => setGroupTypes(selectedGroup.groupTypes)}
                />

                {isAddingUsers &&
                    <AddMemberAccess
                        groupMembers={newGroupMembers}
                        setGroupMembers={setNewGroupMembers}
                        input={input}
                        setInput={setInput}
                        allEmails={allGroupEmails}
                        handleAddEmails={handleAddEmails}
                        width='840px'

                    />
                }
                <label className="font-bold">Group Members</label>

                <div className="flex justify-between gap-6 items-center">
                    <Search
                        placeholder={'Search...'}
                        searchTerm={searchTerm}
                        onSearch={(searchTerm: string) => {
                            setSearchTerm(searchTerm);
                            setUsers(users.filter((u: User) => u.name.startsWith(searchTerm)))
                        }
                        }
                        disabled={isDeleting}
                    />
                    <div className='ml-auto flex flex-row gap-1'>
                        {hasAdminAccess && <button
                            className="px-4 py-2 bg-blue-800 text-white hover:bg-blue-600 transition-colors"
                            onClick={() => setIsAddingUsers(true)}
                        >
                            Add Users
                        </button>}
                        {isAddingUsers && <div className=" flex flex-row gap-0.5 bg-neutral-200 dark:bg-[#343541]/90 w-[36px]">
                            <button
                                className="text-green-500 hover:text-green-700 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (Object.keys(newGroupMembers).length > 0) {
                                        addUsers();
                                    } else {
                                        setIsAddingUsers(false);
                                        setInput('');
                                    }
                                }}
                                title={"Add Users"}
                            >
                                <IconCheck size={16} />
                            </button>

                            <button
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingUsers(false);
                                    setNewGroupMembers({});
                                    setInput('');

                                }}
                                title={"Cancel"}
                            >
                                <IconX size={16} />
                            </button>
                        </div>}
                    </div>
                    {hasAdminAccess && <>
                        <UsersAction
                            condition={isDeleting}
                            label='Deleting Users'
                            title='Delete Users'
                            clickAction={() => {
                                setIsDeleting(true)
                                setSearchTerm('')
                            }}
                            onConfirm={() => {
                                if (deleteUsersList.length > 0) {
                                    deleteUsers();
                                } else {
                                    setIsDeleting(false);
                                }
                            }}
                            onCancel={() => {
                                setIsDeleting(false);
                                setDeleteUsersList([]);
                            }}
                        />

                        <UsersAction
                            condition={isEditingAccess}
                            label='Updating Users Access'
                            title='Update Users access'
                            clickAction={() => {
                                setIsEditingAccess(true)
                                setSearchTerm('')
                            }}
                            onConfirm={() => {
                                if (Object.keys(editAccessMap).length > 0) {
                                    editUsersAccess();
                                } else {
                                    setIsEditingAccess(false);
                                }
                            }}
                            onCancel={() => {
                                setUsers(usersmap);
                                setIsEditingAccess(false);
                                setEditAccessMap({});
                            }}

                        />
                    </>}

                </div>
                {isEditingAccess && accessInfoBox}

                {users.length === 0 ? <div className='ml-4'> No members to display</div> :
                    <div className='overflow-y-auto max-h-[300px]'>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    {isDeleting && <th className="py-2">{
                                        <input
                                            type="checkbox"
                                            title='Select All'
                                            checked={deleteUsersList.length === users.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    // If checked, add all user names to the list
                                                    setDeleteUsersList(users.map((user: User) => user.name));
                                                } else {
                                                    setDeleteUsersList([]);
                                                }

                                            }}
                                        />
                                    }</th>}
                                    <th className="border px-4 py-2">Name</th>
                                    {/* <th className="border px-4 py-2">Date Added</th> */}
                                    <th className="border px-4 py-2">Access Level</th>

                                </tr>
                            </thead>
                            <tbody>
                                {[...users].map((user, index) => (
                                    <tr key={index}>
                                        {isDeleting &&
                                            <td className="py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={deleteUsersList.includes(user.name)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            // Add user name to the list if checkbox is checked
                                                            setDeleteUsersList(prevList => [...prevList, user.name]);
                                                        } else {
                                                            // Remove user name from the list if checkbox is unchecked
                                                            setDeleteUsersList(prevList => prevList.filter(name => name !== user.name));
                                                        }
                                                    }}
                                                />
                                            </td>}
                                        <td className="border px-4 py-2">{user.name}
                                            <label className='ml-2 opacity-50'>{`${userEmail === user.name ? ' (You)' : ''}`}</label>
                                        </td>
                                        {/* <td className="border px-4 py-2">{user.dateAdded}</td> */}
                                        <td className={`border ${isEditingAccess ? '' : 'px-4 py-2'}`}>{
                                            isEditingAccess ? <AccessSelect
                                                access={user.accessLevel}
                                                setAccess={(newAccessLevel: GroupAccessType) => {
                                                    setUsers(prevUsers =>
                                                        prevUsers.map((u, i) =>
                                                            i === index ? { ...u, accessLevel: newAccessLevel } : u
                                                        )
                                                    );
                                                    setEditAccessMap({ ...editAccessMap, [user.name]: newAccessLevel })
                                                }} />
                                                : user.accessLevel
                                        }</td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                }

                <AmpGroupsSysUsersSelection
                    amplifyGroups={amplifyGroups}
                    selectedAmplifyGroups={groupAmpGroups}
                    setSelectedAmplifyGroups={setGroupAmpGroups}
                    systemUsers={availableSystemUsers}
                    selectedSystemUsers={groupSystemUsers}
                    setSelectedSystemUsers={setGroupSystemUsers}
                    onConfirmAmpGroups={onUpdateAmpGroups}
                    onCancelAmpGroups={() => setGroupAmpGroups(selectedGroup.amplifyGroups ?? [])}
                    onConfirmSystemUsers={onUpdateSystemUsers}
                    onCancelSystemUsers={() => setGroupSystemUsers(selectedGroup.systemUsers ?? [])}
                />

                {hasAdminAccess &&
                    <button
                        type="button"
                        className={`flex flex-row mt-auto gap-2 ml-auto mt-4 p-2 text-sm bg-neutral-500 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                        onClick={() => { handleDeleteGroup(selectedGroup.id) }}
                    >
                        <IconTrashX size={18} />
                        Delete Group
                    </button>
                }
            </div>
        </div>
    );
};

const subTabs = ['dashboard', 'conversations', 'edit_assistant', 'group'] as const;
export type SubTabType = typeof subTabs[number];

interface Props {
    open: boolean;
    openToGroup?: Group
    openToAssistant?: Prompt;
}

export const AssistantAdminUI: FC<Props> = ({ open, openToGroup, openToAssistant }) => {
    const { state: { featureFlags, statsService, groups, prompts, folders, syncingPrompts, amplifyUsers }, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user?.email ?? "";

    const onClose = () => {
        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', { detail: { isOpen: false } }));
    }

    const filteredForAdminAccess = (allGroups: Group[]) => {
        return allGroups.filter((g: Group) => [GroupAccessType.ADMIN, GroupAccessType.WRITE].includes(g.members[user]));
    }

    const [innderWindow, setInnerWindow] = useState({ height: window.innerHeight, width: window.innerWidth });

    const modalRef = useRef<HTMLDivElement>(null);

    const [loadingMessage, setLoadingMessage] = useState<string>('Loading Assistant Admin Interface...');
    const [loadingActionMessage, setLoadingActionMessage] = useState<string>('');


    const [adminGroups, setAdminGroups] = useState<Group[]>(groups.length > 0 ? filteredForAdminAccess(groups) : []);

    const [selectedGroup, setSelectedGroup] = useState<Group | undefined>(openToGroup || adminGroups[0]);
    const [selectedAssistant, setSelectedAssistant] = useState<Prompt | undefined>(openToAssistant || selectedGroup?.assistants[0]);

    const [activeAstTab, setActiveAstTab] = useState<string | undefined>(selectedAssistant?.data?.assistant?.definition.assistantId);
    const DEFAULT_SUB_TAB = 'dashboard' as SubTabType;
    const [activeSubTab, setActiveSubTab] = useState<SubTabType>(openToAssistant ? "edit_assistant" : DEFAULT_SUB_TAB);

    const [additionalGroupData, setAdditionalGroupData] = useState<any>({});

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);

    const [showCreateNewGroup, setShowCreateNewGroup] = useState<boolean>();
    const [showCreateGroupAssistant, setShowCreateGroupAssistant] = useState<string | null>(null);

    const fetchEmails = () => {
        const emailSuggestions = amplifyUsers;
        // add groups  #groupName
        const groupForMembers = groups.map((group: Group) => `#${group.name}`);
        return (emailSuggestions ? [...emailSuggestions,
        ...groupForMembers].filter((e: string) => e !== user) : []);
    };

    const allEmails: Array<string> = (fetchEmails());

    const [amplifyGroups, setAmplifyGroups] = useState<string[] | null>(null);
    const [systemUsers, setSystemUsers] = useState<string[] | null>(null);

    useEffect(() => {
        const updateInnerWindow = () => {
            setInnerWindow({ height: window.innerHeight, width: window.innerWidth });
        }
        // Listen to window resize to update the size
        window.addEventListener('resize', updateInnerWindow);
        return () => {
            window.removeEventListener('resize', updateInnerWindow);
        };
    }, []);

    useEffect(() => {
        const fetchAmpGroups = async () => {
            const ampGroupsResult = await getUserAmplifyGroups();
            setAmplifyGroups(ampGroupsResult.success ? ampGroupsResult.data : []);
            if (!ampGroupsResult.success) console.log("Failed to retrieve user amplify groups");
        }

        if (!amplifyGroups) fetchAmpGroups();

        const fetchSystemUsers = async () => {
            const apiSysIds = await fetchAllSystemIds();
            const sysIds: string[] = apiSysIds.map((k: any) => k.systemId).filter((k: any) => k);
            setSystemUsers(sysIds);
        }

        if (!systemUsers) fetchSystemUsers();

    }, [open]);

    useEffect(() => {
        setAdditionalGroupData({});
    }, [activeSubTab])

    useEffect(() => {
        setActiveAstTab(selectedAssistant?.data?.assistant?.definition.assistantId);
    }, [selectedAssistant])

    useEffect(() => {
        const nonAdminGroups = groups.filter((g: Group) => g.members[user] === GroupAccessType.READ);
        homeDispatch({ field: 'groups', value: [...adminGroups, ...nonAdminGroups] });
    }, [adminGroups]);

    const allAssistants = () => {
        return adminGroups.reduce((accumulator: Prompt[], group: Group) => {
            return accumulator.concat(group.assistants);
        }, []);
    }

    // if selectedGroup changes then set to conversation tab
    useEffect(() => {
        if (activeSubTab !== 'group') {
            if ((selectedAssistant && (selectedAssistant.groupId !== selectedGroup?.id || !(selectedGroup?.assistants.find((ast: Prompt) => ast?.data?.assistant?.definition.assistantId === selectedAssistant.data?.assistant?.definition.assistantId))))
                || (!selectedAssistant && (selectedGroup?.assistants && selectedGroup?.assistants.length > 0))) setSelectedAssistant(selectedGroup?.assistants[0]);
        }

    }, [selectedGroup]);

    useEffect(() => {
        if (selectedAssistant && activeSubTab === 'group') setActiveSubTab(DEFAULT_SUB_TAB)
    }, [selectedAssistant]);


    useEffect(() => {
        if (!syncingPrompts) {
            // needs a second for groups to catch up 
            setTimeout(() => {
                setAdminGroups((groups && groups.length > 0 ? filteredForAdminAccess(groups) : []));
                setLoadingMessage('');
            }, 1000);
        }
    }, [syncingPrompts]);


    useEffect(() => {
        const fetchConversations = async () => {
            if (open && selectedGroup && selectedAssistant && !!selectedGroup?.supportConvAnalysis) {
                setLoadingActionMessage('Fetching conversations...');
                const assistantId = selectedAssistant.data?.assistant?.definition.assistantId;
                // console.log('Assistant ID:', assistantId);
                if (assistantId) {
                    statsService.getGroupAssistantConversationsEvent(assistantId);
                    const result = await getGroupAssistantConversations(assistantId);
                    if (result.success) {
                        let conversationsData = result.data;
                        setConversations(Array.isArray(conversationsData) ? conversationsData : []);
                    } else {
                        // console.error('Failed to fetch conversations:', result.message);
                        setConversations([]);
                    }
                } else {
                    console.error('Assistant ID is undefined');
                }
                setLoadingActionMessage('');
            }
        };

        fetchConversations();
    }, [open, selectedAssistant]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (open && selectedGroup && selectedAssistant && !!selectedGroup?.supportConvAnalysis) {
                setLoadingActionMessage('Fetching dashboard data...');
                const assistantId = selectedAssistant.data?.assistant?.definition.assistantId;
                if (assistantId) {
                    statsService.getGroupAssistantDashboardsEvent(assistantId);
                    const result = await getGroupAssistantDashboards(assistantId);
                    if (result && result.success) {
                        setDashboardMetrics(result.data.dashboardData);
                    } else {
                        // console.error('Failed to fetch dashboard data:', result?.message || 'Unknown error');
                        setDashboardMetrics(null);
                    }
                } else {
                    console.error('Assistant ID is undefined');
                }
                setLoadingActionMessage('');
            }
        };

        fetchDashboardData();
    }, [open, selectedAssistant]);


    const groupCreate = async (group: any) => {
        console.log(group);
        if (!group.group_name) {
            alert("Group name is required. Please add a group name to create the group.");
            return;
        }
        if (group.group_name === AMPLIFY_ASSISTANTS_GROUP_NAME) {
            alert(`The group name ${AMPLIFY_ASSISTANTS_GROUP_NAME} isn't available. Please choose a different group name.`);
            return;
        }
        setLoadingMessage("Creating Group...");
        setShowCreateNewGroup(false);
        // ensure group name is unique 
        if (adminGroups.find((g: Group) => g.name == group.group_name)) {
            alert("Group name must be unique to all groups you are a member of.");
            return;
        } else {
            statsService.createAstAdminGroupEvent(group);
            const resultData = await createAstAdminGroup(group);
            if (!resultData) {
                alert("We are unable to create the group at this time. Please try again later.");
                setShowCreateNewGroup(true);
            } else {
                toast("Group successfully created.");
                const newGroup: Group = resultData;
                setSelectedGroup(newGroup);
                setAdminGroups([...adminGroups, newGroup]);
                // console.log("new group", newGroup)
                //update folders 
                const newGroupFolder = {
                    id: newGroup.id,
                    date: getDate(),
                    name: newGroup.name,
                    type: 'prompt',
                    isGroupFolder: true
                } as FolderInterface
                homeDispatch({ field: 'folders', value: [...folders, newGroupFolder] });

            }
            setLoadingMessage('');
        }
    }

    const handleCreateAssistantPrompt = (group: Group) => {
        const newPrompt = createEmptyPrompt('', group.id);

        const assistantDef: AssistantDefinition = {
            name: '',
            description: "",
            instructions: "",
            tools: [],
            tags: [],
            dataSources: [],
            version: 1,
            fileKeys: [],
            provider: AssistantProviderID.AMPLIFY,
            groupId: group.id
        }
        newPrompt.id = `${group.id}_${group.assistants.length}`;
        newPrompt.groupId = group.id;
        if (!newPrompt.data) newPrompt.data = {};
        if (!newPrompt.data.assistant) newPrompt.data.assistant = {};

        newPrompt.data.assistant.definition = assistantDef;
        return newPrompt
    }


    const handleCreateAssistant = async (astDef: AssistantDefinition, updateType: GroupUpdateType) => {
        // if (updateType === GroupUpdateType.ADD) setCurNewAstPrompt(null); 

        const updateAstData = { "group_id": selectedGroup?.id, "update_type": updateType, "assistants": [astDef] };
        statsService.updateGroupAssistantsEvent(updateAstData);
        const result = await updateGroupAssistants(updateAstData);
        return (result.success) ? result.assistantData[0]
            : {
                id: null,
                assistantId: null,
                provider: AssistantProviderID.AMPLIFY
            };
    }

    const handleDeleteAssistant = async (astpId: string) => {
        if (confirm("Are you sure you want to delete this assistant? You will not be able to undo this change.\n\nWould you like to continue?")) {
            setLoadingActionMessage('Deleting Assistant');

            const updateAstData = {
                "group_id": selectedGroup?.id,
                "update_type": GroupUpdateType.REMOVE,
                "assistants": [astpId]
            };
            statsService.updateGroupAssistantsEvent(updateAstData);
            const result = await updateGroupAssistants(updateAstData);
            if (result.success && selectedGroup) {
                toast("Successfully deleted assistant.");
                const updatedGroupAssistants = selectedGroup.assistants.filter((ast: Prompt) => ast?.data?.assistant?.definition.assistantId !== astpId);
                const updatedGroup = { ...selectedGroup, assistants: updatedGroupAssistants ?? [] };

                const updatedGroups = adminGroups.map((g: Group) => {
                    if (selectedGroup?.id === g.id) return updatedGroup;
                    return g;
                })
                setSelectedGroup(updatedGroup);
                setAdminGroups(updatedGroups);
                // update prompts 
                homeDispatch({ field: 'prompts', value: prompts.filter((ast: Prompt) => ast?.data?.assistant?.definition.assistantId !== astpId) });
            } else {
                alert("Unable to delete this assistant at this time. Please try again later.");
            }
            setLoadingActionMessage('');
        }
    }


    if (!open) {
        return null;
    }

    const formatLabel = (label: string) => {
        return String(label).replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    }

    const renderSubTabs = () => (
        <div className="flex flex-col w-full text-[1.05rem]">
            <div className="flex flex-row gap-6 mb-4 px-4 w-full">
                {subTabs.filter((t: SubTabType) => t !== 'conversations' || selectedGroup?.supportConvAnalysis)
                    .map((label: SubTabType) =>
                        label === 'group' ? (
                            <>
                                {selectedAssistant && selectedAssistant?.data?.assistant?.definition &&
                                    <>
                                        <button
                                            type="button"
                                            className={`flex flex-row gap-2 p-2 bg-neutral-200 dark:bg-gray-600  text-black dark:text-white hover:text-white dark:hover:bg-red-700 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                                            onClick={() => handleDeleteAssistant(selectedAssistant?.data?.assistant.definition.assistantId)}>

                                            Delete Assistant
                                        </button>
                                        <label className='ml-auto mt-2 text-sm flex flex-row gap-3 text-black dark:text-neutral-100'
                                        // title={"Use the assistant id in "}
                                        >
                                            <div className={`mt-1.5 ${selectedAssistant?.data?.isPublished ? "bg-green-400 dark:bg-green-300" : "bg-gray-400 dark:bg-gray-500"}`}
                                                style={{ width: '8px', height: '8px', borderRadius: '50%' }}></div>
                                            <div className='overflow-x-auto flex grow whitespace-nowrap'>
                                                Assistant Id: {selectedAssistant.data.assistant.definition.assistantId}
                                            </div>
                                        </label>
                                    </>
                                }
                                <button className={`${activeSubTab === label ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'} h-[36px] rounded-md ml-auto mr-[-16px] whitespace-nowrap`}
                                    key={label}
                                    onClick={() => {
                                        setActiveSubTab(label);
                                        setSelectedAssistant(undefined);
                                    }}
                                    title="Manage users and assistant group types"
                                >
                                    <div className={`flex flex-row gap-1 text-sm text-white px-2 bg-blue-500 hover:bg-blue-600 transition-colors py-2 rounded`}>
                                        <IconSettings className='mt-0.5' size={16} />
                                        Group Management
                                    </div>

                                </button>
                            </>
                        ) :
                            (selectedAssistant ? (
                                <button key={label} className={`${activeSubTab === label ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'} 
                                                        px-4 py-2 ${!selectedAssistant ? 'hidden' : 'visible'}`}
                                    onClick={() => setActiveSubTab(label)}>
                                    {formatLabel(label)}
                                </button>
                            ) : <></>)
                    )}
            </div>
        </div>

    );

    const renderContent = () => {
        switch (activeSubTab) {
            case 'conversations':
                return (selectedAssistant ? <ConversationTable
                    conversations={conversations}
                    // Check BOTH group-level permission and assistant-specific setting
                    supportConvAnalysis={!!selectedGroup?.supportConvAnalysis && !!selectedAssistant?.data?.supportConvAnalysis}
                /> : <></>);
            case 'dashboard':
                if (selectedGroup?.assistants.length === 0) return null;
                if (!selectedGroup?.supportConvAnalysis) return <div className='w-full text-center text-lg text-black dark:text-white'>
                    {"Access to dashboard metrics and assistant conversation history is not currently available for this group."}
                    <br></br>
                    To request access to these features, please reach out to Amplify for approval.
                </div>

                return (
                    selectedAssistant && dashboardMetrics ?
                        <Dashboard
                            metrics={dashboardMetrics}
                            supportConvAnalysis={!!selectedGroup?.supportConvAnalysis && !!selectedAssistant?.data?.supportConvAnalysis}
                        /> :
                        <div className="text-black dark:text-white">
                            No dashboard data available for {selectedAssistant?.name}
                            (Assistant ID: {selectedAssistant?.data?.assistant?.definition.assistantId})
                        </div>
                );


            case 'edit_assistant':
                return (selectedAssistant && !showCreateGroupAssistant ? <div key="admin_edit">
                    <AssistantModal
                        assistant={selectedAssistant}
                        onSave={() => { }}
                        onCancel={() => setActiveSubTab(DEFAULT_SUB_TAB)}
                        onUpdateAssistant={(astprompt: Prompt) => {

                            setAdditionalGroupData({});
                            if (selectedGroup) {
                                astprompt.groupId = selectedGroup?.id;
                                astprompt.folderId = selectedGroup?.id;
                                const updatedAssistants = selectedGroup?.assistants.map((ast: Prompt) => {
                                    if (ast.data?.assistant?.definition.assistantId === astprompt.data?.assistant?.definition.assistantId) {
                                        astprompt.data = { ...astprompt?.data, noEdit: false };
                                        return astprompt;
                                    }
                                    return ast;
                                })
                                setSelectedAssistant(astprompt);
                                const updatedGroup = { ...selectedGroup, assistants: updatedAssistants ?? [] }
                                const updatedGroups = adminGroups.map((g: Group) => {
                                    if (selectedAssistant?.groupId === g.id) return updatedGroup;
                                    return g;
                                })
                                setSelectedGroup(updatedGroup);
                                setAdminGroups(updatedGroups);
                                console.log(astprompt);

                                statsService.createPromptEvent(astprompt);
                                // update prompt
                                const updatedPrompts: Prompt[] = prompts.map((curPrompt: Prompt) => {
                                    if (curPrompt?.data?.assistant?.definition.assistantId ===
                                        astprompt.data?.assistant?.definition.assistantId) return astprompt;
                                    return curPrompt;
                                });
                                homeDispatch({ field: 'prompts', value: updatedPrompts });
                                setActiveSubTab('edit_assistant');
                            } else {
                                alert("Something went wrong, please close and reopen the admin interface before trying again.")
                            }

                        }}
                        loadingMessage={`Updating Assistant '${selectedAssistant.name}'...`}
                        disableEdit={!!showCreateGroupAssistant}
                        loc={"admin_update"}
                        //  title={selectedGroup?.name + " Assistant"}
                        width={`${innderWindow.width - 140}px`}
                        height={`${(innderWindow.height * 0.76) - 165}px`}
                        translateY={'-5%'}
                        embed={true}
                        blackoutBackground={false}
                        additionalGroupData={additionalGroupData}
                        onCreateAssistant={(astDef: AssistantDefinition) => { return handleCreateAssistant(astDef, GroupUpdateType.UPDATE) }}
                    >
                        <AssistantModalConfigs
                            groupId={selectedGroup?.id || '_'}
                            astId={selectedAssistant.id}
                            astData={selectedAssistant?.data}
                            groupTypes={selectedGroup?.groupTypes}
                            additionalGroupData={additionalGroupData}
                            setAdditionalGroupData={setAdditionalGroupData}
                            groupConvAnalysisSupport={!!selectedGroup?.supportConvAnalysis}

                        />
                    </AssistantModal>
                </div>
                    : <></>)

            case 'group':
                return selectedGroup ? <GroupManagement
                    selectedGroup={selectedGroup}
                    setSelectedGroup={setSelectedGroup}
                    members={selectedGroup?.members ?? {}}
                    allEmails={allEmails?.filter((e: string) => e !== `#${selectedGroup.name}` && !Object.keys(selectedGroup.members).includes(e)) || []}
                    setLoadingActionMessage={setLoadingActionMessage}
                    adminGroups={adminGroups}
                    setAdminGroups={setAdminGroups}
                    amplifyGroups={amplifyGroups ?? []}
                    systemUsers={systemUsers ?? []}
                />
                    : null;
            default:
                return null;
        }
    };

    return featureFlags.createAstAdminGroups && !loadingMessage &&
        (adminGroups.length === 0 || showCreateNewGroup) ?
        // Allow the option to create a new group if user has no group where they have either admin or write access. 
        (
            <CreateAdminDialog
                createGroup={groupCreate}
                onClose={onClose} // note clear for built in one
                allEmails={allEmails}
                message={adminGroups.length === 0 ? "You currently do not have admin access to any groups." : ""}
                amplifyGroups={amplifyGroups ?? []}
                systemUsers={systemUsers ?? []}
            />
        ) :
        // User has groups 
        (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20" key={"ast_admin_ui"}>
                <div className="fixed inset-0 z-10 overflow-hidden">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true" />
                        <LoadingDialog open={!!loadingMessage} message={loadingMessage} />
                        <div
                            ref={modalRef} key={selectedGroup?.id}
                            className="inline-block transform rounded-lg border border-gray-300 dark:border-neutral-600 bg-neutral-100 px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:min-h-[636px] sm:w-full sm:p-4 sm:align-middle"
                            style={{ width: `${innderWindow.width - 100}px`, height: `${innderWindow.height * 0.95}px` }}
                            role="dialog"
                        >
                            {loadingActionMessage && (
                                <div className="absolute inset-0 flex items-center justify-center z-60" key={"loading"}
                                    style={{ transform: `translateY(-40%)` }}>
                                    <div className="p-3 flex flex-row items-center  border border-gray-500 bg-[#202123]">
                                        <LoadingIcon style={{ width: "24px", height: "24px" }} />
                                        <span className="text-lg font-bold ml-2 text-white">{loadingActionMessage + '...'}</span>
                                    </div>
                                </div>
                            )
                            }
                            {selectedGroup && showCreateGroupAssistant && (
                                <div key={'admin_add'}>
                                    <AssistantModal
                                        assistant={handleCreateAssistantPrompt(selectedGroup)}
                                        onSave={() => {
                                        }}
                                        onCancel={() => {
                                            setAdditionalGroupData({});
                                            setShowCreateGroupAssistant(null);
                                        }}
                                        onUpdateAssistant={(astprompt: Prompt) => {

                                            setAdditionalGroupData({});
                                            astprompt.groupId = selectedGroup.id;
                                            astprompt.folderId = selectedGroup.id;
                                            astprompt.data = { ...astprompt?.data, noEdit: false };
                                            setSelectedAssistant(astprompt);
                                            const updatedGroup = { ...selectedGroup, assistants: [...selectedGroup.assistants ?? [], astprompt] };
                                            const updatedGroups = adminGroups.map((g: Group) => {
                                                if (astprompt?.groupId === g.id) return updatedGroup;
                                                return g;
                                            })
                                            setSelectedGroup(updatedGroup);
                                            setAdminGroups(updatedGroups);
                                            console.log(astprompt);

                                            statsService.createPromptEvent(astprompt);

                                            // update prompts
                                            homeDispatch({ field: 'prompts', value: [...prompts, astprompt] });
                                            setShowCreateGroupAssistant(null);
                                            setActiveSubTab('edit_assistant');
                                        }}

                                        loadingMessage={`Creating Assistant for Group '${selectedGroup.name}'`}
                                        loc={"admin_add"}
                                        title={`Creating New Assistant for ${selectedGroup.name}`}
                                        height={`${innderWindow.height * 0.7}px`}
                                        additionalTemplates={allAssistants()}
                                        autofillOn={true}
                                        translateY='-4%'
                                        additionalGroupData={additionalGroupData}
                                        onCreateAssistant={(astDef: AssistantDefinition) => { return handleCreateAssistant(astDef, GroupUpdateType.ADD) }}
                                    >

                                        <AssistantModalConfigs
                                            groupId={selectedGroup.id}
                                            astId={`${selectedGroup.id}_${selectedGroup.assistants.length}`}
                                            groupTypes={selectedGroup.groupTypes}
                                            additionalGroupData={additionalGroupData}
                                            setAdditionalGroupData={setAdditionalGroupData}
                                            groupConvAnalysisSupport={!!selectedGroup.supportConvAnalysis}
                                        />
                                    </AssistantModal>

                                </div>

                            )}
                            <div className='flex flex-row gap-2' key={`${selectedGroup?.id}_GroupSelect`}>
                                <GroupSelect
                                    groups={adminGroups}
                                    selectedGroup={selectedGroup}
                                    setSelectedGroup={setSelectedGroup}
                                    setShowCreateNewGroup={setShowCreateNewGroup}
                                />
                                <div className='w-[26px]'>
                                    <div className='absolute top-5 right-2'>
                                        <ActionButton
                                            handleClick={onClose}
                                            title="Close"
                                        >
                                            <IconX size={28} />
                                        </ActionButton>
                                    </div>
                                </div>


                            </div>


                            {selectedGroup &&
                                <>
                                    <div key={`${selectedGroup?.id}_Assistants`}>
                                        <div className="mb-4 flex flex-row items-center justify-between bg-transparent rounded-t border-b border-neutral-400  dark:border-white/20">
                                            {selectedGroup.assistants.length === 0 && <label className='text-center text-black dark:text-white text-lg'
                                                style={{ width: `${innderWindow.width * 0.75}px` }}>
                                                You currently do not have any assistants in this group. </label>}

                                            <div className="overflow-y-auto">
                                                <div className="flex flex-row gap-1">
                                                    {selectedGroup.assistants.length > 0 && selectedGroup.assistants.map((ast: Prompt) => (
                                                        <button
                                                            key={ast.name}
                                                            onClick={() => {
                                                                setSelectedAssistant(ast)
                                                                setActiveSubTab(DEFAULT_SUB_TAB);
                                                            }}
                                                            title={selectedAssistant?.data?.isPublished ? 'Published' : 'Unpublished'}
                                                            className={`p-2 rounded-t flex flex-shrink-0 ${activeAstTab && activeAstTab === ast.data?.assistant?.definition.assistantId ? 'border-l border-t border-r border-neutral-400 text-black dark:border-gray-500 dark:text-white shadow-[2px_0_1px_rgba(0,0,0,0.1),-2px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}
                                                        >
                                                            <h3 className="text-xl">{ast.name.charAt(0).toUpperCase() + ast.name.slice(1)}</h3>
                                                        </button>

                                                    ))
                                                    }
                                                </div>
                                            </div>

                                            <div className="flex items-center">
                                                <button
                                                    className="flex flex-row ml-auto px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowCreateGroupAssistant(selectedGroup.name);
                                                    }}
                                                >
                                                    <IconPlus className='mt-0.5 mr-2' size={16} /> Create Assistant
                                                </button>
                                            </div>
                                        </div>
                                        <div className='overflow-y-auto' style={{ maxHeight: 'calc(100% - 60px)' }}>
                                            {renderSubTabs()}
                                            {renderContent()}
                                        </div>
                                    </div>
                                </>
                            }

                        </div>
                    </div>
                </div>
            </div>
        );
};


interface CreateProps {
    createGroup: (groupData: any) => void;
    onClose: () => void;
    allEmails: Array<string> | null;
    message: string;
    amplifyGroups: string[];
    systemUsers: string[];
}


export const CreateAdminDialog: FC<CreateProps> = ({ createGroup, onClose, allEmails, message, amplifyGroups, systemUsers }) => {
    const { state: { statsService, groups }, dispatch: homeDispatch } = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user?.email;

    const [input, setInput] = useState<string>('');

    const [groupName, setGroupName] = useState<string>('');
    const [groupMembers, setGroupMembers] = useState<Members>({});

    const [groupTypes, setGroupTypes] = useState<string[]>([]);
    const [groupAmpGroups, setGroupAmpGroups] = useState<string[]>([]);
    const [groupSystemUsers, setGroupSystemUsers] = useState<string[]>([]);

    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);
        let entriesWithGroupMembers: string[] = [];

        entries.forEach((e: any) => {
            if (e.startsWith('#')) {
                const group = groups.find((g: Group) => g.name === e.slice(1));
                if (group) entriesWithGroupMembers = [...entriesWithGroupMembers,
                ...Object.keys(group.members).filter((e: string) => e !== user)];
            } else {
                entriesWithGroupMembers.push(e);
            }
        });

        const newEmails = entriesWithGroupMembers.filter(email => /^\S+@\S+\.\S+$/.test(email) && !Object.keys(groupMembers).includes(email));
        setGroupMembers({ ...groupMembers, ...Object.fromEntries(newEmails.map(email => [email, GroupAccessType.READ])) } as Members);
        setInput('');
    };


    return (
        <Modal
            width={() => window.innerWidth * 0.7}
            height={() => window.innerHeight * 0.92}
            title={"Assistant Admin Interface "}
            onCancel={() => {
                onClose()
            }}
            onSubmit={() =>
                createGroup({
                    group_name: groupName,
                    members: { ...groupMembers, [user as string]: GroupAccessType.ADMIN },
                    types: groupTypes,
                    amplify_groups: groupAmpGroups,
                    system_users: groupSystemUsers
                })
            }
            submitLabel={"Create Group"}
            content={
                <div className='mr-2'>
                    {"You will be able to manage assistants and view key metrics related to user engagement and conversation."}
                    <div className="text-sm mb-4 text-black dark:text-neutral-200">{message}</div>

                    <div className='flex flex-col gap-3 font-bold '>
                        <>
                            Group Name

                            <textarea
                                className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{ resize: 'none' }}
                                placeholder={`Group Name`}
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                rows={1}
                            />
                        </>

                        <GroupTypesAst
                            groupTypes={groupTypes}
                            setGroupTypes={setGroupTypes}
                        />
                        <div className='my-2'>
                            <AddMemberAccess
                                groupMembers={groupMembers}
                                setGroupMembers={setGroupMembers}
                                input={input}
                                setInput={setInput}
                                allEmails={allEmails}
                                handleAddEmails={handleAddEmails}
                            />
                        </div>
                        <AmpGroupsSysUsersSelection
                            amplifyGroups={amplifyGroups}
                            selectedAmplifyGroups={groupAmpGroups}
                            setSelectedAmplifyGroups={setGroupAmpGroups}
                            systemUsers={systemUsers}
                            selectedSystemUsers={groupSystemUsers}
                            setSelectedSystemUsers={setGroupSystemUsers}
                        />
                    </div>

                </div>
            }
        />
    )

}




interface MemberAccessProps {
    groupMembers: Members;
    setGroupMembers: (m: Members) => void;
    input: string;
    setInput: (s: string) => void;
    allEmails: Array<string> | null;
    handleAddEmails: () => void;
    width?: string;


}

const accessInfoBox = <InfoBox content={
    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
        <label className='font-bold text-[0.8rem]'> Read Access </label>
        can view assistants in the prompt bar and engage in conversation. They do not have access to the admin interface.
        <br className='mb-2'></br>
        <label className='font-bold text-[0.8rem'> Write Access </label>
        have the ability to view and chat with assistants. They can also create and edit assistants and have access to the admin interface.
        <br className='mb-2'></br>
        <label className='font-bold text-[0.8rem'> Admin Access </label> have full administrative control. They can delete the group, manage members, and modify access levels. Admins are responsible for all aspects of group management and inherit all permissions from above.

    </span>}
/>

const AddMemberAccess: FC<MemberAccessProps> = ({ groupMembers, setGroupMembers, input, setInput, allEmails, handleAddEmails, width = '500px' }) => {
    const [hoveredUser, setHoveredUser] = useState<string | null>(null);


    const handleRemoveUser = (email: string) => {
        const updatedMembers = { ...groupMembers };
        delete updatedMembers[email];
        setGroupMembers(updatedMembers);
    }

    return <div className='flex flex-col gap-2 mb-6'>
        <label className='font-bold'>Add Members </label>
        {accessInfoBox}
        <label className='text-sm font-normal'>List group members and their permission levels.</label>
        <>{includeGroupInfoBox}</>
        <div className='flex flex-row gap-2'>
            <div className="flex-shrink-0 ml-[-6px] mr-2">
                <button
                    type="button"
                    title='Add Members'
                    className="ml-2 mt-1 px-3 py-1.5 text-white rounded bg-neutral-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
                    onClick={handleAddEmails}
                >
                    <IconPlus size={18} />
                </button>
            </div>
            <div className='w-full relative'>
                <EmailsAutoComplete
                    input={input}
                    setInput={setInput}
                    allEmails={allEmails}
                    alreadyAddedEmails={Object.keys(groupMembers)}
                />
            </div>

        </div>

        {Object.keys(groupMembers).length > 0 &&
            <div>
                Set Member Access
                <table className="mt-2 w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border px-4 py-2">User</th>
                            <th className="border px-4 py-2">Access</th>
                        </tr>
                    </thead>
                    <tbody>

                        {Object.entries(groupMembers).map(([email, access]) => (
                            <tr key={email}>
                                <td className="border px-4 py-2 " style={{ width: width }}>
                                    <div className='flex items-center  '
                                        onMouseEnter={() => {
                                            setHoveredUser(email)
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredUser(null)
                                        }}
                                    >
                                        {email}
                                        {hoveredUser === email &&
                                            <button
                                                type="button"
                                                className={`ml-auto p-0.5 text-sm bg-neutral-500 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                                                onClick={() => handleRemoveUser(email)}
                                            >
                                                <IconTrashX size={16} />
                                            </button>}
                                    </div>


                                </td>
                                <td className={`border`}>{
                                    <AccessSelect
                                        access={access}
                                        setAccess={(newAccessLevel: GroupAccessType) => {
                                            setGroupMembers({ ...groupMembers, [email]: newAccessLevel })
                                        }} />
                                }</td>
                            </tr>
                        ))}

                    </tbody>
                </table>

            </div>}
    </div>
}

interface AmpSysSelectionProps {
    amplifyGroups: string[];
    selectedAmplifyGroups: string[];
    setSelectedAmplifyGroups: (selectedGroups: string[]) => void;
    systemUsers: string[];
    selectedSystemUsers: string[];
    setSelectedSystemUsers: (selectedGroups: string[]) => void;

    onConfirmAmpGroups?: () => Promise<boolean>;
    onCancelAmpGroups?: () => void;
    onConfirmSystemUsers?: () => Promise<boolean>;
    onCancelSystemUsers?: () => void;

}
const AmpGroupsSysUsersSelection: FC<AmpSysSelectionProps> = ({ amplifyGroups, selectedAmplifyGroups, setSelectedAmplifyGroups,
    systemUsers, selectedSystemUsers, setSelectedSystemUsers,
    onConfirmAmpGroups, onCancelAmpGroups,
    onConfirmSystemUsers, onCancelSystemUsers
}) => {
    const [isUpdatingAmpGroups, setIsUpdatingAmpGroups] = useState<boolean>(false);
    const [isUpdatingSystemUsers, setIsUpdatingSystemUsers] = useState<boolean>(false);
    const manageAmpGroupChanges = (!!onConfirmAmpGroups);
    const manageSystemUserChanges = (!!onConfirmSystemUsers);

    const onAcceptAmpGroups = async () => {
        if (onConfirmAmpGroups) {
            const sucess = await onConfirmAmpGroups();
            if (sucess) setIsUpdatingAmpGroups(false);
        }
    }

    const onAcceptSystemUsers = async () => {
        if (onConfirmSystemUsers) {
            const sucess = await onConfirmSystemUsers();
            if (sucess) setIsUpdatingSystemUsers(false);
        }
    }

    const manageChanges = (onConfirm: () => void, onCancel: () => void) => {
        return <div className="mr-3 mt-1.5 flex flex-row gap-1 h-[20px]">
            <button
                className="text-green-500 hover:text-green-700 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onConfirm();
                }}
                title={"Confirm Changes"}
            >
                <IconCheck size={18} />
            </button>

            <button
                className="text-red-500 hover:text-red-700 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                }}
                title={"Cancel"}
            >
                <IconX size={18} />
            </button>
        </div>
    }

    return (
        <div className='mb-6'>
            {amplifyGroups.length > 0 &&
                <ListSelection
                    title="Amplify Group Access"
                    infoLabel="Grant read access to users who are members of the following Amplify Groups. These users will not appear under the Group Members list."
                    selection={amplifyGroups}
                    selected={selectedAmplifyGroups}
                    setSelected={(selected: string[]) => {
                        setSelectedAmplifyGroups(selected);
                        if (manageAmpGroupChanges) setIsUpdatingAmpGroups(true);
                    }}
                    manageButtons={manageAmpGroupChanges && isUpdatingAmpGroups ?
                        <div>{manageChanges(onAcceptAmpGroups, () => {
                            if (onCancelAmpGroups) onCancelAmpGroups();
                            setIsUpdatingAmpGroups(false);
                        })}
                        </div> : <></>}
                />}
            {systemUsers.length > 0 &&
                <ListSelection
                    title='System User Access'
                    infoLabel='Grant read access to your API created system users.'
                    label='System Users'
                    selection={systemUsers}
                    selected={selectedSystemUsers}
                    setSelected={(selected: string[]) => {
                        setSelectedSystemUsers(selected);
                        if (manageSystemUserChanges) setIsUpdatingSystemUsers(true);
                    }}
                    manageButtons={manageSystemUserChanges && isUpdatingSystemUsers ?
                        <div> {manageChanges(onAcceptSystemUsers, () => {
                            if (onCancelSystemUsers) onCancelSystemUsers();
                            setIsUpdatingSystemUsers(false);
                        })}
                        </div> : <></>}
                />}

        </div>
    );
}

interface SelectionProps {
    title: string;
    infoLabel: string;
    selection: string[];
    selected: string[];
    setSelected: (selectedGroups: string[]) => void;
    manageButtons?: ReactElement;
    label?: string;
}
const ListSelection: FC<SelectionProps> = ({ title, infoLabel, selection, selected, setSelected, manageButtons = null, label}) => {
    return (
        <div className='mb-6 px-1'>
            <div className='mb-1 font-bold'>{title}</div>
            <InfoBox content={
                <>
                    <span className="ml-1 text-xs w-full text-center"> {infoLabel} </span>
                    <div className='ml-auto'>{manageButtons}</div>
                    {!!manageButtons}
                </>
            } />

            <AmplifyGroupSelect
                groups={selection}
                selected={selected}
                setSelected={setSelected}
                label={label}
            />
        </div>
    );
}


interface AccessProps {
    access: GroupAccessType;
    setAccess: (t: GroupAccessType) => void;
}

const AccessSelect: FC<AccessProps> = ({ access, setAccess }) => {

    return (
        <select className={"w-full text-center border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"}
            value={access}
            title='Select Access Type'
            onChange={(event) => {
                setAccess(event.target.value as GroupAccessType);
            }}
        >
            {[GroupAccessType.ADMIN, GroupAccessType.READ, GroupAccessType.WRITE].map((accessType: GroupAccessType) => (
                <option key={accessType} value={accessType}>
                    {accessType}
                </option>
            ))}
        </select>
    )
}

interface SelectProps {
    groups: Group[];
    selectedGroup: Group | undefined;
    setSelectedGroup: (g: Group) => void;
    setShowCreateNewGroup: (e: boolean) => void;
}

export const GroupSelect: FC<SelectProps> = ({ groups, selectedGroup, setSelectedGroup, setShowCreateNewGroup }) => {
    const { state: { featureFlags }, dispatch: homeDispatch } = useContext(HomeContext);

    return (
        <select className={"mb-2 w-full text-xl text-center rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100  custom-shadow"}
            value={selectedGroup?.name ?? ''}
            title='Select Group'
            onChange={(event) => {
                if (event.target.value === GroupUpdateType.ADD) {
                    setShowCreateNewGroup(true);
                } else {
                    const selectedAccount = groups.find(group => group.name === event.target.value);
                    if (selectedAccount) setSelectedGroup(selectedAccount);
                }
            }}
        >
            {groups.map((group) => (
                <option key={group.id} value={group.name}>
                    {group.name}
                </option>
            ))}
            {featureFlags.createAstAdminGroups &&
                <option value={GroupUpdateType.ADD}>
                    {"+ Create New Group"}
                </option>
            }
        </select>

    );
}


interface ActionProps {
    condition: boolean;
    label: string;
    title: string;
    clickAction: () => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export const UsersAction: FC<ActionProps> = ({ condition, label, title, clickAction, onConfirm, onCancel }) => {

    return (condition ? (
        <div className="flex flex-row gap-1">
            <label className={`px-4 py-2 text-white  bg-gray-700`}>  {label}</label>
            <div className="flex flex-row gap-0.5 bg-neutral-200 dark:bg-[#343541]/90 ">
                <button
                    className="text-green-500 hover:text-green-700 cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onConfirm();
                    }}

                    title={title}
                >
                    <IconCheck size={16} />
                </button>

                <button
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCancel();

                    }}
                    title={"Cancel"}
                >
                    <IconX size={16} />
                </button>
            </div>
        </div>
    ) : (
        <button
            className={`px-4 py-2 bg-blue-800 text-white  hover:bg-blue-600 transition-colors`}
            onClick={clickAction}
        >
            {title}
        </button>
    )
    )
}

interface AssistantModalProps {
    groupId: string;
    astId: string;
    astData?: any;
    groupTypes?: string[];
    additionalGroupData: any;
    setAdditionalGroupData: (data: any) => void;
    groupConvAnalysisSupport: boolean;
}

// To add more configuarations to the assistant, add components here and ensure the change is set in additionalGroupData
export const AssistantModalConfigs: FC<AssistantModalProps> = ({ groupId, astId, astData = {}, groupTypes = [], additionalGroupData, setAdditionalGroupData, groupConvAnalysisSupport }) => {
    const {
        state: { availableModels }
    } = useContext(HomeContext);
    const [isPublished, setIsPublished] = useState<boolean>(astData.isPublished ?? false);
    const [enforceModel, setEnforceModel] = useState<boolean>(!!astData.model);
    const [trackConversations, setTrackConversations] = useState<boolean>(astData.trackConversations ?? false);
    const [showTrackingRequiredMessage, setShowTrackingRequiredMessage] = useState<boolean>(false);
    const [astSupportConvAnalysis, setAstSupportConvAnalysis] = useState<boolean>(astData.supportConvAnalysis ?? false);
    const [analysisCategories, setAnalysisCategories] = useState<string[]>(astData.analysisCategories ?? []);

    // Hide the message after 3 seconds when it's shown
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (showTrackingRequiredMessage) {
            timeout = setTimeout(() => {
                setShowTrackingRequiredMessage(false);
            }, 3000);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [showTrackingRequiredMessage]);

    const updateCategories = (categories: string[]) => {
        setAnalysisCategories(categories);
        setAdditionalGroupData({ ...additionalGroupData, analysisCategories: categories });
    }

    const checkAvailableModel = () => {
        const isValid = checkAvailableModelId(astData.model, availableModels);
        return isValid;
    }

    const onSupportConvAnalysisChange = (isChecked: boolean) => {
        setAdditionalGroupData({
            ...additionalGroupData,
            supportConvAnalysis: isChecked,
            // Ensure trackConversations is also enabled when supportConvAnalysis is enabled
            trackConversations: isChecked ? true : additionalGroupData.trackConversations
        });

        setAstSupportConvAnalysis(isChecked);

        // If enabling analysis, also enable tracking if it's not already enabled
        if (isChecked && !trackConversations) {
            setTrackConversations(true);
        }
    };

    return <div className='flex flex-col' key={astId}>
        <div className='mb-4 flex flex-row gap-3 text-[1.05rem]'>
            <Checkbox
                id="publishAssistant"
                label="Publish assistant to read-access members"
                checked={isPublished}
                onChange={(isChecked: boolean) => {
                    setAdditionalGroupData({ ...additionalGroupData, isPublished: isChecked });

                    setIsPublished(isChecked);
                }}
            />
        </div>
        <div className='mb-1 flex flex-row gap-3 text-[1rem]'>
            <Checkbox
                id="enforceModel"
                label="Enforce Model"
                checked={enforceModel}
                onChange={(isChecked: boolean) => {
                    if (!isChecked) {
                        setAdditionalGroupData({ ...additionalGroupData, model: undefined });
                    } else if (astData.model) setAdditionalGroupData({ ...additionalGroupData, model: astData.model });

                    setEnforceModel(isChecked);
                }}
            />
        </div>
        <div className={`ml-6 flex flex-col ${enforceModel ? "" : 'opacity-40'} `}>
            All conversations will be set to this model and unable to be changed by the user.
            <ModelSelect
                applyModelFilter={false}
                isTitled={false}
                modelId={checkAvailableModel()}
                outlineColor={enforceModel && !additionalGroupData.model ? 'red-500' : ''}
                isDisabled={!enforceModel}
                disableMessage=''
                handleModelChange={(model: string) => {
                    setAdditionalGroupData({ ...additionalGroupData, model: model });
                }}
            />
        </div>

        {groupConvAnalysisSupport && <>
            <div className='mt-4 flex flex-row gap-3 text-[1.05rem]'>
                <Checkbox
                    id="trackConversations"
                    label="Track Conversations"
                    checked={trackConversations || astSupportConvAnalysis}
                    onChange={(isChecked: boolean) => {
                        // Only allow changes if analysis support is not enabled
                        // This prevents unchecking when analysis is enabled
                        if (!astSupportConvAnalysis || isChecked) {
                            setAdditionalGroupData({ ...additionalGroupData, trackConversations: isChecked });
                            setTrackConversations(isChecked);
                        } else {
                            // Show the notification message when trying to uncheck while analysis is enabled
                            setShowTrackingRequiredMessage(true);
                        }
                    }}
                />
            </div>
            <div className={`ml-6 flex flex-col ${trackConversations || astSupportConvAnalysis ? "" : 'opacity-40'}`}>
                Enable the dashboard and conversation tracking with this assistant for monitoring and review purposes.
                {astSupportConvAnalysis &&
                    <div className={`text-amber-500 mt-1 transition-opacity duration-300 ${showTrackingRequiredMessage ? 'opacity-100' : 'opacity-70'}`}>
                        <small>
                            {showTrackingRequiredMessage
                                ? "Track Conversations is required when Analyze Conversations is enabled"
                                : "Automatically enabled when Analyze Conversations is active"}
                        </small>
                    </div>
                }
            </div>

            <div className='mt-4 flex flex-row gap-3 text-[1rem]'>
                <Checkbox
                    id="supportAnalysis"
                    label="Analyze Conversations"
                    checked={astSupportConvAnalysis}
                    onChange={onSupportConvAnalysisChange}
                />
            </div>
            <div className={`ml-6 flex flex-col ${astSupportConvAnalysis ? "" : 'opacity-40'}`}>
                Enable AI-powered categorization of user interactions.
                <br></br>
                {"Define custom categories to classify interactions and evaluate the assistant's performance for quality, relevance, and effectiveness."}
                <br className='mb-2'></br>
                <ExpansionComponent
                    title='Manage Category List'
                    content={
                        <TagsList label={"Categories"}
                            addMessage={"List categories separated by commas:"}
                            tags={analysisCategories}
                            setTags={(categories) => updateCategories(categories)}
                            removeTag={(category) => updateCategories(analysisCategories.filter((t: string) => t !== category))}
                            isDisabled={!astSupportConvAnalysis} />
                    }
                />
            </div>
        </>}
        <br className='mb-1'></br>
        <GroupTypesAstData
            groupId={groupId}
            astPromptId={astId}
            assistantGroupData={astData.groupTypeData ?? {}}
            groupUserTypeQuestion={astData.groupUserTypeQuestion}
            groupTypes={groupTypes}
            additionalGroupData={additionalGroupData}
            setAdditionalGroupData={setAdditionalGroupData}
        />
    </div>
}

interface TypeProps {
    groupTypes: string[];
    setGroupTypes: (gt: string[]) => void;
    canAddTags?: boolean;
    showControlButtons?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export const GroupTypesAst: FC<TypeProps> = ({ groupTypes, setGroupTypes, canAddTags = true, showControlButtons = false, onConfirm, onCancel }) => {
    return <>
        <div className="text-md pb-1 font-bold text-black dark:text-white flex items-center">
            Group Types
        </div>
        <InfoBox content={
            <span className="ml-2 text-xs">
                Creating group types enables the subdivision of users into subgroups when interacting with an assistant.
                <br className='mb-2'></br>
                When creating or editing an assistant, you can select which group types to apply. This allows you to incorporate specific custom instructions and data sources tailored to each group.

                Additionally, you can specify which group types should have chat disabled, and provide reasons for this restriction.
                <br className='mb-2'></br>
                Before engaging with an assistant that has group types defined, users must identify their subgroup by selecting which group they belong to.

                This ensures that the interaction is customized with the appropriate instructions and data sources specific to their group type.

            </span>
        } />
        <div className='flex flex-row gap-2'>

            {showControlButtons && onConfirm && onCancel &&
                <div className="mt-1.5 flex flex-row gap-1 h-[20px]">
                    <button
                        className="text-green-500 hover:text-green-700 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onConfirm();
                        }}
                        title={"Confirm Changes"}
                    >
                        <IconCheck size={18} />
                    </button>

                    <button
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                        title={"Cancel"}
                    >
                        <IconX size={18} />
                    </button>
                </div>
            }

            <TagsList label={"Types"}
                addMessage={"List group types separated by commas:"}
                tags={groupTypes}
                setTags={(tags) => setGroupTypes(tags)}
                removeTag={(tag) => setGroupTypes(groupTypes.filter((t: string) => t !== tag))}
                isDisabled={!canAddTags} />
        </div>
    </>
}

interface TypeAstProps {
    groupId: string;
    astPromptId: string;
    assistantGroupData: AstGroupTypeData;
    groupUserTypeQuestion: string | undefined;
    groupTypes: string[];
    additionalGroupData: any;
    setAdditionalGroupData: (data: any) => void;
}

export const GroupTypesAstData: FC<TypeAstProps> = ({ groupId, astPromptId, assistantGroupData, additionalGroupData, setAdditionalGroupData, groupUserTypeQuestion, groupTypes }) => {
    const { state: { featureFlags } } = useContext(HomeContext);
    const preexistingDSids: { [key: string]: string[] } = {};

    const initialDs = (dataSources: any) => {
        return (dataSources).map((ds: any) => {
            return {
                ...ds,
                key: (ds.key || ds.id)
            }
        });
    }

    const initialStates = (initDs: any[]) => {
        return initDs.map(ds => {
            return { [ds.id]: 100 }
        }).reduce((acc, x) => {
            acc = { ...acc, ...x };
            return acc;
        }, {});
    }

    const initializeGroupTypeData = () => {
        const updatedGroupTypeData = Object.keys(assistantGroupData).reduce((acc: any, key) => {
            if (groupTypes.includes(key)) {
                acc[key] = assistantGroupData[key];
            }
            return acc;
        }, {});

        groupTypes.forEach((type: string) => {
            if (!updatedGroupTypeData[type]) {
                updatedGroupTypeData[type] = {
                    additionalInstructions: '', dataSources: [], documentState: {},
                    isDisabled: false, disabledMessage: ''
                };
            } else {
                const initDS = initialDs(updatedGroupTypeData[type].dataSources);
                updatedGroupTypeData[type].dataSources = initDS;
                updatedGroupTypeData[type].documentState = initialStates(initDS) as { [key: string]: number };
            }
            preexistingDSids[type] = updatedGroupTypeData[type].dataSources.map((ds: any) => ds.id);
        });
        return updatedGroupTypeData;
    };

    const [selectedTypes, setSelectedTypes] = useState<string[]>(Object.keys(assistantGroupData) || []);
    const [groupTypeData, setGroupTypeData] = useState<AstGroupTypeData>(initializeGroupTypeData());
    const [userQuestion, setUserQuestion] = useState<string>(groupUserTypeQuestion || '');

    const groupTypeDataRef = useRef(groupTypeData);

    useEffect(() => {
        groupTypeDataRef.current = groupTypeData;
    }, [groupTypeData]);

    const [showDataSourceSelector, setShowDataSourceSelector] = useState<string>('');

    useEffect(() => {
        setTimeout(() => { // ensure the groupdata state has updated, both ref an d groupTypeData would be outdated some times
            const filteredGroupTypeData = Object.entries(groupTypeData).reduce((acc: any, [key, value]) => {
                if (selectedTypes.includes(key)) {
                    acc[key] = value;
                }
                return acc;
            }, {});
            setAdditionalGroupData({ ...additionalGroupData, groupTypeData: filteredGroupTypeData });

        }, 100);
    }, [groupTypeData, selectedTypes])

    useEffect(() => {
        setAdditionalGroupData({ ...additionalGroupData, groupUserTypeQuestion: userQuestion });

    }, [userQuestion])

    const updateGroupType = (type: string, property: string, value: any) => {
        // console.log("Property: ", property)
        // console.log("Value: ", value)
        setGroupTypeData(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [property]: value
            }
        }));
    };


    const updateDocumentState = (type: string, docId: string, progress: number) => {
        setGroupTypeData(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                documentState: {
                    ...prev[type].documentState,
                    [docId]: progress,
                },
            },
        }));
    };

    const createDataSourceHandlers = (type: string) => {
        return {
            onAttach: (doc: AttachedDocument) => {
                updateGroupType(type, 'dataSources', [...groupTypeDataRef.current[type].dataSources, doc]);
            },
            onSetMetadata: (doc: AttachedDocument, metadata: any) => {
                updateGroupType(type, 'dataSources', groupTypeDataRef.current[type].dataSources.map(x =>
                    x.id === doc.id ? { ...x, metadata } : x
                ));
            },
            onSetKey: (doc: AttachedDocument, key: string) => {
                updateGroupType(type, 'dataSources', groupTypeDataRef.current[type].dataSources.map(x =>
                    x.id === doc.id ? { ...x, key } : x
                ));
            },
            onUploadProgress: (doc: AttachedDocument, progress: number) => {
                updateDocumentState(type, doc.id, progress);
            }
        };
    };

    //on save we will only save the grouptype data that is in the selected types
    if (groupTypes.length === 0) return <></>

    return <div className='my-4 text-black dark:text-neutral-200text-black dark:text-neutral-200'>
        <div className="text-md font-bold flex items-center">
            Group Types
        </div>
        Select applicable group types for this assistant. These will appear to the user as an option to choose from before chatting.
        <div className='ml-4 flex flex-row gap-2 mt-2'>
            {groupTypes.map((type: string) =>
                <div className='flex flex-row gap-2 mb-4' key={type}>
                    <input
                        className='ml-2'
                        type="checkbox"
                        checked={selectedTypes.includes(type)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                // Add type to the list if checkbox is checked
                                setSelectedTypes(prevList => [...prevList, type]);
                            } else {
                                // Remove type from the list if checkbox is unchecked
                                setSelectedTypes(prevList => prevList.filter(name => name !== type));
                            }
                        }}
                    />
                    {type}
                </div>
            )}

        </div>

        {selectedTypes.length > 0 &&
            <div className='w-full flex flex-col gap-2 mb-2'>
                Prompt Message for User Group Selection
                <textarea
                    className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                    style={{ resize: 'none' }}
                    placeholder={`Message to display to user when selecting one of the group types prior to chatting.\n (default message: "Please select the group you best identify with to start chatting."')`}
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    rows={2}
                />

                <ExpansionComponent
                    title='Manage Selected Group Type Data'
                    content={
                        Object.entries(groupTypeData)
                            .filter(([type]) => selectedTypes.includes(type))
                            .map(([type, data]) => {
                                const handlers = createDataSourceHandlers(type);
                                return <ExpansionComponent
                                    key={type}
                                    isOpened={true}
                                    title={type}
                                    content={

                                        <div className='flex flex-col gap-2 my-4 text-black dark:text-neutral-200' key={type}>
                                            <div className='flex flex-row'>
                                                {data.isDisabled ? "Disable Message For User" : "Additional Instructions"}
                                                <div className='ml-auto mr-4 flex flex-row gap-2'>
                                                    <input
                                                        className='ml-2'
                                                        type="checkbox"
                                                        checked={data.isDisabled}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                updateGroupType(type, 'isDisabled', true);
                                                            } else {
                                                                updateGroupType(type, 'isDisabled', false);
                                                            }
                                                        }}
                                                    />
                                                    Disable chat for this group type
                                                </div>

                                            </div>
                                            {data.isDisabled ?
                                                <textarea
                                                    className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                    style={{ resize: 'none' }}
                                                    placeholder={`Message to display for selected disabled type: ${type}`}
                                                    value={data.disabledMessage}
                                                    onChange={(e) => updateGroupType(type, 'disabledMessage', e.target.value)}
                                                    rows={3}
                                                />
                                                :
                                                <textarea
                                                    className="mb-2 rounded-md border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                                    style={{ resize: 'none' }}
                                                    placeholder={`Additional instructions specific for this group type: ${type}`}
                                                    value={data.additionalInstructions}
                                                    onChange={(e) => updateGroupType(type, 'additionalInstructions', e.target.value)}
                                                    rows={3}
                                                />}

                                            {!data.isDisabled && (
                                                <>
                                                    Additional Data Sources

                                                    <div className="flex flex-row items-center">

                                                        <button
                                                            title='Add Files'
                                                            className={`left-1 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:text-neutral-200 dark:bg-opacity-50 dark:text-neutral-100 `}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setShowDataSourceSelector(showDataSourceSelector === type ? '' : type);
                                                            }}
                                                            onKeyDown={(e) => {

                                                            }}
                                                        >
                                                            <IconFiles size={20} />
                                                        </button>

                                                        <AttachFile id={`__attachFile_admin_${type}_${groupId}_${astPromptId}`}
                                                            groupId={groupId}
                                                            disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                                            onAttach={handlers.onAttach}
                                                            onSetMetadata={handlers.onSetMetadata}
                                                            onSetKey={handlers.onSetKey}
                                                            onUploadProgress={handlers.onUploadProgress}
                                                        />
                                                    </div>

                                                    <FileList
                                                        documents={data.dataSources.filter((ds: AttachedDocument) => !(preexistingDSids[type].includes(ds.id)))}
                                                        documentStates={data.documentState}
                                                        setDocuments={(docs: AttachedDocument[]) => updateGroupType(type, 'dataSources', docs)}
                                                    />

                                                    {showDataSourceSelector === type && (
                                                        <div className="mt-[-10px] justify-center overflow-x-hidden">
                                                            <div className="rounded bg-white dark:bg-[#343541]">
                                                                <DataSourceSelector
                                                                    disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                                                    onClose={() => setShowDataSourceSelector('')}
                                                                    minWidth="500px"
                                                                    onDataSourceSelected={(d) => {
                                                                        const doc = {
                                                                            id: d.id,
                                                                            name: d.name || "",
                                                                            raw: null,
                                                                            type: d.type || "",
                                                                            data: "",
                                                                            metadata: d.metadata,
                                                                        };
                                                                        updateGroupType(type, 'dataSources', [...groupTypeData[type].dataSources, doc]);
                                                                        updateDocumentState(type, doc.id, 100);
                                                                    }}
                                                                    onIntegrationDataSourceSelected={featureFlags.integrations ?
                                                                        (file: File) => {
                                                                            handleFile(file, handlers.onAttach, handlers.onUploadProgress, handlers.onSetKey,
                                                                                handlers.onSetMetadata, () => { }, featureFlags.uploadDocuments, groupId)
                                                                        }
                                                                        : undefined
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {preexistingDSids[type].length > 0 &&
                                                        <ExistingFileList
                                                            label={`${type} Data Sources`} boldTitle={false}
                                                            documents={data.dataSources.filter((ds: AttachedDocument) => preexistingDSids[type].includes(ds.id))}
                                                            setDocuments={(docs: AttachedDocument[]) => updateGroupType(type, 'dataSources', docs)} />
                                                    }

                                                </>)}

                                        </div>
                                    } />
                            })
                    }
                />
            </div>


        }
    </div>
}
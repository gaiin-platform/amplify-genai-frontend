import HomeContext from "@/pages/api/home/home.context";
import { IconFiles, IconX } from "@tabler/icons-react";
import { FC, useContext, useEffect, useState } from "react";
import { getGroupConversationData } from '@/services/groupAssistantService';

export interface AstUserConversation {
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

export const ConversationTable: FC<{ conversations: AstUserConversation[], supportConvAnalysis: boolean }> = ({ conversations, supportConvAnalysis }) => {
    const [sortColumn, setSortColumn] = useState<keyof AstUserConversation>('timestamp');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedConversation, setSelectedConversation] = useState<AstUserConversation | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filteredConversations, setFilteredConversations] = useState<AstUserConversation[]>(conversations);
    const [showColumnSelector, setShowColumnSelector] = useState<boolean>(false);

    // Initialize with columns that should always be visible
    const defaultColumns: (keyof AstUserConversation)[] = [
        'assistantName',
        'user',
        'numberPrompts',
        'modelUsed',
        'timestamp',
        'userRating'
    ];

    // Add analysis-specific columns if supportConvAnalysis is true
    const analysisColumns: (keyof AstUserConversation)[] = supportConvAnalysis ? [
        'employeeType',
        'entryPoint',
        'category',
        'systemRating'
    ] : [];

    const [visibleColumns, setVisibleColumns] = useState<(keyof AstUserConversation)[]>([
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
                    const value = conv[field as keyof AstUserConversation];
                    return value && String(value).toLowerCase().includes(lowercaseSearchTerm);
                });
            }));
        }
    }, [searchTerm, conversations, supportConvAnalysis]);

    const openPopup = (conversation: AstUserConversation) => {
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
    const allColumns: (keyof AstUserConversation)[] = [
        ...defaultColumns,
        ...analysisColumns,
        'userFeedback',
        'conversationId',
        'assistantId'
    ];

    const toggleColumnVisibility = (column: keyof AstUserConversation) => {
        if (visibleColumns.includes(column)) {
            setVisibleColumns(visibleColumns.filter(col => col !== column));
        } else {
            setVisibleColumns([...visibleColumns, column]);
        }
    };

    const handleSort = (column: keyof AstUserConversation) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Render star rating
    const renderStarRating = (rating: number) => {
        if (typeof rating === 'string') {
            try {
                rating = Number(rating);
            } catch (error) {
                console.error('Error converting rating to number:', error);
            }
        }
        if (!rating || typeof (rating) !== 'number') return <span className="text-gray-400">No rating</span>;

        return displayRating(rating);
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
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style={{boxShadow: 'none'}}>
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                        <tr className="gradient-header">
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

const displayRating = (rating: number, textSize: string = 'text-xs') => {
    return <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    className={`${star <= rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                >
                    ★
                </span>
            ))}
            <span className={`ml-1 ${textSize} text-gray-600 dark:text-gray-400`}>{rating.toFixed(1)}</span>
           </div>
}

const ConversationPopup: FC<{ conversation: AstUserConversation; onClose: () => void; supportConvAnalysis: boolean }> = ({ conversation, onClose, supportConvAnalysis }) => {
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
    const baseFields: (keyof AstUserConversation)[] = [
        'timestamp',
        'assistantName',
        'user',
        'numberPrompts',
        'modelUsed',
        'userRating'
    ];

    const analysisFields: (keyof AstUserConversation)[] = supportConvAnalysis ? [
        'employeeType',
        'entryPoint',
        'category',
        'systemRating'
    ] : [];

    const fieldsToShow: (keyof AstUserConversation)[] = [...baseFields, ...analysisFields];

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
        if (typeof rating === 'string') {
            try {
                rating = Number(rating);
            } catch (error) {
                console.error('Error converting rating to number:', error);
            }
        }
        if (rating === null || rating === undefined || typeof (rating) !== 'number') return 'No rating';

        return displayRating(rating, 'text-sm');
    };

    // Format the field value for display
    const formatFieldValue = (key: keyof AstUserConversation, value: any) => {
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

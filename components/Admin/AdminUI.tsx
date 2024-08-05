import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { IconX } from '@tabler/icons-react';
import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import Loader from "@/components/Loader/Loader";

interface Props {
    open: boolean;
    onClose: () => void;
}

interface Conversation {
    user: string;
    timestamp: string;
    assistantName: string;
    numberOfPrompts: number;
    category: string;
    rating: number;
    conversationName: string;
}

const ConversationTable: FC<{ conversations: Conversation[] }> = ({ conversations }) => {
    return (
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    <th className="border px-4 py-2">User</th>
                    <th className="border px-4 py-2">Timestamp</th>
                    <th className="border px-4 py-2">Assistant Name</th>
                    <th className="border px-4 py-2">Number of Prompts</th>
                    <th className="border px-4 py-2">Category</th>
                    <th className="border px-4 py-2">Rating</th>
                    <th className="border px-4 py-2">Conversation Name</th>
                </tr>
            </thead>
            <tbody>
                {conversations.map((conv, index) => (
                    <tr key={index}>
                        <td className="border px-4 py-2">{conv.user}</td>
                        <td className="border px-4 py-2">{conv.timestamp}</td>
                        <td className="border px-4 py-2">{conv.assistantName}</td>
                        <td className="border px-4 py-2">{conv.numberOfPrompts}</td>
                        <td className="border px-4 py-2">{conv.category}</td>
                        <td className="border px-4 py-2">{conv.rating}</td>
                        <td className="border px-4 py-2">{conv.conversationName}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

interface DashboardMetrics {
    categories: string[];
    numberOfUsers: number;
    numberOfConversations: number;
    averageRating: number;
    averagePromptsPerConversation: number;
    employeeDepartmentDemographics: { [key: string]: number };
    users: string[];
}

const Dashboard: FC<{ metrics: DashboardMetrics }> = ({ metrics }) => {
    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Dashboard Metrics</h2>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Categories</h3>
                    <ul>
                        {metrics.categories.map((category, index) => (
                            <li key={index}>{category}</li>
                        ))}
                    </ul>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">User Stats</h3>
                    <p>Number of Users: {metrics.numberOfUsers}</p>
                    <p>Number of Conversations: {metrics.numberOfConversations}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Conversation Metrics</h3>
                    <p>Average Rating: {metrics.averageRating.toFixed(2)}</p>
                    <p>Average Prompts per Conversation: {metrics.averagePromptsPerConversation.toFixed(2)}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Employee Department Demographics</h3>
                    <ul>
                        {Object.entries(metrics.employeeDepartmentDemographics).map(([dept, count]) => (
                            <li key={dept}>{dept}: {count}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">List of Users</h3>
                <ul className="grid grid-cols-3 gap-2">
                    {metrics.users.map((user, index) => (
                        <li key={index}>{user}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

interface User {
    name: string;
    dateAdded: string;
    accessLevel: string;
    lastUsageDate: string;
}

const GroupManagement: FC = () => {
    const [users, setUsers] = useState<User[]>([
        { name: 'John Doe', dateAdded: '2023-01-15', accessLevel: 'Admin', lastUsageDate: '2023-06-10' },
        { name: 'Jane Smith', dateAdded: '2023-02-20', accessLevel: 'User', lastUsageDate: '2023-06-09' },
        { name: 'Bob Johnson', dateAdded: '2023-03-05', accessLevel: 'Moderator', lastUsageDate: '2023-06-08' },
    ]);

    const addUser = () => {
        const newUser: User = {
            name: 'New User',
            dateAdded: new Date().toISOString().split('T')[0],
            accessLevel: 'User',
            lastUsageDate: 'N/A'
        };
        setUsers([...users, newUser]);
    };

    const deleteUser = (index: number) => {
        const updatedUsers = users.filter((_, i) => i !== index);
        setUsers(updatedUsers);
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Group Management</h2>
                <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    onClick={addUser}
                >
                    Add User
                </button>
            </div>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="border px-4 py-2">Name</th>
                        <th className="border px-4 py-2">Date Added</th>
                        <th className="border px-4 py-2">Access Level</th>
                        <th className="border px-4 py-2">Last Usage Date</th>
                        <th className="border px-4 py-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user, index) => (
                        <tr key={index}>
                            <td className="border px-4 py-2">{user.name}</td>
                            <td className="border px-4 py-2">{user.dateAdded}</td>
                            <td className="border px-4 py-2">{user.accessLevel}</td>
                            <td className="border px-4 py-2">{user.lastUsageDate}</td>
                            <td className="border px-4 py-2">
                                <button
                                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                    onClick={() => deleteUser(index)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export const AdminUI: FC<Props> = ({ open, onClose }) => {
    const { state: { featureFlags }, dispatch: homeDispatch } = useContext(HomeContext);
    const [activeTab, setActiveTab] = useState('assistant1');
    const [activeSubTab, setActiveSubTab] = useState('conversations');
    const modalRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [dashboardMetrics, setDashboardMetrics] = useState<{ [key: string]: DashboardMetrics }>({});

    useEffect(() => {
        if (open) {
            setIsLoading(true);
            setLoadingMessage('Loading...');
            setTimeout(() => {
                // Simulate fetching conversation data
                setConversations([
                    { user: 'User1', timestamp: '2023-06-01 10:00', assistantName: 'Assistant1', numberOfPrompts: 5, category: 'General', rating: 4, conversationName: 'Chat1' },
                    { user: 'User2', timestamp: '2023-06-02 11:30', assistantName: 'Assistant2', numberOfPrompts: 3, category: 'Technical', rating: 5, conversationName: 'Chat2' },
                ]);

                // Simulate fetching dashboard metrics for each assistant
                setDashboardMetrics({
                    assistant1: {
                        categories: ['General', 'Technical', 'Support'],
                        numberOfUsers: 100,
                        numberOfConversations: 500,
                        averageRating: 4.5,
                        averagePromptsPerConversation: 7.3,
                        employeeDepartmentDemographics: {
                            'IT': 30,
                            'HR': 15,
                            'Sales': 25,
                            'Marketing': 20,
                            'Finance': 10
                        },
                        users: ['User1', 'User2', 'User3', 'User4', 'User5']
                    },
                    assistant2: {
                        categories: ['General', 'Technical', 'Support'],
                        numberOfUsers: 100,
                        numberOfConversations: 500,
                        averageRating: 4.5,
                        averagePromptsPerConversation: 7.3,
                        employeeDepartmentDemographics: {
                            'IT': 30,
                            'HR': 15,
                            'Sales': 25,
                            'Marketing': 20,
                            'Finance': 10
                        },
                        users: ['User1', 'User2', 'User3', 'User4', 'User5']
                    },
                    assistant3: {
                        categories: ['General', 'Technical', 'Support'],
                        numberOfUsers: 100,
                        numberOfConversations: 500,
                        averageRating: 4.5,
                        averagePromptsPerConversation: 7.3,
                        employeeDepartmentDemographics: {
                            'IT': 30,
                            'HR': 15,
                            'Sales': 25,
                            'Marketing': 20,
                            'Finance': 10
                        },
                        users: ['User1', 'User2', 'User3', 'User4', 'User5']
                    }
                });

                setIsLoading(false);
            }, 1000);
        }
    }, [open]);

    if (!open) {
        return null;
    }

    const renderSubTabs = () => (
        <div className="flex space-x-4 mb-4">
            <button className={`px-4 py-2 ${activeSubTab === 'conversations' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('conversations')}>Conversations</button>
            <button className={`px-4 py-2 ${activeSubTab === 'dashboard' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('dashboard')}>Dashboard</button>
            <button className={`px-4 py-2 ${activeSubTab === 'assistant' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('assistant')}>Edit Assistant</button>
            <button className={`px-4 py-2 ${activeSubTab === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-white'}`} onClick={() => setActiveSubTab('group')}>Edit Group</button>
        </div>
    );

    const renderContent = () => {
        switch (activeSubTab) {
            case 'conversations':
                return <ConversationTable conversations={conversations} />;
            case 'dashboard':
                return dashboardMetrics[activeTab] ? (
                    <Dashboard metrics={dashboardMetrics[activeTab]} />
                ) : (
                    <div className="text-black dark:text-white">No dashboard data available for {activeTab}</div>
                );
            case 'assistant':
                return <div className="text-black dark:text-white">Edit Assistant Content for {activeTab}</div>;
            case 'group':
                return <GroupManagement />;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true" />

                    {isLoading ? (
                        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-25 z-60">
                            <div className="p-6 flex flex-row items-center border border-gray-500 dark:bg-[#202123]">
                                <Loader size="48" />
                                <div className="text-xl">{loadingMessage}</div>
                            </div>
                        </div>
                    ) : (
                        <div
                            ref={modalRef}
                            className="dark:border-netural-400 inline-block transform rounded-lg border border-gray-300 bg-neutral-100 px-4 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:min-h-[636px] sm:w-full sm:p-4 sm:align-middle"
                            style={{ width: `${window.innerWidth - 560}px`, height: `${window.innerHeight * 0.9}px` }}
                            role="dialog"
                        >
                                <div className="mb-4 flex flex-row items-center justify-between bg-neutral-100 dark:bg-[#202123] rounded-t border-b dark:border-white/20">
                                    <div className="flex flex-row gap-1">
                                        {['assistant1', 'assistant2', 'assistant3'].map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === tab ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}
                                            >
                                                <h3 className="text-xl">{tab.charAt(0).toUpperCase() + tab.slice(1)}</h3>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center">
                                        <button
                                            className="mr-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                            onClick={() => {/* TODO: create assistant logic here */ }}
                                        >
                                            Create Assistant +
                                        </button>
                                        <SidebarActionButton
                                            handleClick={onClose}
                                            title="Close"
                                        >
                                            <IconX size={20} />
                                        </SidebarActionButton>
                                    </div>
                                </div>

                            <div className='overflow-y-auto' style={{ maxHeight: 'calc(100% - 60px)' }}>
                                {renderSubTabs()}
                                {renderContent()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
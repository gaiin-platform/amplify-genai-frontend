import React, { useState, useEffect } from 'react';
import { IconPlus, IconDatabase, IconLoader2, IconRefresh } from '@tabler/icons-react';
import { DatabaseConnection, getDatabaseConnections, testDatabaseConnection, deleteDatabaseConnection } from '@/services/databaseService';
import { DatabaseConnectionCard } from './DatabaseConnectionCard';
import { DatabaseConnectionModal } from './DatabaseConnectionModal';
import toast from 'react-hot-toast';

interface DatabaseConnectionsListProps {
    onConnectionSelected?: (connection: DatabaseConnection) => void;
    showActions?: boolean;
    height?: string;
}

export const DatabaseConnectionsList: React.FC<DatabaseConnectionsListProps> = ({
    onConnectionSelected,
    showActions = true,
    height
}) => {
    const [connections, setConnections] = useState<DatabaseConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConnection, setSelectedConnection] = useState<DatabaseConnection | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [testingStates, setTestingStates] = useState<{ [key: string]: 'idle' | 'testing' | 'success' | 'error' }>({});

    const loadConnections = async () => {
        try {
            setLoading(true);
            const response = await getDatabaseConnections();
            setConnections(response.connections);
        } catch (error) {
            console.error('Error loading database connections:', error);
            toast.error('Failed to load database connections');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConnections();
    }, []);

    const handleTestConnection = async (connection: DatabaseConnection) => {
        setTestingStates(prev => ({ ...prev, [connection.id]: 'testing' }));
        
        try {
            const result = await testDatabaseConnection(connection.id);
            setTestingStates(prev => ({ 
                ...prev, 
                [connection.id]: result.success ? 'success' : 'error' 
            }));
            
            if (result.success) {
                toast.success(`Connection to ${connection.connection_name} successful!`);
            } else {
                toast.error(`Connection failed: ${result.error || 'Unknown error'}`);
            }
            
            // Reset status after 3 seconds
            setTimeout(() => {
                setTestingStates(prev => ({ ...prev, [connection.id]: 'idle' }));
            }, 3000);
        } catch (error) {
            setTestingStates(prev => ({ ...prev, [connection.id]: 'error' }));
            toast.error('Failed to test connection');
            
            // Reset status after 3 seconds
            setTimeout(() => {
                setTestingStates(prev => ({ ...prev, [connection.id]: 'idle' }));
            }, 3000);
        }
    };

    const handleDeleteConnection = async (connectionId: string) => {
        if (!confirm('Are you sure you want to delete this database connection?')) {
            return;
        }

        try {
            await deleteDatabaseConnection(connectionId);
            toast.success('Database connection deleted successfully');
            await loadConnections(); // Reload the list
        } catch (error) {
            console.error('Error deleting database connection:', error);
            toast.error('Failed to delete database connection');
        }
    };

    const handleSelectConnection = (connection: DatabaseConnection) => {
        setSelectedConnection(connection);
        if (onConnectionSelected) {
            onConnectionSelected(connection);
        }
    };

    const handleConnectionSaved = () => {
        setShowModal(false);
        loadConnections(); // Reload the list after saving
        toast.success('Database connection saved successfully');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <IconLoader2 className="w-8 h-8 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-500">Loading database connections...</span>
            </div>
        );
    }

    return (
        <div className="p-4" style={{ height: height ?? 'auto', minHeight: '400px' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <IconDatabase className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Database Connections
                    </h2>
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {connections.length}
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={loadConnections}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Refresh"
                    >
                        <IconRefresh className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <IconPlus className="w-4 h-4 mr-1" />
                        Add Connection
                    </button>
                </div>
            </div>

            {connections.length === 0 ? (
                <div className="text-center py-12">
                    <IconDatabase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        No database connections
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        Get started by creating your first database connection
                    </p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <IconPlus className="w-4 h-4 mr-1" />
                        Add Database Connection
                    </button>
                </div>
            ) : (
                <div className="space-y-3 overflow-auto">
                    {connections.map((connection) => (
                        <DatabaseConnectionCard
                            key={connection.id}
                            connection={connection}
                            onTest={handleTestConnection}
                            onDelete={handleDeleteConnection}
                            onSelect={handleSelectConnection}
                            isSelected={selectedConnection?.id === connection.id}
                            showActions={showActions}
                            testStatus={testingStates[connection.id] || 'idle'}
                        />
                    ))}
                </div>
            )}

            {showModal && (
                <DatabaseConnectionModal
                    onClose={() => setShowModal(false)}
                    onSave={handleConnectionSaved}
                />
            )}
        </div>
    );
};
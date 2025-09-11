import React from 'react';
import { IconDatabase, IconTestPipe, IconTrash, IconPlugConnected, IconPlugConnectedX } from '@tabler/icons-react';
import { DatabaseConnection } from '@/services/databaseService';

interface DatabaseConnectionCardProps {
    connection: DatabaseConnection;
    onTest: (connection: DatabaseConnection) => void;
    onDelete: (connectionId: string) => void;
    onSelect: (connection: DatabaseConnection) => void;
    isSelected?: boolean;
    showActions?: boolean;
    testStatus?: 'idle' | 'testing' | 'success' | 'error';
}

export const DatabaseConnectionCard: React.FC<DatabaseConnectionCardProps> = ({
    connection,
    onTest,
    onDelete,
    onSelect,
    isSelected = false,
    showActions = true,
    testStatus = 'idle'
}) => {
    const getTypeLabel = (type: string) => {
        const typeLabels: { [key: string]: string } = {
            postgres: 'PostgreSQL',
            mysql: 'MySQL',
            mssql: 'SQL Server',
            sqlite: 'SQLite',
            snowflake: 'Snowflake',
            oracle: 'Oracle'
        };
        return typeLabels[type] || type;
    };

    const getConnectionInfo = (connection: DatabaseConnection) => {
        if (connection.host) {
            return `${connection.host}:${connection.port}`;
        }
        if (connection.database) {
            return connection.database;
        }
        if (connection.account) {
            return connection.account;
        }
        return 'Connection';
    };

    const getStatusIcon = () => {
        switch (testStatus) {
            case 'testing':
                return <IconTestPipe className="w-4 h-4 animate-spin text-blue-500" />;
            case 'success':
                return <IconPlugConnected className="w-4 h-4 text-green-500" />;
            case 'error':
                return <IconPlugConnectedX className="w-4 h-4 text-red-500" />;
            default:
                return <IconDatabase className="w-4 h-4 text-gray-500" />;
        }
    };

    return (
        <div
            className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                isSelected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => onSelect(connection)}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                        {getStatusIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {connection.connection_name}
                            </h3>
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                {getTypeLabel(connection.type)}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                            {getConnectionInfo(connection)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Created: {new Date(connection.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                
                {showActions && (
                    <div className="flex items-center space-x-2 ml-3">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTest(connection);
                            }}
                            disabled={testStatus === 'testing'}
                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                            title="Test Connection"
                        >
                            <IconTestPipe className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(connection.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete Connection"
                        >
                            <IconTrash className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
            
            {testStatus === 'success' && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                    ✓ Connection successful
                </div>
            )}
            
            {testStatus === 'error' && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                    ✗ Connection failed
                </div>
            )}
        </div>
    );
};
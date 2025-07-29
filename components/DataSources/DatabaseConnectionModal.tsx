import { FC, useState, useEffect } from 'react';
import { IconDatabase, IconLoader2 } from '@tabler/icons-react';
import { Modal } from '../ReusableComponents/Modal';
import { createPortal } from 'react-dom';
import { testDatabaseConnection } from '@/services/databaseService';

interface DatabaseConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (connection: DatabaseConnection) => void;
    initialConnection?: DatabaseConnection;
    disableClickOutside?: boolean;
}

export interface DatabaseConnection {
    connection_name: string;
    type: string;
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
    warehouse?: string;
    schema?: string;
    account?: string;
}

const DATABASE_TYPES = [
    { id: 'postgres', name: 'PostgreSQL' },
    { id: 'mssql', name: 'Microsoft SQL Server' },
    { id: 'mysql', name: 'MySQL' },
    { id: 'duckdb', name: 'DuckDB' },
    { id: 'snowflake', name: 'Snowflake' },
    { id: 'bigquery', name: 'BigQuery' },
    { id: 'sqlite', name: 'SQLite' },
    { id: 'oracle', name: 'Oracle' },
];

export const DatabaseConnectionModal: FC<DatabaseConnectionModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialConnection,
    disableClickOutside,
}) => {
    const [connection, setConnection] = useState<DatabaseConnection>(initialConnection || {
        connection_name: '',
        type: 'postgres',
        host: '',
        port: '',
        database: '',
        username: '',
        password: '',
        warehouse: '',
        schema: '',
        account: '',
    });
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Reset form when modal opens with new initialConnection
    useEffect(() => {
        if (isOpen && initialConnection) {
            setConnection(initialConnection);
        }
    }, [isOpen, initialConnection]);

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            console.log('Testing connection with params:', connection);
            const result = await testDatabaseConnection(connection);
            console.log('Test connection result:', result);

            if (!result) {
                throw new Error('No response received from server');
            }

            const parsedResult = typeof result.body === 'string' ? JSON.parse(result.body) : result;

            const success = typeof parsedResult === 'boolean' ? parsedResult : parsedResult.success;
            const message = parsedResult.message || (success ? 'Connection successful!' : 'Connection failed');

            setTestResult({
                success,
                message,
            });
        } catch (error) {
            console.error('Test connection error:', error);
            setTestResult({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to test connection',
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveResult(null);

        try {
            await onSave(connection);
            setSaveResult({
                success: true,
                message: 'Connection saved successfully!'
            });
            // Wait for 1.5 seconds to show the success message before closing
            await new Promise(resolve => setTimeout(resolve, 1500));
            onClose();
        } catch (error) {
            setSaveResult({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to save connection'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        onClose();
    };

    if (!isOpen) {
        return null;
    }

    const modalContent = (
        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
                <label className="block text-sm font-medium mb-1">Connection Name</label>
                <input
                    type="text"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    value={connection.connection_name}
                    onChange={(e) => setConnection({ ...connection, connection_name: e.target.value })}
                    placeholder="My Database"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Database Type</label>
                <select
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    value={connection.type}
                    onChange={(e) => setConnection({ ...connection, type: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                >
                    {DATABASE_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {connection.type === 'snowflake' ? (
                    <div>
                        <label className="block text-sm font-medium mb-1">Account</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            value={connection.account}
                            onChange={(e) => setConnection({ ...connection, account: e.target.value })}
                            placeholder="your-account.snowflakecomputing.com"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium mb-1">Host</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                value={connection.host}
                                onChange={(e) => setConnection({ ...connection, host: e.target.value })}
                                placeholder="localhost"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Port</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                value={connection.port}
                                onChange={(e) => setConnection({ ...connection, port: e.target.value })}
                                placeholder="5432"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Database Name</label>
                <input
                    type="text"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    value={connection.database}
                    onChange={(e) => setConnection({ ...connection, database: e.target.value })}
                    placeholder="mydb"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {connection.type === 'snowflake' && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Warehouse</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            value={connection.warehouse}
                            onChange={(e) => setConnection({ ...connection, warehouse: e.target.value })}
                            placeholder="SAMPLE_WH"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Schema</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            value={connection.schema}
                            onChange={(e) => setConnection({ ...connection, schema: e.target.value })}
                            placeholder="SCHEMA"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                        type="text"
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        value={connection.username}
                        onChange={(e) => setConnection({ ...connection, username: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                        type="password"
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        value={connection.password}
                        onChange={(e) => setConnection({ ...connection, password: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            {testResult && (
                <div className={`p-2 rounded ${testResult.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                    {testResult.message}
                </div>
            )}

            {saveResult && (
                <div className={`p-2 rounded ${saveResult.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                    {saveResult.message}
                </div>
            )}

            <div className="flex justify-end space-x-2">
                <button
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleTestConnection();
                    }}
                    disabled={testing || saving}
                >
                    {testing ? (
                        <IconLoader2 className="animate-spin inline-block mr-2" />
                    ) : null}
                    Test Connection
                </button>
            </div>
        </div>
    );

    return createPortal(
        <div onClick={(e) => e.stopPropagation()}>
            <Modal
                title="Add Database Connection"
                content={modalContent}
                onCancel={handleClose}
                onSubmit={handleSave}
                submitLabel={saving ? "Saving..." : "Save"}
                cancelLabel="Cancel"
                width={() => 600}
                height={() => Math.min(window.innerHeight * 0.8, 700)}
                showClose={true}
                showCancel={true}
                disableClickOutside={disableClickOutside}
                disableSubmit={saving}
            />
        </div>,
        document.body
    );
}; 
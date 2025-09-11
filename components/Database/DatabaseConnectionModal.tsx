import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { IconTestPipe, IconDatabase, IconLoader2 } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { 
    DatabaseConnectionCreate, 
    saveDatabaseConnection, 
    testDatabaseConnection,
    validateDatabaseConnection,
    getDatabaseTypes,
    DB_TYPE_CONFIGS
} from '@/services/databaseService';
import toast from 'react-hot-toast';

interface DatabaseConnectionModalProps {
    onClose: () => void;
    onSave: () => void;
}

export const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({
    onClose,
    onSave
}) => {
    const { state: { lightMode } } = useContext(HomeContext);
    const [connectionData, setConnectionData] = useState<DatabaseConnectionCreate>({
        type: 'postgres',
        name: '',
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: ''
    });
    
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [modalSize, setModalSize] = useState({ width: 800, height: 600 });

    const databaseTypes = getDatabaseTypes();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setModalSize({
                width: window.innerWidth * 0.6,
                height: window.innerHeight * 0.8
            });
        }
    }, []);

    useEffect(() => {
        // Reset form when database type changes
        const config = DB_TYPE_CONFIGS[connectionData.type as keyof typeof DB_TYPE_CONFIGS];
        if (config) {
            const newData: DatabaseConnectionCreate = {
                type: connectionData.type,
                name: connectionData.name
            };
            
            // Set default values based on type
            config.fields.forEach(field => {
                if (field.defaultValue !== undefined) {
                    (newData as any)[field.name] = field.defaultValue;
                }
            });
            
            setConnectionData(newData);
        }
    }, [connectionData.type]);

    const handleInputChange = (field: string, value: any) => {
        setConnectionData(prev => ({
            ...prev,
            [field]: value
        }));
        setTestResult(null); // Clear test result when form changes
        setErrors([]); // Clear errors when form changes
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        
        try {
            const result = await testDatabaseConnection(undefined, connectionData.type, connectionData);
            setTestResult(result);
            
            if (result.success) {
                toast.success('Connection test successful!');
            } else {
                toast.error(`Connection test failed: ${result.error}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setTestResult({ success: false, error: errorMessage });
            toast.error('Failed to test connection');
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        // Validate the form
        const validation = validateDatabaseConnection(connectionData.type, connectionData);
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        setSaving(true);
        setErrors([]);
        
        try {
            await saveDatabaseConnection(connectionData);
            onSave();
        } catch (error) {
            console.error('Error saving database connection:', error);
            toast.error('Failed to save database connection');
        } finally {
            setSaving(false);
        }
    };

    const renderFormField = (field: any) => {
        const value = (connectionData as any)[field.name] || '';
        
        switch (field.type) {
            case 'password':
                return (
                    <input
                        type="password"
                        value={value}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder={field.label}
                        required={field.required}
                    />
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => handleInputChange(field.name, parseInt(e.target.value) || '')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder={field.label}
                        required={field.required}
                    />
                );
            case 'textarea':
                return (
                    <textarea
                        value={value}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        rows={4}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder={field.label}
                        required={field.required}
                    />
                );
            default:
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder={field.label}
                        required={field.required}
                    />
                );
        }
    };

    const currentConfig = DB_TYPE_CONFIGS[connectionData.type as keyof typeof DB_TYPE_CONFIGS];

    // Only render if we're in the browser (not SSR)
    if (typeof window === 'undefined') {
        return null;
    }

    const modalContent = (
        <div className={`${lightMode} fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50`}>
            <div 
                className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-full max-h-full overflow-auto"
                style={{ 
                    width: `${modalSize.width}px`, 
                    height: `${modalSize.height}px` 
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Add Database Connection
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Content */}
                <div className="px-6 py-4 flex-1 overflow-y-auto">
                    <div className="max-w-2xl mx-auto space-y-6">
                        {/* Connection Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Connection Name
                            </label>
                            <input
                                type="text"
                                value={connectionData.name || ''}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="My Database Connection"
                            />
                        </div>

                        {/* Database Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Database Type
                            </label>
                            <select
                                value={connectionData.type}
                                onChange={(e) => handleInputChange('type', e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                {databaseTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Dynamic Fields Based on Database Type */}
                        {currentConfig && (
                            <div className="space-y-4">
                                {currentConfig.fields.map((field) => (
                                    <div key={field.name}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {field.label}
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </label>
                                        {renderFormField(field)}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error Messages */}
                        {errors.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                                <div className="text-sm text-red-600 dark:text-red-400">
                                    <ul className="list-disc list-inside space-y-1">
                                        {errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Test Result */}
                        {testResult && (
                            <div className={`rounded-md p-3 ${
                                testResult.success 
                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                            }`}>
                                <div className={`text-sm ${
                                    testResult.success 
                                        ? 'text-green-600 dark:text-green-400' 
                                        : 'text-red-600 dark:text-red-400'
                                }`}>
                                    {testResult.success ? (
                                        <>✓ Connection successful!</>
                                    ) : (
                                        <>✗ Connection failed: {testResult.error}</>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    <button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                    >
                        {testing ? "Testing..." : "Test Connection"}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Connection"}
                    </button>
                </div>
            </div>
        </div>
    );

    // Render the modal using a portal to document.body to escape container constraints
    return createPortal(modalContent, document.body);
};
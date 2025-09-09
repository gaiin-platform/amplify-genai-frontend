import { FC, useState, useCallback } from "react";
import { IconUpload, IconFileText, IconAlertTriangle, IconX } from "@tabler/icons-react";
import ActionButton from "@/components/ReusableComponents/ActionButton";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import { validateUsers } from "@/services/emailAutocompleteService";

interface CsvUploadResult {
    validAdmins: string[];
    duplicates: string[];
    invalidUsers: string[];
    invalidRows: { row: number; value: string; error: string }[];
    totalRows: number;
    validationError?: string;
}

interface Props {
    existingAdmins: string[];
    onUploadSuccess: (result: CsvUploadResult) => void;
    onClose: () => void;
    maxFileSize?: number; // in MB
}

export const CsvAdminUpload: FC<Props> = ({ 
    existingAdmins, 
    onUploadSuccess, 
    onClose, 
    maxFileSize = 5 
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [csvText, setCsvText] = useState<string | null>(null);
    const [fileUploaded, setFileUploaded] = useState(false);

    // CSV parser with user validation
    const parseCSV = async (csvText: string): Promise<CsvUploadResult> => {
        const lines = csvText.trim().split('\n');
        
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const allUsers: string[] = [];
        const duplicates: string[] = [];
        const invalidRows: { row: number; value: string; error: string }[] = [];
        const seenInFile = new Set<string>();

        // First pass: Extract all user names and check for basic issues
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            // Handle CSV format (first column) or simple list format
            const columns = line.split(',').map(col => col.trim().replace(/['"]/g, ''));
            const adminName = columns[0].trim();
            
            if (!adminName) {
                invalidRows.push({
                    row: i + 1,
                    value: line,
                    error: 'Empty admin value'
                });
                continue;
            }

            // Check for duplicates in existing admins
            if (existingAdmins.includes(adminName)) {
                duplicates.push(adminName);
                continue;
            }

            // Check for duplicates within the file
            if (seenInFile.has(adminName)) {
                duplicates.push(adminName);
                continue;
            }

            seenInFile.add(adminName);
            allUsers.push(adminName);
        }

        // Second pass: Validate users with the endpoint
        let validAdmins: string[] = [];
        let invalidUsers: string[] = [];
        let validationError: string | undefined = undefined;

        if (allUsers.length > 0) {
            try {
                const validationResponse = await validateUsers(allUsers);
                
                // Parse the response to get valid and invalid users
                if (validationResponse && validationResponse.data) {
                    const responseData = validationResponse.data;
                    validAdmins = responseData?.valid_users || [];
                    invalidUsers = responseData?.invalid_users || [];
                } else if (validationResponse && validationResponse.body) {
                    try {
                        const responseBody = JSON.parse(validationResponse.body);
                        validAdmins = responseBody?.valid_users || [];
                        invalidUsers = responseBody?.invalid_users || [];
                    } catch (parseError) {
                        console.error('Failed to parse validation response:', parseError);
                        validationError = 'Failed to parse validation response from server';
                        invalidUsers = allUsers;
                    }
                } else {
                    // If validation fails, treat all as invalid
                    validationError = 'No response received from validation service';
                    invalidUsers = allUsers;
                }
            } catch (error) {
                console.error('User validation failed:', error);
                
                // Determine specific error message based on error type
                if (error instanceof Error) {
                    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
                        validationError = 'Cannot connect to user validation service. Please ensure the service is running and try again.';
                    } else {
                        validationError = `Validation service error: ${error.message}`;
                    }
                } else {
                    validationError = 'Unknown error occurred while validating users';
                }
                
                // If validation endpoint fails, treat all as invalid
                invalidUsers = allUsers;
            }
        }

        return {
            validAdmins,
            duplicates,
            invalidUsers,
            invalidRows,
            totalRows: lines.length,
            validationError
        };
    };

    const processFile = useCallback(async (file: File) => {
        setError(null);
        setUploading(true);

        try {
            // Validate file type
            if (!file.name.toLowerCase().endsWith('.csv')) {
                throw new Error('Please select a CSV file');
            }

            // Validate file size
            const fileSizeMB = file.size / (1024 * 1024);
            if (fileSizeMB > maxFileSize) {
                throw new Error(`File size must be less than ${maxFileSize}MB`);
            }

            // Read file content and store it for preview
            const text = await file.text();
            setCsvText(text);
            setFileUploaded(true);
            
            // Parse CSV and validate admin names
            const result = await parseCSV(text);
            
            onUploadSuccess(result);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process file');
        } finally {
            setUploading(false);
        }
    }, [maxFileSize, onUploadSuccess, parseCSV]);


    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [processFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    }, [processFile]);

    return (
        <div className="admin-style-settings-card">
            <div className="admin-style-settings-card-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="admin-style-settings-card-title">Upload Admins from CSV</h3>
                        <p className="admin-style-settings-card-description">
                            Upload a CSV file with a list of admin users to add multiple admins at once
                        </p>
                    </div>
                    <ActionButton
                        title="Close"
                        handleClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <IconX size={20} />
                    </ActionButton>
                </div>
            </div>

            <div className="px-6 pb-6">
                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
                        <div className="flex items-center gap-2">
                            <IconAlertTriangle className="text-red-500" size={20} />
                            <span className="text-red-700 dark:text-red-400">{error}</span>
                        </div>
                    </div>
                )}


                {/* File Upload Area */}
                <div
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive 
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 text-gray-400">
                            {uploading ? (
                                <div className="animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 w-16 h-16"></div>
                            ) : (
                                <IconUpload size={64} />
                            )}
                        </div>
                        
                        <div>
                            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {uploading ? 'Processing...' : 'Upload CSV File'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Drag and drop your CSV file here, or click to browse
                            </p>
                        </div>

                        <div className="text-xs text-gray-400 space-y-1">
                            <p>• File must be in CSV format</p>
                            <p>• Each line should contain one admin user</p>
                            <p>• Maximum file size: {maxFileSize}MB</p>
                        </div>
                    </div>
                </div>

                {/* CSV Format Example */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <IconFileText size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            CSV Format Example:
                        </span>
                    </div>
                    <div className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-2 rounded border">
                        user1@example.com<br />
                        user2@example.com<br />
                        user3@example.com<br />
                        admin@company.com
                    </div>
                </div>
            </div>
        </div>
    );
};
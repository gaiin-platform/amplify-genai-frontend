import { FC, useState, useCallback } from "react";
import { IconUpload, IconFileText, IconAlertTriangle, IconX } from "@tabler/icons-react";
import ActionButton from "@/components/ReusableComponents/ActionButton";
import { CsvUploadConfig, CsvUploadResult } from "@/types/csvUpload";
import { GenericCsvParser, validateCsvFile } from "@/utils/csvUpload";

interface Props<T = string> {
    config: CsvUploadConfig<T>;
    existingItems: T[];
    onUploadSuccess: (result: CsvUploadResult<T>) => void;
    onClose: () => void;
}

export const CsvUpload = <T = string,>({ 
    config, 
    existingItems, 
    onUploadSuccess, 
    onClose 
}: Props<T>): JSX.Element => {
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [csvText, setCsvText] = useState<string | null>(null);
    const [fileUploaded, setFileUploaded] = useState(false);

    const processFile = useCallback(async (file: File) => {
        setError(null);
        setUploading(true);

        try {
            // Validate file
            validateCsvFile(file, config);

            // Read file content
            const text = await file.text();
            setCsvText(text);
            setFileUploaded(true);
            
            // Parse CSV
            const parser = new GenericCsvParser(config);
            const result = await parser.parseCSV(text, existingItems);
            
            onUploadSuccess(result);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process file');
        } finally {
            setUploading(false);
        }
    }, [config, existingItems, onUploadSuccess]);

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

    const allowedExtensions = config.allowedExtensions || ['.csv'];
    const maxFileSize = config.maxFileSize || 5;

    return (
        <div className="admin-style-settings-card">
            <div className="admin-style-settings-card-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="admin-style-settings-card-title">{config.title}</h3>
                        <p className="admin-style-settings-card-description">
                            {config.description}
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
                        accept={allowedExtensions.join(',')}
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
                                {uploading ? 'Processing...' : (config.uploadButtonText || 'Upload CSV File')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Drag and drop your file here, or click to browse
                            </p>
                        </div>

                        <div className="text-xs text-gray-400 space-y-1">
                            <p>• File must be in {allowedExtensions.join(' or ')} format</p>
                            {config.formatInstructions?.map((instruction, index) => (
                                <p key={index}>• {instruction}</p>
                            ))}
                            <p>• Maximum file size: {maxFileSize}MB</p>
                        </div>
                    </div>
                </div>

                {/* Format Example */}
                {config.formatExample && (
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <IconFileText size={16} className="text-gray-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Format Example:
                            </span>
                        </div>
                        <div className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-2 rounded border">
                            {config.formatExample.map((line, index) => (
                                <div key={index}>{line}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
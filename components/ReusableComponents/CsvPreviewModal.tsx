import { FC, useState } from "react";
import { Modal } from "./Modal";
import { IconCheck, IconX, IconAlertTriangle, IconUsers, IconUserExclamation } from "@tabler/icons-react";
import { LoadingIcon } from "../Loader/LoadingIcon";
import { CsvUploadResult, CsvPreviewConfig } from "@/types/csvUpload";

interface Props<T = string> {
    open: boolean;
    result: CsvUploadResult<T> | null;
    config: CsvPreviewConfig;
    onConfirm: (itemsToImport: T[]) => void;
    onCancel: () => void;
    isProcessing?: boolean;
}

export const CsvPreviewModal = <T = string,>({ 
    open, 
    result, 
    config,
    onConfirm, 
    onCancel, 
    isProcessing = false 
}: Props<T>): JSX.Element | null => {
    const [showDetails, setShowDetails] = useState({
        valid: true,
        duplicates: false,
        invalidItems: false,
        errors: false
    });

    if (!open || !result) return null;

    const hasWarnings = result.duplicates.length > 0 || result.invalidItems.length > 0 || result.invalidRows.length > 0;
    const canProceed = result.validItems.length > 0;

    const handleConfirm = () => {
        if (canProceed && !isProcessing) {
            onConfirm(result.validItems);
        }
    };

    const renderItem = (item: T): React.ReactNode => {
        if (config.itemRenderer) {
            return config.itemRenderer(item);
        }
        
        // Default rendering
        if (typeof item === 'string') {
            return item;
        }
        
        if (typeof item === 'object' && item !== null) {
            return JSON.stringify(item);
        }
        
        return String(item);
    };

    const StatCard = ({ 
        title, 
        count, 
        icon, 
        color, 
        expanded, 
        onToggle, 
        items 
    }: { 
        title: string; 
        count: number; 
        icon: React.ReactNode; 
        color: string; 
        expanded: boolean; 
        onToggle: () => void; 
        items: (T | { row: number; value: string; error: string })[];
    }) => (
        <div className={`border rounded-lg p-4 ${color}`}>
            <div 
                className="flex items-center justify-between cursor-pointer" 
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <div>
                        <h4 className="font-medium">{title}</h4>
                        <p className="text-sm opacity-75">{count} items</p>
                    </div>
                </div>
                <div className="text-lg font-bold">{count}</div>
            </div>
            
            {expanded && count > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto">
                    <div className="space-y-1">
                        {items.map((item, index) => (
                            <div key={index} className="text-sm p-2 bg-black/5 dark:bg-white/5 rounded">
                                {typeof item === 'object' && item !== null && 'row' in item && 'value' in item && 'error' in item ? (
                                    <div>
                                        <span className="font-mono text-xs opacity-75">Row {item.row}:</span>
                                        <div className="mt-1">{item.value}</div>
                                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">{item.error}</div>
                                    </div>
                                ) : (
                                    renderItem(item as T)
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const confirmButtonText = config.confirmButtonText || `Import ${result.validItems.length} ${result.validItems.length === 1 ? config.entityName : config.entityNamePlural}`;

    return (
        <Modal
            title="CSV Import Preview"
            onCancel={onCancel}
            onSubmit={handleConfirm}
            submitLabel={isProcessing ? "Importing..." : confirmButtonText}
            cancelLabel="Cancel"
            disableSubmit={!canProceed || isProcessing}
            content={
                <div className="space-y-6">
                    {/* Validation Error Warning */}
                    {result.validationError && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start gap-2">
                                <IconAlertTriangle className="text-red-600 dark:text-red-400 mt-0.5" size={20} />
                                <div>
                                    <h3 className="font-medium text-red-800 dark:text-red-200 mb-1">
                                        Validation Error
                                    </h3>
                                    <p className="text-sm text-red-700 dark:text-red-300">
                                        {result.validationError}
                                    </p>
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                        All items have been marked as invalid due to this validation failure.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <IconUsers className="text-blue-600 dark:text-blue-400" size={20} />
                            <h3 className="font-medium text-blue-800 dark:text-blue-200">
                                Import Summary
                            </h3>
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                            Found <strong>{result.totalRows}</strong> rows in your CSV file.
                            <br />
                            <strong>{result.validItems.length}</strong> new {result.validItems.length === 1 ? config.entityName.toLowerCase() : config.entityNamePlural.toLowerCase()} will be imported.
                            {hasWarnings && (
                                <span className="text-amber-700 dark:text-amber-300">
                                    <br />
                                    <strong>{result.duplicates.length + result.invalidItems.length + result.invalidRows.length}</strong> {(result.duplicates.length + result.invalidItems.length + result.invalidRows.length) === 1 ? config.entityName.toLowerCase() : config.entityNamePlural.toLowerCase()} will be skipped due to duplicates, validation failures, or errors.
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    <div className="space-y-4">
                        {/* Valid Items */}
                        {(config.showValidItems !== false) && (
                            <StatCard
                                title={`Valid ${config.entityNamePlural} (Will be Imported)`}
                                count={result.validItems.length}
                                icon={<IconCheck className="text-green-600 dark:text-green-400" size={20} />}
                                color="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                                expanded={showDetails.valid}
                                onToggle={() => setShowDetails(prev => ({ ...prev, valid: !prev.valid }))}
                                items={result.validItems}
                            />
                        )}

                        {/* Duplicates */}
                        {(config.showDuplicates !== false) && result.duplicates.length > 0 && (
                            <StatCard
                                title={`Duplicate ${config.entityNamePlural} (Will be Skipped)`}
                                count={result.duplicates.length}
                                icon={<IconUserExclamation className="text-amber-600 dark:text-amber-400" size={20} />}
                                color="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200"
                                expanded={showDetails.duplicates}
                                onToggle={() => setShowDetails(prev => ({ ...prev, duplicates: !prev.duplicates }))}
                                items={result.duplicates}
                            />
                        )}

                        {/* Invalid Items */}
                        {(config.showInvalidItems !== false) && result.invalidItems.length > 0 && (
                            <StatCard
                                title={`Invalid ${config.entityNamePlural} (Will be Skipped)`}
                                count={result.invalidItems.length}
                                icon={<IconAlertTriangle className="text-orange-600 dark:text-orange-400" size={20} />}
                                color="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200"
                                expanded={showDetails.invalidItems}
                                onToggle={() => setShowDetails(prev => ({ ...prev, invalidItems: !prev.invalidItems }))}
                                items={result.invalidItems}
                            />
                        )}

                        {/* Errors */}
                        {(config.showErrors !== false) && result.invalidRows.length > 0 && (
                            <StatCard
                                title="Row Errors (Will be Skipped)"
                                count={result.invalidRows.length}
                                icon={<IconX className="text-red-600 dark:text-red-400" size={20} />}
                                color="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                                expanded={showDetails.errors}
                                onToggle={() => setShowDetails(prev => ({ ...prev, errors: !prev.errors }))}
                                items={result.invalidRows}
                            />
                        )}
                    </div>

                    {/* No valid items warning */}
                    {!canProceed && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-2">
                                <IconAlertTriangle className="text-red-600 dark:text-red-400" size={20} />
                                <span className="font-medium text-red-800 dark:text-red-200">
                                    No valid {config.entityNamePlural.toLowerCase()} to import
                                </span>
                            </div>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                                All rows in your CSV were either duplicates or contained errors. 
                                Please review your file and try again.
                            </p>
                        </div>
                    )}

                    {/* Processing indicator */}
                    {isProcessing && (
                        <div className="flex items-center justify-center py-4">
                            <LoadingIcon style={{ width: '24px', height: '24px' }} />
                            <span className="ml-2 text-gray-600 dark:text-gray-400">
                                Importing {config.entityNamePlural.toLowerCase()}...
                            </span>
                        </div>
                    )}
                </div>
            }
        />
    );
};
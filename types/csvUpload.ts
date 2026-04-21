// Generic CSV Upload Types and Interfaces

export interface CsvRowError {
    row: number;
    value: string;
    error: string;
}

export interface CsvUploadResult<T = string> {
    validItems: T[];
    duplicates: T[];
    invalidItems: T[];
    invalidRows: CsvRowError[];
    totalRows: number;
    validationError?: string;
}

export interface CsvColumnConfig {
    index: number;
    name: string;
    required?: boolean;
    validator?: (value: string) => boolean | string; // Returns true if valid, or error message if invalid
}

export interface CsvUploadConfig<T = string> {
    // UI Configuration
    title: string;
    description: string;
    uploadButtonText?: string;
    formatExample?: string[];
    formatInstructions?: string[];
    
    // File Configuration
    maxFileSize?: number; // in MB
    allowedExtensions?: string[];
    
    // Data Processing Configuration
    columnConfig?: CsvColumnConfig[];
    
    // Custom Processing Functions
    extractItem?: (row: string[], rowIndex: number) => T | null;
    validateItem?: (item: T, existingItems: T[]) => Promise<boolean> | boolean;
    checkDuplicate?: (item: T, existingItems: T[], processedItems: T[]) => boolean;
    
    // Batch Validation (like the current admin validation service)
    batchValidator?: (items: T[]) => Promise<{
        validItems: T[];
        invalidItems: T[];
        validationError?: string;
    }>;
}

export interface CsvPreviewConfig {
    // UI Labels
    entityName: string; // e.g., "Admin", "User", "Product"
    entityNamePlural: string; // e.g., "Admins", "Users", "Products"
    
    // Action Configuration
    confirmButtonText?: string; // e.g., "Import Admins", "Add Users"
    
    // Display Configuration
    showValidItems?: boolean;
    showDuplicates?: boolean;
    showInvalidItems?: boolean;
    showErrors?: boolean;
    
    // Custom Item Display
    itemRenderer?: (item: any) => React.ReactNode;
}
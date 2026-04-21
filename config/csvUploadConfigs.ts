// Predefined CSV Upload Configurations for common use cases

import { CsvUploadConfig, CsvPreviewConfig } from "@/types/csvUpload";
import { createUserValidator } from "@/utils/csvUpload";

/**
 * Configuration for Admin CSV Upload
 */
export const AdminCsvUploadConfig: CsvUploadConfig<string> = {
    // UI Configuration
    title: "Upload Admins from CSV",
    description: "Upload a CSV file with a list of admin users to add multiple admins at once",
    uploadButtonText: "Upload CSV File",
    
    // File Configuration
    maxFileSize: 5, // 5MB
    allowedExtensions: ['.csv'],
    
    // Format Configuration
    formatExample: [
        "user1@example.com",
        "user2@example.com", 
        "user3@example.com",
        "admin@company.com"
    ],
    formatInstructions: [
        "Each line should contain one admin user",
    ],
    
    // Data Processing Configuration
    extractItem: (columns: string[], rowIndex: number): string | null => {
        const adminName = columns[0]?.trim().replace(/['"]/g, '');
        
        if (!adminName) {
            throw new Error('Empty admin value');
        }
        
        return adminName;
    },
    
    checkDuplicate: (item: string, existingItems: string[], processedItems: string[]): boolean => {
        return existingItems.includes(item) || processedItems.includes(item);
    },
    
    // Batch validation using reusable user validation function
    batchValidator: createUserValidator()
};

/**
 * Configuration for Admin CSV Preview
 */
export const AdminCsvPreviewConfig: CsvPreviewConfig = {
    entityName: "Admin",
    entityNamePlural: "Admins",
    confirmButtonText: undefined, // Will use default: "Import X Admins"
    showValidItems: true,
    showDuplicates: true,
    showInvalidItems: true,
    showErrors: true,
    itemRenderer: (item: string) => item // Simple string display
};


// Generic CSV Upload Utilities

import { CsvUploadConfig, CsvUploadResult, CsvRowError } from "@/types/csvUpload";
import { validateUsers } from "@/services/emailAutocompleteService";

/**
 * Generic CSV parser that can be configured for different data types and validation needs
 */
export class GenericCsvParser<T = string> {
    private config: CsvUploadConfig<T>;
    
    constructor(config: CsvUploadConfig<T>) {
        this.config = config;
    }
    
    /**
     * Parse CSV text and return processed results
     */
    async parseCSV(csvText: string, existingItems: T[] = []): Promise<CsvUploadResult<T>> {
        const lines = csvText.trim().split('\n');
        
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const allItems: T[] = [];
        const duplicates: T[] = [];
        const invalidRows: CsvRowError[] = [];
        const seenInFile = new Set<string>();

        // First pass: Extract all items and check for basic issues
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            try {
                const item = this.extractItemFromRow(line, i + 1);
                
                if (item === null) {
                    continue; // Skip this row (already handled by extractItemFromRow)
                }

                // Convert item to string for duplicate checking (customize as needed)
                const itemKey = this.getItemKey(item);
                
                // Check for duplicates in existing items
                if (this.isDuplicateInExisting(item, existingItems)) {
                    duplicates.push(item);
                    continue;
                }

                // Check for duplicates within the file
                if (seenInFile.has(itemKey)) {
                    duplicates.push(item);
                    continue;
                }

                seenInFile.add(itemKey);
                allItems.push(item);
                
            } catch (error) {
                invalidRows.push({
                    row: i + 1,
                    value: line,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Second pass: Batch validation if configured
        let validItems: T[] = [];
        let invalidItems: T[] = [];
        let validationError: string | undefined = undefined;

        if (allItems.length > 0 && this.config.batchValidator) {
            try {
                const validationResult = await this.config.batchValidator(allItems);
                validItems = validationResult.validItems;
                invalidItems = validationResult.invalidItems;
                validationError = validationResult.validationError;
            } catch (error) {
                console.error('Batch validation failed:', error);
                validationError = error instanceof Error ? error.message : 'Validation failed';
                invalidItems = allItems;
            }
        } else {
            // Individual validation or no validation
            for (const item of allItems) {
                try {
                    const isValid = this.config.validateItem 
                        ? await this.config.validateItem(item, existingItems)
                        : true;
                    
                    if (isValid) {
                        validItems.push(item);
                    } else {
                        invalidItems.push(item);
                    }
                } catch (error) {
                    invalidItems.push(item);
                }
            }
        }

        return {
            validItems,
            duplicates,
            invalidItems,
            invalidRows,
            totalRows: lines.length,
            validationError
        };
    }

    /**
     * Extract an item from a CSV row
     */
    private extractItemFromRow(line: string, rowNumber: number): T | null {
        if (this.config.extractItem) {
            const columns = this.parseColumns(line);
            return this.config.extractItem(columns, rowNumber);
        }

        // Default extraction: first column as string
        const columns = this.parseColumns(line);
        const value = columns[0]?.trim();
        
        if (!value) {
            throw new Error('Empty value');
        }

        return value as T;
    }

    /**
     * Parse CSV columns from a line
     */
    private parseColumns(line: string): string[] {
        return line.split(',').map(col => col.trim().replace(/['"]/g, ''));
    }

    /**
     * Get a string key for duplicate checking
     */
    private getItemKey(item: T): string {
        if (typeof item === 'string') {
            return item;
        }
        if (typeof item === 'object' && item !== null) {
            return JSON.stringify(item);
        }
        return String(item);
    }

    /**
     * Check if item is duplicate in existing items
     */
    private isDuplicateInExisting(item: T, existingItems: T[]): boolean {
        if (this.config.checkDuplicate) {
            return this.config.checkDuplicate(item, existingItems, []);
        }
        
        // Default duplicate check
        const itemKey = this.getItemKey(item);
        return existingItems.some(existing => this.getItemKey(existing) === itemKey);
    }
}

/**
 * Validate file before processing
 */
export function validateCsvFile<T>(file: File, config: CsvUploadConfig<T>): void {
    // Check file extension
    const allowedExtensions = config.allowedExtensions || ['.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
        throw new Error(`Please select a ${allowedExtensions.join(' or ')} file`);
    }

    // Check file size
    const maxFileSize = config.maxFileSize || 5;
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > maxFileSize) {
        throw new Error(`File size must be less than ${maxFileSize}MB`);
    }
}

/**
 * Reusable user validation function using the validateUsers service
 * This handles all the complexity of parsing responses and error handling
 */
export function createUserValidator() {
    return async (items: string[]) => {
        try {
            const validationResponse = await validateUsers(items);
            
            // Parse the response to get valid and invalid users
            if (validationResponse && validationResponse.data) {
                const responseData = validationResponse.data;
                return {
                    validItems: responseData?.valid_users || [],
                    invalidItems: responseData?.invalid_users || [],
                };
            } else if (validationResponse && validationResponse.body) {
                try {
                    const responseBody = JSON.parse(validationResponse.body);
                    return {
                        validItems: responseBody?.valid_users || [],
                        invalidItems: responseBody?.invalid_users || [],
                    };
                } catch (parseError) {
                    console.error('Failed to parse validation response:', parseError);
                    return {
                        validItems: [],
                        invalidItems: items,
                        validationError: 'Failed to parse validation response from server'
                    };
                }
            } else {
                return {
                    validItems: [],
                    invalidItems: items,
                    validationError: 'No response received from validation service'
                };
            }
        } catch (error) {
            console.error('User validation failed:', error);
            
            let validationError = 'Unknown error occurred while validating users';
            if (error instanceof Error) {
                if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
                    validationError = 'Cannot connect to user validation service. Please ensure the service is running and try again.';
                } else {
                    validationError = `Validation service error: ${error.message}`;
                }
            }
            
            return {
                validItems: [],
                invalidItems: items,
                validationError
            };
        }
    };
}
import { COMMON_DISALLOWED_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS } from './app/const';
import { handleFile } from '@/components/Chat/AttachFile';
import { resolveRagEnabled } from '@/types/features';
import { AttachedDocument } from '@/types/attacheddocument';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
// ============================================================================
// INTERFACES
// ============================================================================
export interface FileValidationOptions {
    disallowedExtensions?: string[];
    allowedExtensions?: string[];
    supportsImages?: boolean;
    customErrorMessages?: {
        unsupportedType?: string;
        xlsFormat?: string;
        pptFormat?: string;
    };
}
export interface FileValidationResult {
    isValid: boolean;
    errorMessage?: string;
    extension: string;
}
export interface FileProcessorOptions {
    // Validation options
    disallowedExtensions?: string[];
    allowedExtensions?: string[];
    
    // Callback functions
    onAttach: (document: AttachedDocument) => void;
    onUploadProgress: (document: AttachedDocument, progress: number) => void;
    onSetKey: (document: AttachedDocument, key: string) => void;
    onSetMetadata: (document: AttachedDocument, metadata: any) => void;
    onSetAbortController: (document: AttachedDocument, abortController: AbortController) => void;
    
    // Services and configuration
    statsService: any;
    featureFlags: any;
    ragOn?: boolean;
    uploadDocuments: boolean;
    
    // Optional parameters
    groupId?: string;
    disableRag?: boolean;
    generateFileName?: (file: File) => string;
    props?: any;
}
export interface ZipProcessorOptions extends FileProcessorOptions {
    // Additional options specific to ZIP processing
    maxFilesFromZip?: number;
    extractNestedZips?: boolean;
    onZipProgress?: (extractedCount: number, totalCount: number) => void;
    onZipExtractionComplete?: (extractedFileCount: number) => void;
}
// ============================================================================
// VALIDATION UTILITIES
// ============================================================================
/**
 * Extract file extension from filename, properly handling files without extensions
 */
export function getFileExtension(filename: string): string {
    if (!filename.includes('.')) {
        return '';
    }
    return filename.split('.').pop()?.toLowerCase() || '';
}
/**
 * Get the default disallowed file extensions based on image support
 */
export function getDisallowedExtensions(supportsImages: boolean = true): string[] {
    return [
        ...COMMON_DISALLOWED_FILE_EXTENSIONS,
        ...(supportsImages ? [] : IMAGE_FILE_EXTENSIONS)
    ];
}
/**
 * Utility function to get disallowed extensions for a specific context
 * This replicates the logic from ChatInput's getDisallowedFileExtensions()
 */
export function getDisallowedExtensionsForModel(supportsImages: boolean = true): string[] {
    return getDisallowedExtensions(supportsImages);
}
/**
 * Validate a file based on the provided options
 */
export function validateFile(
    file: File,
    options: FileValidationOptions = {}
): FileValidationResult {
    const filename = file.name;
    return validateFileByName(filename, options);
}
/**
 * Validate a file by name based on the provided options
 */
export function validateFileByName(
    filename: string,
    options: FileValidationOptions = {}
): FileValidationResult {
    const {
        disallowedExtensions = [],
        allowedExtensions,
        customErrorMessages = {}
    } = options;
    const extension = getFileExtension(filename);
    // Default error messages
    const errorMessages = {
        unsupportedType: 'This file type is not supported.',
        xlsFormat: 'This file type is not supported. Please save the file as xlsx.',
        pptFormat: 'This file type is not supported. Please save the file as pptx.',
        ...customErrorMessages
    };
    // Check for empty extension
    if (extension === '') {
        return {
            isValid: false,
            errorMessage: errorMessages.unsupportedType,
            extension
        };
    }
    // Check for legacy Office formats with specific messages
    if (extension === 'xls' || extension === 'xlsm') {
        return {
            isValid: false,
            errorMessage: errorMessages.xlsFormat,
            extension
        };
    }
    if (extension === 'ppt' || extension === 'potx') {
        return {
            isValid: false,
            errorMessage: errorMessages.pptFormat,
            extension
        };
    }
    // Check disallowed extensions
    if (disallowedExtensions && disallowedExtensions.includes(extension)) {
        return {
            isValid: false,
            errorMessage: errorMessages.unsupportedType,
            extension
        };
    }
    // Check allowed extensions (if specified)
    if (allowedExtensions && !allowedExtensions.includes(extension)) {
        return {
            isValid: false,
            errorMessage: errorMessages.unsupportedType,
            extension
        };
    }
    // File is valid
    return {
        isValid: true,
        extension
    };
}
// ============================================================================
// ZIP PROCESSING UTILITIES
// ============================================================================
/**
 * Extract files from a ZIP archive asynchronously
 */
export async function extractZipFiles(zipFile: File): Promise<File[]> {
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(zipFile);
        const extractedFiles: File[] = [];
        const entries = Object.entries(contents.files);
        
        for (const [relativePath, zipEntry] of entries) {
            // Skip directories, hidden files, and system files
            if (!zipEntry.dir && 
                !relativePath.startsWith('.') && 
                !relativePath.includes('__MACOSX') &&
                !relativePath.includes('.DS_Store')) {
                
                try {
                    const blobContent = await zipEntry.async('blob');
                    if (blobContent && blobContent.size > 0) {
                        // Determine file type based on extension
                        const extension = getFileExtension(relativePath);
                        const mimeType = getMimeTypeFromExtension(extension);
                        
                        // Create a new File with the extracted content
                        const extractedFile = new File([blobContent], relativePath, {
                            type: mimeType || blobContent.type || 'application/octet-stream'
                        });
                        extractedFiles.push(extractedFile);
                    }
                } catch (error) {
                    console.warn(`Failed to extract file ${relativePath}:`, error);
                }
            }
        }
        return extractedFiles;
    } catch (error) {
        console.error('Failed to extract ZIP file:', error);
        throw new Error('Failed to extract ZIP file. Please ensure it\'s a valid ZIP archive.');
    }
}
/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(extension: string): string | null {
    const mimeTypes: { [key: string]: string } = {
        'txt': 'text/plain',
        'md': 'text/markdown',
        'json': 'application/json',
        'js': 'text/javascript',
        'ts': 'text/typescript',
        'jsx': 'text/javascript',
        'tsx': 'text/typescript',
        'html': 'text/html',
        'css': 'text/css',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml'
    };
    
    return mimeTypes[extension.toLowerCase()] || null;
}
/**
 * Process a ZIP file asynchronously and attach the extracted files (not the ZIP itself)
 */
export async function processZipFileAsync(
    zipFile: File,
    options: ZipProcessorOptions
): Promise<void> {
    const {
        maxFilesFromZip = 50,
        extractNestedZips = false,
        onZipProgress,
        onZipExtractionComplete,
        ...fileOptions
    } = options;
    try {
        console.log(`Processing ZIP file: ${zipFile.name}`);
        
        // Extract files from ZIP
        const extractedFiles = await extractZipFiles(zipFile);
        
        if (extractedFiles.length === 0) {
            alert('No valid files found in the ZIP archive.');
            return;
        }
        if (extractedFiles.length > maxFilesFromZip) {
            const proceed = confirm(
                `The ZIP file contains ${extractedFiles.length} files. Only the first ${maxFilesFromZip} will be processed. Continue?`
            );
            if (!proceed) return;
        }
        // Limit the number of files to process
        const filesToProcess = extractedFiles.slice(0, maxFilesFromZip);
        
        console.log(`Processing ${filesToProcess.length} files from ZIP: ${zipFile.name}`);
        let processedCount = 0;
        // Process each extracted file individually (not the ZIP file itself)
        for (let i = 0; i < filesToProcess.length; i++) {
            const extractedFile = filesToProcess[i];
            
            // Report progress if callback provided
            if (onZipProgress) {
                onZipProgress(i + 1, filesToProcess.length);
            }
            // Check if it's a nested ZIP file
            if (extractNestedZips && getFileExtension(extractedFile.name) === 'zip') {
                // Recursively process nested ZIP
                await processZipFileAsync(extractedFile, {
                    ...options,
                    extractNestedZips: false // Prevent infinite recursion
                });
            } else {
                // Validate the extracted file before processing
                const validation = validateFile(extractedFile, {
                    disallowedExtensions: fileOptions.disallowedExtensions,
                    allowedExtensions: fileOptions.allowedExtensions
                });
                if (validation.isValid) {
                    // Log stats event for the extracted file
                    fileOptions.statsService.attachFileEvent(extractedFile, fileOptions.uploadDocuments);
                    // Resolve RAG configuration
                    const ragEnabled = resolveRagConfiguration(
                        fileOptions.featureFlags, 
                        fileOptions.ragOn || false, 
                        fileOptions.disableRag
                    );
                    const zipFileName = zipFile.name.replace(/\.zip$/i, '');
                    const tags = [zipFileName];
                    // Process the extracted file (this will call onAttach for each individual file)
                    handleFile(
                        extractedFile,
                        fileOptions.onAttach, // This attaches the individual extracted file, not the ZIP
                        fileOptions.onUploadProgress,
                        fileOptions.onSetKey,
                        fileOptions.onSetMetadata,
                        fileOptions.onSetAbortController,
                        fileOptions.uploadDocuments,
                        fileOptions.groupId,
                        ragEnabled,
                        fileOptions.props || {},
                        tags
                    );
                    
                    processedCount++;
                } else {
                    console.warn(`Skipping invalid file from ZIP: ${extractedFile.name} - ${validation.errorMessage}`);
                }
            }
        }
        console.log(`Completed processing ZIP file: ${zipFile.name}. Processed ${processedCount} valid files.`);
        
        // Notify completion with count of successfully processed files
        if (onZipExtractionComplete) {
            onZipExtractionComplete(processedCount);
        }
        
    } catch (error) {
        console.error('Error processing ZIP file:', error);
        alert(`Failed to process ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
// ============================================================================
// PROCESSING UTILITIES
// ============================================================================
/**
 * Resolve RAG configuration based on feature flags and settings
 */
export function resolveRagConfiguration(
    featureFlags: any,
    ragOn: boolean,
    disableRag?: boolean
): boolean {
    if (disableRag !== undefined) {
        return featureFlags.ragEnabled && !disableRag;
    }
    return resolveRagEnabled(featureFlags, ragOn);
}
/**
 * Generate a filename for pasted files that don't have names
 */
export function generatePastedFileName(file: File): string {
    return file.name || `pasted-${Date.now()}.${file.type.split('/')[1] || 'txt'}`;
}
/**
 * Process a single file through the validation and attachment workflow
 */
export function processSingleFile(
    file: File,
    options: FileProcessorOptions
): void {
    const {
        disallowedExtensions,
        allowedExtensions,
        onAttach,
        onUploadProgress,
        onSetKey,
        onSetMetadata,
        onSetAbortController,
        statsService,
        featureFlags,
        ragOn = false,
        uploadDocuments,
        groupId,
        disableRag,
        generateFileName,
        props = {}
    } = options;
    // Generate filename for pasted files if needed
    const processedFile = generateFileName ? 
        new File([file], generateFileName(file), { type: file.type }) : 
        file;
    // Check if it's a ZIP file and process accordingly
    if (getFileExtension(processedFile.name) === 'zip') {
        // Process ZIP file asynchronously - this will attach individual files, not the ZIP
        processZipFileAsync(processedFile, {
            ...options,
            onZipExtractionComplete: (count) => {
                console.log(`ZIP extraction complete. ${count} files were successfully processed from ${processedFile.name}`);
            }
        } as ZipProcessorOptions)
            .catch(error => {
                console.error('Failed to process ZIP file:', error);
            });
        return; // Don't process the ZIP file itself
    }
    // Validate the file (for non-ZIP files)
    const validation = validateFile(processedFile, {
        disallowedExtensions,
        allowedExtensions
    });
    if (!validation.isValid) {
        alert(validation.errorMessage);
        return;
    }
    // Log stats event
    statsService.attachFileEvent(processedFile, uploadDocuments);
    // Resolve RAG configuration
    const ragEnabled = resolveRagConfiguration(featureFlags, ragOn, disableRag);
    // Process the file
    handleFile(
        processedFile,
        onAttach,
        onUploadProgress,
        onSetKey,
        onSetMetadata,
        onSetAbortController,
        uploadDocuments,
        groupId,
        ragEnabled,
        props,
        []
    );
}
/**
 * Process multiple files through the validation and attachment workflow
 */
export function processFiles(
    files: File[] | FileList,
    options: FileProcessorOptions
): void {
    const fileArray = Array.from(files);
    
    fileArray.forEach((file) => {
        processSingleFile(file, options);
    });
}
// ============================================================================
// SPECIALIZED PROCESSING FUNCTIONS
// ============================================================================
/**
 * Process files from drag and drop events
 */
export function processDragDropFiles(
    files: File[] | FileList,
    options: Omit<FileProcessorOptions, 'generateFileName' | 'allowedExtensions'>
): void {
    processFiles(files, {
        ...options,
        allowedExtensions: undefined
    });
}
/**
 * Process files from clipboard paste events
 */
export function processPastedFiles(
    files: File[] | FileList,
    options: Omit<FileProcessorOptions, 'generateFileName' | 'allowedExtensions'>
): void {
    processFiles(files, {
        ...options,
        allowedExtensions: undefined,
        generateFileName: generatePastedFileName
    });
}
/**
 * Process files from file input elements with ZIP support
 */
export function processInputFiles(
    files: File[] | FileList,
    options: FileProcessorOptions
): void {
    processFiles(files, options);
}
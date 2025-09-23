import { COMMON_DISALLOWED_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS } from './app/const';
import { handleFile } from '@/components/Chat/AttachFile';
import { resolveRagEnabled } from '@/types/features';
import { AttachedDocument } from '@/types/attacheddocument';

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

    // Validate the file
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
        props
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
 * Process files from file input elements
 */
export function processInputFiles(
    files: File[] | FileList,
    options: FileProcessorOptions
): void {
    processFiles(files, options);
}
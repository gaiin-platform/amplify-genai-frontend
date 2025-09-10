import { useState, useCallback } from 'react';
import { CsvUploadConfig, CsvPreviewConfig, CsvUploadResult } from '@/types/csvUpload';

export interface UseCsvUploadOptions<T> {
    uploadConfig: CsvUploadConfig<T>;
    previewConfig: CsvPreviewConfig;
    existingItems: T[];
    onImportComplete: (items: T[]) => void;
    onImportSuccess?: (items: T[]) => void;
    onImportError?: (error: Error) => void;
}

export interface CsvUploadState<T> {
    // UI State
    showUpload: boolean;
    showPreview: boolean;
    isProcessing: boolean;
    
    // Data State
    uploadResult: CsvUploadResult<T> | null;
    
    // Actions
    openUpload: () => void;
    closeUpload: () => void;
    closePreview: () => void;
    handleUploadSuccess: (result: CsvUploadResult<T>) => void;
    handleImportConfirm: (items: T[]) => void;
    handleCancel: () => void;
    
    // Computed
    hasOpenModal: boolean;
}

export function useCsvUpload<T = string>(options: UseCsvUploadOptions<T>): CsvUploadState<T> {
    const [showUpload, setShowUpload] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadResult, setUploadResult] = useState<CsvUploadResult<T> | null>(null);

    const openUpload = useCallback(() => {
        setShowUpload(true);
    }, []);

    const closeUpload = useCallback(() => {
        setShowUpload(false);
    }, []);

    const closePreview = useCallback(() => {
        setShowPreview(false);
        setUploadResult(null);
    }, []);

    const handleUploadSuccess = useCallback((result: CsvUploadResult<T>) => {
        setUploadResult(result);
        setShowUpload(false);
        setShowPreview(true);
    }, []);

    const handleImportConfirm = useCallback(async (items: T[]) => {
        setIsProcessing(true);
        
        try {
            await options.onImportComplete(items);
            options.onImportSuccess?.(items);
            
            // Close modals and reset state
            setShowPreview(false);
            setUploadResult(null);
        } catch (error) {
            options.onImportError?.(error instanceof Error ? error : new Error('Import failed'));
        } finally {
            setIsProcessing(false);
        }
    }, [options]);

    const handleCancel = useCallback(() => {
        setShowUpload(false);
        setShowPreview(false);
        setUploadResult(null);
        setIsProcessing(false);
    }, []);

    const hasOpenModal = showUpload || showPreview;

    return {
        // UI State
        showUpload,
        showPreview,
        isProcessing,
        
        // Data State
        uploadResult,
        
        // Actions
        openUpload,
        closeUpload,
        closePreview,
        handleUploadSuccess,
        handleImportConfirm,
        handleCancel,
        
        // Computed
        hasOpenModal
    };
}
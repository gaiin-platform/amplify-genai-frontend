import React, {FC, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {IconArrowNarrowLeft, IconDownload, IconFolder, IconCheck, IconX} from "@tabler/icons-react";
import { BatchProcessModal, BatchProgress } from './BatchProcessModal';
import {
    MantineReactTable,
    useMantineReactTable,
    type MRT_ColumnDef, MRT_SortingState, MRT_ColumnFiltersState, MRT_Cell, MRT_TableInstance,
} from 'mantine-react-table';
import {MantineProvider, ScrollArea} from "@mantine/core";
import HomeContext from "@/pages/api/home/home.context";
import { downloadFileFromPresignedUrl } from '@/utils/app/files';
import ActionButton from '../ReusableComponents/ActionButton';
import { downloadIntegrationFile, listIntegrationFiles } from '@/services/oauthIntegrationsService';
import { loading } from '../Admin/AdminUI';
import toast from 'react-hot-toast';
import { getExtensionFromFilename, getFileTypeFromExtension, getFirstMimeTypeFromCommonName, mimeTypeToCommonName } from '@/utils/app/fileTypeTranslations';
import { capitalize } from '@/utils/app/data';
import Checkbox from '../ReusableComponents/CheckBox';
import { IntegrationFileRecord } from '@/types/integrations';


interface Props {
    driveId: string;
    onDataSourceSelected?: (file: File) => void;
    visibleColumns?: string[];
    visibleTypes?: string[];
    tableParams?: { [key: string]: any };
    height?: string;
    disallowedFileExtensions?: string[];
    enableDownload?: boolean;
    // New props for selection mode
    onItemSelected?: (file: IntegrationFileRecord, isChecked: boolean) => void;
    onBatchItemSelected?: (files: IntegrationFileRecord[]) => void;
    isItemSelected?: (fileId: string, isFolder: boolean) => boolean;
    isItemAutoSelected?: (fileId: string, isFolder: boolean) => boolean;
    onFolderPathChange?: (folderHistory: Array<{id: string | null, name: string}>) => void;
}

const DataSourcesTableScrollingIntegrations: FC<Props> = ({ driveId,
                                                  visibleTypes,
                                                  onDataSourceSelected,
                                                  visibleColumns,
                                                  tableParams,
                                                  height,
                                                  disallowedFileExtensions,
                                                  enableDownload,
                                                  onItemSelected,
                                                  onBatchItemSelected,
                                                  isItemSelected,
                                                  isItemAutoSelected,
                                                  onFolderPathChange,
                                              }) => {

    const {
        state: {lightMode, featureFlags, statsService}, setLoadingMessage
    } = useContext(HomeContext);

    // Helper function to determine if an item is a folder/directory
    const isFolder = (item: IntegrationFileRecord): boolean => /folder|directory|site|library/i.test(item.mimeType);

    const [data, setData] = useState<IntegrationFileRecord[]>([]);

    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
        [],
    );

    const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([]);
    const folderCacheRef = useRef<{ [key: string]: IntegrationFileRecord[] }>({})

    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Batch selection state (only for ChatInput context)
    const [isSelectMultipleMode, setIsSelectMultipleMode] = useState(false);
    const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
    const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const abortBatchRef = useRef(false);

    const ROOT = 'root';

    // Determine if we're in ChatInput context (show Select Multiple) vs AssistantDriveDataSources context (already has checkboxes)
    const shouldShowSelectMultiple = onDataSourceSelected && !onItemSelected;

    const getTypeFromCommonName = (commonName: string, filename: string) => {
        switch (commonName) {
            case 'folder':
                return `${capitalize(driveId.split('_')[0])} Drive Folder`;
            case 'file':
                const extension = getExtensionFromFilename(filename);
                return extension ? getFileTypeFromExtension(extension) : "text/plain";
            default:
                return commonName in mimeTypeToCommonName ? mimeTypeToCommonName[commonName] : commonName;
        }
    }

    const getExtendedTypeFromMimeType = (mimeType: string, filename: string): string => {
        if (mimeType === 'file') {
            // For generic "file" type, determine type from extension
            let fileType = "text/plain";
            const extension = getExtensionFromFilename(filename);
            if (extension) {
                const displayName = getFileTypeFromExtension(extension);
                const updatedType = (getFirstMimeTypeFromCommonName(displayName) ?? getFirstMimeTypeFromCommonName(displayName.split(" ")[0]))
                if (updatedType) fileType = updatedType;
            }
            return fileType;
        } else {
            return mimeType;
        }
    };


    const fetchFiles = async (folderId:string = '') => {
        const cacheKey = folderId || ROOT;

        if (folderCacheRef.current[cacheKey]) {
            setData(folderCacheRef.current[cacheKey]);
            setIsLoading(false);
            return;
        }
        // setIsLoading(true);
        let data: {integration: string, folder_id?:string} = {integration: driveId};
        if (folderId) data.folder_id = folderId;
        const result = await listIntegrationFiles(data);
        if (result.success) {
            let files = result.data
            .map((f: IntegrationFileRecord) => {
                return {...f, mimeType: getTypeFromCommonName(f.mimeType, f.name), type: getExtendedTypeFromMimeType(f.mimeType, f.name)}
            })

            if (disallowedFileExtensions && disallowedFileExtensions.length > 0) {
                files = files.filter((file: IntegrationFileRecord) => {
                    // Skip folders from filtering
                    if (isFolder(file)) return true;
                    const extension = getExtensionFromFilename(file.name)
                    return extension ? !disallowedFileExtensions.includes(extension) : true;
                });
            }

            files.sort((a:IntegrationFileRecord, b:IntegrationFileRecord) => {
                const aIsFolder = isFolder(a);
                const bIsFolder = isFolder(b);
                if (aIsFolder && !bIsFolder) return -1;
                if (!aIsFolder && bIsFolder) return 1;
                return a.name.localeCompare(b.name);
              });
            // console.log("files: ", files);
            setData(files);
            setIsError(false);
            setIsLoading(false);
            folderCacheRef.current[cacheKey] = files
        } else {
            setData([]);
            setIsError(true);
            setIsLoading(false);
        }
    }

    useEffect(() => {
            if (loading) setData([]);
            if (Object.keys(folderCacheRef.current).length === 0) fetchFiles();
            // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

 
    // Handler for breadcrumb navigation clicks.
    const navigateToFolder = (index?: number) => {
        // If index is -1, navigate to root.
        let newHistory: { id: string | null; name: string }[];
        setIsLoading(true);
        if (index === undefined) {
            setFolderHistory([]);
            onFolderPathChange?.([]);
            fetchFiles();
            return;
        } else {
            newHistory = folderHistory.slice(0, index + 1);
            setFolderHistory(newHistory);
            onFolderPathChange?.(newHistory);
            const newFolderId = newHistory.length > 0 ? newHistory[index].id : "";
            // Fetch from cache or call API
            fetchFiles(newFolderId || '');
        }
       
    };


    // Render the breadcrumb bar.
    const renderBreadcrumbs = () => {
        return !folderHistory ? null : (
        <div className="bottom-2 flex items-center p-2 pb-2 border-b">
            {folderHistory.length > 0 && (
            <>
            <ActionButton
                    handleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigateToFolder();
                    }}
                    title="Navigate to root">
                    <IconArrowNarrowLeft size={20} />
            </ActionButton>
            {folderHistory.map((item, index) => (
                <React.Fragment key={item.id || index}>
                    <span className="mx-1 text-gray-500">/</span>
                    <button
                    className="cursor-pointer text-blue-500 hover:text-blue-700"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigateToFolder(index)
                    }}
                    disabled={folderHistory.slice(-1)[0]?.id === item.id}
                    >
                    {item.name}
                    </button>
                </React.Fragment>
            ))}
            </>
            )}

        </div>
        );
    };

    const downloadFile = async (item: IntegrationFileRecord) => {
        setLoadingMessage("Preparing to Download...");
        let success = false;
        try {
            if (item.downloadLink) {
                await new Promise(resolve => setTimeout(resolve, 700));
                success = downloadFileFromPresignedUrl(item.downloadLink, item.name);
            } else {
                const downloadLinkData = await getDownloadLinkData(item.id);
                success = downloadFileFromPresignedUrl(downloadLinkData, item.name);
            }
            if (!success) {
                alert("We are unable to download this file at this time. Please try again later...");
            }
        } finally {
            setLoadingMessage("");
        } 
    }

    const getDownloadLinkData = async (fileId: string, directDownload: boolean = true) => {
        const downloadLinkResult = await downloadIntegrationFile({"integration": driveId, "file_id": fileId, "direct_download": directDownload});
        if (downloadLinkResult && downloadLinkResult.success) {
            return downloadLinkResult.data;
        } else {
            alert("We are unable to retrieve this file at this time. Please try again later...");
        }
        return null;
    }

    // Batch selection functions
    const toggleFileSelection = (id: string) => {
        // Find the file record to check sensitivity
        const fileRecord = data.find(f => f.id === id);
        if (fileRecord && !isFolder(fileRecord) && fileRecord.sensitivity === 4) {
            toast.error(fileRecord.attentionNote || 'This file contains sensitive data and cannot be selected.');
            return;
        }

        const newSelected = new Set(selectedForBatch);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedForBatch(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedForBatch.size === data.length) {
            setSelectedForBatch(new Set());
        } else {
            // Exclude Level 4 sensitive files from "Select All"
            const selectableFiles = data.filter(file =>
                isFolder(file) || !file.sensitivity || file.sensitivity < 4
            );
            setSelectedForBatch(new Set(selectableFiles.map(file => file.id)));
        }
    };

    // Recursively fetch all files in a folder (and subfolders)
    const fetchAllFilesInFolder = async (folderId: string): Promise<IntegrationFileRecord[]> => {
        try {
            const result = await listIntegrationFiles({ integration: driveId, folder_id: folderId });

            if (!result.success) {
                console.error('Failed to fetch folder contents:', folderId);
                return [];
            }

            let allFiles: IntegrationFileRecord[] = [];
            const items = result.data.map((f: IntegrationFileRecord) => {
                return {...f, mimeType: getTypeFromCommonName(f.mimeType, f.name), type: getExtendedTypeFromMimeType(f.mimeType, f.name)}
            });

            // Filter disallowed extensions
            const filteredItems = disallowedFileExtensions && disallowedFileExtensions.length > 0
                ? items.filter((file: IntegrationFileRecord) => {
                    if (isFolder(file)) return true;
                    const extension = getExtensionFromFilename(file.name);
                    return extension ? !disallowedFileExtensions.includes(extension) : true;
                })
                : items;

            for (const item of filteredItems) {
                const itemIsFolder = isFolder(item);

                if (itemIsFolder) {
                    // Recursively get files from this subfolder
                    const subFolderFiles = await fetchAllFilesInFolder(item.id);
                    allFiles = [...allFiles, ...subFolderFiles];
                } else {
                    // Add this file to the list
                    allFiles.push(item);
                }
            }

            return allFiles;
        } catch (error) {
            console.error('Error fetching folder contents:', error);
            return [];
        }
    };

    // Process batch selection
    const processBatchSelection = async (itemsToProcess: IntegrationFileRecord[]) => {
        abortBatchRef.current = false;
        setIsBatchProcessing(true);

        // Separate folders and files
        const folders: IntegrationFileRecord[] = [];
        const files: IntegrationFileRecord[] = [];

        itemsToProcess.forEach(item => {
            const itemIsFolder = isFolder(item);
            if (itemIsFolder) {
                folders.push(item);
            } else {
                files.push(item);
            }
        });

        // Fetch all files from folders
        let allFilesToProcess: IntegrationFileRecord[] = [...files];

        if (folders.length > 0) {
            // Show modal with scanning state
            const scanningProgress: BatchProgress = {
                total: 0,
                completed: 0,
                failed: [],
                currentFile: null,
                isComplete: false,
                scanningFolders: true,
                scanningMessage: `Scanning ${folders.length} folder(s)...`
            };
            setBatchProgress(scanningProgress);
            setShowBatchModal(true);

            for (const folder of folders) {
                if (abortBatchRef.current) break;

                const folderFiles = await fetchAllFilesInFolder(folder.id);
                allFilesToProcess = [...allFilesToProcess, ...folderFiles];
            }
        }

        if (abortBatchRef.current) {
            setIsBatchProcessing(false);
            setShowBatchModal(false);
            setBatchProgress(null);
            return;
        }

        // Initialize progress
        const progress: BatchProgress = {
            total: allFilesToProcess.length,
            completed: 0,
            failed: [],
            currentFile: null,
            isComplete: false,
            scanningFolders: false
        };

        setBatchProgress(progress);
        setShowBatchModal(true);

        // Process each file
        for (let i = 0; i < allFilesToProcess.length; i++) {
            if (abortBatchRef.current) break;

            const file = allFilesToProcess[i];

            // Update current file
            setBatchProgress(prev => prev ? { ...prev, currentFile: file.name } : null);

            try {
                // Use existing onFileSelected logic
                await processFileUpload(file);

                // Success
                setBatchProgress(prev => prev ? {
                    ...prev,
                    completed: prev.completed + 1,
                    currentFile: i === allFilesToProcess.length - 1 ? null : prev.currentFile
                } : null);

            } catch (error) {
                // Failure
                setBatchProgress(prev => prev ? {
                    ...prev,
                    completed: prev.completed + 1,
                    failed: [...prev.failed, { file, error: error instanceof Error ? error.message : 'Unknown error' }],
                    currentFile: i === allFilesToProcess.length - 1 ? null : prev.currentFile
                } : null);
            }

            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Mark as complete
        setBatchProgress(prev => prev ? { ...prev, isComplete: true, currentFile: null } : null);
        setIsBatchProcessing(false);
        setIsSelectMultipleMode(false);
        setSelectedForBatch(new Set());
    };

    // Extract file processing logic from onFileSelected
    const processFileUpload = async (item: IntegrationFileRecord): Promise<void> => {
        // Block Level 4 sensitive files
        if (item.sensitivity === 4) {
            throw new Error(item.attentionNote || 'This file contains sensitive data and cannot be accessed.');
        }

        const downloadLink = await getDownloadLinkData(item.id, false);

        if (!downloadLink) {
            throw new Error('Failed to get download link');
        }

        const response = await fetch(downloadLink);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);

        const fileBlob = await response.blob();

        const extension = getExtensionFromFilename(item.name);
        const actualMimeType = extension ?
            getFileTypeFromExtension(extension) :
            (fileBlob.type || "application/octet-stream");

        const file = new File(
            [fileBlob],
            item.name,
            {
              type: actualMimeType,
              lastModified: new Date().getTime()
            }
        );

        statsService.attachFileEvent(file, featureFlags.uploadDocuments);

        if (onDataSourceSelected) onDataSourceSelected(file);
    };

    const handleConfirmBatchSelection = async () => {
        if (selectedForBatch.size === 0) {
            toast.error('No files selected');
            return;
        }

        const itemsToProcess = data.filter(item => selectedForBatch.has(item.id));
        await processBatchSelection(itemsToProcess);
    };

    const handleCancelBatch = () => {
        abortBatchRef.current = true;
        setShowBatchModal(false);
        setBatchProgress(null);
        setIsBatchProcessing(false);
    };

    const handleRetryFailed = async (failedFiles: IntegrationFileRecord[]) => {
        setShowBatchModal(false);
        setBatchProgress(null);
        await processBatchSelection(failedFiles);
    };

    const handleCloseBatchModal = () => {
        setShowBatchModal(false);
        setBatchProgress(null);
    };

    const onFileSelected = async (item: IntegrationFileRecord) => {
        // Block Level 4 sensitive files immediately
        if (item.sensitivity === 4) {
            toast.error(item.attentionNote || 'This file contains sensitive data and cannot be accessed.');
            return;
        }

        setLoadingMessage("Preparing Document for Upload...");
        // have to get a download link because we need to get the file contents which is only doable by saving it in our internal servers

        const downloadLink = await getDownloadLinkData(item.id, false);
        // console.log("downloadLink: ", downloadLink);
        if (downloadLink) {
            try {

                const response = await fetch(downloadLink);
                if (!response.ok) throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);

                const fileBlob = await response.blob();

                const extension = getExtensionFromFilename(item.name);
                const actualMimeType = extension ?
                    getFileTypeFromExtension(extension) :
                    (fileBlob.type || "application/octet-stream");

                const file = new File(
                    [fileBlob],
                    item.name,
                    {
                      type: actualMimeType,
                      lastModified: new Date().getTime()
                    }
                  );

                statsService.attachFileEvent(file, featureFlags.uploadDocuments);

                setLoadingMessage("");

                if (onDataSourceSelected) onDataSourceSelected(file);

              } catch (error) {
                console.error('Error fetching or displaying file:', error);
                alert("Error fetching the file contents at this time. Please try again later...");
                return;
              }

        }
        setLoadingMessage("");

    }


    // Check if we're inside a folder and if the parent folder is NOT selected
    const currentFolderId = folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].id : null;
    const isCurrentFolderSelected = currentFolderId && isItemSelected
        ? isItemSelected(currentFolderId, true)
        : false;

    // Check if all items in the current folder are already selected
    const areAllItemsSelected = () => {
        if (!isItemSelected || data.length === 0) return false;

        // Filter out Level 4 sensitive files (which can't be selected)
        const selectableItems = data.filter(item => {
            const itemIsFolder = isFolder(item);
            const isSensitive = !itemIsFolder && item.sensitivity === 4;
            return !isSensitive;
        });

        if (selectableItems.length === 0) return false;

        // Check if all selectable items are selected
        return selectableItems.every(item => {
            const itemIsFolder = isFolder(item);
            return isItemSelected(item.id, itemIsFolder);
        });
    };

    const allItemsAlreadySelected = areAllItemsSelected();
    const shouldShowSelectAllItems = onItemSelected && currentFolderId && !isCurrentFolderSelected && !allItemsAlreadySelected;

    // Handler for "Select All Items" button
    const handleSelectAllItems = useCallback(() => {
        
        // Collect all items to select (exclude Level 4 sensitive files)
        const itemsToSelect = data.filter(item => {
            const itemIsFolder = isFolder(item);
            const isSensitiveFile = !itemIsFolder && item.sensitivity === 4;
            return !isSensitiveFile;
        });

        // Use batch selection if available, otherwise fall back to sequential
        if (onBatchItemSelected) {
            onBatchItemSelected(itemsToSelect);
        } else {
            itemsToSelect.forEach(item => {
                onItemSelected?.(item, true);
            });
        }
    }, [data, onItemSelected, onBatchItemSelected]);

    //should be memoized or stable
    const allColumns = useMemo<MRT_ColumnDef<IntegrationFileRecord>[]>(
        () => [
            {
                accessorKey: 'name',
                header: 'Name',
                enableSorting: false, // Disable sorting on Name column
                Header: (shouldShowSelectMultiple || shouldShowSelectAllItems) ? () => (
                    <div className="flex items-center gap-1">
                        <span>Name</span>
                        {shouldShowSelectAllItems && !isSelectMultipleMode && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelectAllItems();
                                }}
                                className="text-xs px-1.5 py-0.5 ml-1 mr-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                                title="Select all items in this folder individually"
                            >
                                Select All Items
                            </button>
                        )}
                        {shouldShowSelectMultiple && !isSelectMultipleMode && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsSelectMultipleMode(true);
                                }}
                                className="text-xs px-1.5 py-0.5 ml-1 mr-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                            >
                                Select Multiple
                            </button>
                        )}
                        {isSelectMultipleMode && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleSelectAll();
                                    }}
                                    className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                                >
                                    {selectedForBatch.size === data.length && data.length > 0 ? 'Deselect All' : 'Select All'}
                                </button>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                    ({selectedForBatch.size})
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleConfirmBatchSelection();
                                    }}
                                    disabled={selectedForBatch.size === 0}
                                    className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title="Confirm Selection"
                                >
                                    <IconCheck size={16} className="text-green-600 dark:text-green-400" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsSelectMultipleMode(false);
                                        setSelectedForBatch(new Set());
                                    }}
                                    className="p-1 mr-3 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                                    title="Cancel"
                                >
                                    <IconX size={16} className="text-red-600 dark:text-red-400" />
                                </button>
                            </>
                        )}
                    </div>
                ) : undefined,
                size: 200,
                maxSize: 300,
                Cell: ({ cell, row }) => {
                  const record = row.original;
                  const itemIsFolder = isFolder(record);
                  const displayName = record.name;
                  const isSelected = isItemSelected ? isItemSelected(record.id, itemIsFolder) : false;
                  const isAutoSelected = isItemAutoSelected ? isItemAutoSelected(record.id, itemIsFolder) : false;
                  const isBatchSelected = selectedForBatch.has(record.id);

                  return (
                    <div className="flex flex-row items-center gap-2">
                      {/* Checkbox for assistant data source selection (existing) */}
                      {/* Don't show checkbox for Level 4 sensitive files */}
                      {onItemSelected && !(!itemIsFolder && record.sensitivity === 4) && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          title={
                            isAutoSelected
                              ? "To deselect items within, uncheck the parent folder."
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            id={`checkbox-${record.id}`}
                            checked={isSelected}
                            disabled={isAutoSelected}
                            onChange={(e) => onItemSelected(record, e.target.checked)}
                            style={isAutoSelected ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                          />
                        </div>
                      )}

                      {/* Checkbox for batch selection (new - ChatInput context) */}
                      {/* Don't show checkbox for Level 4 sensitive files */}
                      {isSelectMultipleMode && shouldShowSelectMultiple && !(!itemIsFolder && record.sensitivity === 4) && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <input
                            type="checkbox"
                            id={`batch-checkbox-${record.id}`}
                            checked={isBatchSelected}
                            onChange={() => toggleFileSelection(record.id)}
                          />
                        </div>
                      )}

                      {/* File/Folder content */}
                      <div className="flex-1">
                        {itemIsFolder ? (
                          <div className="flex flex-row items-center gap-2">
                            <IconFolder size={16} className="flex items-center" />
                            <span
                              className="text-gray-400 cursor-pointer hover:text-blue-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Use functional update to avoid stale closure
                                setFolderHistory((prevHistory) => {
                                //   console.log('Current folderHistory:', prevHistory);
                                  const newHistory = [...prevHistory, { id: record.id, name: record.name }];
                                //   console.log('New history:', newHistory);
                                  onFolderPathChange?.(newHistory);
                                  return newHistory;
                                });
                                setIsLoading(true);
                                fetchFiles(record.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Use functional update to avoid stale closure
                                  setFolderHistory((prevHistory) => {
                                    const newHistory = [...prevHistory, { id: record.id, name: record.name }];
                                    onFolderPathChange?.(newHistory);
                                    return newHistory;
                                  });
                                  setIsLoading(true);
                                  fetchFiles(record.id);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              {displayName}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-row items-center gap-2">
                            <span
                              className={record.sensitivity === 4 ? "text-gray-500 dark:text-gray-500" : ""}
                              title={record.sensitivity === 4 ? "This file cannot be accessed due to sensitivity restrictions" : undefined}
                            >
                              {displayName}
                            </span>
                            {/* Sensitivity indicator text label - moved to right of filename */}
                            {record.sensitivity && record.sensitivity > 1 && (
                              <span
                                className={`text-xs font-medium flex-shrink-0 ${
                                  record.sensitivity === 4 ? 'text-red-500' :
                                  record.sensitivity === 3 ? 'text-orange-500' :
                                  'text-yellow-600 dark:text-yellow-500'
                                }`}
                                title={
                                  record.sensitivity === 4 ? 'Level 4 - Confidential (Access Restricted)' :
                                  record.sensitivity === 3 ? 'Level 3 - Private/Internal' :
                                  'Level 2 - Personal'
                                }
                              >
                                {record.sensitivity === 4 ? 'Level 4 Critical' :
                                 record.sensitivity === 3 ? 'Level 3' :
                                 'Level 2'}
                              </span>
                            )}
                            {enableDownload && record.sensitivity !== 4 && (
                              <div className="ml-auto">
                                <ActionButton
                                  title="Download File"
                                  handleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    downloadFile(record);
                                  }}
                                >
                                  <IconDownload size={22} />
                                </ActionButton>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              },
              {
                accessorKey: 'size',
                header: 'Size',
                size: 60,
                enableColumnFilter: false,
                enableSorting: false,
                Cell: ({cell}) => (
                    <span>{cell.getValue<string>()}</span>
                ),
                Edit: ({cell, column, table}) => <>{cell.getValue<string>()}</>,
                },
                {
                    accessorKey: 'mimeType',
                    header: 'Type',
                    size: 100,
                    maxSize: 100,
                    enableSorting: false,
                    Edit: ({cell, column, table}) => <>{cell.getValue<string>()}</>,
                },
        ],
        [enableDownload, featureFlags.uploadDocuments, isItemSelected, onItemSelected, isSelectMultipleMode, selectedForBatch, data, shouldShowSelectMultiple, shouldShowSelectAllItems, isItemAutoSelected, handleSelectAllItems],
    );

    const columns = allColumns.filter(
        c => {
            return !visibleColumns || visibleColumns.some(cv => cv === c.accessorKey)
        });



    const table = useMantineReactTable({
        columns,
        data,
        mantineEditRowModalProps: {
            closeOnClickOutside: true,
            withCloseButton: true,
        },
        enableColumnResizing: true,
        editDisplayMode: 'cell',
        enableFullScreenToggle: false,
        enableTableFooter: false,
        //enableRowSelection: true,
        // @ts-ignore
        getRowId: (row) => row["__id"],
        initialState: {showColumnFilters: true},
        manualFiltering: false,
        manualPagination: true,
        manualSorting: true,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        // onPaginationChange: setPagination,
        onSortingChange: setSorting,
        enableStickyHeader: true,
        enableBottomToolbar: false,
        state: {
            columnFilters,
            globalFilter,
            isLoading: isLoading,
            showAlertBanner: isError,
            sorting,
        },
        mantineTableBodyRowProps: ({ row }) => {
            const record = row.original;
            const itemIsFolder = isFolder(record);
            const isLevel4Sensitive = !itemIsFolder && record.sensitivity === 4;

            return {
              onClick: (event) => {
                event.preventDefault();

                // Block Level 4 sensitive files
                if (isLevel4Sensitive) {
                  toast.error(record.attentionNote || 'This file contains sensitive data and cannot be accessed.');
                  return;
                }

                // If in select multiple mode, toggle selection instead of normal behavior
                if (isSelectMultipleMode && shouldShowSelectMultiple) {
                  toggleFileSelection(record.id);
                  return;
                }

                if (itemIsFolder) {
                  // Use functional update to avoid stale closure
                  setFolderHistory((prevHistory) => {
                    const newHistory = [...prevHistory, { id: record.id, name: record.name }];
                    onFolderPathChange?.(newHistory);
                    return newHistory;
                  });
                  setIsLoading(true);
                  fetchFiles(record.id);
                } else {
                  if (!featureFlags.uploadDocuments) {
                      toast("Uploading documents is disabled.");
                  } else if (onDataSourceSelected) {
                      onFileSelected(record);
                  }
                }
              },
              sx: {
                cursor: isLevel4Sensitive ? 'not-allowed' : 'pointer',
                opacity: isLevel4Sensitive ? 0.6 : 1,
              },
            };
          },
        mantineTableContainerProps: {
            ref: tableContainerRef,
            sx: {maxHeight:  height ?? '400px'}
        },
        mantineToolbarAlertBannerProps: isError
            ? {color: 'red', children: 'Error loading data'}
            : undefined,
        ...(tableParams || {})
    });

    return (
        <div key={driveId}>
            <MantineProvider
                theme={{
                    colorScheme: lightMode, // or 'light', depending on your preference or state
                    colors: {
                        dark: ["#dddddd", "#000000", "#000000", "#555765", "#343541", "#343541", "#343541", "#343541"]
                    },
                    primaryShade: 1,
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <ScrollArea onScroll={() =>{}} style={{ flex: 1 }}>
                        <MantineReactTable table={table} />
                    </ScrollArea>
                    {renderBreadcrumbs()}
                </div>
            </MantineProvider>

            {/* Batch Process Modal */}
            {showBatchModal && batchProgress && (
                <BatchProcessModal
                    progress={batchProgress}
                    onCancel={handleCancelBatch}
                    onRetry={handleRetryFailed}
                    onClose={handleCloseBatchModal}
                />
            )}
        </div>)
};

export default DataSourcesTableScrollingIntegrations;
import React, {FC, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {IconDownload, IconRefresh, IconTrash, IconLoader2, IconCheck, IconX} from "@tabler/icons-react";
import toast from 'react-hot-toast';
import {Checkbox} from '@/components/ReusableComponents/CheckBox';
import {
    MantineReactTable,
    useMantineReactTable,
    type MRT_ColumnDef, MRT_SortingState, MRT_ColumnFiltersState, MRT_Cell, MRT_TableInstance,
    MRT_ToggleGlobalFilterButton,
    MRT_ToggleFiltersButton,
    MRT_ShowHideColumnsButton,
    MRT_ToggleDensePaddingButton,
} from 'mantine-react-table';
import {MantineProvider, ScrollArea} from "@mantine/core";
import HomeContext from "@/pages/api/home/home.context";
import {FileQuery, FileRecord, PageKey, queryUserFiles, setTags} from "@/services/fileService";
import {TagsList} from "@/components/Chat/TagsList";
import {DataSource} from "@/types/chat";
import { v4 as uuidv4 } from 'uuid';
import { deleteDatasourceFile, downloadDataSourceFile, extractKey, getDocumentStatusConfig, startFileReprocessingWithPolling } from '@/utils/app/files';
import ActionButton from '../ReusableComponents/ActionButton';
import { mimeTypeToCommonName } from '@/utils/app/fileTypeTranslations';
import { IMAGE_FILE_TYPES } from '@/utils/app/const';
import { embeddingDocumentStaus } from '@/services/adminService';
import { capitalize } from '@/utils/app/data';
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";


interface Props {
    onDataSourceSelected?: (dataSource: DataSource) => void;
    visibleColumns?: string[];
    visibleTypes?: string[];
    tableParams?: { [key: string]: any };
    height?: string;
}

const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: #777777;
  font-size: 1.1rem;
  font-weight: bold;
  animation: ${animate} 2s infinite;
`;

const DataSourcesTableScrolling: FC<Props> = ({
                                                  visibleTypes,
                                                  onDataSourceSelected,
                                                  visibleColumns,
                                                  tableParams,
                                                  height
                                              }) => {

    const {
        state: {lightMode}, setLoadingMessage
    } = useContext(HomeContext);

    const [data, setData] = useState<FileRecord[]>(
        []
    );

    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 50, //customize the default page size
    });

    const [lastPageIndex, setLastPageIndex] = useState(0);

    const [pageKeys, setPageKeys] = useState<PageKey[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
        [],
    );
    const [previousColumnFilters, setPreviousColumnFilters] = useState<MRT_ColumnFiltersState>(
        [],
    );
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [currentMaxPageIndex, setCurrentMaxPageIndex] = useState(0);
    const [hasMoreData, setHasMoreData] = useState(true);
    const [prevSorting, setPrevSorting] = useState<string>('createdAt#desc');
    const [loadingMore, setLoadingMore] = useState(false);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    
    // Embedding status state
    const [embeddingStatus, setEmbeddingStatus] = useState<{[key: string]: string} | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    // Cache to track which files have had their status fetched
    const fetchedStatusKeys = useRef<Set<string>>(new Set());
    // Track files being reprocessed/polled
    const [pollingFiles, setPollingFiles] = useState<Set<string>>(new Set());
    
    // Multi-select delete state
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    const getTypeFromCommonName = (commonName: string) => {
        const foundType = Object.entries(mimeTypeToCommonName)
            .find(([key, value]) => value === commonName)?.[0];
        return foundType ? foundType : commonName;
    }

    const getTypesFromCommonName = (commonName: string) => {
        const foundTypes = Object.entries(mimeTypeToCommonName)
            .filter(([key, value]) => value === commonName)
            .map(([key, value]) => key);
        return foundTypes.length > 0 ? foundTypes : [commonName];
    }

    const fetchFiles = async () => {
        try {
            if(isLoading){
                return;
            }
            setIsLoading(true);

            let existingData = data;

            const globalFilterQuery = globalFilter ? globalFilter : null;

            if (globalFilterQuery) {
                setPageKeys([]); //reset page keys if global filter is set
                setLastPageIndex(0);
                existingData = [];
            }

            const sortingKey = sorting.length > 0 ? sorting[0].id + "#" + sorting[0].desc
                : 'createdAt#desc';

            if (sortingKey !== prevSorting) {
                setPageKeys([]); //reset page keys if sorting changes
                setLastPageIndex(0);
                setPrevSorting(sortingKey);
                existingData = [];
            }

            if (columnFilters !== previousColumnFilters) {
                setPageKeys([]); //reset page keys if column filters change
                setLastPageIndex(0);
                setPreviousColumnFilters(columnFilters);
                existingData = [];
            }

            let sortIndex = 'createdAt'

            const pageKeyIndex = pagination.pageIndex - 1;
            const pageKey = pageKeyIndex >= 0 ? pageKeys[pageKeyIndex] : null;
            let forwardScan =
                ((lastPageIndex < pagination.pageIndex) || !pageKey) ? false : true;

            if (sorting.length > 0) {
                const sort = sorting[0];

                console.log("Sort", sort);

                if (sort.id === 'commonType') {
                    sortIndex = 'type';
                } else {
                    sortIndex = sort.id;
                }

                forwardScan = sort.desc;
            }

            console.log("Sort Index", sortIndex, forwardScan);


            setLastPageIndex(pagination.pageIndex);

            const query: FileQuery = {
                pageSize: pagination.pageSize,
                sortIndex,
                forwardScan,
                filters: [
                    {
                    "attribute": "data.type",
                    "operator": "not_startsWith",
                    "value": "assistant"
                    }
                ]
            };
            if (pageKey) {
                query.pageKey = pageKey;
            }
            if (globalFilterQuery) {
                query.namePrefix = globalFilterQuery;
            }

            if (columnFilters.length > 0) {
                for (const filter of columnFilters) {
                    if (filter.id === 'name') {
                        query.namePrefix = "" + filter.value;
                    } else if (filter.id === 'tags') {
                        query.tags = ("" + filter.value)
                            .split(',')
                            .map((tag: string) => tag.trim());
                    } else if (filter.id === 'commonType') {
                        const mimeType = getTypeFromCommonName("" + filter.value);
                        query.typePrefix = mimeType;
                    }
                }
            }

            if(visibleTypes && visibleTypes.length > 0){
                query.types =
                    visibleTypes.flatMap(t => getTypesFromCommonName(t));
            }

            const result = await queryUserFiles(
                query, null);

            if (!result.success) {
                setIsError(true);
            }
            // dont show assistant icons in the data source table
            const items = result.data?.items;
            const updatedWithCommonNames = items?.map((file: any) => {
                const commonName = mimeTypeToCommonName[file.type];
                return {
                    ...file,
                    "__id":  uuidv4() + file.id,
                    commonType: commonName || (file.type && file.type.slice(0, 15)) || 'Unknown',
                };
            });

            if ((pageKeyIndex >= pageKeys.length - 1 || pageKeys.length === 0) && result.data.pageKey) {
                setPageKeys([...pageKeys, result.data.pageKey]);
                setHasMoreData(true);
            }

            setHasMoreData(result.data.pageKey !== null && result.data.items.length === pagination.pageSize);

            setData([...existingData, ...updatedWithCommonNames]);

            if (pageKeyIndex >= currentMaxPageIndex) {
                setCurrentMaxPageIndex(pageKeyIndex);
            }

        } catch (error) {
            setIsError(true);
            console.error(error);
            return;
        }
        setIsError(false);
        setIsLoading(false);
        setIsRefetching(false);
    };

    const fetchMoreData = useCallback(async () => {
        if (loadingMore || !hasMoreData) {
            return;
        }
        setLoadingMore(true);

        setPagination((prevPagination) => ({
            ...prevPagination,
            pageIndex: prevPagination.pageIndex + 1,
        }));

        await fetchFiles();
        //console.log(pagination.pageIndex);

        setLoadingMore(false);
    }, [loadingMore, hasMoreData, data.length]);

    const handleScroll = useCallback(() => {
        console.log("Scrolling...");

        if (tableContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
            // Check if we've scrolled to the bottom
            if ((scrollHeight - scrollTop - clientHeight < 400) &&
                !isLoading &&
                !loadingMore &&
                hasMoreData) {
                fetchMoreData();
            }
        }
    }, [fetchMoreData, isLoading, loadingMore, hasMoreData]);

    useEffect(() => {
        const scrollElement = tableContainerRef.current;
        if (scrollElement) {
            scrollElement.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (scrollElement) {
                scrollElement.removeEventListener('scroll', handleScroll);
            }
        };
    }, [handleScroll]);


    //if you want to avoid useEffect, look at the React Query example instead
    useEffect(() => {
        setData([]); //clear data when filters change
        setPageKeys([]); //clear page keys when filters change

        const fetchData = async () => {
            if (!data.length) {
                setIsLoading(true);
            } else {
                setIsRefetching(true);
            }
            fetchFiles();
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        columnFilters, //refetch when column filters change
        globalFilter, //refetch when global filter changes
        sorting, //refetch when sorting changes
    ]);

    // Fetch embedding status when data changes
    useEffect(() => {
        if (data.length > 0 && !isLoadingStatus) {
            setIsLoadingStatus(true);
            // Clear the cache when new data arrives
            fetchedStatusKeys.current.clear();
            
            // Extract keys from file records using the same logic as FileList
            const keys = data.map(file => {
                return {key: extractKey(file), type: file.type};
            }).filter(key => key) as {key: string, type: string}[];
            
            if (keys.length > 0) {
                // Break keys into chunks of 25
                const chunkSize = 25;
                const chunks: Array<{key: string, type: string}[]> = [];
                for (let i = 0; i < keys.length; i += chunkSize) {
                    chunks.push(keys.slice(i, i + chunkSize));
                }

                // Make concurrent calls for each chunk
                const statusPromises = chunks.map(chunk => 
                    embeddingDocumentStaus(chunk)
                        .then(response => {
                            if (response?.success && response?.data) {
                                // Merge results into existing state as they come in
                                setEmbeddingStatus(prevStatus => {
                                    const newStatus = {
                                        ...prevStatus,
                                        ...response.data
                                    };
                                    
                                    // Mark these keys as fetched AFTER state update
                                    chunk.forEach(item => {
                                        fetchedStatusKeys.current.add(item.key);
                                    });
                                    
                                    return newStatus;
                                });
                            } else {
                                // Still mark keys as fetched to prevent infinite loading
                                chunk.forEach(item => {
                                    fetchedStatusKeys.current.add(item.key);
                                });
                            }
                            return response;
                        })
                        .catch(error => {
                            console.error('Failed to fetch embedding status for chunk:', error);
                            return null;
                        })
                );

                // Wait for all chunks to complete, then stop loading
                Promise.allSettled(statusPromises)
                    .finally(() => {
                        setIsLoadingStatus(false);
                    });
            } else {
                setIsLoadingStatus(false);
            }
        }
    }, [data]);

    function formatIsoString(isoString: string) {
        const options: Intl.DateTimeFormatOptions = {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        };
        
        // Backend sends UTC time without 'Z' suffix, so add it
        const utcTimestamp = isoString.endsWith('Z') ? isoString : isoString + 'Z';
        const date = new Date(utcTimestamp);
        
        // toLocaleString automatically converts UTC to user's local timezone
        return date.toLocaleString('en-US', options).toLowerCase();
    }

    const downloadFile = async (id: string, name: string, fileType: string) => {

        setLoadingMessage("Preparing to Download...");
        try {
            // /assistant/files/download
            downloadDataSourceFile({id: id, name: name, type: fileType});
        } finally {
            setLoadingMessage("");
        }
    }

    const deleteFile = async (key: string) => {
        // console.log("Deleting File", key);
        setLoadingMessage("Deleting File...");
        try {
            await deleteDatasourceFile({id: key}); // TODO: check response
            setData([]); // Clear existing data to force a complete refresh
            setIsRefetching(true);
            fetchFiles(); 
        } finally {
            setLoadingMessage("");
        }
    }
    
    const deleteBatch = async () => {
        if (selectedIds.size === 0) return;
        
        const totalFiles = selectedIds.size;
        setLoadingMessage(`Deleting ${totalFiles} file(s)...`);
        
        try {
            const results = await Promise.all(
                Array.from(selectedIds).map(id => {
                    const file = data.find(f => f.id === id);
                    return deleteDatasourceFile({id, name: file?.name}, false);
                })
            );
            
            const failures = results.filter(r => !r.success);
            const successCount = results.length - failures.length;
            
            if (failures.length === 0) {
                toast.success(`Successfully deleted ${successCount} file(s)`);
            } else if (successCount === 0) {
                toast.error(`Failed to delete all ${failures.length} file(s)`);
            } else {
                toast.error(`Deleted ${successCount} file(s), but ${failures.length} failed: ${failures.map(f => f.fileName).join(', ')}`);
            }
            
            setSelectedIds(new Set());
            setShowDeleteConfirmation(false);
            setIsDeleteMode(false);
            setData([]);
            setIsRefetching(true);
            fetchFiles();
        } catch (error) {
            console.error('Error during batch delete:', error);
            toast.error('An unexpected error occurred during batch deletion');
        } finally {
            setLoadingMessage("");
        }
    }
    
    const toggleSelectAll = () => {
        if (selectedIds.size === data.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.map(file => file.id)));
        }
    }
    
    const toggleSelectId = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    }

    const fileReprocessing = async (key: string) => {
        // Find the document that will be reprocessed to get its type
        const reprocessedDoc = data.find(file => file.id === key);
        if (!reprocessedDoc) {
            console.error('Document not found for reprocessing:', key);
            return;
        }

        await startFileReprocessingWithPolling({
            key: extractKey(reprocessedDoc),
            fileType: reprocessedDoc.type,
            setPollingFiles,
            setEmbeddingStatus,
            setLoadingMessage
        });
    }

    const handleSaveCell = (table: MRT_TableInstance<FileRecord>, cell: MRT_Cell<FileRecord>, value: any) => {
        //if using flat data and simple accessorKeys/ids, you can just do a simple assignment here
        const index = cell.row.index;
        const columnId = cell.column.id;

        const existing: FileRecord[] = table.getRowModel().rows.map(row => row.original);
        const newRow = {...existing[index], [columnId]: value};

        setTags(newRow);

        const newData = [
            ...existing.slice(0, cell.row.index),
            newRow,
            ...existing.slice(cell.row.index + 1),
        ];

        setData(newData); //re-render with new data
    };

    //should be memoized or stable
    const allColumns = useMemo<MRT_ColumnDef<FileRecord>[]>(
        () => [
            {
                accessorKey: '__id', //access nested data with dot notation
                header: ' ',
                width: 18,
                size: 18,
                maxSize: 18,
                enableSorting: false,
                enableColumnActions: false,
                enableColumnFilter: false,
                Cell: ({cell}) => (
                    <ActionButton
                        title='Download File'
                        handleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            downloadFile(cell.getValue<string>().split("#")[1], cell.row.original.name, cell.row.original.type);
                        }}> 
                    <IconDownload size={20}/>
                    </ActionButton>
                ),
            },
            {
                accessorKey: 'name', //access nested data with dot notation
                header: 'Name',
                width: 200,
                size: 200,
                //enableSorting: false,
                maxSize: 300,
            },
            {
                accessorKey: 'id', //access nested data with dot notation
                header: ' ',
                width: 18,
                size: 18,
                maxSize: 18,
                enableSorting: false,
                enableColumnActions: false,
                enableColumnFilter: false,
                Cell: ({cell}) => (
                    <ActionButton
                        title='Download File'
                        handleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            downloadFile(cell.getValue<string>(), cell.row.original.name, cell.row.original.type)
                        }}> 
                    <IconDownload size={20}/>
                    </ActionButton >
                ),
            },
            {
                accessorKey: 'createdAt',
                header: 'Created',
                width: 100,
                size: 100,
                //enableSorting: false,
                enableColumnFilter: false,
                Cell: ({cell}) => (
                    <span>{formatIsoString(cell.getValue<string>())}</span>
                ),
                Edit: ({cell, column, table}) => <>{formatIsoString(cell.getValue<string>())}</>,
            },
            {
                accessorKey: 'tags', //normal accessorKey
                header: 'Tags',
                enableColumnActions: false,
                enableSorting: false,
                Cell: ({cell, table}) => {
                    const tags = cell.getValue<string[]>();

                    return <TagsList
                        tags={tags}
                        label={""}
                        maxWidth={"50px"}
                        setTags={(tags) => handleSaveCell(table, cell, tags)}/>
                }

            },
            {
                accessorKey: 'commonType',
                header: 'Type',
                //enableSorting: false,
                width: 100,
                size: 100,
                maxSize: 100,
                Edit: ({cell, column, table}) => <>{cell.getValue<string>()}</>,
            },
            {
                accessorKey: 'embeddingStatus', //embedding status column
                header: 'Status',
                width: 150,
                size: 150,
                maxSize: 150,
                enableSorting: false,
                enableColumnActions: false,
                enableColumnFilter: false,
                Cell: ({cell}) => {
                    // Use the same key extraction as the API call
                    const key = extractKey(cell.row.original);
                    const status = embeddingStatus?.[key];
                    const fileType = cell.row.original.type;
                    
                    // Show loading only if this specific file hasn't been fetched yet
                    if (!fetchedStatusKeys.current.has(key)) {
                        return (
                            <div className="flex items-center justify-start ml-4">
                                <IconLoader2 className="animate-spin text-gray-400" size={16} />
                            </div>
                        );
                    }
                    
                    if (!status) {
                        return null;
                    }

                    const config = getDocumentStatusConfig(status);
                    if (!config) {
                        return null;
                    }

                    return (
                        <div className="flex items-center justify-start gap-2">
                            <span className={`${config.color} text-xs px-1.5 py-0.5 rounded font-normal whitespace-nowrap`}>
                                {capitalize(config.text)}
                            </span>
                            {/* Show refresh button for non-completed, non-image files */}
                            {status !== 'completed' && !IMAGE_FILE_TYPES.includes(fileType) && (
                                pollingFiles.has(cell.row.original.id) ? (
                                    <LoadingIcon style={{ width: "18px", height: "18px" }} />
                                ) : (
                                    <ActionButton
                                        title='Regenerate text extraction and embeddings for this file.'
                                        handleClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (confirm("Are you sure you want to regenerate the text extraction and embeddings for this file?")) {
                                                fileReprocessing(cell.row.original.id);
                                            }
                                        }}
                                    > 
                                        <IconRefresh size={16} />
                                    </ActionButton>
                                )
                            )}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'delete',
                header: '',
                width: 18,
                size: 18,
                maxSize: 18,
                enableSorting: false,
                enableColumnActions: false,
                enableColumnFilter: false,
                Cell: ({cell}) => {
                    if (isDeleteMode) {
                        return (
                            <div onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleSelectId(cell.row.original.id);
                            }}>
                                <Checkbox
                                    id={`delete-checkbox-${cell.row.original.id}`}
                                    label=""
                                    checked={selectedIds.has(cell.row.original.id)}
                                    onChange={() => toggleSelectId(cell.row.original.id)}
                                />
                            </div>
                        );
                    }
                    return (
                        <ActionButton
                            title='Delete File'
                            handleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteFile(cell.row.original.id);
                            }}> 
                            <IconTrash size={20}/>
                        </ActionButton>
                    );
                },   
            },
        ],
        [embeddingStatus, fetchedStatusKeys, isDeleteMode, selectedIds, pollingFiles],
    );

    const columns = allColumns.filter(
        c => {
            return !visibleColumns || visibleColumns.some(cv => cv === c.accessorKey)
        });


    const myTailwindColors = {
        // This is an example, replace with actual Tailwind colors
        gray: '#64748b',
        blue: '#0ea5e9',
        red: '#ef4444',
        green: '#10b981',
        // Add other colors you want to include from Tailwind
    };

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
        manualFiltering: true,
        manualPagination: true,
        manualSorting: true,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        enableStickyHeader: true,
        enableBottomToolbar: false,
        enableTopToolbar: true,
        state: {
            columnFilters,
            globalFilter,
            isLoading: isLoading || loadingMore,
            pagination,
            showAlertBanner: isError,
            showProgressBars: isRefetching,
            sorting,
        },
        mantineTableBodyRowProps: ({row}) => ({
            onClick: (event) => {
                //console.log("Data Source Selected", row.original);
                if(onDataSourceSelected){
                    onDataSourceSelected({
                        id: row.original.id,
                        type: row.original.type,
                        name: row.original.name,
                        metadata: {
                            createdAt: row.original.createdAt,
                            tags: row.original.tags,
                            totalTokens: row.original.totalTokens,
                        }
                    })
                }
            },
            sx: {
                cursor: 'pointer', //you might want to change the cursor too when adding an onClick
            },
        }),
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
        <div className="relative">
            {/* Delete Mode Controls - Positioned to appear in toolbar area */}
            <div className="absolute right-2 z-10 flex items-center gap-2" style={{ transform: 'translateY(10px)' }}>
                {!showDeleteConfirmation ? (
                    <>  
                        {isDeleteMode ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleSelectAll();
                                    }}
                                    className="text-sm px-2 py-1.5 pr-[-2px] rounded hover:bg-gray-600 dark:hover:bg-black transition-colors"
                                >
                                    {selectedIds.size === data.length && data.length > 0 ? 'Deselect All' : 'Select All'}
                                </button>
                                <span className="text-sm text-gray-400">
                                    {selectedIds.size} selected
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowDeleteConfirmation(true);
                                    }}
                                    disabled={selectedIds.size === 0}
                                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDeleteMode(false);
                                        setSelectedIds(new Set());
                                    }}
                                    className="p-1.5 rounded hover:bg-gray-600 dark:hover:bg-black transition-colors"
                                    title="Cancel"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>
                        ) :
                        <div style={{ transform: 'translateY(6px)' }}>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDeleteMode(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-600 dark:hover:bg-black transition-colors"
                            >
                                <IconTrash size={18} />
                                <span className="text-sm text-neutral-200 font-bold">{'Delete Multiple'}</span>
                            </button>
                        </div>
                        }
                    </>
                ) : (
                    <div className="flex items-center gap-2 bg-red-500/10 px-3 py-2 rounded">
                        <span className="text-sm">
                            Delete {selectedIds.size} file(s)?
                        </span>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteBatch();
                            }}
                            className="rounded hover:bg-green-500/20 transition-colors"
                            title="Confirm Delete"
                        >
                            <IconCheck size={18} className="text-green-500" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowDeleteConfirmation(false);
                            }}
                            className="rounded hover:bg-red-500/20 transition-colors"
                            title="Cancel"
                        >
                            <IconX size={18} className="text-red-500" />
                        </button>
                    </div>
                )}
            </div>
            
            <MantineProvider
                theme={{
                    colorScheme: lightMode, // or 'light', depending on your preference or state
                    colors: {
                        //gray: ["#333333","#333333","#333333","#333333","#333333","#333333","#333333","#333333"],
                        dark: ["#dddddd", "#000000", "#000000", "#555765", "#343541", "#343541", "#343541", "#343541"]
                    },
                    primaryShade: 1,
                    // You can also map Mantine's theme colors to match Tailwind's classes as needed
                    //primaryColor: 'blue', // Use the name of the key from the 'colors' object
                }}
            >
                <ScrollArea onScroll={handleScroll}>
                    <MantineReactTable table={table} />
                </ScrollArea>
            </MantineProvider>
        </div>)
};

export default DataSourcesTableScrolling;
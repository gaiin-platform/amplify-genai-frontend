import React, {FC, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {IconDownload, IconRefresh, IconTrash} from "@tabler/icons-react";
import {
    MantineReactTable,
    useMantineReactTable,
    type MRT_ColumnDef, MRT_SortingState, MRT_ColumnFiltersState, MRT_Cell, MRT_TableInstance,
} from 'mantine-react-table';
import {MantineProvider, ScrollArea} from "@mantine/core";
import HomeContext from "@/pages/api/home/home.context";
import {FileQuery, FileRecord, PageKey, queryUserFiles, reprocessFile, setTags} from "@/services/fileService";
import {TagsList} from "@/components/Chat/TagsList";
import {DataSource} from "@/types/chat";
import { v4 as uuidv4 } from 'uuid';
import { deleteDatasourceFile, downloadDataSourceFile } from '@/utils/app/files';
import ActionButton from '../ReusableComponents/ActionButton';
import { mimeTypeToCommonName } from '@/utils/app/fileTypeTranslations';
import { IMAGE_FILE_TYPES } from '@/utils/app/const';
import toast from 'react-hot-toast';


interface Props {
    onDataSourceSelected?: (dataSource: DataSource) => void;
    visibleColumns?: string[];
    visibleTypes?: string[];
    tableParams?: { [key: string]: any };
    height?: string;
}

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
        pageSize: 100, //customize the default page size
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
                forwardScan
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
            const items = result.data.items.filter((file: any) => file?.data?.type !== 'assistant-icon');
            const updatedWithCommonNames = items.map((file: any) => {
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


    function formatIsoString(isoString: string) {
        const options = {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        };
        const date = new Date(isoString);

        // @ts-ignore
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

    const fileReprocessing = async (key: string) => {
        setLoadingMessage("Reprocessing File...");
        try {
            const result = await reprocessFile(key);
            if (result.success) {
                toast("File's rag and embeddings regenerated successfully. Please wait a few minutes for the changes to take effect.");
            } else {
                alert("Failed to regenerate file's rag and embeddings.");
            }
        } finally {
            setLoadingMessage("");
        }
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
                accessorKey: 'delete',
                header: '',
                width: 18,
                size: 18,
                maxSize: 18,
                enableSorting: false,
                enableColumnActions: false,
                enableColumnFilter: false,
                Cell: ({cell}) => (
                    <ActionButton
                        title='Delete File'
                        handleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteFile(cell.row.original.id);
                        }}> 
                        <IconTrash size={20}/>
                    </ActionButton>
                ),   
            },
            {
                accessorKey: 're-embed', //access nested data with dot notation
                header: ' ',
                width: 18,
                size: 18,
                maxSize: 18,
                enableSorting: false,
                enableColumnActions: false,
                enableColumnFilter: false,
                Cell: ({cell}) => {
                    // Only show the refresh button for non-image file types
                    const fileType = cell.row.original.type;
                    if (IMAGE_FILE_TYPES.includes(fileType)) {
                        return null;
                    }
                    
                    return (
                        <ActionButton
                            title='Regenerate text extraction and embeddings for this file.'
                            handleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                fileReprocessing(cell.row.original.id);
                            }}> 
                        <IconRefresh size={20} />
                        </ActionButton>
                    );
                },
            },
        ],
        [],
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
        <div>
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
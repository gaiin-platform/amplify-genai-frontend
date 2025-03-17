import React, {FC, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {IconArrowLeft, IconArrowNarrowLeft, IconDownload, IconFolder} from "@tabler/icons-react";
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
import { getExtensionFromFilename, getFileTypeFromExtension, mimeTypeToCommonName } from '@/utils/app/fileTypeTranslations';
import { capitalize } from '@/utils/app/data';

type FileRecord = {
    name: string;
    id:  string;
    mimeType:  string;
    size: string;
    downloadLink?: string;
   
}

interface Props {
    driveId: string;
    onDataSourceSelected?: (file: File) => void; 
    visibleColumns?: string[];
    visibleTypes?: string[];
    tableParams?: { [key: string]: any };
    height?: string;
    disallowedFileExtensions?: string[];
    enableDownload?: boolean;
}

const DataSourcesTableScrollingIntegrations: FC<Props> = ({ driveId,
                                                  visibleTypes,
                                                  onDataSourceSelected,
                                                  visibleColumns,
                                                  tableParams,
                                                  height,
                                                  disallowedFileExtensions,
                                                  enableDownload,
                                              }) => {

    const {
        state: {lightMode, featureFlags, statsService}, setLoadingMessage
    } = useContext(HomeContext);

    const [data, setData] = useState<FileRecord[]>([]);

    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
        [],
    );
    const [previousColumnFilters, setPreviousColumnFilters] = useState<MRT_ColumnFiltersState>([]);
    // const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

    const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([]);
    const folderCacheRef = useRef<{ [key: string]: FileRecord[] }>({})

    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [prevSorting, setPrevSorting] = useState<string>('createdAt#desc');
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const ROOT = 'root';

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
            .map((f: FileRecord) => {
                return {...f, mimeType: getTypeFromCommonName(f.mimeType, f.name)}
            })

            if (disallowedFileExtensions && disallowedFileExtensions.length > 0) {
                files = files.filter((file: FileRecord) => {
                    // Skip folders from filtering
                    if (file.mimeType.toLowerCase().includes("folder")) return true;
                    const extension = getExtensionFromFilename(file.name)
                    return extension ? !disallowedFileExtensions.includes(extension) : true;
                });
            }

            files.sort((a:FileRecord, b:FileRecord) => {
                const aIsFolder = a.mimeType.toLowerCase().includes("folder");
                const bIsFolder = b.mimeType.toLowerCase().includes("folder");
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
            fetchFiles();
            return;
        } else {
            newHistory = folderHistory.slice(0, index + 1);
            setFolderHistory(newHistory);
            const newFolderId = newHistory.length > 0 ? newHistory[index].id : "";
            // Fetch from cache or call API
            fetchFiles(newFolderId || '');
        }
       
    };


    // Render the breadcrumb bar.
    const renderBreadcrumbs = () => {
        return !folderHistory ? null : (
        <div className="bottom-2 flex items-center p-2 border-b">
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
                    {/* <span className="mx-1 text-gray-500">/</span> */}
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

    const downloadFile = async (item: FileRecord) => {
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

    const onFileSelected = async (item: FileRecord) => {
        setLoadingMessage("Preparing Document for Upload...");
        // have to get a download link because we need to get the file contents which is only doable by saving it in our internal servers

        const downloadLink = await getDownloadLinkData(item.id, false);
        console.log("downloadLink: ", downloadLink);
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


    //should be memoized or stable
    const allColumns = useMemo<MRT_ColumnDef<FileRecord>[]>(
        () => [
            {
                accessorKey: 'name',
                header: 'Name',
                width: 200,
                size: 200,
                maxSize: 300,
                Cell: ({ cell, row }) => {
                  const record = row.original;
                  const isFolder = record.mimeType.toLowerCase().includes("folder");
                  const displayName = record.name;
                  
                  return isFolder 
                    ? <span className='text-gray-400 flex flex-row gap-2'>
                        <IconFolder size={16} className='flex items-center'/>{displayName}
                      </span>
                    : <div className={`flex flex-row ${featureFlags.uploadDocuments ? 'cursor-pointer' : ''}`}>
                        {displayName} 
                         {enableDownload && 
                         <div className='ml-auto'>
                            <ActionButton
                                title='Download File'
                                handleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    downloadFile(record);
                                }}> 
                                <IconDownload size={22}/>
                            </ActionButton>
                          </div>}
                      </div>;
                }
              },
              {
                accessorKey: 'size',
                header: 'Size',
                width: 60,
                size: 60,
                enableColumnFilter: false,
                Cell: ({cell}) => (
                    <span>{cell.getValue<string>()}</span>
                ),
                Edit: ({cell, column, table}) => <>{cell.getValue<string>()}</>,
                },
                {
                    accessorKey: 'mimeType',
                    header: 'Type',
                    //enableSorting: false,
                    width: 100,
                    size: 100,
                    maxSize: 100,
                    Edit: ({cell, column, table}) => <>{cell.getValue<string>()}</>,
                },
        ],
        [],
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
        mantineTableBodyRowProps: ({ row }) => ({
            onClick: (event) => {
              event.preventDefault();
              const record = row.original;
              const isFolder = record.mimeType.toLowerCase().includes("folder");
              if (isFolder) {
                setFolderHistory(prev => [...prev, { id: record.id, name: record.name }]);
                setIsLoading(true);
                fetchFiles(record.id);
              } else {
                if (!featureFlags.uploadDocuments || !onDataSourceSelected) {
                    toast("Uploading documents is disabled.");
                } else {
                    onFileSelected(record);
                }
                
              }
            },
            sx: {
              cursor: 'pointer',
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
                <ScrollArea onScroll={() =>{}}>
                    <MantineReactTable table={table} />
                </ScrollArea>
                {renderBreadcrumbs()}
            </MantineProvider>
        </div>)
};

export default DataSourcesTableScrollingIntegrations;
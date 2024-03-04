import {useContext, useEffect, useMemo, useState} from 'react';
import {
    MantineReactTable,
    useMantineReactTable,
    type MRT_ColumnDef, MRT_SortingState, MRT_ColumnFiltersState, MRT_Cell,
} from 'mantine-react-table';
import {MantineProvider} from "@mantine/core";
import HomeContext from "@/pages/api/home/home.context";
import {FileRecord, queryUserFiles} from "@/services/fileService";
import {TagsList} from "@/components/Chat/TagsList";

type FileSchema = {
    name: string;
    createdAt: string;
    tags: string[];
    type: string;

}

type MimeTypeMapping = {
    [mimeType: string]: string;
};

const mimeTypeToCommonName: MimeTypeMapping = {
    "application/vnd.ms-excel": "Excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "application/vnd.ms-powerpoint": "PowerPoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "text/plain": "Text",
    "application/pdf": "PDF",
    "application/rtf": "Rich Text Format",
    "application/vnd.oasis.opendocument.text": "OpenDocument Text",
    "application/vnd.oasis.opendocument.spreadsheet": "OpenDocument Spreadsheet",
    "application/vnd.oasis.opendocument.presentation": "OpenDocument Presentation",
    "text/csv": "CSV",
    "application/vnd.google-apps.document": "Google Docs",
    "application/vnd.google-apps.spreadsheet": "Google Sheets",
    "application/vnd.google-apps.presentation": "Google Slides",
    "text/html": "HTML",
    "application/xhtml+xml": "XHTML",
    "application/xml": "XML",
    "application/json": "JSON",
    "application/x-latex": "LaTeX",
    "application/vnd.ms-project": "Microsoft Project",
    "text/markdown": "Markdown",
    "application/vnd.ms-outlook": "Outlook Email",
    "application/x-tex": "TeX",
    "text/x-vcard": "vCard",
    "application/x-vnd.ls-xpix": "Lotus Spreadsheet",
    "application/vnd.visio": "Visio",
    "application/x-mspublisher": "Publisher",
    "text/tab-separated-values": "Tab Separated Values",
    "application/x-mswrite": "Write",
    "application/vnd.ms-works": "Microsoft Works",
};


const DataSourcesTable = () => {

    const {
        state: {lightMode},
    } = useContext(HomeContext);

    const [data, setData] = useState<FileRecord[]>(
        []
    );

    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 5, //customize the default page size
    });

    const [lastPageIndex, setLastPageIndex] = useState(0);

    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
        [],
    );
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);

    //if you want to avoid useEffect, look at the React Query example instead
    useEffect(() => {
        const fetchData = async () => {
            if (!data.length) {
                setIsLoading(true);
            } else {
                setIsRefetching(true);
            }

            const fetchFiles = async () => {
                try {

                    let pageKey = null;
                    let forwardScan = true;

                    if(data && data.length> 0) {
                        if (lastPageIndex === pagination.pageIndex) {
                            pageKey = data.slice(-1)[0].id;
                        } else if (lastPageIndex < pagination.pageIndex) {
                            pageKey = data.slice(-1)[0].id;
                        } else if (lastPageIndex > pagination.pageIndex) {
                            pageKey = data[0].id;
                            forwardScan = false;
                        }
                    }

                    setLastPageIndex(pagination.pageIndex);

                    let startDate = "2000-01-25T14:48:23.544796";
                    if(data && data.length> 0){
                        const curr = pagination.pageIndex - 1;
                        // @ts-ignore
                        startDate = data.slice(-1)[0].createdAt;
                    }

                    const result = await queryUserFiles(
                        {
                            pageSize: pagination.pageSize,
                            pageKey,
                            forwardScan,
                            startDate}, null);

                    if(!result.success){
                        setIsError(true);
                    }

                    const updatedWithCommonNames = result.data.items.map((file: any) => {
                        const commonName = mimeTypeToCommonName[file.type];
                        return {
                            ...file,
                            commonType: commonName || (file.type && file.type.slice(0, 15)) || 'Unknown',
                        };
                    });

                    setData(updatedWithCommonNames);

                    setRowCount(1000);
                } catch (error) {
                    setIsError(true);
                    console.error(error);
                    return;
                }
                setIsError(false);
                setIsLoading(false);
                setIsRefetching(false);
            }

            fetchFiles();

        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        columnFilters, //refetch when column filters change
        globalFilter, //refetch when global filter changes
        pagination.pageIndex, //refetch when page index changes
        pagination.pageSize, //refetch when page size changes
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
    const handleSaveCell = (cell: MRT_Cell, value: any) => {
        //if using flat data and simple accessorKeys/ids, you can just do a simple assignment here
        const row = data[cell.row.index];
        const columnId = cell.column.id;

        console.log("col:", columnId);

        const newData = [
            ...data.slice(0, cell.row.index),
            // @ts-ignore
            {...data.slice(cell.row.index, cell.row.index + 1)[0], [columnId]: value},
            ...data.slice(cell.row.index + 1),
            ];

         setData(newData); //re-render with new data
    };

    //should be memoized or stable
    const columns = useMemo<MRT_ColumnDef<FileSchema>[]>(
        () => [
            {
                accessorKey: 'name', //access nested data with dot notation
                header: 'Name',
            },
            {
                accessorKey: 'createdAt',
                header: 'Created',
                Cell: ({cell}) => (
                    <span>{formatIsoString(cell.getValue<string>())}</span>
                ),
                Edit: ({ cell, column, table }) => <>{formatIsoString(cell.getValue<string>())}</>,
            },
            {
                accessorKey: 'tags', //normal accessorKey
                header: 'Tags',
                // Cell: ({ cell}) => {
                //     const tags = cell.getValue<string[]>();
                //
                //     return <TagsList
                //         tags={tags}
                //         label={""}
                //         maxWidth={"50px"}
                //         setTags={(tags)=>handleSaveCell(cell, tags)}/>
                // }

            },
            {
                accessorKey: 'commonType',
                header: 'Type',
                Edit: ({ cell, column, table }) => <>{cell.getValue<string>()}</>,
            },
        ],
        [],
    );

    const myTailwindColors = {
        // This is an example, replace with actual Tailwind colors
        gray: '#64748b',
        blue: '#0ea5e9',
        red: '#ef4444',
        green: '#10b981',
        // Add other colors you want to include from Tailwind
    };

    // const table = useMantineReactTable({
    //         columns,
    //         data, //must be memoized or stable (useState, useMemo, defined outside of this component, etc.)
    //         onPaginationChange: setPagination, //hoist pagination state to your state when it changes internally
    //         state: { pagination }, //pass the pagination state to the table
    //         enablePagination: true,
    //         enableBottomToolbar: true,
    //         enableStickyHeader: true,
    //         mantinePaperProps:{
    //             shadow: 'lg',
    //             sx: {
    //                 //stripe the rows, make odd rows a darker color
    //                 '*': {
    //                     //backgroundColor: '#444654',
    //                 },
    //                 //borderRadius: '20',
    //                 //border: '3px dashed #ffffff',
    //             },
    //         },
    //         mantineTableProps:{
    //             //striped: true,
    //         },
    //         mantineTableContainerProps: { sx: { maxHeight: '400px' } },
    //         mantinePaginationProps: {
    //             rowsPerPageOptions: ['20', '50', '100'],
    //             withEdges: true, //note: changed from `showFirstLastButtons` in v1.0
    //         }
    //     });


    const table = useMantineReactTable({
        columns,
        data,
        mantineEditRowModalProps: {
            closeOnClickOutside: true,
            withCloseButton: true,
        },
        editDisplayMode: 'cell',
        enableRowSelection: true,
        // @ts-ignore
        getRowId: (row) => row.id,
        initialState: {showColumnFilters: true},
        manualFiltering: true,
        manualPagination: true,
        manualSorting: true,
        rowCount,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        enableStickyHeader: true,
        enableBottomToolbar: true,
        state: {
            columnFilters,
            globalFilter,
            isLoading,
            pagination,
            showAlertBanner: isError,
            showProgressBars: isRefetching,
            sorting,
        },
        mantineTableContainerProps: { sx: { maxHeight: '400px' } },
        mantineToolbarAlertBannerProps: isError
            ? {color: 'red', children: 'Error loading data'}
            : undefined,
    });

    return (<MantineProvider
        theme={{
            colorScheme: lightMode, // or 'light', depending on your preference or state
            colors: {
                gray: [myTailwindColors.gray],
                blue: [myTailwindColors.blue], // Example color for 'blue' palette
                red: [myTailwindColors.red],   // Example color for 'red' palette
                green: [myTailwindColors.green] // Example color for 'green' palette
            },
            // You can also map Mantine's theme colors to match Tailwind's classes as needed
            primaryColor: 'blue', // Use the name of the key from the 'colors' object
        }}
    >
        <MantineReactTable table={table}/>
    </MantineProvider>)
};

export default DataSourcesTable;
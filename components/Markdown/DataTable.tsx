import React from 'react';

interface DataTableProps {
    data: any[];
    columns: string[];
    pagination: {
        currentPage: number;
        totalRows: number;
        totalPages: number;
        rowsPerPage: number;
    };
    onPageChange: (page: number) => void; // Callback function for page change
}

export const DataTable: React.FC<DataTableProps> = ({
    data,
    columns,
    pagination,
    onPageChange,
}) => {
    const { currentPage, totalPages } = pagination;

    // Handles page change
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            onPageChange(newPage);
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
                <thead>
                    <tr>
                        {columns.map((column, index) => (
                            <th
                                key={index}
                                className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
                            >
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {columns.map((column, colIndex) => (
                                <td key={colIndex} className="px-5 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-gray-300">
                                    {row[column]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex justify-between items-center p-4">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

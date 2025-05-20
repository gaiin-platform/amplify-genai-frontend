import { IconLoader2 } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';



import { getFileDownloadUrls } from '@/services/agentService';



import Papa from 'papaparse';


interface Props {
  filePath: string;
  message: any;
}

interface Column {
  id: string;
  name: string;
}

const AgentTableBlock: React.FC<Props> = ({ filePath, message }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);


  useEffect(() => {
    const fetchTableData = async () => {
      if (!message?.data?.state?.agentLog?.data?.files) {
        setError('No agent files found in message');
        setLoading(false);
        return;
      }

      try {
        // Extract filename from the file path
        const fileName = filePath.split('/').pop() || '';
        
        // Find the file ID for the referenced file
        const agentLog = message.data.state.agentLog;
        const files = agentLog.data.files;
        let fileId = null;
        
        for (const [id, fileData] of Object.entries(files)) {
          // @ts-ignore
          if (fileData.original_name === fileName) {
            fileId = id;
            break;
          }
        }
        
        if (!fileId) {
          setError(`File "${fileName}" not found in agent files`);
          setLoading(false);
          return;
        }
        
        // Get download URL for the file
        const urls = await getFileDownloadUrls({
          files: [fileId],
          sessionId: agentLog.data.session
        });
        
        if (!urls?.data?.[fileId]) {
          setError('Failed to get download URL');
          setLoading(false);
          return;
        }
        
        const downloadUrl = urls.data[fileId];
        
        // Fetch and parse the CSV file
        const response = await fetch(downloadUrl);
        const text = await response.text();
        
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              setError(`Parse error: ${results.errors[0].message}`);
              setLoading(false);
              return;
            }

            // Set columns
            const headerRow = results.meta.fields || [];
            const formattedColumns = headerRow.map((header) => ({
              id: header,
              name: header,
            }));

            setColumns(formattedColumns);
            setData(results.data);
            setLoading(false);
          },
          error: (error: { message: any }) => {
            setError(`Error parsing CSV: ${error.message}`);
            setLoading(false);
          },
        });
      } catch (err) {
        setError(`Failed to load table data: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    fetchTableData();
  }, [filePath, message]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-md my-4">
        <IconLoader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Loading table data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 my-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Limit the number of rows displayed to 100 for performance
  const displayData = data.slice(0, 100);
  const hasMoreRows = data.length > 100;

  return (
    <div className="overflow-x-auto my-4 bg-white dark:bg-gray-800 rounded-md shadow">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {columns.map((column) => (
              <th 
                key={column.id}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {displayData.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
              {columns.map((column) => (
                <td key={`${rowIndex}-${column.id}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {row[column.id] !== null && row[column.id] !== undefined ? String(row[column.id]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMoreRows && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-sm">
          Showing 100 of {data.length} rows
        </div>
      )}
    </div>
  );
};

export default AgentTableBlock;
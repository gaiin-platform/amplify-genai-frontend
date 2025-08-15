import React, { useState, useEffect } from 'react';
import { 
  IconLoader2, 
  IconDownload, 
  IconFileText, 
  IconFileSpreadsheet, 
  IconFileTypePdf, 
  IconPhoto,
  IconFile,
} from '@tabler/icons-react';
import { getFileDownloadUrls } from '@/services/agentService';
import { guessMimeType } from '../ChatContentBlocks/AgentLogBlock';
import { getAgentLog } from '@/utils/app/agent';

interface Props {
  filePath: string;
  message: any;
}

const AgentFileBlock: React.FC<Props> = ({ filePath, message }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    downloadUrl: string;
  } | null>(null);

  useEffect(() => {
    const fetchFileData = async () => {
      let agentLog = getAgentLog(message);
      
      if (!agentLog?.data?.files) {
        setError('No agent files found in message');
        setLoading(false);
        return;
      }

      try {
        // Extract filename from the file path
        const fileName = filePath.split('/').pop() || '';
        const files = agentLog.data.files;
        let fileId = null;
        let fileData = null;
        
        for (const [id, data] of Object.entries(files)) {
          // @ts-ignore
          if (data.original_name === fileName) {
            fileId = id;
            fileData = data;
            break;
          }
        }
        
        if (!fileId || !fileData) {
          setError(`File "${fileName}" not found in agent files`);
          setLoading(false);
          return;
        }
        // console.log('agentLog', agentLog);
        
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
        

        setFileData({
          fileId,
          fileName,
          fileType: guessMimeType(fileName),
          // @ts-ignore
          fileSize: fileData.size || 0,
          downloadUrl
        });
        
        setLoading(false);
      } catch (err) {
        setError(`Failed to load file data: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    fetchFileData();
  }, [filePath, message]);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fileData) return;
    
    const link = document.createElement('a');
    link.href = fileData.downloadUrl;
    link.download = fileData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDocumentIcon = () => {
    if (!fileData) return <IconFile size={64} stroke={1.5} />;
    
    const fileType = fileData.fileType;
    if (fileType.includes('spreadsheet') || fileData.fileName.endsWith('.csv')) {
      return <IconFileSpreadsheet size={64} stroke={1.5} />;
    } else if (fileType.includes('pdf') || fileData.fileName.endsWith('.pdf')) {
      return <IconFileTypePdf size={64} stroke={1.5} />;
    } else if (fileType.includes('image') || 
              fileData.fileName.endsWith('.png') || 
              fileData.fileName.endsWith('.jpg') || 
              fileData.fileName.endsWith('.jpeg')) {
      return <IconPhoto size={64} stroke={1.5} />;
    } else {
      return <IconFileText size={64} stroke={1.5} />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-md my-4">
        <IconLoader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Loading file information...</p>
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

  if (!fileData) {
    return null;
  }

  const isImage = fileData.fileType.includes('image') || 
                  fileData.fileName.endsWith('.png') || 
                  fileData.fileName.endsWith('.jpg') || 
                  fileData.fileName.endsWith('.jpeg');

  return (
    <div className="flex flex-col w-full my-4">
      <div className="flex flex-wrap">
        <div className="mr-3 mb-3">
          <div className="relative group">
            <div 
              className="rounded-lg shadow-lg overflow-hidden relative"
              style={{
                width: '200px',
                height: '200px',
              }}
            >
              {/* Custom tooltip that appears on hover */}
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm max-w-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                <div className="text-center truncate">
                  {fileData.fileName.length > 40 ? (
                    <span title={fileData.fileName}>{fileData.fileName.substring(0, 40)}...</span>
                  ) : (
                    fileData.fileName
                  )}
                </div>
                <div className="text-xs text-center text-gray-300">
                  {formatFileSize(fileData.fileSize)}
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                <div className="text-gray-400 dark:text-gray-300">
                  {getDocumentIcon()}
                </div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-60 text-white truncate">
                {fileData.fileName}
              </div>
              
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  className="p-1 bg-white rounded-full shadow-md hover:bg-gray-200"
                  onClick={handleDownload}
                  title="Download file"
                >
                  <IconDownload size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentFileBlock;
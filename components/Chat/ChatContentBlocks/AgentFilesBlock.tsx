import React, { useState } from 'react';
import {
  IconFile,
  IconFileText,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconPhoto,
  IconChevronDown,
  IconLoader2
} from '@tabler/icons-react';
import { getFileDownloadUrls } from '@/services/agentService';

export interface FileVersion {
  version_file_id: string;
  timestamp: string;
  size: number;
  hash: string;
}

export interface FileValues {
  fileId: string;
  fileName: string;
  sessionId: string;
  versions?: FileVersion[];
  size: number;
  lastModified: string;
}

export interface AgentFile {
  type: string;
  values: FileValues;
}

interface FileListProps {
  files: AgentFile[];
}

type FileUrls = {
  [key: string]: string;
};

export const AgentFileList: React.FC<FileListProps> = ({ files }) => {
  const [fileUrls, setFileUrls] = useState<FileUrls>({});
  const [openDropdown, setOpenDropdown] = useState<string>('');
  const [downloading, setDownloading] = useState<{[key: string]: boolean}>({});

  const getFileIcon = (mimeType: string) => {
    switch (mimeType) {
      case 'text/csv':
        return <IconFileSpreadsheet size={20} className="text-gray-500 dark:text-gray-400" stroke={1.5} />;
      case 'application/pdf':
        return <IconFileTypePdf size={20} className="text-gray-500 dark:text-gray-400" stroke={1.5} />;
      case 'image/png':
      case 'image/jpeg':
      case 'image/gif':
        return <IconPhoto size={20} className="text-gray-500 dark:text-gray-400" stroke={1.5} />;
      case 'text/plain':
        return <IconFileText size={20} className="text-gray-500 dark:text-gray-400" stroke={1.5} />;
      default:
        return <IconFile size={20} className="text-gray-500 dark:text-gray-400" stroke={1.5} />;
    }
  };

  const refreshUrl = async (
    fileId: string,
    sessionId: string,
    versionFileId: string | null = null
  ): Promise<string | null> => {
    try {
      // If versionFileId is provided, use that instead of the fileId
      const requestFileId = versionFileId || fileId;
      const newUrls = await getFileDownloadUrls({
        files: [requestFileId],
        sessionId
      });
      return newUrls['data'][requestFileId];
    } catch (error) {
      console.error('Failed to refresh URL:', error);
      return null;
    }
  };

  const handleDownload = async (
    file: AgentFile,
    version?: FileVersion
  ): Promise<void> => {
    const downloadId = version?.version_file_id || file.values.fileId;
    
    try {
      // Set downloading state for this file
      setDownloading(prev => ({...prev, [downloadId]: true}));
      
      const versionFileId = version?.version_file_id;
      const newUrl = await refreshUrl(file.values.fileId, file.values.sessionId, versionFileId);

      if (!newUrl) {
        console.error('Failed to get download URL');
        return;
      }

      const response = await fetch(newUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.values.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      // Close dropdown after download
      setOpenDropdown('');
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      // Clear downloading state
      setDownloading(prev => ({...prev, [downloadId]: false}));
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <ul className="space-y-2">
      {files.map((file: AgentFile, index: number) => (
        <li key={index} className="relative">
          <div className="flex items-center">
            <span className="mr-2">
              {getFileIcon(file.type)}
            </span>
            <button
              onClick={() => handleDownload(file)}
              disabled={downloading[file.values.fileId]}
              className="text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors flex items-center"
            >
              {downloading[file.values.fileId] ? (
                <>
                  <IconLoader2 className="animate-spin mr-2" size={16} />
                  <span>Downloading...</span>
                </>
              ) : (
                file.values.fileName
              )}
            </button>

            {file.values.versions && file.values.versions.length > 1 && (
              <button
                onClick={() => setOpenDropdown(openDropdown === file.values.fileId ? '' : file.values.fileId)}
                className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <IconChevronDown size={16} stroke={1.5} />
              </button>
            )}
          </div>

          {openDropdown === file.values.fileId && file.values.versions && (
            <div className="absolute left-0 mt-2 w-64 rounded-md shadow-lg bg-white dark:bg-gray-800 z-10">
              <div className="py-1">
                <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                  Version History
                </div>
                {file.values.versions.map((version: FileVersion, vIndex: number) => (
                  <button
                    key={vIndex}
                    onClick={() => handleDownload(file, version)}
                    disabled={downloading[version.version_file_id]}
                    className={`block w-full px-4 py-2 text-sm text-left ${downloading[version.version_file_id] ? 'text-gray-500' : 'text-gray-700'} dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center`}
                  >
                    {downloading[version.version_file_id] ? (
                      <>
                        <IconLoader2 className="animate-spin mr-2" size={16} />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      formatTimestamp(version.timestamp)
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

export default AgentFileList;
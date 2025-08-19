import React, { useState, useEffect } from 'react';
import { IconLoader2, IconZoomIn, IconDownload, IconExternalLink } from '@tabler/icons-react';
import { getFileDownloadUrls } from '@/services/agentService';
import { getAgentLog } from '@/utils/app/agent';

interface Props {
  filePath: string;
  message: any;
}

const AgentImageBlock: React.FC<Props> = ({ filePath, message }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [fullscreen, setFullscreen] = useState<boolean>(false);

  useEffect(() => {
    let agentLog = getAgentLog(message);
      
    const fetchImage = async () => {
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
        
        for (const [id, fileData] of Object.entries(files)) {
          // @ts-ignore
          if (fileData.original_name === fileName) {
            fileId = id;
            break;
          }
        }
        
        if (!fileId) {
          setError(`Image "${fileName}" not found in agent files`);
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
        setImageUrl(downloadUrl);
        setLoading(false);
      } catch (err) {
        setError(`Failed to load image: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    fetchImage();
  }, [filePath, message]);

  const handleDownload = () => {
    const fileName = filePath.split('/').pop() || 'image';
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-md my-4">
        <IconLoader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Loading image...</p>
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

  const fileName = filePath.split('/').pop() || 'image';

  return (
    <>
      {fullscreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <div className="relative max-w-screen-xl max-h-screen overflow-auto bg-white dark:bg-gray-800 p-2 rounded-lg">
            <div className="flex justify-between items-center mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-t-lg">
              <h3 className="text-gray-800 dark:text-gray-100 font-medium">{fileName}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                  title="Download image"
                >
                  <IconDownload size={20} />
                </button>
                <button 
                  onClick={() => setFullscreen(false)}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                  title="Close fullscreen"
                >
                  <IconExternalLink size={20} />
                </button>
              </div>
            </div>
            <img
              src={imageUrl}
              alt={fileName}
              className="max-w-full h-auto object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <div className="my-4 bg-white dark:bg-gray-800 rounded-md shadow-md overflow-hidden">
        <div className="relative">
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full h-auto mx-auto"
            style={{ maxHeight: '400px' }}
          />
          <div className="absolute top-0 right-0 p-2 opacity-0 hover:opacity-100 transition-opacity flex gap-1">
            <button 
              onClick={() => setFullscreen(true)}
              className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full"
              title="View fullscreen"
            >
              <IconZoomIn size={20} />
            </button>
            <button 
              onClick={handleDownload}
              className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full"
              title="Download image"
            >
              <IconDownload size={20} />
            </button>
          </div>
        </div>
        <div className="p-2 bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-600">
          {fileName}
        </div>
      </div>
    </>
  );
};

export default AgentImageBlock;
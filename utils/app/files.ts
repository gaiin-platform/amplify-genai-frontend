import { getFileDownloadUrl, deleteFile, reprocessFile } from "@/services/fileService";
import { DataSource } from "@/types/chat";
import { IMAGE_FILE_TYPES } from "./const";
import toast from "react-hot-toast";
import { capitalize } from "./data";
import { embeddingDocumentStaus } from "@/services/adminService";

export const downloadDataSourceFile = async (dataSource: DataSource, groupId: string | undefined = undefined) => {
    const response = await getFileDownloadUrl(dataSource.id, groupId); // support images too 
    if (!response.success) {
        alert("Error downloading file. Please try again.");
        return;
    }
    if (dataSource.type && IMAGE_FILE_TYPES.includes(dataSource.type)) {
        downloadImageFromPresignedUrl(response.downloadUrl, dataSource.name || 'image', dataSource.type || '');
    } else {
        downloadFileFromPresignedUrl(response.downloadUrl, dataSource.name || 'File');
    }
}

export const deleteDatasourceFile = async (dataSource: DataSource, showToast: boolean = true) => {
  console.log("deleteDatasourceFile: ", dataSource)
  try {
      const response = await deleteFile(dataSource.id || 'none');
      if (!response.success) {  // Now correctly checking success
          console.error(`Failed to delete file: ${dataSource.id}`, response);
          if (showToast) {
              alert(`Error deleting file. Please try again.`);
          }
          return { success: false, fileName: dataSource.name || dataSource.id || 'Unknown file' };
      }
      if (showToast) {
          toast(`File deleted successfully`);
      }
      console.log(`File deleted successfully: ${dataSource.id}`);
      return { success: true, fileName: dataSource.name || dataSource.id || 'Unknown file' };
  } catch (error) {
      console.error(`Error while deleting file: ${dataSource.id}`, error);
      if (showToast) {
          alert(`An unexpected error occurred while deleting "${dataSource.id}". Please try again later.`);
      }
      return { success: false, fileName: dataSource.name || dataSource.id || 'Unknown file' };
  }
};

export async function fetchImageFromPresignedUrl(presignedUrl: string, fileType: string) {
    try {
      const response = await fetch(presignedUrl);
      if (!response.ok) throw new Error('Network response was not ok');

      const base64Data = await response.text(); 
  
      const byteCharacters = window.atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: fileType }); 
    } catch (error) {
      console.error('Failed to fetch image:', error);
      alert("Error downloading file. Please try again later.");
      return null;
    }
}

async function downloadImageFromPresignedUrl(presignedUrl: string, filename: string, fileType: string): Promise<void> {
    try {
      const blob = await fetchImageFromPresignedUrl(presignedUrl, fileType);
      if (!blob) return;
      // Trigger the download
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.setAttribute('download', filename);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Cleanup
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  }

export function downloadFileFromPresignedUrl(presignedUrl: string | null, fileName: string) {
    if (!presignedUrl) return false;
    
    const link = document.createElement('a');
    link.href = presignedUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
}

export async function fetchFile(presignedUrl: string) {
    if (!presignedUrl) return null;
    try {
      const response = await fetch(presignedUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
  
      const fileBlob = await response.blob();

      return URL.createObjectURL(fileBlob);
    } catch (error) {
      console.error('Error fetching or displaying file:', error);
      return "";
    }
  }


  // Status configuration helper
export const getDocumentStatusConfig = (status: string) => {
    const name = capitalize(status);
    switch (status) {
        case 'starting':
            return { 
                color: 'text-blue-600 bg-blue-50', 
                text: name,
                indicator: '●',
                indicatorColor: 'text-slate-400 opacity-50',
                showIndicatorWhenNotHovered: true,
                animate: false
            };
        case 'processing':
            return { 
                color: 'text-amber-600 bg-amber-50', 
                text: name,
                indicator: '●',
                indicatorColor: 'text-gray-400',
                showIndicatorWhenNotHovered: true,
                animate: true
            };
        case 'completed':
            return { 
                color: 'text-green-500 bg-gray-300', 
                text: name,
                showIndicatorWhenNotHovered: false
            };
        case 'failed':
            return { 
                color: 'text-red-600 bg-red-50', 
                text: name,
                indicator: '!',
                indicatorColor: 'text-red-500',
                showIndicatorWhenNotHovered: true
            };
        case 'terminated':
            return { 
                color: 'text-slate-500 bg-slate-50', 
                text: "error",
                indicator: '!',
                indicatorColor: 'text-orange-500',
                showIndicatorWhenNotHovered: true
            };
        case 'not_found':
            return { 
                color: 'px-2 text-gray-500', 
                text: '-----',
                indicator: '',
                indicatorColor: 'text-gray-500',
                showIndicatorWhenNotHovered: true
            };
        default:
            return null;
    }
};


export const extractKey = (ds: any) => {
  const key = ds.id || ds.key || ds.metadata?.contentKey;
  if (key && key.startsWith("s3://")) {
      return key.split("s3://").pop() || key;
  }
  return key;
}

// File reprocessing with polling interface
export interface FileReprocessingOptions {
  key: string;
  fileType: string;
  setPollingFiles: (updater: (prev: Set<string>) => Set<string>) => void;
  setEmbeddingStatus: (updater: (prev: any) => any) => void;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  successMessage?: string;
  failureMessage?: string;
  setLoadingMessage?: (message: string) => void;
}

/**
 * Reprocesses a file and polls for status updates until completed or timeout
 * 
 * @param options Configuration for file reprocessing and polling
 */
export const startFileReprocessingWithPolling = async (options: FileReprocessingOptions): Promise<void> => {
  const {
    key,
    fileType,
    setPollingFiles,
    setEmbeddingStatus,
    onSuccess,
    onError,
    successMessage = "File's rag and embeddings regenerated successfully. Please wait a few minutes for the changes to take effect.",
    failureMessage = "Failed to regenerate file's rag and embeddings.",
    setLoadingMessage
  } = options;

  try {
    // Set loading message if provided
    if (setLoadingMessage) setLoadingMessage("Reprocessing File...");
    
    // Add to polling files
    setPollingFiles(prev => new Set(prev).add(key));
    
    const result = await reprocessFile(key);
    if (result.success) {
      toast(successMessage);
      
      // Poll every 5 seconds for 2 minutes (24 polls total) or until completed
      let pollCount = 0;
      const maxPolls = 24;
      
      const pollStatus = () => {
        const keyData = {key, type: fileType};
        embeddingDocumentStaus([keyData])
          .then(response => {
            if (response?.success && response?.data) {
              setEmbeddingStatus(prev => ({
                ...prev,
                ...response.data
              }));
              
              // Stop polling if completed
              if (response.data[key] === 'completed') {
                setPollingFiles(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(key);
                  return newSet;
                });
                if (onSuccess) onSuccess();
                return;
              }
            }
            
            pollCount++;
            if (pollCount < maxPolls) {
              setTimeout(pollStatus, 5000); // Poll again in 5 seconds
            } else {
              // Stop polling after 2 minutes
              setPollingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
              });
            }
          })
          .catch(error => {
            console.error('Failed to poll embedding status:', error);
            setPollingFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(key);
              return newSet;
            });
            if (onError) onError(error);
          });
      };
      
      // Start first poll after 5 seconds
      setTimeout(pollStatus, 5000);
    } else {
      alert(failureMessage);
      // Remove from polling if reprocessing failed
      setPollingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
      if (onError) onError(new Error(failureMessage));
    }
  } catch (error) {
    console.error('Failed to reprocess file:', error);
    setPollingFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
    if (onError) onError(error);
  } finally {
    // Clear loading message if provided
    if (setLoadingMessage) setLoadingMessage("");
  }
};
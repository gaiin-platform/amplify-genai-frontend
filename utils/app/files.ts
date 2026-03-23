import { getFileDownloadUrl, deleteFile, reprocessFile } from "@/services/fileService";
import { DataSource } from "@/types/chat";
import { IMAGE_FILE_TYPES, VIDEO_FILE_TYPES } from "./const";
import toast from "react-hot-toast";
import { capitalize } from "./data";
import { embeddingDocumentStatus, clearEmbeddingStatusCache } from "@/services/adminService";
import JSZip from "jszip";
import { isBedrockKbDatasource } from "./bedrockKb";

/**
 * Extract Microsoft Information Protection (MIP) sensitivity label from Office files.
 * Office files (.docx, .xlsx, .pptx) are ZIP archives containing XML metadata.
 *
 * @param file - The Office file to check
 * @returns Object with sensitivity level and label name, or null if no label found
 */
export const extractSensitivityLabel = async (file: File): Promise<{ level: number; labelName: string } | null> => {
    try {
        const extension = file.name.split('.').pop()?.toLowerCase();

        // Only check Office Open XML files (not .doc, .xls, .ppt which use different format)
        if (!extension || !['docx', 'xlsx', 'pptx', 'xlsm', 'docm', 'pptm'].includes(extension)) {
            return null;
        }

        console.log(`[SENSITIVITY CHECK] Checking file: ${file.name} (${file.size} bytes)`);

        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();
        console.log(`[SENSITIVITY CHECK] Read ${arrayBuffer.byteLength} bytes from ${file.name}`);

        // Check if file is actually empty or too small to be a valid Office file
        if (arrayBuffer.byteLength < 100) {
            console.warn(`[SENSITIVITY CHECK] File ${file.name} is too small (${arrayBuffer.byteLength} bytes) to be a valid Office document`);
            return null;
        }

        // Check for ZIP file signature (PK\x03\x04)
        const view = new Uint8Array(arrayBuffer);
        const hasZipSignature = view[0] === 0x50 && view[1] === 0x4B && view[2] === 0x03 && view[3] === 0x04;

        if (!hasZipSignature) {
            console.warn(`[SENSITIVITY CHECK] File ${file.name} does not have ZIP signature. First bytes: ${Array.from(view.slice(0, 4)).map(b => '0x' + b.toString(16)).join(' ')}`);
            console.warn(`[SENSITIVITY CHECK] This may be an old Office format (.doc, .xls, .ppt) which doesn't support MIP labels`);
            return null; // Old Office format or corrupted file
        }

        console.log(`[SENSITIVITY CHECK] Valid ZIP signature found in ${file.name}`);

        // Load as ZIP using JSZip with lenient options
        const zip = await JSZip.loadAsync(arrayBuffer, {
            checkCRC32: false, // Don't validate checksums - be lenient
        });

        console.log(`[SENSITIVITY CHECK] Successfully loaded ZIP structure from ${file.name}`);

        // Extract custom properties XML where MIP labels are stored
        const customPropsFile = zip.file('docProps/custom.xml');

        if (!customPropsFile) {
            console.log(`[SENSITIVITY CHECK] No custom.xml found in ${file.name} - file has no sensitivity label`);
            return null;
        }

        const customPropsXml = await customPropsFile.async('string');
        console.log(`[SENSITIVITY CHECK] Found custom.xml in ${file.name}, size: ${customPropsXml.length} chars`);

        // Look for MIP label properties
        // Format: <property name="MSIP_Label_<GUID>_Name"><vt:lpwstr>Level 4 Critical</vt:lpwstr></property>
        const labelNameMatch = customPropsXml.match(/MSIP_Label_[a-f0-9-]+_Name">\s*<vt:lpwstr>([^<]+)<\/vt:lpwstr>/i);

        if (!labelNameMatch) {
            console.log(`[SENSITIVITY CHECK] No MIP label found in custom.xml of ${file.name}`);
            return null;
        }

        const labelName = labelNameMatch[1].trim();
        console.log(`[SENSITIVITY CHECK] ✓ Found label: "${labelName}" in ${file.name}`);

        // Determine sensitivity level (same logic as backend)
        const labelNameLower = labelName.toLowerCase();

        // Check exact "level X" patterns first
        if (labelNameLower.includes('level 4')) {
            console.warn(`[SENSITIVITY CHECK] ⚠️ LEVEL 4 DETECTED: "${labelName}"`);
            return { level: 4, labelName };
        }
        if (labelNameLower.includes('level 3')) {
            console.log(`[SENSITIVITY CHECK] Level 3 detected: "${labelName}"`);
            return { level: 3, labelName };
        }
        if (labelNameLower.includes('level 2')) {
            console.log(`[SENSITIVITY CHECK] Level 2 detected: "${labelName}"`);
            return { level: 2, labelName };
        }
        if (labelNameLower.includes('level 1')) {
            console.log(`[SENSITIVITY CHECK] Level 1 detected: "${labelName}"`);
            return { level: 1, labelName };
        }

        // Fallback keyword matching
        const level4Keywords = ['critical', 'confidential', 'restricted', 'secret', 'highly confidential', 'classified', 'sensitive', 'proprietary'];
        if (level4Keywords.some(keyword => labelNameLower.includes(keyword))) {
            console.warn(`[SENSITIVITY CHECK] ⚠️ LEVEL 4 DETECTED (keyword): "${labelName}"`);
            return { level: 4, labelName };
        }

        const level3Keywords = ['internal', 'private', 'company', 'organization'];
        if (level3Keywords.some(keyword => labelNameLower.includes(keyword))) {
            console.log(`[SENSITIVITY CHECK] Level 3 detected (keyword): "${labelName}"`);
            return { level: 3, labelName };
        }

        if (labelNameLower.includes('personal')) {
            console.log(`[SENSITIVITY CHECK] Level 2 detected (keyword): "${labelName}"`);
            return { level: 2, labelName };
        }

        const level1Keywords = ['public', 'non-sensitive', 'general', 'unrestricted'];
        if (level1Keywords.some(keyword => labelNameLower.includes(keyword))) {
            console.log(`[SENSITIVITY CHECK] Level 1 detected (keyword): "${labelName}"`);
            return { level: 1, labelName };
        }

        console.log(`[SENSITIVITY CHECK] Label "${labelName}" did not match any level patterns`);
        return null;

    } catch (error) {
        console.error(`[SENSITIVITY CHECK] Error checking sensitivity label for ${file.name}:`, error);
        console.error(`[SENSITIVITY CHECK] File will be allowed through (fail-open policy)`);
        return null; // Fail open - don't block on errors
    }
}

export const downloadDataSourceFile = async (dataSource: DataSource, groupId: string | undefined = undefined) => {
    if (isBedrockKbDatasource(dataSource)) return; // No file to download for Bedrock KB
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
  if (isBedrockKbDatasource(dataSource)) {
      // Bedrock KB datasources are references, not files — just remove from the array
      return { success: true, fileName: dataSource.name || dataSource.id || 'Bedrock KB' };
  }
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

export const disableSupportReprocess = (fileType: string) => {
  return IMAGE_FILE_TYPES.includes(fileType) || VIDEO_FILE_TYPES.includes(fileType);
}

// Polling options interface
export interface FilePollingOptions {
  key: string;
  fileType: string;
  setPollingFiles: (updater: (prev: Set<string>) => Set<string>) => void;
  setEmbeddingStatus: (updater: (prev: any) => any) => void;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  groupId?: string;
}

// File reprocessing with polling interface
export interface FileReprocessingOptions extends FilePollingOptions {
  successMessage?: string;
  failureMessage?: string;
  setLoadingMessage?: (message: string) => void;
}

/**
 * Starts polling for file status updates
 * Polls every 5 seconds for 2 minutes (24 polls) or until completed
 * 
 * @param options Configuration for status polling
 */
export const startFileStatusPolling = (options: FilePollingOptions): void => {
  const { key, fileType, setPollingFiles, setEmbeddingStatus, onSuccess, onError } = options;
  
  // Add to polling files
  setPollingFiles(prev => new Set(prev).add(key));
  
  let pollCount = 0;
  const maxPolls = 24; // 2 minutes total (24 * 5 seconds)
  
  const pollStatus = () => {
    const keyData = { key, type: fileType };
    embeddingDocumentStatus([keyData])
      .then(response => {
        if (response?.success && response?.data) {
          setEmbeddingStatus(prev => ({
            ...prev,
            ...response.data,
            // Include metadata if available
            ...(response.metadata && { metadata: { ...prev?.metadata, ...response.metadata } })
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
          // Stop polling after max attempts
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
};

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
    setLoadingMessage,
    groupId
  } = options;

  try {
    // Set loading message if provided
    if (setLoadingMessage) setLoadingMessage("Reprocessing File...");

    // Add to polling files
    setPollingFiles(prev => new Set(prev).add(key));

    // Clear any cached status for this file since we're reprocessing
    await clearEmbeddingStatusCache(key);

    const result = await reprocessFile(key, groupId);
    if (result.success) {
      toast(successMessage);
      
      // Start polling for status updates
      startFileStatusPolling({ key, fileType, setPollingFiles, setEmbeddingStatus, onSuccess, onError });
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

// Threshold for showing refresh vs reprocess button (in minutes)
const REPROCESS_THRESHOLD_MINUTES = 5;

/**
 * Helper function to check how many minutes have passed since a timestamp
 * @returns Number of minutes since the timestamp, or null if parsing fails
 */
const getMinutesSinceTimestamp = (createdAt: string, metadata?: { lastUpdated?: string }): number | null => {
  try {
    // Use lastUpdated from metadata if available, otherwise fall back to createdAt
    const timestampToCheck = metadata?.lastUpdated || createdAt;
    
    // Backend sends UTC time without 'Z' suffix, so add it if needed
    const utcTimestamp = timestampToCheck.endsWith('Z') ? timestampToCheck : timestampToCheck + 'Z';
    const checkTime = new Date(utcTimestamp);
    const now = new Date();
    
    return (now.getTime() - checkTime.getTime()) / (60 * 1000); // Convert ms to minutes
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return null;
  }
};

/**
 * Determines whether to show the reprocess button based on file status and last updated time
 * 
 * @param createdAt ISO timestamp string of when the file was created
 * @param status Current processing status of the file
 * @param metadata Optional metadata containing lastUpdated and other details
 * @returns true if reprocess button should be shown, false otherwise
 */
export const shouldShowReprocessButton = (createdAt: string, status: string, metadata?: { lastUpdated?: string; failedChunks?: number; totalChunks?: number }): boolean => {
  // Never show button for completed files
  if (status === 'completed') {
    return false;
  }

  // Always show button for failed files regardless of time
  if (status === 'failed') {
    return true;
  }

  // For other statuses, check if file is older than threshold
  const minutesSince = getMinutesSinceTimestamp(createdAt, metadata);
  
  // If we can't parse the time, default to showing the button
  if (minutesSince === null) {
    return true;
  }
  
  // Show button only if file was last updated more than threshold minutes ago
  return minutesSince > REPROCESS_THRESHOLD_MINUTES;
};

/**
 * Determines what action button to show for a file
 * @returns 'refresh' - show refresh button (within 5 min, unknown state)
 *          'reprocess' - show reprocess button (after 5 min or failed)
 *          null - show nothing (completed files)
 */
export const getFileAction = (
  createdAt: string,
  status: string,
  metadata?: { lastUpdated?: string; failedChunks?: number; totalChunks?: number }
): 'refresh' | 'reprocess' | null => {
  // Never show actions for completed files
  if (status === 'completed') {
    return null;
  }

  // Always show reprocess for failed files (regardless of time)
  if (status === 'failed') {
    return 'reprocess';
  }

  // For other statuses, check time
  const minutesSince = getMinutesSinceTimestamp(createdAt, metadata);
  if (minutesSince === null) {
    return 'reprocess'; // Safe fallback
  }

  // Within threshold: Show refresh (might still be processing from previous session)
  if (minutesSince <= REPROCESS_THRESHOLD_MINUTES) {
    return 'refresh';
  }

  // After threshold: Show reprocess (probably stuck or timed out)
  return 'reprocess';
};


export const isRecentlyReprocessed = (createdAt: string, status: string, metadata?: { lastUpdated?: string; failedChunks?: number; totalChunks?: number }): boolean => {
  // Don't show loader for completed or failed files
  if (status === 'completed' || status === 'failed') {
    return false;
  }

  // For other statuses (processing, pending, etc.), check if it's within threshold
  const minutesSince = getMinutesSinceTimestamp(createdAt, metadata);
  
  // If we can't parse the time, don't show loader
  if (minutesSince === null) {
    return false;
  }
  
  // Handle future timestamps (shouldn't happen but be defensive)
  if (minutesSince < 0) {
    return true; // Treat future timestamps as "recently processed"
  }
  
  // Return true if the file was processed within the threshold
  return minutesSince <= REPROCESS_THRESHOLD_MINUTES;
};
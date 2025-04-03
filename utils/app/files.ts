import { getFileDownloadUrl, deleteFile } from "@/services/fileService";
import { DataSource } from "@/types/chat";
import { IMAGE_FILE_TYPES } from "./const";

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

export const deleteDatasourceFile = async (dataSource: DataSource) => {
  try {
      const response = await deleteFile(dataSource.id || 'none');
      if (!response.success) {  // Now correctly checking success
          console.error(`Failed to delete file: ${dataSource.id}`, response);
          alert(`Error deleting file "${dataSource.id}". Please try again.`);
          return false;
      }
      alert(`File deleted successfully`);
      console.log(`File deleted successfully: ${dataSource.id}`);
      return true;
  } catch (error) {
      console.error(`Error while deleting file: ${dataSource.id}`, error);
      alert(`An unexpected error occurred while deleting "${dataSource.id}". Please try again later.`);
      return false;
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
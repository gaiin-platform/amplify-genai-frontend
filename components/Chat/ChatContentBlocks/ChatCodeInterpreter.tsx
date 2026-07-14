import { getPresignedDownloadUrl } from '@/services/codeInterpreterService';
import React, { useEffect, useState } from 'react';
import {
  IconDownload
} from '@tabler/icons-react';
import { DownloadFileButton } from '@/components/ReusableComponents/DownloadFileButton';

export interface FileInfo {
  type: string;
  values: {
    file_key: string;
    presigned_url: string;
    file_size: number;
    file_key_low_res?: string;
    presigned_url_low_res?: string;
  };
}

interface Data {
    key: string;
    fileName?: string;
  }

interface ChatCodeInterpreterProps {
  file_info: FileInfo;
}


const ChatCodeInterpreter: React.FC<ChatCodeInterpreterProps> = ({ file_info }) => {
  const [fileContent, setFileContent] = useState<React.ReactNode>(<div>Loading...</div>);

  const [csvPreview, setCsvPreview] = useState<string[] | null>([]);
  const [csvOverflow, setcsvOverflow] = useState(false);
  
  const [pdfError, setPdfError] = useState(false);
  


  useEffect(() => {
    const fetchAndSetCsvContent = async (presignedUrl: string, fileSize: number) => {
      try {
        const response = await fetch(presignedUrl);
        if (!response.ok) throw new Error('Failed to fetch CSV content');
        const csvText = await response.text();
        
        let contentToShow =  csvText.trim().split('\n');
        
        if (contentToShow.length > 11) {
            const previewRows = contentToShow.slice(0, 11);
            previewRows.push('...')
            setcsvOverflow(true);
            contentToShow = previewRows;
        } 
        setCsvPreview(contentToShow);
      } catch (error) {
        console.error('Error fetching or parsing CSV:', error);
        setCsvPreview(null);
      }
    };
    if (file_info.type === 'text/csv') {
        fetchAndSetCsvContent(file_info.values.presigned_url, file_info.values.file_size);
      }
  }, [file_info]);


  async function fetchPdfAndDisplay(presignedUrl: string) {
    try {
      const response = await fetch(presignedUrl);
      if (!response.ok) throw new Error('Failed to fetch PDF');
  
      const pdfBlob = await response.blob();
      return URL.createObjectURL(pdfBlob);
    
    } catch (error) {
      console.error('Error fetching or displaying PDF:', error);
      setPdfError(true);
      return ""
    }
  }
  

  const isUrlExpired = (url: string): boolean => {
    // AWS SDK v4 presigned URLs use X-Amz-Date + X-Amz-Expires
    const dateMatch = /X-Amz-Date=(\d{8}T\d{6}Z)/.exec(url);
    const expiresMatch = /X-Amz-Expires=(\d+)/.exec(url);
    if (dateMatch && expiresMatch) {
        const raw = dateMatch[1]; // e.g. 20240508T123456Z
        const iso = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(9,11)}:${raw.slice(11,13)}:${raw.slice(13,15)}Z`;
        const signedAt = new Date(iso);
        const expiresInSeconds = parseInt(expiresMatch[1]);
        return new Date() > new Date(signedAt.getTime() + expiresInSeconds * 1000);
    }
    // Legacy AWS SDK v2: Expires= (unix timestamp)
    const legacyMatch = /[?&]Expires=(\d+)/.exec(url);
    if (legacyMatch) {
        return new Date() >= new Date(parseInt(legacyMatch[1]) * 1000);
    }
    // Cannot determine expiry — assume valid
    return false;
  };

  const getNewPresignedUrl = async (data: Data) => {
    try {
        const rawPresignedUrl = await getPresignedDownloadUrl(data);
        if (rawPresignedUrl && rawPresignedUrl.downloadUrl) { //else it failed
            return rawPresignedUrl.downloadUrl;
        }
        return null;
    } catch {
        console.log("Failed to retrieve presigned url");
        return null;
    }
  };

  // Fetch a fresh attachment-flavoured presigned URL and trigger a browser download.
  // Always called with the high-res key and the human-readable filename so the backend
  // adds ResponseContentDisposition: attachment — keeping the display URL (no attachment)
  // separate from the download URL.
  const triggerDownload = async (fileKey: string, name: string) => {
    const url = await getNewPresignedUrl({ key: fileKey, fileName: name });
    if (!url) {
      console.error('Failed to get download URL for', fileKey);
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
  const renderFileContent = async () => {
    const { type, values } = file_info;
    let { presigned_url, file_key } = values;

    // For PNG images, use the low-res version for display if available.
    // The high-res key (values.file_key) is always used for the download button.
    const isLowRes = type === 'image/png' && !!(values.presigned_url_low_res && values.file_key_low_res);
    if (isLowRes) {
      presigned_url = values.presigned_url_low_res!;
      file_key = values.file_key_low_res!;
    }

    // Derive the human-readable filename from whichever key is used for display.
    const fileNameMatch = file_key.match(/-FN-([^\/]+)/);
    const fileName = fileNameMatch && fileNameMatch[1] ? fileNameMatch[1] : `Generated_${type.split('/')[1]}_file`;

    // Refresh the display URL if expired — fetch WITHOUT fileName so the URL has no
    // ResponseContentDisposition header and <img> tags can render it directly.
    if (isUrlExpired(presigned_url)) {
      const urlResponse = await getNewPresignedUrl({ key: file_key });
      if (urlResponse) {
        presigned_url = urlResponse;
        if (isLowRes) {
          file_info.values.presigned_url_low_res = urlResponse;
        } else {
          file_info.values.presigned_url = urlResponse;
        }
      }
    }

    // The high-res key used for every download button (always values.file_key).
    const downloadKey = values.file_key;
    // Human-readable name derived from the high-res key for the download filename.
    const downloadFileNameMatch = downloadKey.match(/-FN-([^\/]+)/);
    const downloadFileName = downloadFileNameMatch && downloadFileNameMatch[1]
      ? downloadFileNameMatch[1]
      : fileName;

    switch (type) {
      case 'text/csv': {
            const scrollableStyle: React.CSSProperties = {
                overflowX: 'auto',
                width: '100%',
                maxHeight: '400px',
                display: 'block'
            };
            const cellStyle: React.CSSProperties = {
                whiteSpace: 'nowrap',
                minWidth: '80px'
            };
            const renderCsvTable = () => (
                <div style={scrollableStyle}>
                    <table>
                        <tbody>
                        {csvPreview && csvPreview.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                            {row.split(',').map((cell, cellIndex) => (
                                <td key={cellIndex} style={cellStyle}>{cell}</td>
                            ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            );
            setFileContent(
            <div className='mb-6'>
                <DownloadFileButton
                  fileName={downloadFileName}
                  presigned_url={presigned_url}
                  onClickOverride={() => triggerDownload(downloadKey, downloadFileName)}>
                  <IconDownload size={24}/>
                </DownloadFileButton>
                { !csvPreview ? <div>Loading...</div> : csvPreview.length > 0
                            ? <div>{renderCsvTable()} {csvOverflow && <>{'Download to see full content'}</>}</div>
                            : <div>Unfortunately, we are unable to display the file contents at this time...</div>}
            </div>
            );
            break;
      }
      case 'application/pdf': {
            const pdfUrl = await fetchPdfAndDisplay(presigned_url);
            setFileContent(
                <div className='mb-6'>
                    <DownloadFileButton
                    fileName={downloadFileName}
                    presigned_url={presigned_url}
                    onClickOverride={() => triggerDownload(downloadKey, downloadFileName)}>
                      <IconDownload size={24}/>
                    </DownloadFileButton>
                    {pdfError ? (<div>Unfortunately, we are unable to display the PDF at this time...</div>)
                              : pdfUrl && pdfUrl !== "" ?
                                        (<iframe
                                            className='mt-6'
                                            id="Generated_PDF"
                                            width="625"
                                            height="450"
                                            src={pdfUrl}
                                            onError={() => setPdfError(true)}
                                            style={{ border: 'none' }} />)
                                        : <div>Loading...</div>}
                </div>);
                break;
      }
      case 'binary/octet-stream':
            setFileContent(
            <div>
                <DownloadFileButton
                  fileName={downloadFileName}
                  presigned_url={presigned_url}
                  onClickOverride={() => triggerDownload(downloadKey, downloadFileName)}>
                    <IconDownload size={24}/>
                </DownloadFileButton>
                Please download to view the file contents
            </div>
            );
            break;
      case 'image/png':
            setFileContent(
                <div>
                <DownloadFileButton
                fileName={downloadFileName}
                presigned_url={presigned_url}
                onClickOverride={() => triggerDownload(downloadKey, downloadFileName)}>
                  <IconDownload size={24}/>
                </DownloadFileButton>
                <img
                    src={presigned_url}
                    alt={fileName}
                    loading="lazy"
                    style={{ maxWidth: '100%', height: 'auto', display: 'block'}}
                    onError={(e) => {
                        e.currentTarget.alt = 'Unfortunately, we are unable to display the image at this time...';
                        e.currentTarget.src = '';
                    }}
                />
            </div>
            );
            break;
      case 'image/jpeg':
            setFileContent(
                <div>
                <DownloadFileButton
                fileName={downloadFileName}
                presigned_url={presigned_url}
                onClickOverride={() => triggerDownload(downloadKey, downloadFileName)}>
                  <IconDownload size={24}/>
                </DownloadFileButton>
                <img
                    src={presigned_url}
                    alt={fileName}
                    loading="lazy"
                    style={{ maxWidth: '100%', height: 'auto', display: 'block'}}
                    onError={(e) => {
                        e.currentTarget.alt = 'Unfortunately, we are unable to display the image at this time...';
                        e.currentTarget.src = '';
                    }}
                />
            </div>
            );
            break;
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            setFileContent(
            <div>
                <DownloadFileButton
                  fileName={downloadFileName}
                  presigned_url={presigned_url}
                  onClickOverride={() => triggerDownload(downloadKey, downloadFileName)}>
                    <IconDownload size={24}/>
                </DownloadFileButton>
                Please download to view the file contents
            </div>
            );
            break;
      default:
            setFileContent(<div>Unsupported file type</div>);
    }
  };
  renderFileContent();
}, [file_info, csvPreview]);

  return <>{fileContent}</>;
};    

export default ChatCodeInterpreter;



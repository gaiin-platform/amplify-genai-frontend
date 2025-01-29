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
    const regex = /Expires=(\d+)/;
    const matches = regex.exec(url);

    if (matches && matches[1]) {
        const expiry = matches[1];
        const expiryDate = new Date(parseInt(expiry) * 1000);
        return expiryDate <= new Date();
    }
    return true;
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

  useEffect(() => {
  const renderFileContent = async () => {   
    const { type, values } = file_info;
    let { presigned_url, file_key } = values;
    
    // Check for low-res image first
    let isLowRes = false;
    if (type === 'image/png' && values.presigned_url_low_res && values.file_key_low_res) { //think about download the whole file 
      presigned_url = values.presigned_url_low_res;
      file_key = values.file_key_low_res
      isLowRes = true;
    }

    const fileNameMatch = file_key.match(/-FN-([^\/]+)/);
    const fileName = fileNameMatch && fileNameMatch[1] ? fileNameMatch[1] : `Generated_${type.split('/')[1]}_file`;
    
    if (isUrlExpired(presigned_url)) {

      //fetch new presigned url and set it 
       const urlResponse = await getNewPresignedUrl({'key': file_key, "fileName": fileName});
       if (urlResponse) {
            presigned_url = urlResponse;
            if (isLowRes) {
                file_info.values.presigned_url_low_res = urlResponse;
            } else{
                file_info.values.presigned_url = urlResponse;
            }
       }
      }

    switch (type) {
      case 'text/csv':
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
            
            const renderCsvTable = () => {
                return (
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
            };
            setFileContent (
            <div className='mb-6'>
                <DownloadFileButton
                  fileName={fileName}
                  presigned_url={presigned_url}>
                  <IconDownload size={24}/>
                </DownloadFileButton>
                
                { !csvPreview ? <div>Loading...</div> : csvPreview.length > 0 
                            ? <div >{renderCsvTable()} {csvOverflow && <>{'Download to see full content'}</>} </div> 
                            : <div>Unfortunately, we are unable to display the file contents at this time...</div>}
            </div>
            );
            break;
        case 'application/pdf':
            const pdfUrl = await fetchPdfAndDisplay(presigned_url)
            setFileContent(
                <div className='mb-6'>
                    <DownloadFileButton
                    fileName={fileName}
                    presigned_url={presigned_url}>
                      <IconDownload size={24}/>
                    </DownloadFileButton>
                    {pdfError ? ( <div>Unfortunately, we are unable to display the PDF at this time...</div>) 
                              : pdfUrl && pdfUrl !== "" ? 
                                        (<iframe
                                            className='mt-6'
                                            id="Generated_PDF"
                                            width="625"
                                            height="450"
                                            src={pdfUrl}
                                            onError={() => setPdfError(true)}
                                            style={{ border: 'none' }} /> )
                                        : <div>Loading...</div>}
                             
                </div>);
                break;
        case 'binary/octet-stream': 
            setFileContent(
            <div>
                <DownloadFileButton
                  fileName={fileName}
                  presigned_url={presigned_url}>
                    <IconDownload size={24}/>
                </DownloadFileButton>
                Please download to view the file contents
            </div>
            );
            break;
        case 'image/png':
            let downloadPresignedUrl = presigned_url;
            // We need to get the high quality version
            if (isLowRes) {
                if (isUrlExpired(file_info.values.presigned_url)) {
                    const urlResponse = await getNewPresignedUrl({'key': file_info.values.file_key, "fileName": fileName});
                    if (urlResponse) {
                        file_info.values.presigned_url = urlResponse;
                        downloadPresignedUrl = urlResponse;
                    }  
                }        
            }

            setFileContent(
                <div>
                <DownloadFileButton
                fileName={fileName}
                presigned_url={presigned_url}>
                  <IconDownload size={24}/>
                </DownloadFileButton>
                <img 
                    src={presigned_url} 
                    alt={fileName} 
                    loading="lazy" 
                    style={{ maxWidth: '100%', height: 'auto', display: 'block'}} 
                    onError={(e) => {
                        // Display error text or handle the error as desired
                        e.currentTarget.alt = 'Unfortunately, we are unable to display the image at this time...';
                        e.currentTarget.src = ''; // Remove the broken image src or replace with a placeholder image
                    }}
                />
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



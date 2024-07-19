import { useEffect, useState, useContext } from "react";
import HomeContext from "@/pages/api/home/home.context";
import ExpansionComponent from "../ExpansionComponent";
import { fetchApiDoc } from "@/services/apiKeysService";
import SidebarActionButton from "@/components/Buttons/SidebarActionButton";
import { DownloadFileButton } from "@/components/Download/DownloadFileButton";
import { IconDownload } from "@tabler/icons-react";


export async function fetchFile(presignedUrl: string) {
    console.log(presignedUrl)
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


  interface Props {
    content: string;
}


export const ApiDocBlock: React.FC<Props> = ({content}) => {
    const {state:{statsService, messageIsStreaming},  dispatch:homeDispatch} = useContext(HomeContext);
    const [docFileContents, setDocxFileContents] = useState<any>(null);
    const [csvUrl, setCsvUrl] = useState<string | undefined>(undefined);
    const [postmanUrl, setPostmanUrl] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);


    useEffect(() => {
        const getUrls = async () => {
            setIsLoading(true);
            const result = await fetchApiDoc();
            if (result.success) {
                setDocxFileContents(await fetchFile(result.doc_url));
                setCsvUrl(result.csv_url);
                setPostmanUrl(result.postman_url);
            }
        }
        if (!docFileContents && !messageIsStreaming) getUrls();
    }, [content]);

    useEffect(() => {
        if (!messageIsStreaming) setIsLoading(false);
    }, [postmanUrl, csvUrl, docFileContents]);


   return <div className="mt-3">
        <ExpansionComponent 
            title="Amplify API Documents"
            content={ [
                isLoading ? <> Loading API Documents...</> :<></>
                ,
                <>
                {docFileContents && 
                <ExpansionComponent 
                    title="View PDF Format"
                    content={
                        <iframe
                            className='mt-6'
                            src={docFileContents}
                            width="560"
                            height="400"
                            onError={() => {}}
                            style={{ border: 'none' }} /> 
                        } /> }
                </> ,
              
                <>
                {csvUrl && 
                    <APIDownloadFile
                        label="CSV format"
                        presigned_url={csvUrl}
                    />
                }
                </>,
                    
                <>
                {postmanUrl &&
                    <APIDownloadFile
                    label="Postman Collection"
                    presigned_url={postmanUrl}
                    />
                }
                </>,
                    
                    

            ]}/>
    </div>
}



interface DownloadProps {
    label: string;
    presigned_url: string;
    IconSize?: number;
}


export const APIDownloadFile: React.FC<DownloadProps> = ({ label, presigned_url, IconSize=20 }) => {
    return (
    <div className="flex justify-start mt-2">
        <DownloadFileButton
            presigned_url={presigned_url}>
            <div className="flex flex-row gap-2 p-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"> 
                <IconDownload size={IconSize} />
                {label}
            </div>  
        </DownloadFileButton>
    </div>    
    )
}
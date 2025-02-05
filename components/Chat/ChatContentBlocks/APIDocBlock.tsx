import { useEffect, useState, useContext, useRef, useLayoutEffect } from "react";
import HomeContext from "@/pages/api/home/home.context";
import ExpansionComponent from "../ExpansionComponent";
import { fetchApiDoc } from "@/services/apiKeysService";
import { DownloadFileButton } from "@/components/ReusableComponents/DownloadFileButton";
import { IconDownload } from "@tabler/icons-react";
import React from "react";
import { fetchFile } from "@/utils/app/files";

  interface Props {
    content: string;
}


export const ApiDocBlock: React.FC<Props> = ({content}) => {
    const {state:{statsService, messageIsStreaming},  dispatch:homeDispatch} = useContext(HomeContext);
    const [docFileContents, setDocxFileContents] = useState<any>(null);
    const [csvUrl, setCsvUrl] = useState<string | undefined>(undefined);
    const [postmanUrl, setPostmanUrl] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(true);

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
        if (!messageIsStreaming && (postmanUrl || csvUrl || docFileContents)) setIsLoading(false);
    }, [postmanUrl, csvUrl, docFileContents]);



   return <div className="mt-3" key={0}>
        <ExpansionComponent 
            title="Amplify API Documents"
            content={ [
                isLoading ? <> Loading API Documents... </> :<></>
                ,
                <div key={"pdf"}>
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
                </div> ,
              
              <div key={"csv"}>
                {csvUrl && 
                    <APIDownloadFile
                        label="CSV format"
                        presigned_url={csvUrl}
                    />
                }
                </div>,
                    
                <div key={"postman"}>
                {postmanUrl &&
                    <APIDownloadFile
                    label="Postman Collection"
                    presigned_url={postmanUrl}
                    />
                }
                </div>,
                    
                    

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
            <div className="flex flex-row gap-2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-100"> 
                <IconDownload size={IconSize} />
                {label}
            </div>  
        </DownloadFileButton>
    </div>    
    )
}
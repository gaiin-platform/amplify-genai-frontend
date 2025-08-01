
import React, { ReactElement } from 'react';

interface Props {
    fileName?: string;
    presigned_url: string;
    children: ReactElement;
    textSize?: string;
}


export const DownloadFileButton: React.FC<Props> = ({fileName="", presigned_url, children, textSize="text-lg"}) => {
    return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`${textSize}font-bold`}>{fileName}</span>
                <button
                    className=" text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    onClick={(e) => {
                        e.preventDefault();
                        const link = document.createElement('a');
                        link.href = presigned_url;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    title={`Download ${fileName}`}
                    id={`downloadButtons`}
                    aria-label={`Download ${fileName}`}
                    style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    {children}
                </button>
            </div>
        );
}

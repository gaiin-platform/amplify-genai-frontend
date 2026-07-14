
import React, { ReactElement } from 'react';

interface Props {
    fileName?: string;
    presigned_url: string;
    children: ReactElement;
    textSize?: string;
    // Optional async override: when provided, called instead of directly opening presigned_url.
    // Useful when a fresh attachment-flavoured URL needs to be fetched before triggering the download.
    onClickOverride?: () => Promise<void>;
}


export const DownloadFileButton: React.FC<Props> = ({fileName="", presigned_url, children, textSize="text-lg", onClickOverride}) => {
    return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`${textSize}font-bold`}>{fileName}</span>
                <button
                    className=" text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    onClick={async (e) => {
                        e.preventDefault();
                        if (onClickOverride) {
                            await onClickOverride();
                            return;
                        }
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

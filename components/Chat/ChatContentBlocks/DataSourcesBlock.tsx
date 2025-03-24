import React, { useContext, useState, useRef } from "react";
import {Message} from "@/types/chat";
import {IconDownload, IconFileCheck, IconX} from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";
import { getFileDownloadUrl } from "@/services/fileService";
import { fetchImageFromPresignedUrl } from "@/utils/app/files";
import { IMAGE_FILE_TYPES } from "@/utils/app/const";

interface Props {
    message: Message;
    handleDownload?: (dataSource: any) => void;
}


export const DataSourcesBlock: React.FC<Props> = (
    {message, handleDownload}) => {
    const { setLoadingMessage} = useContext(HomeContext);
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
    const imageUrlsRef = useRef<Record<string, string>>({});

    const getName = (dataSource: any) => {
        if(dataSource.name){
            return (dataSource.name.length < 50) ?
                dataSource.name : dataSource.name.substring(0, 50) + "...";
        }
        return "Untitled Document";
    }

    const getImage = async (dataSource: any, index: number) => {
        const defaultImage = 'url("/sparc_apple.png")';
        if (!dataSource.type || !dataSource.id || !IMAGE_FILE_TYPES.includes(dataSource.type)) {
            return defaultImage;
        }
        
        // Skip if we're already loading this image or if we already have it
        const cacheKey = `${dataSource.id}-${index}`;
        if (loadingImages[cacheKey] || imageUrlsRef.current[cacheKey]) {
            return imageUrlsRef.current[cacheKey] ? `url(${imageUrlsRef.current[cacheKey]})` : defaultImage;
        }
        
        // Set loading state for this image
        setLoadingImages(prev => ({...prev, [cacheKey]: true}));
        
        try {
            const response = await getFileDownloadUrl(dataSource.id, dataSource.groupId);
            if (!response.success) {
                console.error("Error getting file download URL");
                return defaultImage;
            }
            
            const blob = await fetchImageFromPresignedUrl(response.downloadUrl, dataSource.type || '');
            if (!blob) return defaultImage;
            
            // Convert blob to URL
            const imageUrl = URL.createObjectURL(blob);
            imageUrlsRef.current[cacheKey] = imageUrl;
            return `url(${imageUrl})`;
        } catch (error) {
            console.error("Error loading image:", error);
            return defaultImage;
        } finally {
            setLoadingImages(prev => ({...prev, [cacheKey]: false}));
        }
    };

    // Pre-load images when component mounts
    React.useEffect(() => {
        if (!message.data?.dataSources) return;
        
        message.data.dataSources.forEach((dataSource: any, index: number) => {
            if (dataSource.type && IMAGE_FILE_TYPES.includes(dataSource.type)) {
                getImage(dataSource, index);
            }
        });
        
        // Cleanup function to revoke object URLs
        return () => {
            Object.values(imageUrlsRef.current).forEach(url => {
                URL.revokeObjectURL(url);
            });
        };
    }, [message.data?.dataSources]);

    if(!message.data || !message.data.dataSources || message.data.dataSources.length < 1){
        return <></>;
    }

    return (
        <div className="flex flex-col w-full mt-5 text-gray-800">
        <div className="mr-3 dark:text-white">Included documents:</div>

        <div className="flex flex-col">
            {message.data && message.data.dataSources && message.data.dataSources.map((d: any, i: any) => {
                const cacheKey = `${d.id}-${i}`;
                const isLoading = loadingImages[cacheKey];
                const imageUrl = imageUrlsRef.current[cacheKey] ? `url(${imageUrlsRef.current[cacheKey]})` : 'url("/sparc_apple.png")';
                
                return (
                <div key={i}
                    className="bg-yellow-400 dark:bg-[#B0BEC5] rounded-xl shadow-lg h-12 mr-2 mb-2"
                >
                    <div className="flex flex-row">
                        <div
                            className="w-14 h-12 flex-none bg-cover rounded-l-xl text-center overflow-hidden relative"
                            style={{backgroundImage: imageUrl}} 
                            title={d.name}>
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>

                        <div className="ml-3 mt-3">
                                <IconFileCheck/>
                        </div>

                        <div className="mt-3 ml-2 flex-grow p-0 truncate">
                            {i + 1}. {getName(d)}
                        </div>
                   
                        {d.id && d.id.startsWith("s3://") && (
                            <div className="mt-3 mr-3 ml-1 p-0 truncate hover:text-neutral-100 dark:hover:text-blue-700"
                            >
                                <button onClick={() => {
                                    if (handleDownload) {
                                        setLoadingMessage('Downloading File...');
                                        handleDownload(d);
                                        setLoadingMessage('');
                                    }
                                }}
                                >
                                    <IconDownload/>
                                </button>
                            </div>
                        )}              
                    </div>
                </div>
            )})}
        </div>
    </div>);
};

export default DataSourcesBlock;
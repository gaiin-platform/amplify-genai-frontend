import React, { useContext, useState, useRef, useEffect } from "react";
import {Message} from "@/types/chat";
import {
    IconDownload, 
    IconFileCheck, 
    IconX,
    IconFileText,
    IconFileSpreadsheet,
    IconFileTypePdf,
    IconZoomIn,
    IconMaximize
} from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";
import { getFileDownloadUrl } from "@/services/fileService";
import { fetchImageFromPresignedUrl } from "@/utils/app/files";
import { IMAGE_FILE_TYPES } from "@/utils/app/const";
import { getWhiteLabelConfig } from "@/utils/whiteLabel/config";

interface Props {
    message: Message;
    handleDownload?: (dataSource: any) => void;
}


// Image Modal component
const ImageModal: React.FC<{
    imageUrl: string,
    fileName: string,
    onClose: () => void
}> = ({ imageUrl, fileName, onClose }) => {
    // Close modal when Escape key is pressed
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
            onClick={onClose}
        >
            <div className="relative max-w-4xl max-h-[90vh] p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <button 
                    className="absolute top-3 right-3 p-1 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-200 dark:hover:bg-gray-600 z-10"
                    onClick={onClose}
                >
                    <IconX size={20} />
                </button>
                
                <div className="text-center text-gray-800 dark:text-gray-200 mb-2 font-medium">
                    {fileName}
                </div>
                
                <div className="overflow-auto max-h-[calc(90vh-60px)]">
                    <img 
                        src={imageUrl} 
                        alt={fileName} 
                        className="max-w-full h-auto object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        </div>
    );
};

export const DataSourcesBlock: React.FC<Props> = (
    {message, handleDownload}) => {
    const { setLoadingMessage} = useContext(HomeContext);
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
    const imageUrlsRef = useRef<Record<string, string>>({});
    const [selectedImage, setSelectedImage] = useState<{url: string, name: string} | null>(null);
    
    // Get logo source for default image
    const config = getWhiteLabelConfig();
    const defaultLogoSrc = config.customLogoPath 
        ? `/logos/${config.customLogoPath}`
        : '/sparc_apple.png';

    const getName = (dataSource: any) => {
        if(dataSource.name){
            return (dataSource.name.length < 50) ?
                dataSource.name : dataSource.name.substring(0, 50) + "...";
        }
        return "Untitled Document";
    }

    const getImage = async (dataSource: any, index: number) => {
        const defaultImage = `url("${defaultLogoSrc}")`;
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

    // Get full image URL without 'url()' wrapper for modal
    const getFullImageUrl = (cacheKey: string): string => {
        if (imageUrlsRef.current[cacheKey]) {
            return imageUrlsRef.current[cacheKey];
        }
        return defaultLogoSrc; // Fallback image
    };

    return (
        <div className="flex flex-col w-full mt-5 text-gray-800">
        {selectedImage && (
            <ImageModal 
                imageUrl={selectedImage.url}
                fileName={selectedImage.name}
                onClose={() => setSelectedImage(null)}
            />
        )}
        <div className="mr-3 dark:text-white">Included documents:</div>

        <div className="flex flex-wrap">
            {message.data && message.data.dataSources && message.data.dataSources.map((d: any, i: any) => {
                const cacheKey = `${d.id}-${i}`;
                const isLoading = loadingImages[cacheKey];
                const imageUrl = imageUrlsRef.current[cacheKey] ? `url(${imageUrlsRef.current[cacheKey]})` : `url("${defaultLogoSrc}")`;
                const isImage = d.type && IMAGE_FILE_TYPES.includes(d.type);
                
                const getDocumentIcon = () => {
                    if (d.type && d.type.includes('spreadsheet')) {
                        return <IconFileSpreadsheet size={64} stroke={1.5} />;
                    } else if (d.type && d.type.includes('pdf')) {
                        return <IconFileTypePdf size={64} stroke={1.5} />;
                    } else {
                        return <IconFileText size={64} stroke={1.5} />;
                    }
                };
                
                return (
                <div key={i} className="mr-3 mb-3">
                    <div className="relative group">
                        <div 
                            className="rounded-lg shadow-lg overflow-hidden relative"
                            style={{
                                width: '200px',
                                height: '200px',
                            }}
                        >
                            {/* Custom tooltip that appears on hover */}
                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm max-w-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                                <div className="text-center truncate">
                                    {d.name.length > 40 ? (
                                        <span title={d.name}>{d.name.substring(0, 40)}...</span>
                                    ) : (
                                        d.name
                                    )}
                                </div>
                            </div>
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                                </div>
                            )}
                            
                            {isImage ? (
                                <>
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center cursor-pointer" 
                                        style={{backgroundImage: imageUrl}}
                                        onClick={() => {
                                            setSelectedImage({
                                                url: getFullImageUrl(cacheKey),
                                                name: d.name
                                            });
                                        }}
                                    ></div>
                                    {/* Zoom icon indicator */}
                                    <div className="absolute bottom-10 right-2 p-1 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <IconZoomIn size={18} className="text-white" />
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                                    <div className="text-gray-400 dark:text-gray-300">
                                        {getDocumentIcon()}
                                    </div>
                                </div>
                            )}
                            
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-60 text-white truncate">
                                {i + 1}. {getName(d)}
                            </div>
                            
                            {d.id && d.id.startsWith("s3://") && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        className="p-1 bg-white rounded-full shadow-md hover:bg-gray-200"
                                        onClick={() => {
                                            if (handleDownload) {
                                                setLoadingMessage('Downloading File...');
                                                handleDownload(d);
                                                setLoadingMessage('');
                                            }
                                        }}
                                    >
                                        <IconDownload size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )})}
        </div>
    </div>);
};

export default DataSourcesBlock;
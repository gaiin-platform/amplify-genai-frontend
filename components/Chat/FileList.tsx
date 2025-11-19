import React, {FC, useEffect, useState} from 'react';
import { IconCircleX, IconCheck, IconWorld, IconSitemap } from '@tabler/icons-react';
import { AttachedDocument } from '@/types/attacheddocument';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import Search from '../Search';
import { embeddingDocumentStaus } from '@/services/adminService';
import { extractKey, getDocumentStatusConfig } from '@/utils/app/files';

interface Props {
    documents:AttachedDocument[]|undefined;
    setDocuments: (documents: AttachedDocument[]) => void;
    documentStates?: {[key:string]:number};
    onCancelUpload?: (document:AttachedDocument) => void;
    allowRemoval?: boolean;
}


const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: #777777;
  font-size: 1.1rem;
  font-weight: bold;
  animation: ${animate} 2s infinite;
`;

const getIcon = (document:AttachedDocument) => {
    switch (document.type) {
        case 'website/sitemap':
            return <IconSitemap className="text-blue-500" size={18}/>
        case 'website/url':
            return <IconWorld className="text-blue-500" size={18}/>
        default:
            return null;
    }
}

export const FileList: FC<Props> = ({ documents, setDocuments , documentStates, onCancelUpload, allowRemoval = true}) => {


    const isComplete = (document:AttachedDocument) => {
        return !documentStates || (documentStates && documentStates[document.id] == 100);
    }

    const getProgress = (document:AttachedDocument) => {

        if (documentStates && documentStates[document.id]) {
            const percentage = documentStates[document.id];
            //const percentage = 50;

            return (
                <div className="mr-1 flex items-center justify-center w-6 dark:text-black" style={{minWidth:"20px"}}>
                <CircularProgressbar
                    styles={buildStyles({
                        // Text size
                        textSize: '32px',

                        // How long animation takes to go from one percentage to another, in seconds
                        pathTransitionDuration: 0.5,

                        // Can specify path transition in more detail, or remove it entirely
                        // pathTransition: 'none',

                        // Colors
                        pathColor: `rgba(62, 152, 199})`,
                        textColor: '#000000',
                        trailColor: '#d6d6d6',
                        backgroundColor: '#3e98c7',
                    })}
                    value={percentage} text={`${percentage}`} />
                </div>
            );
        }
        return <LoadingIcon/>;
    }

    const getLabel = (document:AttachedDocument) => {
        if(!document.name) { return 'Untitled Document'; }
        return document.name.length > 12 ? document.name.slice(0, 12) + '...' : document.name;
    }

    const getIconForFileList = (document:AttachedDocument) => {
        const icon = getIcon(document);
        if (!icon) {
            return !isComplete(document) ?
                    getProgress(document) : 
                    <IconCheck className="text-green-500" />
        }
        return icon;
    }

    return (
        <div className="flex overflow-x-auto pb-2 mt-2">
            {documents?.map((document, i) => (
                <div
                    key={i}
                    className={`${isComplete(document) ? 'bg-white' : 'bg-yellow-400'} flex flex-row items-center justify-between border bg-white rounded-md px-1 py-1 ml-1 mr-1 shadow-md dark:shadow-lg`}
                    style={{ maxWidth: '220px' }}
                >
                    
                    {getIconForFileList(document)}

                    <div className="ml-1" title={document.name}>
                        <p className={`truncate font-medium text-sm ${isComplete(document) ? 'text-gray-800' : 'text-gray-800'}`}
                            style={{ maxWidth: '160px' }}>
                            {i+1}. {getLabel(document)}
                        </p>
                    </div>

                    { allowRemoval && <button
                            className="text-gray-400 hover:text-gray-600 transition-all"
                            onClick={(e) =>{
                                e.preventDefault();
                                e.stopPropagation();
                                if(onCancelUpload){
                                    onCancelUpload(document);
                                }
                                setDocuments(documents?.filter(x => x != document));
                            }}
                        >
                            <IconCircleX/>
                </button>}
                </div>
            ))}
        </div>
        
    );
};



interface ExistingProps {
    label: string;
    documents:AttachedDocument[] | undefined;
    setDocuments: (documents: AttachedDocument[]) => void;
    allowRemoval?: boolean;
    onRemoval?: (document: AttachedDocument) => void;
    boldTitle?: boolean;
}

interface GroupedDataSources {
    directUrls: AttachedDocument[];
    sitemapGroups: { [sitemapUrl: string]: AttachedDocument[] };
    other: AttachedDocument[];
}

const groupDataSourcesBySitemap = (documents: AttachedDocument[]): GroupedDataSources => {
    const grouped: GroupedDataSources = {
        directUrls: [],
        sitemapGroups: {},
        other: []
    };

    documents.forEach(doc => {
        if (doc.type === 'website/url' && doc.metadata?.fromSitemap) {
            const sitemapUrl = doc.metadata.fromSitemap;
            if (!grouped.sitemapGroups[sitemapUrl]) {
                grouped.sitemapGroups[sitemapUrl] = [];
            }
            grouped.sitemapGroups[sitemapUrl].push(doc);
        } else if (doc.type === 'website/url') {
            grouped.directUrls.push(doc);
        } else {
            grouped.other.push(doc);
        }
    });

    return grouped;
};

export const ExistingFileList: FC<ExistingProps> = ({ label, documents, setDocuments, allowRemoval = true, boldTitle=true, onRemoval}) => {

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [dataSources, setDataSources] = useState<AttachedDocument[]>(documents ?? []);
    const [hovered, setHovered] = useState<string>('');
    const [expandedSitemaps, setExpandedSitemaps] = useState<Set<string>>(new Set());
    const [embeddingStatus, setEmbeddingStatus] = useState<{[key: string]: string} | null >(null);

    useEffect(() => {
        if (documents) setDataSources(documents);
    }, [documents, searchTerm]);


    // Fetch embedding status on first render
    useEffect(() => {
        if (dataSources.length > 0 && embeddingStatus === null) {
            const keys = dataSources.map(ds => {
                const key = extractKey(ds);
                return key ? {key: extractKey(ds), type: ds.type} : null;
            }).filter(ds => ds) as {key: string, type: string}[];
            
            if (keys.length > 0) {
                embeddingDocumentStaus(keys)
                    .then(response => {
                        if (response?.success && response?.data) {
                            setEmbeddingStatus(response.data);
                        }
                    })
                    .catch(error => {
                        console.error('Failed to fetch embedding status:', error);
                    });
            }
        }
    }, [dataSources]);

    const toggleSitemap = (sitemapUrl: string) => {
        const newExpanded = new Set(expandedSitemaps);
        if (newExpanded.has(sitemapUrl)) {
            newExpanded.delete(sitemapUrl);
        } else {
            newExpanded.add(sitemapUrl);
        }
        setExpandedSitemaps(newExpanded);
    };

    const removeDocument = (document: AttachedDocument) => {
        const newDataSources = dataSources.filter(x => x.id !== document.id);
        setDataSources(newDataSources);
        // Update parent component state
        setDocuments(newDataSources);
        if (onRemoval) onRemoval(document);
    };

    const removeSitemapGroup = (sitemapUrl: string, sitemapDocs: AttachedDocument[]) => {
        const newDataSources = dataSources.filter(doc => !sitemapDocs.includes(doc));
        setDataSources(newDataSources);
        // Update parent component state
        setDocuments(newDataSources);
        if (onRemoval) {
            sitemapDocs.forEach(doc => onRemoval(doc));
        }
    };

    // Shared component for rendering document items
    const DocumentItem: FC<{
        id: string;
        itemNumber: number;
        displayText: string;
        icon?: React.ReactNode;
        onRemove?: () => void;
        onClick?: () => void;
        className?: string;
        textSize?: 'sm' | 'xs';
        removeTitle?: string;
        removeIconSize?: number;
        isClickable?: boolean;
        document?: AttachedDocument;
    }> = ({ 
        id, 
        itemNumber, 
        displayText, 
        icon, 
        onRemove, 
        onClick, 
        className = '', 
        textSize = 'sm',
        removeTitle = 'Remove',
        removeIconSize = 20,
        isClickable = false,
        document
    }) => {
        const [hoveredButton, setHoveredButton] = useState(false);
        
        // Determine background color based on hover state
        let hoverBgClass = 'bg-white bg-brand-light-input dark:bg-brand-dark-input'; // default
        
        if (hoveredButton) {
            // When hovering remove button, show gray for all items
            hoverBgClass = 'bg-gray-200 dark:bg-gray-500';
        } else if (isClickable && hovered === id) {
            // When hovering clickable item (not button), show blue
            hoverBgClass = 'bg-blue-100 dark:bg-blue-900/40';
        }
        
        const baseClasses = `flex flex-row items-center border dark:border-neutral-500 dark:text-white rounded-sm px-1 py-1.5 ml-1 mr-1 mb-1`;
        const clickableClasses = isClickable ? 'cursor-pointer transition-colors' : '';
        
        return (
            <div
                className={`${hoverBgClass} ${baseClasses} ${clickableClasses} ${className}`}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered('')}
                onClick={onClick}
            >
                <div className="ml-1 flex-1 flex items-center justify-between" style={{ overflow: 'hidden' }}>
                    <p className={`truncate font-medium text-${textSize} text-black-800 dark:text-white flex flex-row items-center gap-1 flex-1 min-w-0`} style={{
                        overflow: 'hidden',
                        whiteSpace: 'nowrap', 
                        textOverflow: 'ellipsis',
                    }}>
                        {itemNumber}. {displayText} {icon}
                        {document && embeddingStatus && (() => {
                            const status = embeddingStatus[extractKey(document)];
                            if (!status) return null;
                            const config = getDocumentStatusConfig(status);
                            return config?.showIndicatorWhenNotHovered ? (
                                <span className={`${config.indicatorColor} text-sm ml-1 ${config.animate ? 'animate-pulse' : ''}`}>
                                    {config.indicator}
                                </span>
                            ) : null;
                        })()}
                    </p>
                    <div className="flex-shrink-0 px-4">
                        {document && embeddingStatus && (
                            <StatusBadge 
                                status={embeddingStatus[extractKey(document)]} 
                                isRowHovered={hovered === id}
                            />
                        )}
                    </div>
                </div>
           
                {allowRemoval && onRemove && 
                    <button
                        title={removeTitle}
                        className="ml-auto mr-2 text-gray-400 hover:text-red-600 transition-all"
                        style={{ flexShrink: 0 }}
                        onMouseEnter={() => setHoveredButton(true)}
                        onMouseLeave={() => setHoveredButton(false)}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemove();
                        }}
                    >
                        <IconCircleX size={removeIconSize}/>
                    </button>
                }
            </div>
        );
    };

    // Child document item (for sitemap pages)
    const ChildDocumentItem: FC<{
        document: AttachedDocument;
        onRemove: () => void;
    }> = ({ document, onRemove }) => (
        <div
            key={`sitemap-doc-${document.id}`}
            className={`${hovered === document.id ? 'hover:bg-gray-200 dark:hover:bg-gray-500' : ''} bg-gray-50 dark:bg-[#35363f] flex flex-row items-center border dark:border-neutral-600 dark:text-white rounded-sm px-1 py-1 ml-1 mr-1 mb-1`}
            onMouseEnter={() => setHovered(document.id)}
            onMouseLeave={() => setHovered('')}
        >
            <div className="ml-4 flex-1 flex items-center justify-between" style={{ overflow: 'hidden' }}>
                <p className={`truncate font-medium text-xs text-gray-700 dark:text-gray-300 flex flex-row items-center gap-1 flex-1 min-w-0`} style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap', 
                    textOverflow: 'ellipsis',
                }}>
                    ↳ {document.metadata?.sourceUrl || document.name}
                    {embeddingStatus && (() => {
                        const status = embeddingStatus[extractKey(document)];
                        if (!status) return null;
                        const config = getDocumentStatusConfig(status);
                        return config?.showIndicatorWhenNotHovered ? (
                            <span className={`${config.indicatorColor} text-sm ml-1 ${config.animate ? 'animate-pulse' : ''}`}>
                                {config.indicator}
                            </span>
                        ) : null;
                    })()}
                </p>
                <div className="flex-shrink-0 px-4">
                    {embeddingStatus && <StatusBadge 
                        status={embeddingStatus[extractKey(document)]} 
                        isRowHovered={hovered === document.id}
                    />}
                </div>
            </div>
       
            {allowRemoval && 
                <button
                    title={"Remove this page"}
                    className="ml-auto mr-2 text-gray-400 hover:text-red-500 transition-all"
                    style={{ flexShrink: 0 }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove();
                    }}
                >
                    <IconCircleX size={20}/>
                </button>
            }
        </div>
    );
  
    const filteredDataSources = searchTerm 
        ? dataSources.filter((ds: AttachedDocument) => 
            ds.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ds.metadata?.sourceUrl?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : dataSources;

    const grouped = groupDataSourcesBySitemap(filteredDataSources);
    let itemCounter = 0;
    
    return (
        <div className='mb-4'>
            <div className="flex flex-row mt-1 mb-2 text-black dark:text-neutral-200">
                <label className={boldTitle ? "font-bold": ''}>{label}</label>
                <div className='mt-[-12px] ml-auto mr-1'>
                <Search
                    placeholder={'Search...'}
                    searchTerm={searchTerm}
                    paddingY='py-1.5'
                    onSearch={(searchTerm: string) => {
                        setSearchTerm(searchTerm);
                    }}
                />
                </div>
            </div>
            
            <div className="flex flex-col overflow-y-auto pb-2 mt-2 w-full max-h-[200px]">
                {/* Direct URLs */}
                {grouped.directUrls.map((document) => {
                    itemCounter++;
                    return (
                        <DocumentItem
                            key={`direct-${document.id}`}
                            id={document.id}
                            itemNumber={itemCounter}
                            displayText={document.metadata?.sourceUrl || document.name}
                            icon={getIcon(document)}
                            onRemove={() => removeDocument(document)}
                            document={document}
                        />
                    );
                })}

                {/* Sitemap Groups */}
                {Object.entries(grouped.sitemapGroups).map(([sitemapUrl, sitemapDocs]) => {
                    itemCounter++;
                    const isExpanded = expandedSitemaps.has(sitemapUrl);
                    
                    return (
                        <div key={`sitemap-${sitemapUrl}`}>
                            <DocumentItem
                                id={`sitemap-${sitemapUrl}`}
                                itemNumber={itemCounter}
                                displayText={`${sitemapUrl} (${sitemapDocs.length} pages)`}
                                icon={<IconSitemap size={18} className="text-blue-500" />}
                                onRemove={() => removeSitemapGroup(sitemapUrl, sitemapDocs)}
                                onClick={() => toggleSitemap(sitemapUrl)}
                                isClickable={true}
                                removeTitle={`Remove all ${sitemapDocs.length} pages from this sitemap`}
                            />

                            {/* Sitemap Content - only show when expanded */}
                            {isExpanded && sitemapDocs.map((document) => (
                                <ChildDocumentItem
                                    key={`sitemap-doc-${document.id}`}
                                    document={document}
                                    onRemove={() => removeDocument(document)}
                                />
                            ))}
                        </div>
                    );
                })}

                {/* Other documents */}
                {grouped.other.map((document) => {
                    itemCounter++;
                    return (
                        <DocumentItem
                            key={`other-${document.id}`}
                            id={document.id}
                            itemNumber={itemCounter}
                            displayText={document.metadata?.sourceUrl || document.name}
                            icon={getIcon(document)}
                            onRemove={() => removeDocument(document)}
                            document={document}
                        />
                    );
                })}
            </div>
        </div>
    );
};




    // Status badge component  
export const StatusBadge: FC<{ status: string | null | undefined; isRowHovered: boolean }> = ({ status, isRowHovered }) => {
    if (!status) return null;
    
    const config = getDocumentStatusConfig(status);
    if (!config) return null;
    
    return (
        <div className="inline-block min-w-[60px] text-right">
            {isRowHovered ? (
                <span className={`${config.color} text-xs px-1.5 py-0.5 rounded font-normal whitespace-nowrap`}>
                    {config.text}
                </span>
            ) : null}
        </div>
    );
};
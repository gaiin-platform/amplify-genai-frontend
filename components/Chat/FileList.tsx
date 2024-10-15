import React, {FC, useEffect, useState} from 'react';
import { IconTrashX, IconCircleX, IconCheck } from '@tabler/icons-react';
import { AttachedDocument } from '@/types/attacheddocument';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import Search from '../Search';

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

    return (
        <div className="flex overflow-x-auto pb-2 mt-2">
            {documents?.map((document, i) => (
                <div
                    key={i}
                    className={`${isComplete(document) ? 'bg-white' : 'bg-yellow-400'} flex flex-row items-center justify-between border bg-white rounded-md px-1 py-1 ml-1 mr-1 shadow-md dark:shadow-lg`}
                    style={{ maxWidth: '220px' }}
                >

                    {!isComplete(document) ?
                        getProgress(document) : 
                        <IconCheck className="text-green-500" />
                    }

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
    boldTitle?: boolean;
}

export const ExistingFileList: FC<ExistingProps> = ({ label, documents, setDocuments, allowRemoval = true, boldTitle=true}) => {

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [dataSources, setDataSources] = useState<AttachedDocument[]>(documents ?? []);
    const [hovered, setHovered] = useState<string>('');


    useEffect(() => {
        if (!searchTerm && documents) setDataSources(documents);
    }, [searchTerm]);
    
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
                        if (documents) setDataSources(documents.filter((ds: AttachedDocument) => ds.name.toLowerCase().includes(searchTerm.toLowerCase())));
                    }
                    }
                />
                </div>
            </div>
            
            <div className="flex flex-col overflow-y-auto pb-2 mt-2 w-full max-h-[200px]">
                {dataSources?.map((document, i) => (
                    <div
                        key={i}
                        className={`${hovered === document.id ? 'hover:bg-gray-200 dark:hover:bg-gray-500' : ''} bg-white dark:bg-[#40414F] flex flex-row items-center border dark:border-neutral-500 dark:text-white rounded-sm px-1 py-1.5 ml-1 mr-1`}
                    >
                            <div className="ml-1 flex-1" style={{ overflow: 'hidden' }}>
                                <p className={`truncate font-medium text-sm text-black-800`} style={{
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap', 
                                    textOverflow: 'ellipsis',
                                }}>
                                    {i+1}. {document.name}
                                </p>
                            </div>
                       
                        { allowRemoval && 

                                <button
                                key={i}
                                onMouseEnter={() => setHovered(document.id)}
                                onMouseLeave={() =>setHovered('')}
                                title={"Remove"}
                                className="ml-auto mr-2 text-gray-400 transition-all"
                                style={{ flexShrink: 0 }}
                                onClick={(e) =>{
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (documents) setDocuments(documents.filter(x => x != document));
                                }}
                            >
                                <IconCircleX/>
                    </button>}
                    </div>
                ))}
            </div>

        </div>
    );
};

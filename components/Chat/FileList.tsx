import React, {FC} from 'react';
import { IconTrashX, IconCircleX, IconCheck } from '@tabler/icons-react';
import { AttachedDocument } from '@/types/attacheddocument';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";

interface Props {
    documents:AttachedDocument[]|undefined;
    setDocuments: (documents: AttachedDocument[]) => void;
    documentStates?: {[key:string]:number}
    onCancelUpload?: (document:AttachedDocument) => void;
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

export const FileList: FC<Props> = ({ documents, setDocuments , documentStates, onCancelUpload}) => {

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
                    className={`${isComplete(document) ? 'bg-white' : 'bg-yellow-400'} flex flex-row items-center justify-between border bg-white rounded-md px-1 py-1 ml-1 mr-1 shadow-lg`}
                    style={{ maxWidth: '200px' }}
                >
                    {!isComplete(document) ?
                        getProgress(document) : ''
                    }
                    {isComplete(document) ?
                        <IconCheck className="text-green-500" /> : ''
                    }
                   <button
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
                   </button>

                    <div className="ml-1">
                        <p className={`truncate font-medium text-sm ${isComplete(document) ? 'text-gray-800' : 'text-gray-800'}`}
                            style={{ maxWidth: '160px' }}>
                            {i+1}. {getLabel(document)}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

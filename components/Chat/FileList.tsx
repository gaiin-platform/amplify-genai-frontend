import React, {FC} from 'react';
import { IconTrashX, IconCircleX } from '@tabler/icons-react';
import { AttachedDocument } from '@/types/attacheddocument';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface Props {
    documents:AttachedDocument[]|undefined;
    setDocuments: (documents: AttachedDocument[]) => void;
    documentStates?: {[key:string]:number}
    onCancelUpload?: (document:AttachedDocument) => void;
}

export const FileList: FC<Props> = ({ documents, setDocuments , documentStates, onCancelUpload}) => {
    //console.log("Document list: ", documents)

    const isComplete = (document:AttachedDocument) => {
        return !documentStates || (documentStates && documentStates[document.id] == 100);
    }

    const getProgress = (document:AttachedDocument) => {
        if (documentStates && documentStates[document.id]) {
            const percentage = documentStates[document.id];
            return (
                <div className="mr-1 flex items-center justify-center w-6">
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
        return 0;
    }

    return (
        <div className="flex overflow-x-auto pb-2 mt-2">
            {documents?.map((document, i) => (
                <div
                    key={i}
                    className="flex items-center justify-between bg-white rounded-md px-1 py-1 mr-1 shadow-lg"
                    style={{ maxWidth: '200px' }}
                >
                    {!isComplete(document) ?
                        getProgress(document) : ''
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
                        <p className="truncate font-medium text-sm text-gray-800" style={{ maxWidth: '160px' }}>
                            {i+1}. {document.name}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

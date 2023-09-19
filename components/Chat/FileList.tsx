import React, {FC} from 'react';
import { IconTrashX } from '@tabler/icons-react';
import { Document } from "@/components/Chat/AttachFile";

interface Props {
    documents:Document[]|undefined;
    setDocuments: (documents: Document[]) => void;
}

export const FileList: FC<Props> = ({ documents, setDocuments }) => {
    //console.log("Document list: ", documents)

    return (
        <div className="flex overflow-x-auto pb-2 mt-2">
            {documents?.map((document, i) => (
                <div
                    key={i}
                    className="flex items-center justify-between bg-white rounded-md px-1 py-1 mr-2 shadow-lg"
                    style={{ maxWidth: '200px' }}
                >
                    <button
                        className="text-gray-400 hover:text-gray-600 transition-all"
                        onClick={() => setDocuments(documents?.filter(x => x != document))}
                    >
                        <IconTrashX/>
                    </button>
                    <div>
                        <p className="truncate font-medium text-sm text-gray-800" style={{ maxWidth: '160px' }}>
                            {i+1}. {document.name}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

import HomeContext from '@/pages/api/home/home.context';
import { DataSource } from '@/types/chat';
import { downloadDataSourceFile } from '@/utils/app/files';
import { useSession } from 'next-auth/react';
import React, { useContext,  } from "react";
import DOMPurify from 'dompurify';
interface Props {
    source: any;
    index: number;
    name: string;
}


// Helper function to capitalize the first letter of each word and handle underscores
function formatPropertyName(propertyName: string): string {
    return propertyName
        .split('_')
        .map(capitalizeFirstLetter)
        .join(' ');
}

function groupArrayValuesByKeys(array: Array<any>) {
    
    // Define precedence order for location types (higher priority first)
    const keyPrecedence: { [key: string]: number } = {
        // Document structure (highest priority)
        'slide_number': 1,
        'page_number': 2,
        'section_number': 3,
        'section_title': 4,
        
        // Content structure
        'paragraph_number': 5,
        'line_number': 6,
        
        // Spreadsheet structure
        'sheet_number': 7,
        'sheet_name': 8,
        'row_number': 9,
        'cell_range': 10,
        
        // Other/unknown (lowest priority)
    };
    
    // Get all unique keys from all objects in the array
    const allKeys = Array.from(new Set(array.flatMap(obj => Object.keys(obj))));
    
    // Sort keys by precedence (lower number = higher priority)
    const sortedKeys = allKeys.sort((a, b) => {
        const aPrecedence = keyPrecedence[a] || 999; // Unknown keys get low priority
        const bPrecedence = keyPrecedence[b] || 999;
        return aPrecedence - bPrecedence;
    });
    
    return sortedKeys
        .map((propertyKey, index) => {
            // Create a label for the key based on formatting rules
            let label = formatPropertyName(propertyKey);


            // Check if the array is an array of numbers
            const isArrayOfNumbers = array.every(item => typeof item[propertyKey] === 'number');
            // group numbers into consecutive ranges and represent as strings like 9-14
            if (isArrayOfNumbers) {
                const ranges = [];
                let start = array[0][propertyKey];
                let end = start;
                for (let i = 1; i < array.length; i++) {
                    if (array[i][propertyKey] === end + 1 ||
                        array[i][propertyKey] === end) {
                        end = array[i][propertyKey];
                    } else {
                        ranges.push(start === end ? start.toString() : `${start}-${end}`);
                        start = array[i][propertyKey];
                        end = start;
                    }
                }
                ranges.push(start === end ? start.toString() : `${start}-${end}`);

                return <div key={index}>
                    <div className="text-sm flex flex-row items-center">
                        <div className="text-sm dark:text-neutral-300 font-bold">{label}:</div>
                        <div className="p-1 m-1 text-center dark:text-neutral-400">
                            {ranges.join(', ')}
                        </div>
                    </div>
                </div>;
            }

            if (array.every(item => item[propertyKey] === '' || item[propertyKey] === null || item[propertyKey] === undefined)) {
                return <></>
            }


            const values = array.reduce((unique, item) => {
                const v = item[propertyKey];

                return (v !== null &&
                        v !== '' &&
                        v !== undefined &&
                        !unique.includes(v)) ?
                    [...unique, v] : unique;
            }, []);

            const limitLength = (x: string) => {
                if (x.length > 60) {
                    return x.substring(0, 60) + "...";
                }
                return x;
            }

            // console.log(propertyKey, values);

            return <div key={index}>
                <div className="text-sm flex flex-row items-center">
                    <div className="text-sm font-bold">{label}:</div>
                    <div className="p-1 m-1 text-center">
                        {values
                            .map((v:any) => {
                                    return limitLength("" + v);
                                }
                            ).join(', ')}
                    </div>
                </div>
            </div>;
        });
}

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

const sanitizedUrl = (source: any) => {
    const sanitizedUrl = DOMPurify.sanitize(source.url);
    return (
         <a 
            id={`sourceUrl-${source.id}`} 
            className="mr-auto text-start text-[#5495ff] cursor-pointer hover:underline no-underline" 
            href={sanitizedUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            title="Open URL"
        >
            {sanitizedUrl}
        </a>
    )
}


const ChatSourceBlock: React.FC<Props> = (
    {source, index, name}) => {
    const { data: session } = useSession();
    const user = session?.user?.email;

    const { state: {}, setLoadingMessage
    } = useContext(HomeContext);

    const downloadFile = async (dataSource: DataSource, groupId: string | undefined) => {

        setLoadingMessage("Downloading File...");
        try {
            // /assistant/files/download
            await downloadDataSourceFile(dataSource, groupId);
        } finally {
            setLoadingMessage("");
        }
    }

    

    return  <div key={index}>
        <div
            className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2"
        >
            <div className="text-xl text-right p-4 -mb-10">
                <div className="text-gray-400 dark:text-gray-600">{index}.</div>
            </div>
            <div className="flex flex-col p-3">
                {source.content && (
                    <div>
                        <blockquote className="text-sm italic font-semibold text-gray-900 dark:text-white">
                            <svg className="w-8 h-8 text-gray-400 dark:text-gray-600 mb-4" aria-hidden="true"
                                 xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 14">
                                <path
                                    d="M6 0H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3H2a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3h-1a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Z"/>
                            </svg>
                            <p className="dark:text-neutral-300">{source.content}</p>
                        </blockquote>
                    </div>
                )}

                { source.url ? sanitizedUrl(source) :
                <>
                {source.name && (
                    (source.contentKey && !source.contentKey.includes("global/") &&  (source.contentKey.includes(user) ||  source.groupId))  ? 
                        <button id="sourceName" className="mr-auto text-start text-[#5495ff] cursor-pointer hover:underline" title='Download File'
                            onClick={() => downloadFile({id: source.contentKey, name: source.name, type: source.type}, source.groupId)}>
                            {source.name}
                        </button> 
                        :
                        <div id="sourceName" className="dark:text-neutral-300">
                            {source.name}
                        </div>

                )}
                {name !== "documentContext" && source.locations && Array.isArray(source.locations) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {groupArrayValuesByKeys(source.locations).map((element, elementIndex) => (
                            <React.Fragment key={`location-${index}-${elementIndex}`}>
                                {element}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                </>}
                
            </div>
        </div>
    </div> 
};

export default ChatSourceBlock;

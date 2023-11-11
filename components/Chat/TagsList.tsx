import React, {FC} from 'react';
import { IconCircleX, IconPlus } from '@tabler/icons-react';

interface Props {
    label?: string;
    tags:string[];
    setTags: (tags: string[]) => void;
    tagParser?: (tag: string) => string[];
    addMessage?: string;
}

export const TagsList: FC<Props> = (
    { tags, setTags , label="Tags", tagParser=(t:string)=>t.split(","), addMessage="Tag names separated by commas:"}) => {

    return (
        <div className="flex w-full">
            <div
                className="flex items-center justify-between px-1 py-1 mr-2"
                style={{ maxWidth: '200px' }}
            >
                <button
                    className="text-gray-400 hover:text-gray-600 transition-all"
                    onClick={(e) =>{
                        e.preventDefault();
                        e.stopPropagation();
                        const name = prompt(addMessage);
                        if(name) {
                            console.log(tagParser);
                            const parsedTags = tagParser(name);
                            setTags([...tags, ...parsedTags]);
                        }
                    }}
                >
                    <IconPlus/>
                </button>
                <div>
                    <p className="truncate font-medium text-sm pl-2 " style={{ maxWidth: '160px' }}>
                        {label}:
                    </p>
                </div>
            </div>
            <div className="flex overflow-x-auto pb-2 mt-2">
                {tags?.map((tag, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between bg-white rounded-md px-1 py-1 mr-2 shadow-lg"
                        style={{ maxWidth: '200px' }}
                    >
                        <button
                            className="text-gray-400 hover:text-gray-600 transition-all"
                            onClick={(e) =>{
                                e.preventDefault();
                                e.stopPropagation();
                                setTags(tags?.filter(x => x != tag));
                            }}
                        >
                            <IconCircleX/>
                        </button>
                        <div>
                            <p className="truncate font-medium text-sm text-gray-800" style={{ maxWidth: '160px' }}>
                                {tag}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

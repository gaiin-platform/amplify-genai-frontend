import React, {FC} from 'react';
import { IconCircleX, IconPlus } from '@tabler/icons-react';

interface Props {
    label?: string;
    tags:string[];
    setTags: (tags: string[]) => void;
    tagParser?: (tag: string) => string[];
    addMessage?: string;
    maxWidth?: string;
    removeTag?: (tags: string) => void;
    isDisabled?: boolean;

}

function stringToColor(str:string) {
    // Array of the color options provided
    const colors = [
        "#fbfbfb", // snowman
        "#979197", // gandalf
        "#f69833", // orange
        "#419bf9", // cornflower-blue
        "#f7f7f7", // whitey
        // "#554d56", // teflon
        "#ee6723", // peach
        "#fecf33", // yellow
        "#c8cf2d", // green
        "#0dcfda", // turquoise
        "#edeced", // karl
        "#c1bec1", // clooney
        "#fdbd39", // light-orange
    ];

    // Hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash); // Ensure hash is positive

    // Use the hashed value to select a color
    const index = hash % colors.length; // Modulus operation to get a valid array index
    return colors[index];
}


export const TagsList: FC<Props> = (
    { tags, setTags , maxWidth="200px", label="Tags", tagParser=(t:string)=>t.split(","), addMessage="Tag names separated by commas:", removeTag=((t:string)=>{}), isDisabled=false}) => {

    return (
        <div className="flex w-full">

            <div className="flex flex-row items-start justify-between px-1 py-1 mr-2">
                { !isDisabled && 
                    <button
                        className="text-gray-400 hover:text-gray-600 transition-all"
                        onClick={(e) =>{
                            e.preventDefault();
                            e.stopPropagation();
                            const name = prompt(addMessage);
                            if (name) {
                                const parsedTags = tagParser(name).map((t:string) => t.trim());
                                setTags([...tags, ...parsedTags]);
                            }
                        }}
                        title="Add"
                    >
                        <IconPlus/>
                    </button>
                }
                <div>
                    <p className="mt-0.5 text-black dark:text-white font-medium text-sm pl-2 ">
                        {label}{label ? ":" : ""}
                    </p>
                </div>
            </div>
            {/* Parent container for tags with full width */}
            <div className="flex w-full flex-wrap pb-2 mt-2">
                {tags?.map((tag, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between bg-white dark:bg-neutral-200 rounded-md px-2 py-0 mr-2 mb-2 shadow-lg"
                        style={{ flex: 'none', backgroundColor: stringToColor(tag) }} // Prevent flex-shrink which can distort items
                    >
                        { !isDisabled && 
                            <button
                                className="text-gray-800 transition-all color-gray-800"
                                onClick={(e) =>{
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTags(tags?.filter(x => x != tag));
                                    removeTag(tag);
                                }}
                                title="Remove Tag"
                            >
                                <IconCircleX size={17}/>
                            </button>
                        }
                        {/* Tag text container, without truncation to allow wrapping */}
                        <div className="ml-1">
                            <p className="text-gray-800 font-medium text-sm">
                                {tag}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

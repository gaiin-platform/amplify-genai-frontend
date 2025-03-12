import React, {FC, useEffect, useState} from "react";
import {IconCircleX, IconPlus, IconTag} from "@tabler/icons-react";
import {listTags} from "@/services/fileService";
import {TagsList} from "@/components/Chat/TagsList";
import {Loader} from "@mantine/core";
import { stringToColor } from "@/utils/app/data";

export type Props = {
    onTagSelected: (tag: string) => void;
}

export const UserTagsList: FC<Props> = ({
                                            onTagSelected
                                        }) => {


    // Get the user tags in a useEffect
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await listTags();
                const sortedTags = response.data.tags.sort((a: string, b: string) => a.localeCompare(b));
                setTags(sortedTags);
            } catch (e) {
                setError(true);
            } finally {
                setLoading(false);
            }
        }

        fetchTags();
    }, []);

    // The tags will be laid out in a fixed width div that places as many ass
    // possible in the given width and then expands its height up to 400px and
    // scrolls if there are more. The tags have
    return (
        <div className={`overflow-y-auto flex w-full h-full ${loading? "items-center" : ""}`} >
            {loading &&
                <div className="mt-6 flex flex-col items-center w-full p-6" style={{ minWidth: '95%', overflow:"none"}}>
                    <div style={{ width: '95%', display: 'flex', justifyContent: 'center' }}><Loader/></div>
                    <div className="text-md p-3" style={{ textAlign: 'center' }}>Loading...</div>
                </div>
            }
            {error && <div>Error loading tags</div>}

            <div className="p-2">
                {/* Parent container for tags with full width */}
                <div className="flex w-full flex-wrap pb-2 mt-2">
                    {tags?.map((tag, i) => (
                        <div
                            key={i}
                            className="cursor-pointer flex items-center justify-between bg-white dark:bg-neutral-200 rounded-md p-2 mr-2 mb-2 shadow-lg"
                            style={{ flex: 'none', backgroundColor: stringToColor(tag) }} // Prevent flex-shrink which can distort items
                            onClick={(e) =>{
                                e.preventDefault();
                                e.stopPropagation();
                                onTagSelected(tag);
                            }}
                        >
                            <button
                                className="text-gray-800 transition-all color-gray-800"

                                title="Select Tag"
                            >
                                <IconTag size={17}/>
                            </button>
                            {/* Tag text container, without truncation to allow wrapping */}
                            <div className="ml-1">
                                <p className="text-gray-800 font-medium text-md">
                                    {tag}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


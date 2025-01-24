import React, { useContext } from "react";
import {Message} from "@/types/chat";
import {IconDownload, IconFileCheck} from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";

interface Props {
    message: Message;
    handleDownload?: (dataSource: any) => void;
}


export const DataSourcesBlock: React.FC<Props> = (
    {message, handleDownload}) => {
    const { setLoadingMessage } = useContext(HomeContext);


    if(!message.data || !message.data.dataSources || message.data.dataSources.length < 1){
        return <></>;
    }

    const getName = (dataSource: any) => {
        if(dataSource.name){
            return (dataSource.name.length < 50) ?
                dataSource.name : dataSource.name.substring(0, 50) + "...";
        }
        return "Untitled Document";
    }

    return (
        <div className="flex flex-col w-full mt-5 text-gray-800">
        <div className="mr-3 dark:text-white">Included documents:</div>

        <div className="flex flex-col">
            {message.data && message.data.dataSources && message.data.dataSources.map((d: any, i: any) => (
                <div
                    key={i}
                    className="bg-yellow-400 dark:bg-[#B0BEC5] rounded-xl shadow-lg h-12 mr-2 mb-2"
                >
                    <div className="flex flex-row">
                        <div
                            className="w-14 h-12 flex-none bg-cover rounded-l-xl text-center overflow-hidden"
                            style={{backgroundImage: 'url("/sparc_apple.png")'}}
                            title={d.name}>
                        </div>
                        <div className="ml-3 mt-3">
                            <IconFileCheck/>
                        </div>
                        <div className="mt-3 ml-1 flex-grow p-0 truncate">
                            {i + 1}. {getName(d)}
                        </div>
                        {d.id && d.id.startsWith("s3://") && (
                            <div className="mt-3 mr-3 ml-1 p-0 truncate hover:text-neutral-100 dark:hover:text-blue-700"
                            >
                                <button onClick={() => {
                                    if (handleDownload) {
                                        setLoadingMessage('Downloading File...');
                                        handleDownload(d);
                                        setLoadingMessage('');
                                    }
                                }}
                                >
                                    <IconDownload/>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>);
};

export default DataSourcesBlock;
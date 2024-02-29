import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import React, {useState} from "react";
import {Status} from "@/types/workflow";
import Loader from "@/components/Loader/Loader";
import {
    IconCaretDown,
    IconCaretRight,
} from '@tabler/icons-react';
import {
    IconAperture,
    IconApiApp,
    IconBolt,
    IconCheck, IconClearAll, IconDownload,
    IconInfoHexagon,
    IconRepeat,
    IconSend, IconSettings, IconShare
} from "@tabler/icons-react";
import {PromptStatusDetails} from "@/components/Status/PromptStatusDetails";

interface PromptStatusProps {
    status: Status;
}

export const PromptStatus: React.FC<PromptStatusProps> = ({ status }) => {

    const [detailsOpen, setDetailsOpen] = useState(false);

    const getLeadingComponent = (status: Status) => {
        if(status.inProgress) {
            return <Loader size="32"/>;
        }

        switch (status.icon) {
            case 'bolt':
                return <IconBolt/>;
            case 'info':
                return <IconInfoHexagon/>;
            case 'assistant':
                return <></>;
            case 'check':
                return <IconCheck/>;
            case 'aperture':
                return <IconAperture/>;
            case 'repeat':
                return <IconRepeat/>;
            case 'api':
                return <IconApiApp/>;
            case 'send':
                return <IconSend/>;
            case 'clear':
                return <IconClearAll/>;
            case 'settings':
                return <IconSettings/>;
            case 'share':
                return <IconShare/>;
            case 'download':
                return <IconDownload/>;
            default:
                return <IconCheck/>;
        }
    }


    const getCoverBackgroundImage = (status: Status) => {
        if(status.icon === 'assistant') {
            return 'url("/sparc_folds.png")';
        }
        else if(status.inProgress) {
            return 'url("/bg-18.png")';
        }
        return 'url("/bg-20.png")';
    }


    return (
        <>
            <div
                className="rounded-xl text-neutral-800 hover:opacity-50 dark:text-white bg-neutral-200 dark:bg-[#343541] rounded-md shadow-lg h-12 mb-2 mr-2"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDetailsOpen(!detailsOpen);
                }}
            >
                <div className="flex flex-row">
                    <div
                        className="w-14 h-12 flex-none bg-cover rounded-l-xl text-center overflow-hidden"
                        style={{backgroundImage: getCoverBackgroundImage(status)}}
                    >
                        <div className="text-white flex h-full w-full justify-center items-center">{getLeadingComponent(status)}</div>
                    </div>
                    <div className="mt-0 ml-3 flex flex-row p-0 truncate justify-center items-center">
                        <div className="mt-0 pt-0">
                        {status.summary || status.message}
                        </div>
                        {status.message && status.summary && (status.summary !== status.message) && (
                            <div className="ml-3">
                                {detailsOpen ?
                                    <IconCaretDown size={18} /> :
                                    <IconCaretRight size={18} />
                                }
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {status.message && status.summary && (status.summary !== status.message && detailsOpen) && (
                <div className="mx-2 mt-0 pt-7 px-5 bg-neutral-200 dark:bg-[#343541] rounded-lg">
                    <PromptStatusDetails status={status}/>
                </div>
            )}
        </>
    )
}
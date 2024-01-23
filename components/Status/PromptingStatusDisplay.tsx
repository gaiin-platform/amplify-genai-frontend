import React, { useState } from 'react';
import {
    IconBolt,
    IconRobot,
    IconCheck,
    IconAperture,
    IconInfoHexagon,
    IconAssembly,
    IconBlockquote,
    IconAlignBoxBottomRight,
    IconRepeat,
    IconApiApp,
    IconSend, IconFileCheck,
} from '@tabler/icons-react';
import { Status } from "@/types/workflow";
import Loader from "@/components/Loader/Loader";

import {IconClearAll, IconSettings, IconShare, IconDownload} from '@tabler/icons-react';

interface PromptingStatusDisplayProps {
    statusHistory: Status[];
}

const PromptingStatusDisplay: React.FC<PromptingStatusDisplayProps> = ({ statusHistory }) => {

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


    const activeStatuses: Status[] = statusHistory.reduceRight((acc: Status[], current: Status) => {
        if (!acc.map(status => status.id).includes(current.id)) {
            acc.unshift(current);
        }
        return acc;
    }, []);

    return (
        <div className="flex flex-col mb-2">
            {activeStatuses.filter(s => s.inProgress || s.sticky).map((status, i) => (
                    <div
                        key={i}
                        className="rounded-xl text-neutral-500 hover:opacity-50 dark:text-white bg-neutral-200 dark:bg-[#343541] rounded-md shadow-lg h-12 mb-2 mr-2"
                    >
                        <div className="flex flex-row">
                            <div
                                className="w-14 h-12 flex-none bg-cover rounded-l-xl text-center overflow-hidden"
                                style={{backgroundImage: getCoverBackgroundImage(status)}}
                            >
                                <div className="text-white flex h-full w-full justify-center items-center">{getLeadingComponent(status)}</div>
                            </div>
                            <div className="mt-3 ml-3 flex-grow p-0 truncate">
                                {status.message || status.summary}
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}

export default PromptingStatusDisplay;

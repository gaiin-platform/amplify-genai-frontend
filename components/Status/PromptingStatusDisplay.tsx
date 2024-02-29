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
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {PromptStatus} from "@/components/Status/PromptStatus";

interface PromptingStatusDisplayProps {
    statusHistory: Status[];
}

const PromptingStatusDisplay: React.FC<PromptingStatusDisplayProps> = ({ statusHistory }) => {

    const activeStatuses: Status[] = statusHistory.reduceRight((acc: Status[], current: Status) => {
        if (!acc.map(status => status.id).includes(current.id)) {
            acc.unshift(current);
        }
        return acc;
    }, []);

    return (
        <div className="flex flex-col mb-2">
            {activeStatuses.filter(s => s.inProgress || s.sticky).map((status, i) => (
                <PromptStatus key={i} status={status}/>
            ))}
        </div>
    );
}

export default PromptingStatusDisplay;

import React from 'react';
import { Status } from "@/types/workflow";
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

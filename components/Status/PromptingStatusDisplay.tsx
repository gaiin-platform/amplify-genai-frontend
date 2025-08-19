import React from 'react';
import { Status } from "@/types/workflow";
import {PromptStatus} from "@/components/Status/PromptStatus";

interface PromptingStatusDisplayProps {
    statusHistory: Status[];
}

const PromptingStatusDisplay: React.FC<PromptingStatusDisplayProps> = ({ statusHistory }) => {

    // Group statuses by ID and combine streaming chunks
    const statusMap = new Map<string, Status[]>();
    statusHistory.forEach(status => {
        if (!statusMap.has(status.id)) {
            statusMap.set(status.id, []);
        }
        statusMap.get(status.id)!.push(status);
    });

    const activeStatuses: Status[] = [];
    statusMap.forEach((statusGroup) => {
        if (statusGroup.length === 1) {
            // Single status, use as-is
            activeStatuses.push(statusGroup[0]);
        } else if (statusGroup[0].id === "reasoning") {
            // Multiple statuses with ID "reasoning" - combine streaming chunks
            const combinedMessage = statusGroup.map(s => s.message).join('');
            const latestStatus = statusGroup[statusGroup.length - 1];
            
            activeStatuses.push({
                ...latestStatus,
                message: combinedMessage,
            });
        } else {
            // Multiple statuses with other IDs - use latest only
            activeStatuses.push(statusGroup[statusGroup.length - 1]);
        }
    });

    return (
        <div className="flex flex-col mb-2">
            {activeStatuses.filter(s => s.inProgress || s.sticky).map((status, i) => (
                <PromptStatus key={i} status={status}/>
            ))}
        </div>
    );
}

export default PromptingStatusDisplay;

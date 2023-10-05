// Your imports
import React, { FC } from 'react';
import {WorkflowDefinition} from "@/types/workflow";
import { WorkflowDefinitionComponent } from './WorkflowDefinitionComponent';

interface Props {
    workflows: WorkflowDefinition[];
}

export const WorkflowDefinitions: FC<Props> = ({ workflows }) => {
    return (
        <div className="flex w-full flex-col gap-1">
            {workflows
                .slice()
                .reverse()
                .map((workflow, index) => (
                    <WorkflowDefinitionComponent key={index} workflow={workflow} />
                ))}
        </div>
    );
};
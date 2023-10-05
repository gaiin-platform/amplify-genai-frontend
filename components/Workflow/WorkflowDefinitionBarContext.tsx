import { Dispatch, createContext } from 'react';

import { ActionType } from '@/hooks/useCreateReducer';

import {WorkflowDefinition} from "@/types/workflow";
import {WorkflowDefinitionBarInitialState} from "@/components/Workflow/WorkflowDefinitionBar.state";

export interface WorkflowDefinitionBarContextProps {
    state: WorkflowDefinitionBarInitialState;
    dispatch: Dispatch<ActionType<WorkflowDefinitionBarInitialState>>;
    handleCreateWorkflowDefinition: () => void;
    handleDeleteWorkflowDefinition: (workflowDefinition: WorkflowDefinition) => void;
    handleUpdateWorkflowDefinition: (workflowDefinition: WorkflowDefinition) => void;
}

const WorkflowDefinitionBarContext = createContext<WorkflowDefinitionBarContextProps>(undefined!);

export default WorkflowDefinitionBarContext;

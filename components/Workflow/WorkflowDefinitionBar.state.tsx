import {WorkflowDefinition} from "@/types/workflow";

export interface WorkflowDefinitionBarInitialState {
  searchTerm: string;
  filteredWorkflows: WorkflowDefinition[];
}

export const initialState: WorkflowDefinitionBarInitialState = {
  searchTerm: '',
  filteredWorkflows: [],
};

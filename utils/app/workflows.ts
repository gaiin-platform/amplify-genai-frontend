import {WorkflowDefinition} from "@/types/workflow";

export const updateWorkflowDefinition = (updatedWorkflowDefinition: WorkflowDefinition, allWorkflowDefinitions: WorkflowDefinition[]) => {
  const updatedWorkflowDefinitions = allWorkflowDefinitions.map((c) => {
    if (c.id === updatedWorkflowDefinition.id) {
      return updatedWorkflowDefinition;
    }

    return c;
  });

  saveWorkflowDefinitions(updatedWorkflowDefinitions);

  return {
    single: updatedWorkflowDefinition,
    all: updatedWorkflowDefinitions,
  };
};

export const saveWorkflowDefinitions = (workflows: WorkflowDefinition[]) => {
  localStorage.setItem('workflows', JSON.stringify(workflows));
};


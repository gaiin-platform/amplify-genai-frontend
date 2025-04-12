import { AstWorkflow, Step } from "@/types/assistantWorkflows";
import cloneDeep from "lodash/cloneDeep";

export const rebuildWorkflowFromBase = (baseWorkflowTemplate: AstWorkflow, astWorkflowTemplate: AstWorkflow) => {
    // If astWorkflowTemplate doesn't exist or has no template, use the base template
    if (!astWorkflowTemplate || !astWorkflowTemplate.template) return baseWorkflowTemplate ?? null;
    const newTemplate = cloneDeep(astWorkflowTemplate);
    
    if (!baseWorkflowTemplate || !baseWorkflowTemplate.template ||
        !baseWorkflowTemplate.template.steps) return newTemplate;
    
    // Get all actionSegments from the base template
    const baseSegments = new Map();
    baseWorkflowTemplate.template.steps.forEach(step => {
        const segment = step.actionSegment || 'default';
        if (!baseSegments.has(segment)) {
            baseSegments.set(segment, []);
        }
        baseSegments.get(segment).push(step);
    });
    
    // Get all actionSegments from the ast template
    const astSegments = new Set();
    (newTemplate.template?.steps || []).forEach(step => {
        astSegments.add(step.actionSegment || 'default');
    });
    
    // If newTemplate doesn't have a template, create one
    if (!newTemplate.template) newTemplate.template = { steps: [] };
    
    const newSteps: Step[] = [];
    
    // Go through base template steps in order
    baseWorkflowTemplate.template.steps.forEach(baseStep => {
        const segment = baseStep.actionSegment || 'default';
        
        // If this segment exists in the ast template, find the corresponding step
        if (astSegments.has(segment)) {
            // Find existing step in ast template with same position/characteristics
            const matchingStep = newTemplate.template?.steps.find(step => 
                (step.actionSegment || 'default') === segment && 
                step.tool === baseStep.tool &&
                step.stepName === baseStep.stepName
            );
            newSteps.push(matchingStep ? matchingStep : cloneDeep(baseStep));
            
        } else {
            // This segment was disabled/removed in the ast template,
            // add it back from the base template
            newSteps.push(cloneDeep(baseStep));
        }
    });
    newTemplate.template.steps = newSteps;
    return newTemplate;
};


// Function to compute which segments from the base template are disabled in the current template
export const computeDisabledSegments = (baseWorkflowTemplate: AstWorkflow, astWorkflowTemplate: AstWorkflow) => {
  // Handle edge cases where templates or steps don't exist
  if (!baseWorkflowTemplate?.template?.steps) return [];
  
  // If ast template doesn't exist or has no steps, all base segments are disabled
  if (!astWorkflowTemplate?.template?.steps) {
    return baseWorkflowTemplate.template.steps
      .map(step => step.actionSegment || '')
      .filter((segment, index, self) => self.indexOf(segment) === index); // Unique values only
  }
  
  // Get all unique segments from base template
  const baseSegments = new Set(
    baseWorkflowTemplate.template.steps.map(step => step.actionSegment || '')
  );
  
  // Get all unique segments from ast template
  const astSegments = new Set(
    astWorkflowTemplate.template.steps.map(step => step.actionSegment || '')
  );
  return Array.from(baseSegments).filter(segment => !astSegments.has(segment));
};
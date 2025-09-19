// Create Workflows from scratch

import React, { useState, useEffect, useContext, useRef } from 'react';
import { AstWorkflow, Step } from '@/types/assistantWorkflows';
import { Modal } from '@/components/ReusableComponents/Modal';
import { registerAstWorkflowTemplate, listAstWorkflowTemplates, getAstWorkflowTemplate, updateAstWorkflowTemplate, deleteAstWorkflowTemplate } from '@/services/assistantWorkflowService';
import { IconPlus, IconTrash, IconChevronDown, IconChevronUp, IconCaretDown, IconCaretRight, IconArrowUp, IconArrowDown, IconLoader2, IconInfoCircle, IconPresentation, IconPuzzle, IconPuzzleFilled, IconEdit, IconEditOff, IconRobot, IconEye, IconEyeOff } from '@tabler/icons-react';
import cloneDeep from 'lodash/cloneDeep';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { InfoBox } from '../ReusableComponents/InfoBox';
import { InputsMap } from '../ReusableComponents/InputMap';
import ApiIntegrationsPanel from '../AssistantApi/ApiIntegrationsPanel';
import HomeContext from '@/pages/api/home/home.context';
import { getOpsForUser } from '@/services/opsService';
import { getAgentTools } from '@/services/agentService';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import toast from 'react-hot-toast';
import ActionButton from '../ReusableComponents/ActionButton';
import { AssistantWorkflow } from './AssistantWorkflow';
import { getSegmentColor } from '@/utils/app/segmentColors';
import { OpDef, Schema } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
import { emptySchema } from '@/utils/app/tools';
import WorkflowGeneratorModal from './WorkflowGeneratorModal';
import VisualWorkflowBuilder from './VisualWorkflowBuilder';
import StepEditor from './StepEditor';

interface WorkflowTemplateBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate?: AstWorkflow;
  onRegister?: (template: AstWorkflow) => void;
  isBaseTemplate?: boolean;
}

const defaultStep: Step = {
  description: '',
  tool: '',
  instructions: '',
  args: {},
  values: {},
  actionSegment: undefined
};


const emptyTemplate = (isBaseTemplate: boolean): AstWorkflow => {
  return {
    templateId: '',
    name: '',
    description: '',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {},
    template: { steps: [] },
    isBaseTemplate: isBaseTemplate
  }
}


export const AssistantWorkflowBuilder: React.FC<WorkflowTemplateBuilderProps> = ({
  isOpen, onClose, initialTemplate, onRegister, isBaseTemplate = true }) => {

  const { state: {featureFlags} } = useContext(HomeContext);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AstWorkflow>(emptyTemplate(isBaseTemplate));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  
  // State for all templates for the sidebar
  const [allTemplates, setAllTemplates] = useState<AstWorkflow[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [loadingSelectedWorkflow, setLoadingSelectedWorkflow] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);

  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null);
  const [hoveredArgIndex, setHoveredArgIndex] = useState<string | null>(null);
  const [hoveredValueIndex, setHoveredValueIndex] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  const [showToolSelector, setShowToolSelector] = useState(false);

  const [availableApis, setAvailableApis] = useState<any[] | null>(null);
  const [availableAgentTools, setAvailableAgentTools] = useState<Record<string, any> | null>(null);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [detailedPreview, setDetailedPreview] = useState(false);

  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);
  const [showWorkflowGenerator, setShowWorkflowGenerator] = useState(false);
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);
  const [forceVisualBuilderReset, setForceVisualBuilderReset] = useState(false);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [workflowBuilderWorkflow, setWorkflowBuilderWorkflow] = useState<AstWorkflow | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);


      const filterOps = async (data: any[]) => {
        const filteredOps = await filterSupportedIntegrationOps(data);
        if (filteredOps) setAvailableApis(filteredOps);
    }

      useEffect(() => {
          if (featureFlags.integrations && 
              availableApis === null) getOpsForUser()
                                      .then((ops) => {
                                          if (ops.success) {
                                              // console.log("ops: ", ops.data);
                                              filterOps(ops.data); 
                                              return;
                                          } 
                                          setAvailableApis([]);
                                      });
      }, [availableApis]);

      useEffect(() => {
          if (featureFlags.agentTools && availableAgentTools === null ) {
              getAgentTools().then((tools) => {
                  // console.log("tools", tools.data);
                  setAvailableAgentTools(tools.success ? tools.data : {});
              });
          }
      }, [availableAgentTools]);

  
  // Add this to ensure the terminate step is always present
  useEffect(() => {
    if (selectedWorkflow.template?.steps && !selectedWorkflow.template.steps.some(step => isTerminateStep(step))) {
      const updatedTemplate = cloneDeep(selectedWorkflow);
      if (!updatedTemplate.template) {
        updatedTemplate.template = { steps: [] };
      }
      
      // Add the terminate step
      updatedTemplate.template.steps.push({
        stepName: "done",
        tool: "terminate",
        description: "Terminate the conversation",
        instructions: "Terminate the conversation and provide a conclusion.",
        args: {
          message: "<fill in with conclusion message>"
        },
        values: {}
      });
      
      setSelectedWorkflow(updatedTemplate);
    }
  }, [selectedWorkflow.template?.steps]);
  
  // Fetch all templates for the sidebar
  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await listAstWorkflowTemplates(true);
      setAllTemplates(response.success && response.data?.templates ? response.data.templates : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setAllTemplates([]);
    }
    setIsLoadingTemplates(false);

  };

  
  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);
  
  // Initialize with template data if provided
  useEffect(() => {
     setSelectedWorkflow( initialTemplate ? cloneDeep(initialTemplate) : emptyTemplate(isBaseTemplate) );
  }, [initialTemplate, isBaseTemplate]);
  
  // Group steps by actionSegment for display
  const groupedSteps = selectedWorkflow.template?.steps.reduce((groups, step, index) => {
    const segment = step.actionSegment || '';
    if (!groups[segment]) {
      groups[segment] = [];
    }
    groups[segment].push({ step, index });
    return groups;
  }, {} as Record<string, Array<{ step: Step, index: number }>>) || {};
  


  const handleSaveTemplate = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      if (!selectedWorkflow.name.trim()) {
        setError('Template name is required');
        setIsSubmitting(false);
        return;
      }
      
      if (!selectedWorkflow.template?.steps.filter(step => step.stepName !== 'done').length) {
        setError('Template must have at least one step');
        setIsSubmitting(false);
        return;
      }
      
      // Validate steps exist other than terminate step
      const nonTerminateSteps = selectedWorkflow.template.steps.filter(
        step => step.tool !== 'terminate' && step.stepName !== 'done'
      );
      
      if (nonTerminateSteps.length === 0) {
        setError('Template must have at least one non-terminate step');
        setIsSubmitting(false);
        return;
      }
      
      // Validate each step has required fields
      for (let i = 0; i < selectedWorkflow.template.steps.length; i++) {
        const step = selectedWorkflow.template.steps[i];
        const isTerminate = step.tool === 'terminate';
        
        if (!isTerminate) {
          
          if (!step.description?.trim()) {
            setError(`Step ${i+1} is missing a description`);
            setIsSubmitting(false);
            return;
          }
          
          if (!step.tool?.trim()) {
            setError(`Step ${i+1} is missing a tool`);
            setIsSubmitting(false);
            return;
          }
          
          if (!step.instructions?.trim()) {
            setError(`Step ${i+1} is missing instructions`);
            setIsSubmitting(false);
            return;
          }
        }
      }
      
      // Ensure terminateStep is the last step
      const lastStep = selectedWorkflow.template.steps[selectedWorkflow.template.steps.length - 1];
      if (lastStep.tool !== 'terminate') {
        setError('The last step must be a terminate step');
        setIsSubmitting(false);
        return;
      }
      
      const isBaseTemplate = true;
      let response;
    
      if (selectedWorkflow.templateId && selectedWorkflow.templateId.trim() !== '') {
        // Update existing template
        response = await updateAstWorkflowTemplate(
          selectedWorkflow.templateId,
          selectedWorkflow.template,
          selectedWorkflow.name,
          selectedWorkflow.description,
          selectedWorkflow.inputSchema,
          selectedWorkflow.outputSchema,
          isBaseTemplate,
          selectedWorkflow.isPublic
        );
      } else {
        // Register new template
        response = await registerAstWorkflowTemplate(
          selectedWorkflow.template,
          selectedWorkflow.name,
          selectedWorkflow.description,
          selectedWorkflow.inputSchema,
          selectedWorkflow.outputSchema,
          isBaseTemplate,
          selectedWorkflow.isPublic
        );
      }
      
      if (response.success && response.data) {
        if (onRegister) {
          onRegister({
            ...selectedWorkflow,
            templateId: response.data.templateId,
            isBaseTemplate: isBaseTemplate
          });
        }
        toast("Successfully saved template");
        
        // Refresh the template list
        fetchTemplates();
        
      } else {
        setError(response.message || 'Failed to register template');
        console.error(response.message );
        alert('Failed to register template');
      }
    } catch (err) {
      setError('An error occurred while saving the template');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, index: number) => {
    setIsDeletingTemplate(index);
    const response = await deleteAstWorkflowTemplate(templateId);
    if (response.success) {
      // If we deleted the currently selected workflow, reset to empty state
      if (selectedWorkflowId === templateId) {
        setSelectedWorkflow(emptyTemplate(isBaseTemplate));
        setSelectedWorkflowId(null);
        setIsPreviewing(false);
      }
      fetchTemplates();
    }
    setIsDeletingTemplate(-1);
  }

  
  const handleDeleteStep = (index: number) => {
    const newTemplate = cloneDeep(selectedWorkflow);
    newTemplate.template?.steps.splice(index, 1);
    setSelectedWorkflow(newTemplate);
  };
  
  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!selectedWorkflow.template?.steps) return;
    
    const newTemplate = cloneDeep(selectedWorkflow);
    const steps = newTemplate.template?.steps ?? [];
    
    if (direction === 'up' && index > 0) {
      [steps[index], steps[index - 1]] = [steps[index - 1], steps[index]];
    } else if (direction === 'down' && index < steps.length - 1) {
      [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
    }
    
    setSelectedWorkflow(newTemplate);
  };
  

  const sanitizeKey = (key: string): string => {
    let sanitized = key.trim();
    
    // Replace spaces and invalid characters with underscores
    // Keep alphanumeric, underscore (_), and dot (.) characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9_\.]/g, '_');
    
    // Ensure key doesn't start with a number (invalid in some contexts)
    if (/^[0-9]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }

    return sanitized || '_key';
  };
  
  const handleNewTemplate = () => {
    setSelectedWorkflow( emptyTemplate(false) );
    setIsPreviewing(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCreateMenu && createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCreateMenu]);

  useEffect(() => {
    setDetailedPreview(false);
  }, [isPreviewing]);


  const handleLoadTemplate = async (templateId: string) => {
    // Handle deselection - if clicking the already selected template, deselect it
    if (selectedWorkflowId === templateId) {
      setSelectedWorkflowId(null);
      setSelectedWorkflow(emptyTemplate(false));
      setIsPreviewing(false);
      return;
    }

    setLoadingSelectedWorkflow(true);
    setIsPreviewing(true); // Automatically show preview when selecting
    setSelectedWorkflowId(templateId);
    
    const selectedTemp = allTemplates.find(t => t.templateId === templateId);
    if (!selectedTemp) {
      alert("Template not found");
      setSelectedWorkflow( emptyTemplate(false) );
      setSelectedWorkflowId(null);
      setLoadingSelectedWorkflow(false);
      return;
    }
    
    if (selectedTemp.template?.steps && selectedTemp.template.steps.length > 0) {
      // we already loaded it fully previously
      setSelectedWorkflow( selectedTemp ); // populate what we do have
      setLoadingSelectedWorkflow(false);
      return;
    }

    const loadTemplate = await getAstWorkflowTemplate(templateId);
    if (loadTemplate.success && loadTemplate.data) {
      const fullTemplate = loadTemplate.data;
      const updatedTemplates = allTemplates.map(t => t.templateId === templateId ? fullTemplate : t);
      setAllTemplates(updatedTemplates);
        
        // Ensure template structure is valid and has steps
        if (!fullTemplate.template) {
          fullTemplate.template = { steps: [] };
        } else if (!fullTemplate.template.steps) {
          fullTemplate.template.steps = [];
        }
        setSelectedWorkflow(fullTemplate);
    } else {
      alert("Failed to load template");
      setSelectedWorkflow( emptyTemplate(false) );
    }

    setLoadingSelectedWorkflow(false);
  };

  const handleOpenWorkflowBuilder = () => {
    if (selectedWorkflowId) {
      // Edit existing workflow
      const workflowToEdit = allTemplates.find(t => t.templateId === selectedWorkflowId);
      if (workflowToEdit) {
        setWorkflowBuilderWorkflow(cloneDeep(workflowToEdit));
      }
    } else {
      // Create new workflow
      setWorkflowBuilderWorkflow(emptyTemplate(isBaseTemplate));
    }
    setShowWorkflowBuilder(true);
  };

  const handleSaveWorkflowFromBuilder = async (workflow: AstWorkflow) => {
    try {
      // Validate workflow
      if (!workflow.name.trim()) {
        throw new Error('Workflow name is required');
      }

      if (!workflow.template?.steps || workflow.template.steps.length === 0) {
        throw new Error('Workflow must have at least one step');
      }

      const nonTerminateSteps = workflow.template.steps.filter(
        step => step.tool !== 'terminate' && step.stepName !== 'done'
      );
      
      if (nonTerminateSteps.length === 0) {
        throw new Error('Workflow must have at least one non-terminate step');
      }

      // Save workflow
      const isBaseTemplate = true;
      let response;

      if (workflow.templateId && workflow.templateId.trim() !== '') {
        // Update existing template
        response = await updateAstWorkflowTemplate(
          workflow.templateId,
          workflow.template ?? { steps: [] },
          workflow.name,
          workflow.description,
          workflow.inputSchema,
          workflow.outputSchema,
          isBaseTemplate,
          workflow.isPublic
        );
      } else {
        // Register new template
        response = await registerAstWorkflowTemplate(
          workflow.template ?? { steps: [] },
          workflow.name,
          workflow.description,
          workflow.inputSchema,
          workflow.outputSchema,
          isBaseTemplate,
          workflow.isPublic
        );
      }

      if (response.success && response.data) {
        toast.success("Successfully saved workflow template");
        
        // Refresh templates and select the saved workflow
        await fetchTemplates();
        setSelectedWorkflowId(response.data.templateId);
        setSelectedWorkflow({
          ...workflow,
          templateId: response.data.templateId,
          isBaseTemplate: isBaseTemplate
        });
        
        setShowWorkflowBuilder(false);
        setWorkflowBuilderWorkflow(null);
      } else {
        throw new Error(response.message || 'Failed to save workflow template');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save workflow');
    }
  };

  const handleSelectTool = (toolName: string, index: number, parameters: Schema) => {
    const args: Record<string, string> = {};
    if (parameters.properties) {
      Object.entries(parameters.properties).forEach(([paramName, paramInfo]: [string, any]) => {
        args[paramName] = paramInfo.description ?? "No description provided";
      });
    }
    const updatedTemplate = cloneDeep(selectedWorkflow);
    if (updatedTemplate.template?.steps) {
      updatedTemplate.template.steps[index].tool = toolName;  
      updatedTemplate.template.steps[index].args = args;
    }
    setSelectedWorkflow(updatedTemplate);
  }
  
  const renderSidebar = () => (
    <div className="w-1/4 border-r border-neutral-300 dark:border-neutral-700 overflow-y-auto pr-4"
         style={{height: '100% !important'}}>
  
      <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-bold">Workflow Templates</div>
          <div className="relative" ref={createMenuRef}>
            <button 
              onClick={() => setShowCreateMenu(!showCreateMenu)} 
              title="Create New Workflow Template using different methods" 
              className="hover:text-blue-600 relative"
            >
              <IconPlus size={18} />
            </button>
            
            {showCreateMenu && (
              <div className="absolute top-8 right-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-[180px]">
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => {
                    setForceVisualBuilderReset(true);
                    setShowVisualBuilder(true);
                    setShowCreateMenu(false);
                  }}
                  title="Drag-and-drop interface for building workflows visually with real-time preview"
                >
                  <IconPuzzle size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm">Visual Builder</span>
                </button>
                
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => {
                    setShowWorkflowGenerator(true);
                    setShowCreateMenu(false);
                  }}
                  title="Let AI create a workflow based on your description and selected tools"
                >
                  <IconRobot size={16} className="text-green-600 dark:text-green-400" />
                  <span className="text-sm">AI Generate</span>
                </button>
                
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => {
                    handleOpenWorkflowBuilder();
                    setShowCreateMenu(false);
                  }}
                  title="Traditional step-by-step workflow creation interface with detailed configuration"
                >
                  <IconEdit size={16} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-sm">Workflow Builder</span>
                </button>
              </div>
            )}
          </div>
      </div>
      
      {isLoadingTemplates ? (
        <div className="text-center p-4 text-neutral-500 dark:text-neutral-400">
          Loading templates...
        </div>
      ) : !Array.isArray(allTemplates) || allTemplates.length === 0 ? (
        <div className="text-center p-4 text-neutral-500 dark:text-neutral-400">
          No templates available
        </div>
      ) : (
        <div className="space-y-2">
          {Array.isArray(allTemplates) && allTemplates.map((template, index) => (
            <div
              key={template.templateId}
              className={`p-2 rounded-lg cursor-pointer flex flex-row ${
                selectedWorkflowId === template.templateId
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => handleLoadTemplate(template.templateId)}
              title="Click to preview this workflow template, click again to deselect">
              <div className="flex flex-col truncate">
                <div className="font-medium text-neutral-800 dark:text-neutral-200">
                  {template.name}
                </div>
                {template.description && (
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                    {template.description}
                  </div>
                )}
                {/* {template.isBaseTemplate && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Base Template
                  </div>
                )} */}
              </div>
              
              { selectedWorkflowId === template.templateId &&
                <button className="ml-auto right-2"
                title="Delete Template"
                onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template.templateId, index);
                }}
            >
                {isDeletingTemplate === index ? (
                    <IconLoader2 size={18} className="animate-spin text-neutral-500" />
                ) : (<IconTrash className="text-red-500 hover:text-red-700" size={18} /> )}
            </button>}
            </div>
          ))}
        </div>
      )}

    </div>
  );
  
  
  const handleStepChange = (updatedStep: Step, index: number) => {
    const newTemplate = cloneDeep(selectedWorkflow);
    if (newTemplate.template?.steps) {
      newTemplate.template.steps[index] = updatedStep;
      setSelectedWorkflow(newTemplate);
    }
  };

  const renderStepEditor = (step: Step, index: number) => {
    const isTerminate = isTerminateStep(step);
    // Detect if step is likely new (empty or minimal content)
    const isNewStep = !isTerminate && (
      !step.description?.trim() && 
      !step.tool?.trim() && 
      !step.instructions?.trim() &&
      (!step.stepName?.trim() || step.stepName === 'New Step')
    );
    
    return (
      <div className="mb-4">
        <StepEditor
          step={step}
          stepIndex={index}
          onStepChange={(updatedStep) => handleStepChange(updatedStep, index)}
          availableApis={availableApis}
          availableAgentTools={availableAgentTools}
          isTerminate={isTerminate}
          allowToolSelection={true}
          isNewStep={isNewStep}
        />
      </div>
    );
  };
  
  const isTerminateStep = (step: Step) => step.tool === 'terminate';
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    // Don't allow dragging the terminate step
    if (selectedWorkflow.template?.steps && isTerminateStep(selectedWorkflow.template.steps[index])) {
      e.preventDefault();
      return;
    }
    
    setDraggedIndex(index);
    // Set the dragged data
    e.dataTransfer.setData('text/plain', index.toString());
    // Make the drag image semi-transparent
    if (e.target instanceof HTMLElement) {
      e.dataTransfer.effectAllowed = 'move';
    }
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    // Find the terminate step index
    const terminateIndex = selectedWorkflow.template?.steps.findIndex(isTerminateStep);
    const dragIndex = draggedIndex;
    
    // Don't allow dropping after the terminate step or dropping the terminate step itself
    if (dragIndex === null || 
        (terminateIndex !== undefined && terminateIndex !== -1 && index >= terminateIndex) || 
        (terminateIndex !== undefined && terminateIndex !== -1 && dragIndex === terminateIndex)) {
      e.dataTransfer.dropEffect = 'none';
      setDropIndicatorIndex(null);
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    // Set drop indicator to be consistent with the visuals
    // If dragging over the top half of a step, indicate before that step
    // If dragging over the bottom half of a step, indicate after that step
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const isInTopHalf = y < rect.height / 2;
    
    setDropIndicatorIndex(isInTopHalf ? index : index + 1);
  };
  
  const handleDragEnter = (e: React.DragEvent, index: number) => {
    // Find the terminate step index
    const terminateIndex = selectedWorkflow.template?.steps.findIndex(isTerminateStep);
    const dragIndex = draggedIndex;
    
    // Don't allow dropping after the terminate step or dropping the terminate step itself
    if (dragIndex === null || 
        (terminateIndex !== undefined && terminateIndex !== -1 && index >= terminateIndex) || 
        (terminateIndex !== undefined && terminateIndex !== -1 && dragIndex === terminateIndex)) {
      setDropIndicatorIndex(null);
      return;
    }
    
    // Match logic from handleDragOver
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const isInTopHalf = y < rect.height / 2;
    
    setDropIndicatorIndex(isInTopHalf ? index : index + 1);
  };
  
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    
    // Find the terminate step index
    const terminateIndex = selectedWorkflow.template?.steps.findIndex(isTerminateStep);
    // Don't allow dropping after the terminate step or dropping the terminate step itself
    if ((terminateIndex !== undefined && terminateIndex !== -1 && dropIndex >= terminateIndex) || 
        (terminateIndex !== undefined && terminateIndex !== -1 && dragIndex === terminateIndex)) {
      return;
    }
    // Make a new copy of the template
    const newTemplate = cloneDeep(selectedWorkflow);
    if (!newTemplate.template?.steps) return;
    
    // Get the steps array and the step being moved
    const steps = newTemplate.template.steps;
    const movedStep = steps[dragIndex];
    
    // Remove the step from its original position
    steps.splice(dragIndex, 1);
    
    // Insert it at the new position
    steps.splice(dropIndex, 0, movedStep);
    
    // Update the template
    setSelectedWorkflow(newTemplate);
    setDraggedIndex(null);
    setDropIndicatorIndex(null);
  };
  
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropIndicatorIndex(null);
  };
  
  const renderWorkflowSteps = () => {
    // Make sure template and steps exist
    const steps = selectedWorkflow.template?.steps || [];
    
    return (
      <div className="mb-4">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div> )}
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium dark:text-neutral-200">
            Workflow Steps
          </label>
          <button
            onClick={() => {
              // Add a new step
              const newTemplate = cloneDeep(selectedWorkflow);
              if (!newTemplate.template) {
                newTemplate.template = { steps: [] };
              }
              
              // Find the terminate step
              const terminateIndex = newTemplate.template.steps.findIndex(s => isTerminateStep(s));
              
              // Create new step
              const newStep: Step = {
                description: '',
                tool: '',
                instructions: '',
                args: {},
                values: {},
                actionSegment: undefined
              };
              
              if (terminateIndex !== -1) {
                // Insert before terminate step
                newTemplate.template.steps.splice(terminateIndex, 0, newStep);
              } else {
                // Add to end
                newTemplate.template.steps.push(newStep);
              }
              
              setSelectedWorkflow(newTemplate);
            }}
            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            title="Add a new step before the terminate step"
          >
            <IconPlus size={16} className="mr-1" />
            Add Step
          </button>
        </div>
        
        {steps.length === 0 ? (
          <div className="text-center p-4 border rounded-lg border-dashed border-neutral-300 dark:border-neutral-700">
            <p className="text-neutral-500 dark:text-neutral-400">
              {"No steps added yet. Click 'Add Step' to get started."}
            </p>
          </div>
        ) : (
          <div>
            {loadingSelectedWorkflow && (
              <div className="p-4 text-neutral-500 dark:text-neutral-400">
                Loading steps...
              </div>
            )}
            {/* Drop indicator for position 0 */}
            {draggedIndex !== null && dropIndicatorIndex === 0 && (
              <div className="h-[1px] w-full bg-green-400 my-0 rounded-full"></div>
            )}
            
            {steps.map((step, index) => {
              const actionColor = step.actionSegment ? getSegmentColor(step.actionSegment) : "";
              return (
                <React.Fragment key={index}>
                  <div 
                    className={`p-4 bg-white border-t border-neutral-300 dark:border-neutral-700 dark:bg-[#343541] 
                    ${expandedSteps.includes(index) ? '' : 'hover:bg-neutral-200 dark:hover:bg-gray-700'}
                    ${isTerminateStep(step) && !expandedSteps.includes(index) ? 'opacity-50' : ''} 
                    ${draggedIndex === index ? 'opacity-50' : ''}
                    flex flex-row relative`}
                  draggable={!isTerminateStep(step) && !expandedSteps.includes(index)}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => setHoveredStepIndex(index)}
                  onMouseLeave={() => setHoveredStepIndex(null)}
                >
                  <div className='flex flex-col w-full'>
                    <ExpansionComponent
                      title={`${index + 1}. ${(isTerminateStep(step) ? 'Terminate conversation'  : 
                                          ( `${step.stepName || step.description}`) || 'New Step')}`}
                      content={<div className=" bg-neutral-100 dark:bg-[#22232b] p-2">{renderStepEditor(step, index)}</div>}
                      onOpen={() => setExpandedSteps([...expandedSteps, index])}
                      onClose={() => setExpandedSteps(expandedSteps.filter(i => i !== index))}
                      closedWidget={<IconCaretDown size={20} style={{ color: actionColor, fill: actionColor || "none"}} />}
                      openWidget={<IconCaretRight size={20} style={{ color: actionColor, fill: actionColor || "none"}} />}
                    />
                  </div>
                  <div className='absolute right-4 mt-[-4px]'> 
                    {!isTerminateStep(step) && hoveredStepIndex === index && (
                      <>
                      {index > 0 && 
                      <ActionButton
                          id={"moveStepUp" + index} title="Move step up"
                          handleClick={() => handleMoveStep(index, 'up')}>
                          <IconArrowUp size={18} />
                      </ActionButton>}
                      {index < steps.length - 2 && 
                      <ActionButton
                          id={"moveStepDown" + index}  title="Move step down"
                          handleClick={() => handleMoveStep(index, 'down')}>
                          <IconArrowDown size={18} />
                      </ActionButton>}
                      
                      <button
                        onClick={() => handleDeleteStep(index)}
                        className="p-1 text-red-600 dark:text-red-400 hover:opacity-60 rounded"
                        title="Delete step"
                      >
                        <IconTrash size={18} />
                      </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Drop indicator after this step */}
                {draggedIndex !== null && dropIndicatorIndex === index + 1 && (
                  <div className="h-[1px] w-full bg-green-400 my-0 rounded-full"></div>
                )}
              </React.Fragment>
          )})}
          </div>
        )}
      </div>
    );
  };
  
  const renderMainContent = () => (
    <div className="flex-1 pl-4">
      <div className="relative mt-2 ">
        <ExpansionComponent
          closedWidget={<IconInfoCircle size={18} className='flex-shrink-0'/>}
          title="Understanding Assistant Workflow Templates"
          content={<div className="mb-8 py-2">
            <InfoBox
              content={
                <span className='px-4'>
              Workflow templates are used to create assistant workflows. They are a collection of steps that are executed in order.
              
              <ul className="mt-2 list-disc pl-5">
                <li><strong>Steps and Tools:</strong> Each step allows you to select a Tool (internal API, custom API, or agent tool). </li>
                <li className="ml-4"> Selecting a tool will automatically populate the Arguments section. </li>
                <li className="ml-4"> {"Edit the Arguments instructions to influence the Assistant's generated argument value."} </li>
                <li className="ml-4"> Use the Values section to assign permanent values to specific arguments, otherwise the assistant will decide the value at runtime.</li>
                <li className="ml-4"> Arguments are not required and can be removed by clicking the Trash Icon to the right of the argument name. </li>
                <li className="ml-4"> Select the Edit Icon to the right of the argument name to enable/disable the ability to edit the argument value when adding this workflow to an assistant. </li>
                <li><strong>Action Segments:</strong> Group related steps by giving them the same Action Segment name. Steps with the same segment will be color-coded together. When creating an assistant with this template, you can enable/disable entire segments at once.</li>
                <li><strong>Terminate Step:</strong> Every workflow must end with a terminate step. This step is automatically added and should always remain as the last step in your workflow.</li>
              </ul>
            </span>
            }
          /></div> }
          /> 
          <div className="absolute right-1 top-[-6px] flex flex-row gap-3">
             <button
              className={`px-2  ${buttonStyle}`}
              onClick={() => {
                // Force reset if we don't have a saved workflow (no templateId)
                const shouldForceReset = !selectedWorkflow?.templateId;
                
                setForceVisualBuilderReset(shouldForceReset);
                setShowVisualBuilder(true);
              }}
              title="Open visual drag-and-drop workflow builder for intuitive workflow creation">
              <IconPuzzle size={18} />
              Visual Builder
            </button>
             <button
              className={`px-2  ${buttonStyle}`}
              onClick={() => {
                setShowWorkflowGenerator(true);
                setIsPreviewing(false);
                setDetailedPreview(false);
              }}
              title="Use AI to generate a workflow from your description and selected tools">
              {isGeneratingWorkflow ? <IconLoader2 size={18} className='animate-spin' /> : <IconRobot size={18} />}
              AI Generate Workflow
            </button>
            <button
              className={`px-3  ${buttonStyle}`}
              onClick={() => setIsPreviewing(true)}
              title="Preview how this workflow will appear to users when they use it">
              <IconPresentation size={18} />
              Preview Workflow
            </button>
          </div>
      </div>
      <div className="my-4">
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Template Name
        </label>
        <input
          type="text"
          value={selectedWorkflow.name}
          onChange={(e) => setSelectedWorkflow({...selectedWorkflow, name: e.target.value})}
          className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
          placeholder="Name your workflow template"
          title="Choose a descriptive name for this workflow template that explains its purpose"
        />
      </div>
      
      <div className="mb-4">
        
        <div title="Allow any Amplify user to access and use this workflow template">
          <Checkbox
            id="isPublic"
            label="Accessible to any Amplify user"
            checked={selectedWorkflow.isPublic || false}
            onChange={(checked) => setSelectedWorkflow({...selectedWorkflow, isPublic: checked})}
          />
        </div>

      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Description
        </label>
        <textarea
          value={selectedWorkflow.description}
          onChange={(e) => setSelectedWorkflow({...selectedWorkflow, description: e.target.value})}
          className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
          rows={2}
          placeholder="Describe what this workflow does"
          title="Explain what this workflow does and when to use it"
        />
      </div>
      
      {renderWorkflowSteps()}
      
    </div>
  );

  const renderPreviewContent = () => (
    <div className="flex-1 pl-4">
      {/* Workflow Template Preview with Controls */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Workflow Template Preview</h3>
          <div className="flex gap-2">
            <button
              className={`px-3 py-2 ${buttonStyle}`}
              onClick={() => {
                const shouldForceReset = false; // Don't reset when editing existing
                setForceVisualBuilderReset(shouldForceReset);
                setShowVisualBuilder(true);
              }}
              title="Edit this workflow using the visual drag-and-drop interface"
            >
              <IconPuzzle size={18} className="text-blue-600 dark:text-blue-400" />
              Visual Builder
            </button>

            <button
              className={`px-3 py-2 ${buttonStyle}`}
              onClick={handleOpenWorkflowBuilder}
              title="Edit this workflow using the step-by-step editor interface"
            >
              <IconEdit size={18} className="text-purple-600 dark:text-purple-400" />
              Workflow Builder
            </button>
          </div>
        </div>
        
        <AssistantWorkflow 
          id={"previewCurrentWorkflow"}
          workflowTemplate={selectedWorkflow} 
          enableCustomization={false}  // do nothing 
          onWorkflowTemplateUpdate={(workflowTemplate: AstWorkflow | null) => {}}
        />
      </div>
    </div>
  );

  const renderCenterPanel = () => {
    if (selectedWorkflowId) {
      // Show preview when a workflow is selected
      return renderPreviewContent();
    } else {
      // Show instructions and quick actions when no workflow is selected
      return (
        <div className="flex-1 pl-4">
          <div className="relative mt-2">
            <ExpansionComponent
              closedWidget={<IconInfoCircle size={18} className='flex-shrink-0'/>}
              title="Understanding Assistant Workflow Templates"
              content={<div className="mb-8 py-2">
                <InfoBox
                  content={
                    <span className='px-4'>
                  Workflow templates are used to create assistant workflows. They are a collection of steps that are executed in order.
                  
                  <ul className="mt-2 list-disc pl-5">
                    <li><strong>Steps and Tools:</strong> Each step allows you to select a Tool (internal API, custom API, or agent tool). </li>
                    <li className="ml-4"> Selecting a tool will automatically populate the Arguments section. </li>
                    <li className="ml-4"> {"Edit the Arguments instructions to influence the Assistant's generated argument value."} </li>
                    <li className="ml-4"> Use the Values section to assign permanent values to specific arguments, otherwise the assistant will decide the value at runtime.</li>
                    <li className="ml-4"> Arguments are not required and can be removed by clicking the Trash Icon to the right of the argument name. </li>
                    <li className="ml-4"> Select the Edit Icon to the right of the argument name to enable/disable the ability to edit the argument value when adding this workflow to an assistant. </li>
                    <li><strong>Action Segments:</strong> Group related steps by giving them the same Action Segment name. Steps with the same segment will be color-coded together. When creating an assistant with this template, you can enable/disable entire segments at once.</li>
                    <li><strong>Terminate Step:</strong> Every workflow must end with a terminate step. This step is automatically added and should always remain as the last step in your workflow.</li>
                  </ul>
                </span>
                }
              /></div> }
            /> 
            
            {/* Quick Action Buttons */}
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Create New Workflow Template</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <button
                  className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-left hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  onClick={() => {
                    setForceVisualBuilderReset(true);
                    setShowVisualBuilder(true);
                  }}
                  title="Best for visual learners and complex workflows. Drag tools from a palette onto a canvas to build your workflow with instant preview."
                >
                  <div className="flex items-center mb-2">
                    <IconPuzzle size={24} className="text-blue-600 dark:text-blue-400 mr-2" />
                    <span className="font-medium text-gray-900 dark:text-white">Visual Builder</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag and drop tools to build workflows visually
                  </p>
                </button>

                <button
                  className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-left hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  onClick={() => {
                    setShowWorkflowGenerator(true);
                  }}
                  title="Perfect for quick workflow creation. Describe your desired workflow in plain language and AI will generate the steps and tool configurations for you."
                >
                  <div className="flex items-center mb-2">
                    <IconRobot size={24} className="text-green-600 dark:text-green-400 mr-2" />
                    <span className="font-medium text-gray-900 dark:text-white">AI Generate</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Describe your workflow and let AI create it
                  </p>
                </button>

                <button
                  className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-left hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  onClick={handleOpenWorkflowBuilder}
                  title="Best for detailed control and complex configurations. Traditional form-based interface for precise step-by-step workflow creation."
                >
                  <div className="flex items-center mb-2">
                    <IconEdit size={24} className="text-purple-600 dark:text-purple-400 mr-2" />
                    <span className="font-medium text-gray-900 dark:text-white">Workflow Builder</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create workflows with step-by-step editing
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      <Modal
        title={initialTemplate?.templateId ? 'Edit Assistant Workflow Template' : 'Create Assistant Workflow Template'}
        content={
          <div className="flex flex-row" style={{height: (window.innerHeight * 0.9) * 0.8}}>
                  {renderSidebar()}
                  {renderCenterPanel()}
          </div>
        }
        showCancel={true}
        submitLabel="Close"
        onSubmit={onClose}
        onCancel={ () => {
          setSelectedWorkflow(emptyTemplate(isBaseTemplate));
          onClose();
        }}
        disableSubmit={isSubmitting}
        disableClickOutside={true}
      />
      
      <WorkflowGeneratorModal
        isOpen={showWorkflowGenerator}
        onClose={() => {
          setShowWorkflowGenerator(false);
          setIsGeneratingWorkflow(false);
        }}
        onGenerate={async (workflow) => {
          try {
            // Save the generated workflow directly
            const response = await registerAstWorkflowTemplate(
              workflow.template ?? { steps: [] },
              workflow.name,
              workflow.description,
              workflow.inputSchema,
              workflow.outputSchema,
              isBaseTemplate,
              workflow.isPublic
            );

            if (response.success && response.data) {
              toast.success("Successfully generated and saved workflow");
              
              // Refresh templates and select the new workflow
              await fetchTemplates();
              setSelectedWorkflowId(response.data.templateId);
              setSelectedWorkflow({
                ...workflow,
                templateId: response.data.templateId,
                isBaseTemplate: isBaseTemplate
              });
              setIsPreviewing(true); // Show preview of the new workflow
              
              setShowWorkflowGenerator(false);
              setIsGeneratingWorkflow(false);
            } else {
              throw new Error(response.message || 'Failed to save generated workflow');
            }
          } catch (error) {
            console.error('Error saving generated workflow:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save generated workflow');
            
            // Still allow the user to see the workflow even if save failed
            setSelectedWorkflow(workflow);
            setSelectedWorkflowId(null);
            setShowWorkflowGenerator(false);
            setIsGeneratingWorkflow(false);
            setIsPreviewing(true);
          }
        }}
        availableApis={availableApis}
        availableAgentTools={availableAgentTools}
      />

      {/* Workflow Builder Modal */}
      {showWorkflowBuilder && workflowBuilderWorkflow && (
        <Modal
          title={workflowBuilderWorkflow.templateId ? 'Edit Workflow Template' : 'Create New Workflow Template'}
          content={
            <div style={{ height: (window.innerHeight * 0.9) * 0.7, overflow: 'auto' }}>
              <div className="space-y-6">
                {/* Workflow Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Workflow Name
                    </label>
                    <input
                      type="text"
                      value={workflowBuilderWorkflow.name}
                      onChange={(e) => setWorkflowBuilderWorkflow({
                        ...workflowBuilderWorkflow,
                        name: e.target.value
                      })}
                      className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
                      placeholder="Enter workflow name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      value={workflowBuilderWorkflow.description}
                      onChange={(e) => setWorkflowBuilderWorkflow({
                        ...workflowBuilderWorkflow,
                        description: e.target.value
                      })}
                      className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
                      rows={2}
                      placeholder="Describe what this workflow does"
                    />
                  </div>

                  <div>
                    <Checkbox
                      id="workflowBuilder-isPublic"
                      label="Accessible to any Amplify user"
                      checked={workflowBuilderWorkflow.isPublic || false}
                      onChange={(checked) => setWorkflowBuilderWorkflow({
                        ...workflowBuilderWorkflow,
                        isPublic: checked
                      })}
                    />
                  </div>
                </div>

                {/* Steps Section */}
                <div>
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Workflow Steps</h3>
                  <div className="space-y-4">
                    {workflowBuilderWorkflow.template?.steps?.map((step, index) => (
                      <div key={index} className="border rounded-lg p-4 dark:border-gray-600">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Step {index + 1}: {step.stepName || 'Untitled Step'}
                          </h4>
                          {step.tool !== 'terminate' && (
                            <button
                              onClick={() => {
                                const updatedWorkflow = cloneDeep(workflowBuilderWorkflow);
                                updatedWorkflow.template?.steps?.splice(index, 1);
                                setWorkflowBuilderWorkflow(updatedWorkflow);
                              }}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <IconTrash size={16} />
                            </button>
                          )}
                        </div>
                        
                        <StepEditor
                          step={step}
                          stepIndex={index}
                          onStepChange={(updatedStep) => {
                            const updatedWorkflow = cloneDeep(workflowBuilderWorkflow);
                            if (updatedWorkflow.template?.steps) {
                              updatedWorkflow.template.steps[index] = updatedStep;
                              setWorkflowBuilderWorkflow(updatedWorkflow);
                            }
                          }}
                          availableApis={availableApis}
                          availableAgentTools={availableAgentTools}
                          isTerminate={step.tool === 'terminate'}
                          allowToolSelection={step.tool !== 'terminate'}
                          isNewStep={step.tool !== 'terminate' && (
                            !step.description?.trim() && 
                            !step.tool?.trim() && 
                            !step.instructions?.trim() &&
                            (!step.stepName?.trim() || step.stepName === 'New Step')
                          )}
                        />
                      </div>
                    ))}

                    {/* Add Step Button */}
                    <button
                      onClick={() => {
                        const updatedWorkflow = cloneDeep(workflowBuilderWorkflow);
                        if (!updatedWorkflow.template) {
                          updatedWorkflow.template = { steps: [] };
                        }
                        
                        const newStep: Step = {
                          stepName: '',
                          description: '',
                          tool: '',
                          instructions: '',
                          args: {},
                          values: {}
                        };
                        
                        // Insert before terminate step if it exists
                        const terminateIndex = updatedWorkflow.template.steps.findIndex(s => s.tool === 'terminate');
                        if (terminateIndex !== -1) {
                          updatedWorkflow.template.steps.splice(terminateIndex, 0, newStep);
                        } else {
                          updatedWorkflow.template.steps.push(newStep);
                        }
                        
                        setWorkflowBuilderWorkflow(updatedWorkflow);
                      }}
                      className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <IconPlus size={20} />
                      Add New Step
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
          showCancel={true}
          submitLabel="Save Workflow"
          onSubmit={() => handleSaveWorkflowFromBuilder(workflowBuilderWorkflow)}
          onCancel={() => {
            setShowWorkflowBuilder(false);
            setWorkflowBuilderWorkflow(null);
          }}
        />
      )}
      
      <VisualWorkflowBuilder
        isOpen={showVisualBuilder}
        onClose={() => {
          setShowVisualBuilder(false);
          setForceVisualBuilderReset(false); // Reset the force flag when closing
          fetchTemplates(); // Refresh template list in case a new template was saved
        }}
        onSave={(workflow) => {
          setSelectedWorkflow(workflow);
          setShowVisualBuilder(false);
          setIsPreviewing(false);
          setForceVisualBuilderReset(false); // Reset the force flag when saving
        }}
        availableApis={availableApis}
        availableAgentTools={availableAgentTools}
        initialWorkflow={selectedWorkflow}
        forceReset={forceVisualBuilderReset}
      />
    </>
  );
};

const buttonStyle = "py-2 border rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-2";


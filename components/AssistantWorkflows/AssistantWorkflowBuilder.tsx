// Create Workflows from scratch

import React, { useState, useEffect, useContext } from 'react';
import { AstWorkflow, Step } from '@/types/assistantWorkflows';
import { Modal } from '@/components/ReusableComponents/Modal';
import { registerAstWorkflowTemplate, listAstWorkflowTemplates, getAstWorkflowTemplate, updateAstWorkflowTemplate, deleteAstWorkflowTemplate } from '@/services/assistantWorkflowService';
import { IconPlus, IconTrash, IconChevronDown, IconChevronUp, IconCaretDown, IconCaretRight, IconArrowUp, IconArrowDown, IconLoader2, IconInfoCircle, IconPresentation, IconPuzzle, IconPuzzleFilled, IconEdit, IconEditOff, IconRobot } from '@tabler/icons-react';
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
import { OpDef, Schema } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
import { emptySchema } from '@/utils/app/tools';

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

// Add this color palette for action segments
const segmentColors = [
  "#00EAFF", // electric cyan
  "#FF00FF", // magenta
  "#00FF00", // neon green
  "#FF3800", // neon orange
  "#FFF100", // bright yellow
  "#FF0080", // hot pink
  "#7B00FF", // electric purple
  "#00FF8A", // electric mint
  "#FF484B", // bright red
  "#01CDFE", // bright sky blue
  "#FF6EFF", // neon pink
  "#CCFF00", // electric lime
  "#00FFCC", // bright turquoise
  "#B3FF00", // chartreuse
  "#6600FF", // deep violet
  "#FF9500", // vivid orange
  "#00B3FF", // azure
  "#FFDD00", // golden yellow
  "#FF0054", // ruby red
  "#46FFCA", // aquamarine
];

const getSegmentColor = (segment: string): string => {
  if (!segment || segment === "") return "";
  
  // Hash the segment name to get a consistent index
  let hashCode = 0;
  for (let i = 0; i < segment.length; i++) {
    hashCode = segment.charCodeAt(i) + ((hashCode << 5) - hashCode);
  }
  
  const index = Math.abs(hashCode) % segmentColors.length;
  return segmentColors[index];
};

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
    console.log("handleDeleteTemplate: ", templateId);
    console.log("expecting 21f303ed-9dae-4324-bd38-b31219984429");
    setIsDeletingTemplate(index);
    const response = await deleteAstWorkflowTemplate(templateId);
    if (response.success) {
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

  useEffect(() => {
    setDetailedPreview(false);
  }, [isPreviewing]);


  const handleLoadTemplate = async (templateId: string) => {
    setLoadingSelectedWorkflow(true);
    setIsPreviewing(false);
    const selectedTemp = allTemplates.find(t => t.templateId === templateId);
    if (!selectedTemp) {
      alert("Template not found");
      setSelectedWorkflow( emptyTemplate(false) );
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
          <div className="text-sm font-bold">Templates</div>
          <button onClick={handleNewTemplate} title="Add New Template" className="hover:text-blue-600">
              <IconPlus size={18} />
          </button>
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
                selectedWorkflow.templateId === template.templateId
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => handleLoadTemplate(template.templateId)}>
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
              
              { selectedWorkflow.templateId === template.templateId &&
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
  
  
  const renderStepEditor = (step: Step, index: number) => {
    const isTerminate = isTerminateStep(step);
    return <div className="mb-4">
        <div className={`mb-4 ${isTerminate ? 'opacity-50' : ''}`}>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
            Step Name
          </label>
          <input
            disabled={isTerminate}
            type="text"
            value={step.stepName || ''}
            onChange={(e) => {
              const newTemplate = cloneDeep(selectedWorkflow);
              if (newTemplate.template?.steps) {
                newTemplate.template.steps[index].stepName = e.target.value;
                setSelectedWorkflow(newTemplate);
              }
            }}
            className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
            placeholder="Name for this step (used for references)"
          />
        </div>
      
      <div className={`mb-4 ${isTerminate ? 'opacity-50' : ''}`}>
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Description
        </label>
        <input
          type="text"
          value={step.description}
          onChange={(e) => {
            const newTemplate = cloneDeep(selectedWorkflow);
            if (newTemplate.template?.steps) {
              newTemplate.template.steps[index].description = e.target.value;
              setSelectedWorkflow(newTemplate);
            }
          }}
          className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
          placeholder="What this step does"
          disabled={isTerminate}
        />
      </div>
      
      <div className={`mb-4 ${isTerminate ? 'opacity-50' : ''}`}>
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Tool
        </label>
        <div className="flex flex-col">
          <button
            disabled={isTerminate}
            type="button"
            className={`flex flex-row w-full p-2 border text-left rounded-lg bg-white dark:bg-[#40414F] dark:border-neutral-600 dark:text-white ${ isTerminate ? "" : "hover:bg-gray-50 dark:hover:bg-[#4a4b59] transition-colors"}`}
            onClick={() => setShowToolSelector(!showToolSelector)}
          >
            {step.tool || "Select a tool"}
            {!showToolSelector ?
             <IconChevronDown size={18} className="ml-auto flex-shrink-0 ml-1" />:
             <IconChevronUp size={18} className="ml-auto flex-shrink-0 ml-1" />}
          </button>

          {showToolSelector && !isTerminate && 
          <div className='border-b flex flex-col  border-neutral-500'>
            <ApiIntegrationsPanel
                // API-related props
                availableApis={availableApis}
                onClickApiItem={(api: OpDef) => {
                  handleSelectTool(api.name, index, api.parameters);
                }}
                // Agent tools props
                availableAgentTools={availableAgentTools}
                onClickAgentTool={ (tool: AgentTool) => {
                  handleSelectTool(tool.tool_name, index, tool.parameters || emptySchema);
                }}
                // python function 
                allowCreatePythonFunction={false}
                hideApisPanel={['external']}
            />
            <br></br>
          </div>
          }
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Instructions
        </label>
        <textarea
          value={step.instructions}
          onChange={(e) => {
            const newTemplate = cloneDeep(selectedWorkflow);
            if (newTemplate.template?.steps) {
              newTemplate.template.steps[index].instructions = e.target.value;
              setSelectedWorkflow(newTemplate);
            }
          }}
          className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
          rows={4}
          placeholder="Instructions for this step"
          // disabled={isTerminate}
        />
      </div>
      
      <div className={`mb-4 ${isTerminate ? 'opacity-40' : ''}`}>
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Action Segment
        </label>
        <input
          type="text"
          value={step.actionSegment ?? ''}
          onChange={(e) => {
            const newTemplate = cloneDeep(selectedWorkflow);
            if (newTemplate.template?.steps) {
              newTemplate.template.steps[index].actionSegment = e.target.value || undefined;
              setSelectedWorkflow(newTemplate);
            }
          }}
          className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
          placeholder="Group related steps"
          disabled={isTerminate}
        />
      </div>
      
      <div className="mb-4" title="Uses a more advanced model for this step">
        <Checkbox
          id={`advanced-reasoning-${index}`}
          label="Use Advanced Reasoning"
          checked={step.useAdvancedReasoning || false}
          onChange={(checked) => {
            const newTemplate = cloneDeep(selectedWorkflow);
            if (newTemplate.template?.steps) {
              newTemplate.template.steps[index].useAdvancedReasoning = checked;
              setSelectedWorkflow(newTemplate);
            }
          }}
        />
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium dark:text-neutral-200">
            Argument Instructions
          </label>
        </div>
        {Object.keys(step.args || {}).length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">
            No Arguments 
          </div>
        ) : (
          Object.entries(step.args)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value], argIndex) => (
              <div 
                key={argIndex} 
                className="w-full flex mb-2 last:mb-0"
                onMouseEnter={() => setHoveredArgIndex(`${index}-${argIndex}`)}
                onMouseLeave={() => setHoveredArgIndex(null)}
              >
                <div className="flex-grow">
                  <InputsMap
                    id={`arg-${index}-${argIndex}`}
                    inputs={[
                      {label: 'Argument', key: 'key', disabled: true},
                      {label: 'Instructions', key: 'value', }
                      // disabled: isTerminate
                    ]}
                    state={{key, value}}
                    inputChanged={(changedKey, changedValue) => {
                      const newTemplate = cloneDeep(selectedWorkflow);
                      if (newTemplate.template?.steps) {
                        if (changedKey === 'value') {
                          const newArgs = { ...newTemplate.template.steps[index].args };
                          newArgs[key] = changedValue;
                          newTemplate.template.steps[index].args = newArgs;
                          setSelectedWorkflow(newTemplate);
                        } 
                      }
                    }}
                  />
                </div>
                
                {!isTerminate && (
                  <div className="w-[28px] mt-1 flex items-center">
                    {hoveredArgIndex === `${index}-${argIndex}` && (
                    <div className="flex flex-col gap-2">
                      <button
                          onClick={() => {
                            const newTemplate = cloneDeep(selectedWorkflow);
                            if (newTemplate.template?.steps) {
                              const newArgs = { ...newTemplate.template.steps[index].args };
                              delete newArgs[key];
                              newTemplate.template.steps[index].args = newArgs;
                              setSelectedWorkflow(newTemplate);
                            }
                          }}
                          className="p-1 text-red-600 dark:text-red-400 hover:opacity-60 rounded flex-shrink-0"
                        >
                          <IconTrash size={20} />
                      </button>

                      <button
                          onClick={() => {
                            const newTemplate = cloneDeep(selectedWorkflow);
                            if (newTemplate.template?.steps) {
                              // Initialize editableArgs if it doesn't exist
                              if (!newTemplate.template.steps[index].editableArgs) {
                                newTemplate.template.steps[index].editableArgs = [];
                              }
                              const editableArgs = newTemplate.template.steps[index].editableArgs || [];
                              if (editableArgs.includes(key)) {
                                newTemplate.template.steps[index].editableArgs = editableArgs.filter(arg => arg !== key);
                              } else {// Add to editable args
                                newTemplate.template.steps[index].editableArgs = [...editableArgs, key];
                              }
                              setSelectedWorkflow(newTemplate);
                            }
                          }}
                          className="p-1 text-neutral-900 dark:text-neutral-100 hover:opacity-80 rounded flex-shrink-0 mr-1"
                          title={`${(step.editableArgs || []).includes(key) ? "Users will be able to edit this argument's instructions.\nClick to mark as non-editable" : 'Users will not be able to edit this argument.\nClick to mark as editable'}`}
                        >
                          {(step.editableArgs || []).includes(key) ? (
                            <IconEdit size={20} /> ) : ( <IconEditOff size={20} className="opacity-60" />
                          )}
                      </button>
                    </div>
                    )}
                  </div>
                )}
              </div>
            ))
        )}
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium dark:text-neutral-200">
            Argument Values
          </label>
          
          <button
            onClick={() => {
              const newTemplate = cloneDeep(selectedWorkflow);
              if (newTemplate.template?.steps) {
                newTemplate.template.steps[index].values = {
                  ...newTemplate.template.steps[index].values,
                  '': ''
                };
                setSelectedWorkflow(newTemplate);
              }
            }}
            className="flex items-center px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            <IconPlus size={14} className="mr-1" />
            Add Value
          </button>
          
        </div>
        {Object.keys(step.values || {}).length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">
            No values set
          </div>
        ) :  (Object.entries(step.values || {})
                    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                    .map(([key, value], valueIndex) => (
          <div 
            key={valueIndex} 
            className="flex mb-2 last:mb-0"
            onMouseEnter={() => setHoveredValueIndex(`${index}-${valueIndex}`)}
            onMouseLeave={() => setHoveredValueIndex(null)}
          >
            <div className="flex-grow">
              <InputsMap
                id={`value-${index}-${valueIndex}`}
                inputs={[
                  {label: 'Argument', key: 'key', placeholder: 'Argument name (from Arguments section)'},
                  {label: 'Value', key: 'value', placeholder: 'Value content'}
                ]}
                state={{key, value}}
                inputChanged={(changedKey, changedValue) => {
                  const newTemplate = cloneDeep(selectedWorkflow);
                  if (newTemplate.template?.steps) {
                    const newValues = { ...newTemplate.template.steps[index].values };
                    
                    if (changedKey === 'key') {
                      const newKey = changedValue.trim();
                      if (newKey === '') return;
                      const sanitizedKey = sanitizeKey(newKey);
                      delete newValues[key];
                      newValues[sanitizedKey] = value;
                    } else if (changedKey === 'value') {
                      newValues[key] = changedValue;
                    }
                    
                    newTemplate.template.steps[index].values = newValues;
                    setSelectedWorkflow(newTemplate);
                  }
                }}
              />
            </div>
            
            <div className="w-[28px] flex items-center">
              {hoveredValueIndex === `${index}-${valueIndex}` && (
                <button
                  onClick={() => {
                    const newTemplate = cloneDeep(selectedWorkflow);
                    if (newTemplate.template?.steps) {
                      const newValues = { ...newTemplate.template.steps[index].values };
                      delete newValues[key];
                      newTemplate.template.steps[index].values = newValues;
                      setSelectedWorkflow(newTemplate);
                    }
                  }}
                  className="p-1 text-red-600 dark:text-red-400 hover:opacity-60 rounded flex-shrink-0"
                >
                  <IconTrash size={18} />
                </button>
              )}
            </div>
          </div>
        )))}
      </div>
    </div>
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
             {/* <button
              className={`px-2  ${buttonStyle}`}
              onClick={() => {}}>
              {isGeneratingWorkflow ? <IconLoader2 size={18} className='animate-spin' /> : <IconRobot size={18} />}
              AI Generate Workflow
            </button> */}
            <button
              className={`px-3  ${buttonStyle}`}
              onClick={() => setIsPreviewing(true)}>
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
        />
      </div>
      
      <div className="mb-4">
        
        <Checkbox
          id="isPublic"
          label="Accessible to any Amplify user"
          checked={selectedWorkflow.isPublic || false}
          onChange={(checked) => setSelectedWorkflow({...selectedWorkflow, isPublic: checked})}
        />

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
        />
      </div>
      
      {renderWorkflowSteps()}
      
    </div>
  );

  const renderPreviewContent = () => (
    <div className="flex-1 pl-4">
       <div className="relative mt-2 ">
        <div className="absolute right-1 top-[-6px] flex flex-row gap-4">
        <button
              className={`w-[168px] px-4 ${buttonStyle}`}
              onClick={() => setDetailedPreview(!detailedPreview)}>
              {`${detailedPreview ? "Hide" : "View"} Detailed Steps`}
            </button>
            <button
              className={`px-3  ${buttonStyle}`}
              onClick={() => setIsPreviewing(false)}>
              <IconPuzzle className="ml-1" size={20} />
              Workflow Builder
            </button>
          </div>
      </div>
      <AssistantWorkflow 
          id={"previewCurrentWorkflow"}
          workflowTemplate={selectedWorkflow} 
          enableCustomization={false}  // do nothing 
          onWorkflowTemplateUpdate={(workflowTemplate: AstWorkflow | null) => {}}
          obfuscate={!detailedPreview}
      />

    </div>
  );
  
  if (!isOpen) return null;
  
  return (
    <Modal
      title={initialTemplate?.templateId ? 'Edit Assistant Workflow Template' : 'Create Assistant Workflow Template'}
      content={
        <div className="flex flex-row" style={{height: (window.innerHeight * 0.9) * 0.8}}>
                {renderSidebar()}
                { isPreviewing ? renderPreviewContent() : renderMainContent()}
        </div>
      }
      showCancel={false}
      submitLabel={isSubmitting ? 'Saving Template...' : 'Save Template'}
      onSubmit={handleSaveTemplate}
      onCancel={ () => {
        setSelectedWorkflow(emptyTemplate(isBaseTemplate));
        onClose();
      }}
      disableSubmit={isSubmitting}
    />
  );
};

const buttonStyle = "py-2 border rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-2";


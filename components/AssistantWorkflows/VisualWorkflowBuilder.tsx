import React, { useState, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  IconX, IconSearch, IconPlus, IconGripVertical, IconTrash, IconSettings, IconPlayerPlay,
  IconBraces, IconMail, IconDatabase, IconMessageCircle, IconBrain,
  IconFileText, IconChartBar, IconPuzzle, IconArrowDown, IconCheck,
  IconAlertTriangle, IconTool, IconRotateClockwise, IconHelp, IconChevronDown, IconChevronUp,
  IconFiles,
  IconActivity,
  IconSettingsAutomation,
  IconLoader2,
  IconTools,
  IconEdit
} from '@tabler/icons-react';
import { snakeCaseToTitleCase } from '@/utils/app/data';
import { createToolItemsForVisualBuilder } from '@/utils/toolItemFactory';
// import getOperationIcon from the correct location
import { getOperationIcon } from '@/utils/app/integrations';
import { AstWorkflow, Step } from '@/types/assistantWorkflows';
import { OpDef } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
import HomeContext from '@/pages/api/home/home.context';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import { ToolSelectorModal, ToolItem, ToolSelectorModalProps } from './ToolSelectorModal';
import { ToolSelectorPanel } from './ToolSelectorPanel';
import { filterTags } from './ToolSelectorCore';
import StepEditor from './StepEditor';
import { registerAstWorkflowTemplate, updateAstWorkflowTemplate } from '@/services/assistantWorkflowService';
import { toast } from 'react-hot-toast';
import { getSegmentColor } from '@/utils/app/segmentColors';


interface VisualWorkflowBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workflow: AstWorkflow) => void;
  availableApis: OpDef[] | null;
  availableAgentTools: Record<string, AgentTool> | null;
  initialWorkflow?: AstWorkflow;
  forceReset?: boolean; // Force reset to clean state even if initialWorkflow exists
}


interface WorkflowStep extends Step {
  id: string;
  position: number;
  isEmpty?: boolean; // For steps created without tools
}


interface ToolReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentTool: string;
  newTool: ToolItem;
  stepName: string;
}



const ToolReplacementModal: React.FC<ToolReplacementModalProps> = ({
  isOpen, onClose, onConfirm, currentTool, newTool, stepName
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <IconRotateClockwise size={20} />
            Replace Tool in Step
          </h3>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-center gap-4 text-lg">
            <span className="font-medium">{currentTool}</span>
            <IconArrowDown size={20} className="text-gray-400" />
            <div className="flex items-center gap-2">
              {newTool.icon}
              <span className="font-medium">{newTool.name}</span>
            </div>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <IconAlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium mb-1">What will change:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Tool will change from &ldquo;{currentTool}&rdquo; to &ldquo;{newTool.name}&rdquo;</li>
                  <li>Parameters will be reset to {newTool.name} defaults</li>
                  <li>Previous parameter values will be lost</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <IconCheck size={16} className="text-green-600 dark:text-green-400 mt-0.5" />
              <div className="text-sm text-green-800 dark:text-green-200">
                <p className="font-medium mb-1">What will be preserved:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Step name: &ldquo;{stepName}&rdquo;</li>
                  <li>Step position in workflow</li>
                  <li>Action segment (if any)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Replace Tool
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};





interface StepCardProps {
  step: WorkflowStep;
  index: number;
  onEdit: (step: WorkflowStep) => void;
  onDelete: (stepId: string) => void;
  onMove: (stepId: string, direction: 'up' | 'down') => void;
  onToolReplace: (step: WorkflowStep, serializableToolData: any) => void;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ 
  step, index, onEdit, onDelete, onMove, onToolReplace, onReorder, canMoveUp, canMoveDown 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const getStepIcon = (toolName: string, isEmpty?: boolean) => {
    if (isEmpty) return <IconHelp size={20} className="text-orange-500" />;
    
    const IconComponent = getOperationIcon(toolName);
    return <IconComponent size={20} />;
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (step.tool === 'terminate') {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.setData('stepIndex', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    const stepIndex = e.dataTransfer.getData('stepIndex');
    const toolData = e.dataTransfer.getData('tool');
    
    if (stepIndex) {
      // This is a step reorder operation
      e.dataTransfer.dropEffect = 'move';
    } else if (toolData && step.tool !== 'terminate') {
      // This is a tool replacement operation
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const stepIndex = e.dataTransfer.getData('stepIndex');
    const toolData = e.dataTransfer.getData('tool');
    
    if (stepIndex) {
      // Handle step reordering
      const dragIndex = parseInt(stepIndex);
      if (dragIndex !== index && step.tool !== 'terminate') {
        onReorder(dragIndex, index);
      }
    } else if (toolData && step.tool !== 'terminate') {
      // Handle tool replacement
      const serializableToolData = JSON.parse(toolData);
      if (serializableToolData.name !== step.tool) {
        onToolReplace(step, serializableToolData);
      }
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const segmentColor = step.actionSegment ? getSegmentColor(step.actionSegment) : undefined;

  return (
    <div
      draggable={step.tool !== 'terminate'}
      className={`
        relative bg-white dark:bg-gray-800 border rounded-lg p-4 
        transition-all duration-200 cursor-pointer
        ${isHovered ? 'shadow-lg border-blue-300 dark:border-blue-600' : 'border-gray-200 dark:border-gray-700'}
        ${step.tool === 'terminate' ? 'opacity-75' : ''}
        ${isDragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
        ${step.isEmpty ? 'border-orange-300 dark:border-orange-600' : ''}
        ${isDragging ? 'opacity-50 transform rotate-2' : ''}
        ${step.tool !== 'terminate' ? 'hover:shadow-md' : ''}
      `}
      style={segmentColor ? { borderLeftColor: segmentColor, borderLeftWidth: '4px' } : {}}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onClick={() => onEdit(step)}
    >
      {/* Drag Handle */}
      <div 
        className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-40 hover:opacity-100"
        title="Drag to reorder steps (terminate step must remain last)"
      >
        <IconGripVertical size={16} className="text-gray-400" />
      </div>

      {/* Drop Indicator for Tool Replacement */}
      {isDragOver && step.tool !== 'terminate' && (
        <div 
          className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 border-dashed rounded-lg flex items-center justify-center"
          title="Drop a tool here to replace the current tool in this step"
        >
          <div className="text-blue-600 dark:text-blue-400 font-medium text-sm">
            Drop to replace tool
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="ml-6">
        <div className="flex items-center gap-3 mb-2">
          {getStepIcon(step.tool, step.isEmpty)}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {step.stepName || step.description || 'Unnamed Step'}
            </h4>
            <p className={`text-sm ${
              step.isEmpty 
                ? 'text-orange-600 dark:text-orange-400 font-medium' 
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {step.isEmpty ? 'No tool selected - click to configure' : step.tool || 'No tool selected'}
            </p>
          </div>
        </div>

        {/* Warning for empty steps */}
        {step.isEmpty && (
          <div 
            className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm mb-2"
            title="This step needs a tool selected to function properly. Click to configure."
          >
            <IconAlertTriangle size={16} />
            <span>Step needs a tool to function</span>
          </div>
        )}

        {/* Parameter Preview */}
        {!step.isEmpty && Object.keys(step.values || {}).length > 0 && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium">Values:</span>
            {Object.entries(step.values || {}).slice(0, 2).map(([key, value], index) => (
              <span key={key} className="ml-2">
                {key}: {String(value).substring(0, 20)}
                {String(value).length > 20 ? '...' : ''}
                {index < Math.min(1, Object.keys(step.values || {}).length - 1) ? ',' : ''}
              </span>
            ))}
            {Object.keys(step.values || {}).length > 2 && (
              <span className="ml-1">+{Object.keys(step.values || {}).length - 2} more</span>
            )}
          </div>
        )}

        {/* Action Segment Badge */}
        {step.actionSegment && (
          <div className="mt-2">
            <span 
              className="inline-block px-2 py-1 text-xs rounded-full text-white font-medium"
              style={{ backgroundColor: segmentColor }}
              title="Steps with the same segment name are grouped together and can be enabled/disabled as a unit when creating assistants"
            >
              {step.actionSegment}
            </span>
          </div>
        )}
      </div>

      {/* Hover Actions */}
      {isHovered && step.tool !== 'terminate' && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
          {canMoveUp && (
            <button
              onClick={(e) => { e.stopPropagation(); onMove(step.id, 'up'); }}
              className="p-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Move up"
            >
              <IconArrowDown size={14} className="rotate-180" />
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={(e) => { e.stopPropagation(); onMove(step.id, 'down'); }}
              className="p-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Move down"
            >
              <IconArrowDown size={14} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(step.id); }}
            className="p-1 rounded bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-400"
            title="Delete step"
          >
            <IconTrash size={14} />
          </button>
        </div>
      )}
    </div>
  );
};




const VisualWorkflowBuilder: React.FC<VisualWorkflowBuilderProps> = ({
  isOpen,
  onClose,
  onSave,
  availableApis,
  availableAgentTools,
  initialWorkflow,
  forceReset = false
}) => {
  const { state: { lightMode } } = useContext(HomeContext);
  
  // Workflow state
  const [workflow, setWorkflow] = useState<AstWorkflow>(() => ({
    templateId: '',
    name: initialWorkflow?.name || '',
    description: initialWorkflow?.description || '',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {},
    template: { steps: [] },
    isBaseTemplate: true,
    isPublic: false
  }));
  
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  
  // UI state
  const [leftPanelWidth, setLeftPanelWidth] = useState(320); // Default 320px (w-80)
  const [isResizing, setIsResizing] = useState(false);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);


  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    const minWidth = 240; // Minimum panel width
    const maxWidth = Math.min(600, window.innerWidth * 0.5); // Maximum panel width (50% of viewport or 600px, whichever is smaller)
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add event listeners for global mouse events during resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);
  
  // Modal states
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [showToolReplacement, setShowToolReplacement] = useState(false);
  const [showParameterConfig, setShowParameterConfig] = useState(false);
  const [toolPickerPosition, setToolPickerPosition] = useState<number>(0);
  const [replacementData, setReplacementData] = useState<{
    step: WorkflowStep;
    newTool: ToolItem;
  } | null>(null);
  const [configStep, setConfigStep] = useState<{
    step: WorkflowStep;
    tool: ToolItem;
    isNewStep?: boolean; // Flag to indicate if this is a newly created step
  } | null>(null);
  
  // Tool items state
  const [toolItems, setToolItems] = useState<ToolItem[]>([]);
  
  // Ref for step editor modal scroll container
  const stepEditorScrollRef = useRef<HTMLDivElement>(null);
  
  // Counter to force fresh StepEditor instance when modal reopens
  const [stepEditorResetCounter, setStepEditorResetCounter] = useState(0);
  
  // Handle closing parameter config modal and resetting AI state
  const handleCloseParameterConfig = () => {
    setShowParameterConfig(false);
    // Increment counter to force fresh StepEditor instance (clears AI description)
    setStepEditorResetCounter(prev => prev + 1);
  };
  
  // Update workflow state when initialWorkflow prop changes
  useEffect(() => {
    if (initialWorkflow && !forceReset) {
      // Edit existing workflow
      setWorkflow({
        templateId: initialWorkflow.templateId || '',
        name: initialWorkflow.name || '',
        description: initialWorkflow.description || '',
        inputSchema: initialWorkflow.inputSchema || { type: 'object', properties: {} },
        outputSchema: initialWorkflow.outputSchema || {},
        template: initialWorkflow.template || { steps: [] },
        isBaseTemplate: initialWorkflow.isBaseTemplate !== undefined ? initialWorkflow.isBaseTemplate : true,
        isPublic: initialWorkflow.isPublic || false
      });
      
      // Convert template steps to workflow steps
      if (initialWorkflow.template?.steps) {
        const convertedSteps: WorkflowStep[] = initialWorkflow.template.steps.map((step, index) => ({
          ...step,
          id: `step-${index}`,
          position: index
        }));
        setWorkflowSteps(convertedSteps);
      } else {
        // Initialize with terminate step
        const terminateStep: WorkflowStep = {
          id: 'step-terminate',
          position: 0,
          stepName: 'done',
          description: 'Terminate the conversation',
          tool: 'terminate',
          instructions: 'Terminate the conversation and provide a conclusion.',
          args: { message: '<fill in with conclusion message>' },
          values: {}
        };
        setWorkflowSteps([terminateStep]);
      }
    } else {
      // Create new workflow or force reset - reset to clean state
      setWorkflow({
        templateId: '',
        name: '',
        description: '',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: {},
        template: { steps: [] },
        isBaseTemplate: true,
        isPublic: false
      });
      
      // Initialize with terminate step only
      const terminateStep: WorkflowStep = {
        id: 'step-terminate',
        position: 0,
        stepName: 'done',
        description: 'Terminate the conversation',
        tool: 'terminate',
        instructions: 'Terminate the conversation and provide a conclusion.',
        args: { message: '<fill in with conclusion message>' },
        values: {}
      };
      setWorkflowSteps([terminateStep]);
    }
  }, [initialWorkflow, forceReset]);

  // Reset state when modal opens for a new workflow or force reset
  useEffect(() => {
    if (isOpen && (!initialWorkflow || forceReset)) {
      // Reset to clean state for new workflow
      setWorkflow({
        templateId: '',
        name: '',
        description: '',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: {},
        template: { steps: [] },
        isBaseTemplate: true,
        isPublic: false
      });
      
      // Initialize with terminate step only
      const terminateStep: WorkflowStep = {
        id: 'step-terminate',
        position: 0,
        stepName: 'done',
        description: 'Terminate the conversation',
        tool: 'terminate',
        instructions: 'Terminate the conversation and provide a conclusion.',
        args: { message: '<fill in with conclusion message>' },
        values: {}
      };
      setWorkflowSteps([terminateStep]);
      
      // Reset UI state as well
      setShowToolPicker(false);
      setShowToolReplacement(false);
      setShowParameterConfig(false);
      setConfigStep(null);
      setReplacementData(null);
    }
  }, [isOpen, initialWorkflow, forceReset]);
  
  // Reset step editor modal scroll position when opened
  useEffect(() => {
    if (showParameterConfig && stepEditorScrollRef.current) {
      // Reset scroll to top when modal opens
      stepEditorScrollRef.current.scrollTop = 0;
    }
  }, [showParameterConfig]);
  
  // Initialize tool items
  useEffect(() => {
    const items = createToolItemsForVisualBuilder(availableApis, availableAgentTools);
    setToolItems(items);
  }, [availableApis, availableAgentTools]);
  
  
  
  // Filter out terminate tool - it's automatically managed
  const availableTools = toolItems.filter(tool => tool.name !== 'terminate');
  
  const createStepFromTool = (toolItem: ToolItem): WorkflowStep => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      position: 0,
      stepName: toolItem.name.toLowerCase().replace(/\s+/g, '_'),
      description: '',
      tool: toolItem.name,
      instructions: '',
      args: {},
      values: {}
    };
    
    // Add parameter templates from tool
    if (toolItem.parameters?.properties) {
      Object.entries(toolItem.parameters.properties).forEach(([paramName, paramInfo]: [string, any]) => {
        newStep.args[paramName] = paramInfo.description || `Instructions for ${paramName}`;
      });
    }
    
    return newStep;
  };
  
  
  const handleToolSelect = (tool: ToolItem) => {
    if (toolPickerPosition !== undefined) {
      const stepToUpdate = workflowSteps[toolPickerPosition];
      if (stepToUpdate) {
        const updatedStep = createStepFromTool(tool);
        updatedStep.id = stepToUpdate.id;
        updatedStep.position = stepToUpdate.position;
        updatedStep.stepName = stepToUpdate.stepName || updatedStep.stepName;
        updatedStep.description = stepToUpdate.description || updatedStep.description;
        updatedStep.actionSegment = stepToUpdate.actionSegment;
        updatedStep.isEmpty = false;
        
        const newSteps = [...workflowSteps];
        newSteps[toolPickerPosition] = updatedStep;
        setWorkflowSteps(newSteps);
        
        // Show parameter configuration modal
        setConfigStep({ step: updatedStep, tool, isNewStep: true });
        setShowParameterConfig(true);
      }
    }
    setShowToolPicker(false);
  };
  
  const handleToolReplace = (step: WorkflowStep, serializableToolData: any) => {
    // Find the complete tool item from the available toolItems array
    const newTool = toolItems.find(t => t.id === serializableToolData.id || t.name === serializableToolData.name);
    if (newTool) {
      setReplacementData({ step, newTool });
      setShowToolReplacement(true);
    }
  };
  
  const handleConfirmReplacement = () => {
    if (replacementData) {
      const { step, newTool } = replacementData;
      
      // Create a clean step with the new tool, clearing all user-editable fields
      const updatedStep = createStepFromTool(newTool);
      // Preserve only the essential step metadata
      updatedStep.id = step.id;
      updatedStep.position = step.position;
      updatedStep.actionSegment = step.actionSegment;
      // Clear user fields (stepName, description, instructions, args, values are reset by createStepFromTool)
      
      const newSteps = [...workflowSteps];
      const stepIndex = newSteps.findIndex(s => s.id === step.id);
      if (stepIndex !== -1) {
        newSteps[stepIndex] = updatedStep;
        setWorkflowSteps(newSteps);
        
        // Automatically open Step Editor for the user to configure the new tool
        setConfigStep({ step: updatedStep, tool: newTool, isNewStep: false });
        setShowParameterConfig(true);
      }
    }
    setShowToolReplacement(false);
    setReplacementData(null);
  };
  
  const handleStepEdit = (step: WorkflowStep) => {
    if (step.isEmpty) {
      setToolPickerPosition(step.position);
      setShowToolPicker(true);
    } else {
      const tool = toolItems.find(t => t.name === step.tool);
      if (tool) {
        setConfigStep({ step, tool, isNewStep: false });
        setShowParameterConfig(true);
      }
    }
  };

  const handleStepChange = (updatedStep: Step, stepId: string) => {
    const newSteps = [...workflowSteps];
    const stepIndex = newSteps.findIndex(s => s.id === stepId);
    if (stepIndex !== -1) {
      // Preserve WorkflowStep properties while updating Step properties
      const updatedWorkflowStep = {
        ...newSteps[stepIndex],
        ...updatedStep
      };
      newSteps[stepIndex] = updatedWorkflowStep;
      setWorkflowSteps(newSteps);
      
      // Update configStep if this is the step currently being edited
      if (configStep && configStep.step.id === stepId) {
        let updatedTool = configStep.tool;
        
        // If the tool changed, find the new tool item
        if (updatedStep.tool && updatedStep.tool !== configStep.step.tool) {
          const newToolItem = toolItems.find(t => t.name === updatedStep.tool);
          if (newToolItem) {
            updatedTool = newToolItem;
          }
        }
        
        setConfigStep({
          ...configStep,
          step: updatedWorkflowStep,
          tool: updatedTool
        });
      }
    }
  };

  
  const handleStepDelete = (stepId: string) => {
    setWorkflowSteps(prev => prev.filter(step => step.id !== stepId));
  };
  
  const handleStepMove = (stepId: string, direction: 'up' | 'down') => {
    const stepIndex = workflowSteps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) return;
    
    const newIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (newIndex < 0 || newIndex >= workflowSteps.length) return;
    
    const newSteps = [...workflowSteps];
    [newSteps[stepIndex], newSteps[newIndex]] = [newSteps[newIndex], newSteps[stepIndex]];
    
    // Update positions
    newSteps.forEach((step, index) => {
      step.position = index;
    });
    
    setWorkflowSteps(newSteps);
  };

  const handleStepReorder = (dragIndex: number, hoverIndex: number) => {
    const newSteps = [...workflowSteps];
    const draggedStep = newSteps[dragIndex];
    
    // Remove the dragged step
    newSteps.splice(dragIndex, 1);
    
    // Insert it at the hover position
    newSteps.splice(hoverIndex, 0, draggedStep);
    
    // Update positions
    newSteps.forEach((step, index) => {
      step.position = index;
    });
    
    setWorkflowSteps(newSteps);
  };

  const handleAddStep = () => {
    const emptyStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      position: workflowSteps.length,
      stepName: '',
      description: '',
      tool: '',
      instructions: '',
      args: {},
      values: {},
      isEmpty: true
    };
    
    // Find the terminate step and insert before it
    const terminateIndex = workflowSteps.findIndex(step => step.tool === 'terminate');
    const newSteps = [...workflowSteps];
    
    if (terminateIndex !== -1) {
      newSteps.splice(terminateIndex, 0, emptyStep);
    } else {
      newSteps.push(emptyStep);
    }
    
    // Update positions
    newSteps.forEach((step, index) => {
      step.position = index;
    });
    
    setWorkflowSteps(newSteps);
    
    // Show tool picker for the new empty step
    setToolPickerPosition(terminateIndex !== -1 ? terminateIndex : newSteps.length - 1);
    setShowToolPicker(true);
  };

  const handleToolDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const toolData = e.dataTransfer.getData('tool');
    if (toolData) {
      const serializableToolData = JSON.parse(toolData);
      // Find the complete tool item from the available toolItems array
      const toolItem = toolItems.find(t => t.id === serializableToolData.id || t.name === serializableToolData.name);
      
      if (toolItem) {
        // Create a new step from the dropped tool
        const newStep = createStepFromTool(toolItem);
        
        // Find the terminate step and insert before it
        const terminateIndex = workflowSteps.findIndex(step => step.tool === 'terminate');
        const newSteps = [...workflowSteps];
        
        if (terminateIndex !== -1) {
          newSteps.splice(terminateIndex, 0, newStep);
        } else {
          newSteps.push(newStep);
        }
        
        // Update positions
        newSteps.forEach((step, index) => {
          step.position = index;
        });
        
        setWorkflowSteps(newSteps);
        
        // Show parameter configuration modal for the new step
        const stepPosition = terminateIndex !== -1 ? terminateIndex : newSteps.length - 1;
        setConfigStep({ step: newSteps[stepPosition], tool: toolItem, isNewStep: true });
        setShowParameterConfig(true);
      }
    }
  };
  
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      
      // Validate workflow name
      if (!workflow.name.trim()) {
        setSaveError('Workflow name is required');
        setIsSaving(false);
        return;
      }
      
      // Convert workflow steps back to regular steps
      const steps: Step[] = workflowSteps
        .filter(step => !step.isEmpty) // Filter out empty steps
        .map(({ id, position, isEmpty, ...step }) => step);
      
      // Validate steps exist
      if (!steps.length) {
        setSaveError('Workflow must have at least one step');
        setIsSaving(false);
        return;
      }
      
      // Validate steps exist other than terminate step
      const nonTerminateSteps = steps.filter(
        step => step.tool !== 'terminate' && step.stepName !== 'done'
      );
      
      if (nonTerminateSteps.length === 0) {
        setSaveError('Workflow must have at least one non-terminate step');
        setIsSaving(false);
        return;
      }
      
      // Validate each step has required fields
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isTerminate = step.tool === 'terminate';
        
        if (!isTerminate) {
          if (!step.description?.trim()) {
            setSaveError(`Step ${i+1} is missing a description`);
            setIsSaving(false);
            return;
          }
          
          if (!step.tool?.trim()) {
            setSaveError(`Step ${i+1} is missing a tool`);
            setIsSaving(false);
            return;
          }
          
          if (!step.instructions?.trim()) {
            setSaveError(`Step ${i+1} is missing instructions`);
            setIsSaving(false);
            return;
          }
        }
      }
      
      // Ensure terminateStep is the last step
      const lastStep = steps[steps.length - 1];
      if (lastStep.tool !== 'terminate') {
        setSaveError('The last step must be a terminate step');
        setIsSaving(false);
        return;
      }
      
      const updatedWorkflow: AstWorkflow = {
        ...workflow,
        template: { steps }
      };
      
      const isBaseTemplate = true;
      let response;
    
      if (updatedWorkflow.templateId && updatedWorkflow.templateId.trim() !== '') {
        // Update existing template
        response = await updateAstWorkflowTemplate(
          updatedWorkflow.templateId,
          updatedWorkflow.template ?? { steps: [] },
          updatedWorkflow.name,
          updatedWorkflow.description,
          updatedWorkflow.inputSchema,
          updatedWorkflow.outputSchema,
          isBaseTemplate,
          updatedWorkflow.isPublic
        );
      } else {
        // Register new template
        response = await registerAstWorkflowTemplate(
          updatedWorkflow.template ?? { steps: [] },
          updatedWorkflow.name,
          updatedWorkflow.description,
          updatedWorkflow.inputSchema,
          updatedWorkflow.outputSchema,
          isBaseTemplate,
          updatedWorkflow.isPublic
        );
      }
      
      if (response.success && response.data) {
        toast.success("Successfully saved workflow template");
        
        // Don't call onSave - we've already saved directly to the backend
        // Just close the modal since the workflow has been persisted
        onClose();
      } else {
        setSaveError(response.message || 'Failed to save workflow template');
        console.error(response.message);
      }
    } catch (err) {
      setSaveError('An error occurred while saving the workflow');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isOpen) return null;
  
  const modalContent = (
    <div className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-7xl w-full mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <IconPuzzle size={24} />
            Visual Workflow Template Builder
          </h3>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <IconX size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tool Palette - Left Panel */}
          <ToolSelectorPanel
            tools={availableTools}
            onSelect={handleToolSelect}
            width={leftPanelWidth}
          />
          
          {/* Resize Handle */}
          <div
            className={`w-1 bg-gray-300 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-all duration-150 ${
              isResizing ? 'bg-blue-500 dark:bg-blue-400 w-2' : ''
            }`}
            onMouseDown={handleMouseDown}
            title="Drag to resize Tool Selection panel"
          >
            {/* Optional: Add subtle grip dots for visual hint */}
            <div className="h-full w-full flex items-center justify-center">
              <div className="flex flex-col space-y-1 opacity-0 hover:opacity-60 transition-opacity">
                <div className="w-0.5 h-1 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                <div className="w-0.5 h-1 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                <div className="w-0.5 h-1 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
              </div>
            </div>
          </div>
          
          {/* Workflow Template Canvas - Right Panel */}
          <div className="flex-1 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <IconPuzzle size={20} className="text-purple-600 dark:text-purple-400" />
                    Workflow Template Canvas
                  </h3>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    initialWorkflow?.templateId 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {initialWorkflow?.templateId ? 'Editing' : 'New'}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Configure your workflow template details and arrange steps</p>
              
              {/* Workflow Name Input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                  Workflow Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={workflow.name}
                  onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter a descriptive name for your workflow..."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  title="Give your workflow template a descriptive name that clearly explains what it does"
                />
                {!workflow.name.trim() && (
                  <p className="text-xs text-red-500 mt-1">Workflow name is required</p>
                )}
              </div>

              {/* Workflow Description */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
                  Description
                </label>
                <textarea
                  value={workflow.description}
                  onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this workflow does..."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  title="Describe what this workflow accomplishes and when to use it"
                />
              </div>

              {/* Accessibility Checkbox */}
              <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <div title="Make this template available to all Amplify users, not just you">
                  <Checkbox
                    id="isPublic"
                    label="Accessible to any Amplify user"
                    checked={workflow.isPublic || false}
                    onChange={(checked) => setWorkflow(prev => ({ ...prev, isPublic: checked }))}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">When enabled, other users can discover and use this template</p>
              </div>
              
            </div>
            
            {/* Visual separator with gradient */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
              <div className="max-w-xl mx-auto space-y-3">
                {/* Header with Add Step button */}
                <div className="relative mb-4">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                      <IconPlayerPlay size={14} />
                      Workflow Start
                    </div>
                  </div>
                  
                  <button
                    onClick={handleAddStep}
                    className="absolute right-0 top-0 flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                    title="Add a new step before the terminate step"
                  >
                    <IconPlus size={16} />
                    Add Step
                  </button>
                </div>
                
                {/* Workflow steps */}
                {workflowSteps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="mb-4">No steps in your workflow yet.</p>
                    <button 
                      onClick={handleAddStep}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <IconPlus size={16} />
                      Add Your First Step
                    </button>
                  </div>
                ) : (
                  <>
                    {workflowSteps.map((step, index) => {
                      const isTerminateStep = step.tool === 'terminate';
                      
                      return (
                        <React.Fragment key={step.id}>
                          {/* Arrow between steps (but not before terminate step since drop zone handles that) */}
                          {index > 0 && !isTerminateStep && (
                            <div className="flex justify-center">
                              <IconArrowDown size={16} className="text-gray-400" />
                            </div>
                          )}
                          
                          {/* Drop Zone before terminate step */}
                          {isTerminateStep && (
                            <>
                              <div className="flex justify-center my-3">
                                <IconArrowDown size={16} className="text-gray-400" />
                              </div>
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'copy';
                                }}
                                onDrop={handleToolDrop}
                                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                                title="Drag tools from the left panel here to create new workflow steps"
                              >
                                <IconPlus size={24} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-medium">Drop Zone</p>
                                <p className="text-sm font-medium">Drag tools here to add new steps</p>
                                <p className="text-xs mt-1">or use the &quot;Add Step&quot; button above</p>
                              </div>
                              <div className="flex justify-center my-3">
                                <IconArrowDown size={16} className="text-gray-400" />
                              </div>
                            </>
                          )}
                          
                          <StepCard
                            step={step}
                            index={index}
                            onEdit={handleStepEdit}
                            onDelete={handleStepDelete}
                            onMove={handleStepMove}
                            onToolReplace={handleToolReplace}
                            onReorder={handleStepReorder}
                            canMoveUp={index > 0}
                            canMoveDown={index < workflowSteps.length - 1 && step.tool !== 'terminate'}
                          />
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
                
                {/* End indicator */}
                {workflowSteps.some(step => step.tool === 'terminate') && (
                  <div className="text-center mt-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
                      <IconCheck size={14} />
                      Workflow End
                    </div>
                  </div>
                )}
              </div>
              
              {/* Workflow Template Canvas Footer - Error Display & Action Buttons */}
              <div className="border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 mt-4">
                {/* Error Display */}
                {saveError && (
                  <div className="mb-3">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-md text-sm">
                      <div className="flex items-start gap-2">
                        <IconAlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">Save Failed</div>
                          <div className="mt-1">{saveError}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {workflowSteps.filter(s => s.tool !== 'terminate').length} steps configured
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      disabled={isSaving}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        isSaving 
                          ? 'text-gray-400 bg-gray-200 dark:bg-gray-600 cursor-not-allowed'
                          : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !workflow.name.trim()}
                      className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center gap-2 ${
                        isSaving || !workflow.name.trim()
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                      }`}
                    >
                      {isSaving && <IconLoader2 size={16} className="animate-spin" />}
                      {isSaving ? 'Saving...' : 'Save Workflow'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Minimal Footer - Removed buttons/errors, moved to Workflow Template Canvas */}
        <div className="h-2"></div>
      </div>
      
      {/* Modals */}
      <ToolSelectorModal
        isOpen={showToolPicker}
        onClose={() => setShowToolPicker(false)}
        onSelect={handleToolSelect}
        tools={toolItems.filter(t => t.name !== 'terminate')}
        title="Select Tool for Step"
        showAdvancedFiltering={false}
        showClearSearch={false}
      />
      
      <ToolReplacementModal
        isOpen={showToolReplacement}
        onClose={() => setShowToolReplacement(false)}
        onConfirm={handleConfirmReplacement}
        currentTool={replacementData?.step.tool || ''}
        newTool={replacementData?.newTool || toolItems[0]}
        stepName={replacementData?.step.stepName || replacementData?.step.description || 'Step'}
      />
      
      {configStep && (
        <div className={`fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 ${showParameterConfig ? '' : 'hidden'}`}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <IconSettings size={20} />
                Configure Step: {configStep.step.stepName || configStep.step.description || 'Step'}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6" ref={stepEditorScrollRef}>
              <StepEditor
                key={`step-editor-${configStep.step.id}-${stepEditorResetCounter}`}
                step={configStep.step}
                stepIndex={workflowSteps.findIndex(s => s.id === configStep.step.id)}
                onStepChange={(updatedStep) => handleStepChange(updatedStep, configStep.step.id)}
                availableApis={availableApis}
                availableAgentTools={availableAgentTools}
                isTerminate={configStep.step.tool === 'terminate'}
                allowToolSelection={true}
                isNewStep={configStep.isNewStep || false}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={handleCloseParameterConfig}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseParameterConfig}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  return createPortal(modalContent, document.body);
};

export default VisualWorkflowBuilder;
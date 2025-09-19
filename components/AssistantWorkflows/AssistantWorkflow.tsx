// Display a Workflow 

import { AstWorkflow, Step } from "@/types/assistantWorkflows";
import { useState, useEffect, useContext, useRef } from "react";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import { IconBulb, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";
import { camelCaseToTitle, capitalize } from "@/utils/app/data";
import cloneDeep from 'lodash/cloneDeep';
import InputsMap from "../ReusableComponents/InputMap";
import { rebuildWorkflowFromBase } from "@/utils/app/assistantWorkflows";
import ExpansionComponent from "../Chat/ExpansionComponent";
import { getSegmentColor } from "@/utils/app/segmentColors";

interface WorkflowProps {
    id: string;
    workflowTemplate: AstWorkflow;
    originalBaseWorkflowTemplate?: AstWorkflow; // used to preserve original args when enable customization is true
    enableCustomization: boolean;
    onWorkflowTemplateUpdate: (workflowTemplate: AstWorkflow) => void;
    computedDisabledSegments?: () => string[];
    obfuscate?: boolean;
}
  
export const AssistantWorkflow: React.FC<WorkflowProps> = ({ 
    id,
    workflowTemplate,
    originalBaseWorkflowTemplate,
    onWorkflowTemplateUpdate,
    enableCustomization,
    computedDisabledSegments = () => [],
    obfuscate
  }) => {
    const { state: {featureFlags} } = useContext(HomeContext);
    
    const [disabledActionSegments, setDisabledActionSegments] = useState<string[]>([]);
    const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({});
    const [internalTemplate, setInternalTemplate] = useState(cloneDeep(workflowTemplate));

    const groupSteps = (template: AstWorkflow) => {
      return template.template?.steps.reduce((groups, step) => {
        const segment = step.actionSegment || 'default';
        if (!groups[segment]) {
          groups[segment] = [];
        }
        groups[segment].push(step);
        return groups;
      }, {} as Record<string, Step[]>) || {};
    } 
    const [groupedSteps, setGroupedSteps] = useState<Record<string, Step[]>>(groupSteps(internalTemplate)?? {});


    useEffect(() => {
      const displayTemplate = rebuildWorkflowFromBase(workflowTemplate, internalTemplate);
      setGroupedSteps(groupSteps(displayTemplate));
      onWorkflowTemplateUpdate(internalTemplate);
      // console.log("\n\nUPDATED INTERNAL", internalTemplate.template?.steps);
    },[internalTemplate]);


    useEffect(() => {
        // Only update if the template ID or version changes
        if (workflowTemplate?.templateId !== internalTemplate?.templateId) {
            setInternalTemplate(cloneDeep(workflowTemplate));
        }
    }, [workflowTemplate?.templateId]);
  


    const updateInternalWithDisabledSegments = (disabledSegments: string[]) => {
      const updatedTemplate = cloneDeep(workflowTemplate);
      if (!updatedTemplate.template?.steps) return false;
      const newSteps = updatedTemplate.template.steps.map(originalStep => {
        const segment = originalStep.actionSegment || 'default';
        // If this segment is disabled, skip this step
        if (disabledSegments.includes(segment)) return null;
        if (segment === 'default') return originalStep; // will never have changes to preserve
        
        // Check if this step exists in the current internalTemplate
        // so we can preserve any modifications to args
        const currentStepIndex = findStepInTemplate(internalTemplate, originalStep);
        if (currentStepIndex !== undefined && currentStepIndex !== -1) {
          return internalTemplate.template?.steps[currentStepIndex];
        }

        // If not in internalTemplate, check if it exists in groupedSteps
        // internal and groupedStep both preservce any arg modifications
        if (segment in groupedSteps) {
          // Find matching step in the grouped steps for this segment
          const matchingStep = groupedSteps[segment].find(s => 
            s.tool === originalStep.tool && 
            s.description === originalStep.description &&
            s.instructions === originalStep.instructions
          );
          
          if (matchingStep) return matchingStep;
        }
    
        return originalStep;
      }).filter(step => step !== null) as Step[];

      updatedTemplate.template.steps = newSteps;
      setInternalTemplate(updatedTemplate);
      return true;
    }

    useEffect(() => {
        // Only call update if this is the initial mount
        if (enableCustomization) {
            const calcDisabledSegments = computedDisabledSegments();
            setDisabledActionSegments(calcDisabledSegments);
            updateInternalWithDisabledSegments(calcDisabledSegments);
        }
    }, [ enableCustomization ]);  


    // Toggle segment enabled/disabled state
    const toggleSegmentEnabled = (segment: string, enabled: boolean) => {
      const disabledSegments = enabled ? disabledActionSegments.filter(s => s !== segment) 
                                       : [...disabledActionSegments, segment];
      setDisabledActionSegments(disabledSegments);
      updateInternalWithDisabledSegments(disabledSegments);
    };

    // Toggle segment expanded/collapsed state
    const toggleSegmentExpanded = (segment: string) => {
      setExpandedSegments(prev => ({
        ...prev,
        [segment]: !prev[segment] // Default false (collapsed)
      }));
    };


    // Function to format segment names for display
    const formatSegmentName = (segment: string): string => {
      if (segment === 'default') return 'Default Actions';
      // Split on special characters (-, _, .) and spaces
      const words = segment.split(/[-_.\s]+/);
      return words.map(word => capitalize(word)).join(' ');
    };

    if (!workflowTemplate || !workflowTemplate.template) {
      return <div className="text-sm text-neutral-500 dark:text-neutral-400 italic">No workflow template available</div>;
    }
    
    const findStepInTemplate = (template: AstWorkflow, step: Step) => {
      return template.template?.steps.findIndex(s => 
        s.tool === step.tool && 
        s.stepName === step.stepName &&
        s.description === step.description &&
        s.actionSegment === step.actionSegment
      );
    
    }

    const handleArgChange = (step: Step, argKey: string, value: string) => {
      // Create a deep copy of the template to avoid direct state mutations
      const updatedTemplate = cloneDeep(internalTemplate);
      const stepIndex = findStepInTemplate(updatedTemplate, step);

      // Only update if we found the step
      if (stepIndex !== undefined  && stepIndex !== -1 && 
          updatedTemplate.template?.steps[stepIndex]?.args) {
        updatedTemplate.template.steps[stepIndex].args[argKey] = value;

        setInternalTemplate({...updatedTemplate});
      }
    };


    const renderEditableArgs = (step: Step, index: number, shift: string = "") => {
      const editableArgs = step.editableArgs || [];
      editableArgs.sort((a, b) => b.length - a.length);

      if (Object.keys(step.args).length === 0 || editableArgs.length === 0) return null;
      
      const originalTemplate = originalBaseWorkflowTemplate ?? workflowTemplate
      const originalStepIndex = findStepInTemplate(originalTemplate, step);
      if (originalStepIndex === undefined || originalStepIndex === -1) return null;

      const originalArgs = originalTemplate.template?.steps[originalStepIndex].args;

      const filteredArgs: Record<string, string> = {};
      editableArgs.forEach(argKey => {
        if (argKey in step.args) {
          filteredArgs[argKey] = step.args[argKey];
        }
      });
      // consider only allowing appending to the arg
      const inputs = Object.keys(filteredArgs).map(argKey => ({
        label: camelCaseToTitle(argKey), key: argKey, description: `Customize argument "${argKey}" value`, 
        disabled: !enableCustomization
      }));
      return (
        <div className={`${shift} my-3 pb-4 border-y border-neutral-300 dark:border-neutral-600 pt-3 ${!enableCustomization ? 'opacity-70' : ''}`}>
        <div 
          className="font-medium mb-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
          title="These argument instructions can be customized when adding this workflow to an assistant"
        >
          <IconBulb size={18} />
          {enableCustomization ? "Customizable " : ""}
          Argument Instructions
        </div>
        
        <InputsMap
          id={`${id}-${index}-args`}
          inputs={inputs}
          state={filteredArgs}
          inputChanged={(argKey, newValue) => {
            if (originalArgs) {
              const originalArgValue = originalArgs[argKey] ?? '';
              // remove duplicate original value from new value
              let newArgValue = newValue.slice(originalArgValue.length);
              newArgValue = `${originalArgValue }${newArgValue}`;
              handleArgChange(step, argKey, newArgValue);
            }
          }}
        />
      </div>
      ) ;
    }


    return (
      <div className="mt-4 mb-6" key={id}>
        <div className="text-sm text-black dark:text-neutral-200 mb-2">
          <span className="font-bold">Name:</span> {capitalize(internalTemplate.name)} 
        </div>
        
        {internalTemplate.description && (
          <div className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
            <span className="font-bold">Description:</span> {internalTemplate.description}
          </div>
        )}
        
        <div 
          className="text-sm text-neutral-700 dark:text-neutral-300 mb-4"
          title="Segments allow you to group related workflow steps together and enable/disable them as units"
        >
          <span className="font-bold">Workflow Segments:</span> Each segment groups related steps that will be executed together. Click the toggle icon to expand or collapse segment details.
        </div>
        
        <div className="space-y-3 mr-4">
          {Object.entries(groupedSteps).map(([segment, steps], index) => {
            const isDisabled = disabledActionSegments.includes(segment);
            const isExpanded = expandedSegments[segment] || false;
            const segmentTitle = segment !== 'default' ? formatSegmentName(segment) : 'Default Actions';
            const segmentColor = getSegmentColor(segment, true); // Use gray for default segments
            
            return (
              <div 
                key={segment} 
                className={`border rounded-lg border-neutral-300 dark:border-neutral-700 overflow-hidden ${isDisabled ? 'opacity-50' : ''}`}
                title={`Workflow segment: ${segmentTitle}. ${isDisabled ? 'This segment is disabled and will not execute.' : 'This segment is enabled and will execute normally.'}`}
              > 
                {/* Segment Header */}
                <div className={`flex items-center justify-between p-3 bg-neutral-50 dark:bg-[#2A2B32] border-b border-neutral-300 dark:border-neutral-700 ${isDisabled ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSegmentExpanded(segment)}
                      className="flex-shrink-0 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded"
                      title={isExpanded ? "Click to collapse and hide step details" : "Click to expand and show detailed step information"}
                    >
                      {isExpanded ? (
                        <IconChevronDown size={18} />
                      ) : (
                        <IconChevronRight size={18} />
                      )}
                    </button>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {segmentTitle}
                    </span>
                  </div>
                  {enableCustomization && segment !== 'default' && (
                    <div title="Enable or disable this entire group of workflow steps">
                      <Checkbox
                        id={`segment-${segment}`}
                        label=""
                        checked={!isDisabled}
                        onChange={(checked) => toggleSegmentEnabled(segment, checked)}
                      />
                    </div>
                  )}
                </div>

                {/* Segment Content */}
                <div className="p-3">
                  {isExpanded ? (
                    // Detailed view - full step information
                    <div className="space-y-3">
                      {steps.map((step, stepIndex) => (
                        <div 
                          key={stepIndex} 
                          className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4" 
                          style={{ borderLeftColor: segmentColor }}
                          title="Color coding shows which steps belong to the same functional group"
                        >
                          <div 
                            className="font-medium text-neutral-800 dark:text-neutral-200 mb-2"
                            title="Description of what this step does in the workflow"
                          >
                            • {step.description}
                          </div>
                          <div className="text-sm space-y-2">
                            <div title="The specific tool or API that will be executed in this step">
                              <span className="font-medium text-gray-600 dark:text-gray-400">Tool:</span>{' '}
                              <span className="text-gray-800 dark:text-gray-200">{step.tool}</span>
                            </div>
                            
                            {step.args && Object.keys(step.args).length > 0 && (
                              <div title="Instructions that guide how this step will be executed">
                                <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">Arguments:</div>
                                <ul className="list-disc pl-4 text-gray-700 dark:text-gray-300">
                                  {Object.entries(step.args).map(([key, value]) => (
                                    <li key={key}>{key}: {value}</li>
                                  ))}
                                </ul>
                                {renderEditableArgs(step, stepIndex)}
                              </div>
                            )}
                            
                            {step.values && Object.keys(step.values).length > 0 && (
                              <div title="Fixed parameter values that won't change during workflow execution">
                                <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">Values:</div>
                                <ul className="list-disc pl-4 text-gray-700 dark:text-gray-300">
                                  {Object.entries(step.values).map(([key, value]) => (
                                    <li key={key}>{key}: {value}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {step.instructions && (
                              <ExpansionComponent
                                title="Instructions"
                                content={
                                  <div className="text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">Instructions:</span> {step.instructions}
                                  </div>
                                }
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Collapsed view - simple step list
                    <div 
                      className="text-sm text-neutral-700 dark:text-neutral-300"
                      title="Click the expand button above to see detailed step information including tools, arguments, and values"
                    >
                      {steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="mb-2 last:mb-0">
                          • {step.description}
                          {renderEditableArgs(step, stepIndex, "ml-3")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
}
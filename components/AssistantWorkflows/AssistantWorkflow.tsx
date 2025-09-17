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
    const [obfuscateSteps, setObfuscateSteps] = useState<boolean>(obfuscate ?? !featureFlags.assistantWorkflows);
    const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
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
      if (obfuscate !== undefined) setObfuscateSteps(obfuscate);
  }, [obfuscate]);

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
        <div className="font-medium mb-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
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
        
        <div className="border rounded-lg border-neutral-300 dark:border-neutral-700 overflow-hidden mr-4"
        >
          {Object.entries(groupedSteps).map(([segment, steps], index) => {
            const isDisabled = disabledActionSegments.includes(segment);
            
            const segmentTitle = segment !== 'default' ? formatSegmentName(segment) : 'Default Actions';
            const segmentDescription = steps[0]?.description || '';
            
            return (
              <div 
                key={segment} 
                className={`border-b border-neutral-300 dark:border-neutral-700 last:border-b-0 ${isDisabled ? 'opacity-50' : ''}`}
                > 
                <div className={`gap-1 items-center px-3 pb-4 bg-neutral-100 dark:bg-[#2A2B32] cursor-pointer 
                                 ${ expandedSteps.includes(index) ?"" : "hover:bg-neutral-200 dark:hover:bg-[#343541]"} ${isDisabled ? 'opacity-70' : ''}`}>
              
                  <div className="flex flex-col w-full flex-grow">
                    <div className="relative">
                      {segmentDescription && (
                        <div className="absolute text-sm text-neutral-600 dark:text-neutral-400 truncate"
                             style={{transform: 'translateY(32px) translateX(24px)', maxWidth: window.innerWidth * 0.5}}>
                          {segmentDescription}
                        </div>
                      )}
                      {enableCustomization && segment !== 'default' && (
                        <div  className="absolute right-1 mt-4"
                              onClick={e => e.stopPropagation()} 
                           >
                          <Checkbox
                            id={`segment-${segment}`}
                            label=""
                            checked={!isDisabled}
                            onChange={(checked) => toggleSegmentEnabled(segment, checked)}
                          />
                        </div>
                      )}
                    </div>
                    <ExpansionComponent
                      isOpened={obfuscateSteps || typeof obfuscate === 'boolean'}
                      title={segmentTitle}
                      content={ <div className="py-3 mt-5 bg-gray-200 dark:bg-[#22232b] p-2">
                          {obfuscateSteps ? (
                            // Simplified view (obfuscated)
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                              {steps.map((step, index) => (
                                <div key={index} className="mb-2 last:mb-0">
                                  • {step.description}
                                  {renderEditableArgs(step, index, "ml-3")}
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Detailed view
                            <div>
                              {steps.map((step, index) => (
                                <div key={index} className="mb-4 last:mb-0 p-2 border-l-2 border-neutral-300 dark:border-neutral-700 pl-3">
                                  <div className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                                  • {step.description}
                                  </div>
                                  <div className="text-xs bg-gray-300 dark:bg-[#343541] p-2 rounded">
                                    
                                    <div className="mb-1"><span className="font-medium">Tool:</span> {step.tool}</div>
                                    
                                    {step.args && Object.keys(step.args).length > 0 && (
                                      <div className="mt-2">
                                        <div className="font-medium">Arguments:</div>
                                        <ul className="list-disc pl-4">
                                          {Object.entries(step.args).map(([key, value]) => (
                                            <li key={key}>{key}: {value}</li>
                                          ))}
                                        </ul>
                                        {renderEditableArgs(step, index)}
                                      </div>
                                    )}
                                    
                                    {step.values && Object.keys(step.values).length > 0 && (
                                      <div className="my-2">
                                        <div className="font-medium">Values:</div>
                                        <ul className="list-disc pl-4">
                                          {Object.entries(step.values).map(([key, value]) => (
                                            <li key={key}>{key}: {value}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                  <ExpansionComponent
                                    title={"Instructions"}
                                    content={<div><span className="font-medium">Instructions:</span> {step.instructions}</div>}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div> 
                      }
                      onOpen={() => setExpandedSteps([...expandedSteps, index])}
                      onClose={() => setExpandedSteps(expandedSteps.filter(i => i !== index))}
                      closedWidget={<IconChevronDown className="my-4 flex-shrink-0" size={18} />}
                      openWidget={<IconChevronRight className="my-4 flex-shrink-0" size={18} />}
                    />
                  </div>
                </div>
               
              </div>
            );
          })}
        </div>
      </div>
    );
}
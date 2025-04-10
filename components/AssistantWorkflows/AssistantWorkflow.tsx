// Display a Workflow 

import { AstWorkflow } from "@/types/assistantWorkflows";
import { useState, useEffect, useContext, useRef } from "react";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";
import { capitalize } from "@/utils/app/data";
import cloneDeep from 'lodash/cloneDeep';

interface WorkflowProps {
    id: string;
    workflowTemplate: AstWorkflow;
    enableCustomization: boolean;
    onWorkflowTemplateUpdate: (workflowTemplate: AstWorkflow) => void;
    computedDisabledSegments?: () => string[];
}
  
export const AssistantWorkflow: React.FC<WorkflowProps> = ({ 
    id,
    workflowTemplate,
    onWorkflowTemplateUpdate,
    enableCustomization,
    computedDisabledSegments = () => []
  }) => {
    const { state: {featureFlags} } = useContext(HomeContext);
    
    const [disabledActionSegments, setDisabledActionSegments] = useState<string[]>(computedDisabledSegments());
    const [expandedSegments, setExpandedSegments] = useState<string[]>([]);
    const [obfuscateSteps, setObfuscateSteps] = useState<boolean>(!featureFlags.assistantWorkflows);

    const [internalTemplate, setInternalTemplate] = useState(workflowTemplate);


    useEffect(() => {
        // Only update if the template ID or version changes
        if (workflowTemplate?.templateId !== internalTemplate?.templateId) {
            setInternalTemplate(cloneDeep(workflowTemplate));
        }
    }, [workflowTemplate?.templateId]);



    useEffect(() => {
        // Only call update if this is the initial mount
            const updatedTemplate = cloneDeep(internalTemplate);
            if (disabledActionSegments.length > 0 && updatedTemplate.template?.steps) {     
                updatedTemplate.template.steps = updatedTemplate.template.steps.filter(step => {
                    const segment = step.actionSegment || 'default';
                    return !disabledActionSegments.includes(segment);
                });
              }
                      
            onWorkflowTemplateUpdate(cloneDeep(updatedTemplate));
    }, [ enableCustomization ]);  
    
    // Group steps by actionSegment
    const groupedSteps = workflowTemplate.template?.steps.reduce((groups, step) => {
      const segment = step.actionSegment || 'default';
      if (!groups[segment]) {
        groups[segment] = [];
      }
      groups[segment].push(step);
      return groups;
    }, {} as Record<string, typeof workflowTemplate.template.steps>) || {};

    // Toggle segment expansion
    const toggleSegment = (segment: string) => {
      setExpandedSegments(prev => 
        prev.includes(segment) 
          ? prev.filter(s => s !== segment) 
          : [...prev, segment]
      );
    };

    // Toggle segment enabled/disabled state
    const toggleSegmentEnabled = (segment: string, enabled: boolean) => {
      setDisabledActionSegments(prev => 
        enabled
          ? prev.filter(s => s !== segment)
          : [...prev, segment]
      );
    };

    // Initialize expanded segments
    useEffect(() => {
      if (obfuscateSteps) {
        // Expand all segments by default when obfuscating
        setExpandedSegments(Object.keys(groupedSteps));
      } else {
        // Collapse all segments by default when not obfuscating
        setExpandedSegments([]);
      }
    }, [obfuscateSteps, workflowTemplate]);

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

    return (
      <div className="mt-4 mb-6" key={id}>
        <div className="text-sm font-bold text-black dark:text-neutral-200 mb-2">
          Workflow - {capitalize(workflowTemplate.name)} 
        </div>
        
        {workflowTemplate.description && (
          <div className="ml-1 text-sm text-neutral-700 dark:text-neutral-300 mb-4">
            {workflowTemplate.description}
          </div>
        )}
        
        <div className="border rounded-lg border-neutral-300 dark:border-neutral-700 overflow-hidden">
          {Object.entries(groupedSteps).map(([segment, steps]) => {
            const isExpanded = expandedSegments.includes(segment);
            const isDisabled = disabledActionSegments.includes(segment);
            
            // Get first step description as segment title if available
            const segmentTitle = segment !== 'default' ? formatSegmentName(segment) : 'Default Actions';
            const segmentDescription = steps[0]?.description || '';
            
            return (
              <div 
                key={segment} 
                className={`border-b border-neutral-300 dark:border-neutral-700 last:border-b-0 ${isDisabled ? 'opacity-50' : ''}`}
              >
                <div 
                  className="flex items-center p-3 bg-neutral-100 dark:bg-[#2A2B32] cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#343541]"
                  onClick={() => toggleSegment(segment)}
                >
                  {/* Expansion icon */}
                  <div className="mr-2">
                    {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                  </div>
                  
                  {/* Checkbox (when customization is enabled) */}
                  {enableCustomization && segment !== 'default' && (
                    <div onClick={e => e.stopPropagation()} className="mr-3">
                      <Checkbox
                        id={`segment-${segment}`}
                        label=""
                        checked={!isDisabled}
                        onChange={(checked) => toggleSegmentEnabled(segment, checked)}
                      />
                    </div>
                  )}
                  
                  {/* Segment title and description */}
                  <div className="flex-1">
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {segmentTitle}
                    </div>
                    {segmentDescription && (
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">
                        {segmentDescription}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Expanded content showing steps */}
                {isExpanded && (
                  <div className={`p-3 bg-white dark:bg-[#22232b] border-t border-neutral-300 dark:border-neutral-700 ${isDisabled ? 'opacity-50' : ''}`}>
                    {obfuscateSteps ? (
                      // Simplified view (obfuscated)
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        {steps.map((step, index) => (
                          <div key={index} className="mb-2 last:mb-0">
                            • {step.description}
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
                            <div className="text-xs bg-neutral-100 dark:bg-[#343541] p-2 rounded">
                              <div className="mb-1"><span className="font-medium">Tool:</span> {step.tool}</div>
                              <div><span className="font-medium">Instructions:</span> {step.instructions}</div>
                              
                              {step.args && Object.keys(step.args).length > 0 && (
                                <div className="mt-2">
                                  <div className="font-medium">Arguments:</div>
                                  <ul className="list-disc pl-4">
                                    {Object.entries(step.args).map(([key, value]) => (
                                      <li key={key}>{key}: {value}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {step.values && Object.keys(step.values).length > 0 && (
                                <div className="mt-2">
                                  <div className="font-medium">Values:</div>
                                  <ul className="list-disc pl-4">
                                    {Object.entries(step.values).map(([key, value]) => (
                                      <li key={key}>{key}: {value}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
}
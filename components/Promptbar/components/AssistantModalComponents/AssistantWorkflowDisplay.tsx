import { AssistantWorkflow } from "@/components/AssistantWorkflows/AssistantWorkflow";
import { getAstWorkflowTemplate } from "@/services/assistantWorkflowService";
import { AstWorkflow } from "@/types/assistantWorkflows";
import { computeDisabledSegments, rebuildWorkflowFromBase } from "@/utils/app/assistantWorkflows";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

// This component is very specific to Assistant Modal, which uses the other Workflow components that are more appropriate for reuse
interface WorkflowProps {
    baseWorkflowTemplateId: string | undefined;
    astWorkflowTemplateId: string | undefined;
    onWorkflowTemplateUpdate: (workflowTemplate: AstWorkflow | null) => void;
    disableEdit?: boolean;
}
  
export const AssistantWorkflowDisplay: React.FC<WorkflowProps> = ({ 
    baseWorkflowTemplateId, astWorkflowTemplateId, onWorkflowTemplateUpdate, disableEdit=false
  }) => {

    const getWorkflowTemplate = async (workflowTemplateId: string | undefined): Promise<any> => {
        if (!workflowTemplateId) return null;
        const response = await getAstWorkflowTemplate(workflowTemplateId);
        if (!response.success && 
            confirm("Error fetching workflow template, would you like to try to retrieve it again?")) {
            return getWorkflowTemplate(workflowTemplateId);
        }
        return response.success ? response.data : null;
    }
    // initial states
    const [baseWorkflowTemplate, setBaseWorkflowTemplate] = useState<AstWorkflow | null>(null);
    const [astWorkflowTemplate, setAstWorkflowTemplate] = useState<AstWorkflow | null>(null);
    const [loadingState, setLoadingState] = useState<{
        baseTemplate: boolean;
        astTemplate: boolean;
    }>({
        baseTemplate: !!baseWorkflowTemplateId, 
        astTemplate: !!astWorkflowTemplateId
    });

    const [editWorkflowTemplate, setEditWorkflowTemplate] = useState<boolean>(false);
    
   useEffect(() => {
        if (baseWorkflowTemplateId) {
            if (!baseWorkflowTemplate || 
                // to handle when base templates in selector has changed 
                (baseWorkflowTemplate.templateId !== baseWorkflowTemplateId)) {
                setLoadingState(prev => ({ ...prev, baseTemplate: true }));
                getWorkflowTemplate(baseWorkflowTemplateId).then((template) => {
                    setBaseWorkflowTemplate(template ?? null);
                    setLoadingState(prev => ({ ...prev, baseTemplate: false }));
                }); 
            }    
        } else {
            setBaseWorkflowTemplate(null);
            setLoadingState(prev => ({ ...prev, baseTemplate: false }));
        }
   }, [baseWorkflowTemplateId]);


   useEffect(() => {
       // runs once since astWorkflowTemplateId does not change to another template id
        if (astWorkflowTemplateId && !astWorkflowTemplate) {
            setLoadingState(prev => ({ ...prev, astTemplate: true }));
            getWorkflowTemplate(astWorkflowTemplateId).then((template) => {
               setAstWorkflowTemplate(template ?? null);
               setLoadingState(prev => ({ ...prev, astTemplate: false }));
            });
        } else if (!astWorkflowTemplateId) {
            setLoadingState(prev => ({ ...prev, astTemplate: false }));
        }
   }, [astWorkflowTemplateId]);



   const isLoading = loadingState.baseTemplate || loadingState.astTemplate;

    return <div className={`mt-2 w-full mb-4 ${baseWorkflowTemplate ? "border-b pb-3 border-neutral-500" : ""} `}>
    {isLoading || !baseWorkflowTemplate ? <> Loading Workflow Template...</>:
      <>
      {/* Initial Setup  */}
       { !astWorkflowTemplateId || (baseWorkflowTemplate && !astWorkflowTemplate) ?
        <div key={`initialBaseWorkflow`}>
            <AssistantWorkflow 
            id={"intialWorkflowSetup"}
            workflowTemplate={baseWorkflowTemplate} 
            enableCustomization={true && !disableEdit} 
            onWorkflowTemplateUpdate={onWorkflowTemplateUpdate}
        /></div> : <>
        <div className="relative">
            {!disableEdit &&
            <button className={"absolute right-2 text-xs flex items-center gap-2 rounded border border-neutral-500 px-3 py-2 text-neutral-800 dark:border-neutral-700 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700"}
                style={{transform: 'translateY(-10px)'}}
                onClick={() => {
                    if (editWorkflowTemplate && !confirm("Are you sure you want to discard workflow changes?")) return;
                        const newEditValue = !editWorkflowTemplate;
                        if (!newEditValue) onWorkflowTemplateUpdate(null);
                        setEditWorkflowTemplate(newEditValue);
                }}
            >   {editWorkflowTemplate ? 
                <> <IconTrash size={16} />  {"Discard Changes"}</> :
                <> <IconPencil size={16} /> {"Edit Template"}</>}
                
            </button>}

        </div>
        {baseWorkflowTemplate && astWorkflowTemplate && 
          (editWorkflowTemplate ?
            // Display the current workflow template setup only
            <div key={`EditingExistingWorkflow`}>
           <AssistantWorkflow 
            // We will use the base workflow and existing workflow template to create a new workflow template 
                id={"editExistingWorkflow"}
                workflowTemplate={rebuildWorkflowFromBase(baseWorkflowTemplate, astWorkflowTemplate)} 
                enableCustomization={true} 
                originalBaseWorkflowTemplate={{...baseWorkflowTemplate}}
                onWorkflowTemplateUpdate={onWorkflowTemplateUpdate}
                computedDisabledSegments={() => computeDisabledSegments(baseWorkflowTemplate, astWorkflowTemplate)}
            /> </div>
            : 
            <div key={`ExistingWorkflow`}>
            <AssistantWorkflow 
                id={"viewExistingWorkflow"}
                workflowTemplate={{...astWorkflowTemplate}} 
                enableCustomization={false}  // do nothing 
                onWorkflowTemplateUpdate={(workflowTemplate: AstWorkflow | null) => {}}
            /> </div>) 
        }
        </>
       }
      
      </>
    
    }
    
    </div>

  }


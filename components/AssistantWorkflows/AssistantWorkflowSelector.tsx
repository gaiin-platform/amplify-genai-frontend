import { listAstWorkflowTemplates } from "@/services/assistantWorkflowService";
import { AstWorkflow } from "@/types/assistantWorkflows";
import { snakeCaseToTitleCase } from "@/utils/app/data";
import { IconPlus } from "@tabler/icons-react";
import { useContext, useEffect, useState } from "react";
import { AssistantWorkflowBuilder } from "./AssistantWorkflowBuilder";
import HomeContext from "@/pages/api/home/home.context";
import { useSession } from "next-auth/react";


interface Props {
    selectedTemplateId: string | undefined;
    onTemplateChange: (workflowTemplateId: string) => void;
    disabled: boolean;
}
  
export const AssistantWorkflowSelector: React.FC<Props> = ({ 
    selectedTemplateId,
    onTemplateChange,
    disabled
  }) => {

    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [workflowTemplates, setWorkflowTemplates] = useState<AstWorkflow[] | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { state: {featureFlags} } = useContext(HomeContext);

    const allowWorkflowCreation = featureFlags.createAssistantWorkflows;

    const fetchAstWorkflowTemplates = async () => {      
            const response = await listAstWorkflowTemplates(true, true);
            const baseTemplates = response.success ? response.data?.templates ?? [] : [];
            // console.log("templates", templates);
            setWorkflowTemplates(baseTemplates);
    };

    useEffect(() => {
        if (workflowTemplates === null) fetchAstWorkflowTemplates();
    }, []);


    return ( 
        <>
        <div className="pr-1">
            <div className="mb-2 text-sm font-bold text-black dark:text-neutral-200">
                Base Assistant Workflow Template 
            </div>
            <div className="flex flex-row gap-3">
                <select className={`${workflowTemplates === null || workflowTemplates.length === 0 ? "opacity-40" : ""} mb-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 custom-shadow`} 
                    disabled={workflowTemplates === null || workflowTemplates.length === 0 || disabled}
                    value={selectedTemplateId ?? ''}
                    title='Add Workflow Template to assistant'
                    onChange={(event) => {
                        const templateId = event.target.value;
                        onTemplateChange(templateId);
                    }}
                > 
                    {workflowTemplates && workflowTemplates.map((template: AstWorkflow, index: number) => (
                        <option key={`${template.templateId}-${index}`} value={template.templateId}
                                title={`${template.description} ${template.user && template.user != userEmail ? `Provided by ${template.user}` : ""}`}>
                            {snakeCaseToTitleCase(template.name)}
                        </option>
                    ))}
                    { 
                    <option value={""}>
                        {workflowTemplates === null ? 'Loading Base Templates...' :
                        workflowTemplates.length === 0 ? 'No Available Base Templates' : 'Select Base Template'}
                    </option>
                    } 
                </select>

                { allowWorkflowCreation && !disabled &&
                    <button type="button" title='Add Workflow Template' style={{transform: "translateY(-3px)"}}
                        className="px-2 my-1 rounded-md border border-neutral-300 dark:border-white/20 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10 "
                        onClick={() => setIsModalOpen(true)}
                        id="baseAssistantWorkflowTemplateAdd"
                        disabled={disabled}
                    > <IconPlus size={18} />
                    </button>}
                
            </div>
        </div>
        { allowWorkflowCreation &&  
        <AssistantWorkflowBuilder 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onRegister={(template) => {
                if (template.isBaseTemplate) setWorkflowTemplates([...(workflowTemplates ?? []), template]);
            }} 
        />
        }
        </>)

  }


  
// Read-only workflow viewer for the chat input toolbar.
// Layout and styling mirrors OperationSelector.tsx (Actions / Action Sets) exactly.
// Left sidebar header style matches OperationSelector's bg-gray-100 header bar.
// Right panel shows Name / Description / Workflow Segments labels + <AssistantWorkflow />.

import { useEffect, useState, useRef } from 'react';
import { AstWorkflow } from '@/types/assistantWorkflows';
import { listAstWorkflowTemplates, getAstWorkflowTemplate } from '@/services/assistantWorkflowService';
import { AssistantWorkflow } from '@/components/AssistantWorkflows/AssistantWorkflow';
import {
    IconX,
    IconLoader2,
    IconCirclePlus,
    IconCheck,
    IconChevronRight,
    IconGitBranch,
} from '@tabler/icons-react';

interface Props {
    /** templateId of the currently attached workflow (if any) */
    selectedWorkflowId: string | null;
    /** Called when the user confirms a selection (or passes null to remove) */
    onSelect: (workflow: AstWorkflow | null) => void;
    /** Called when the panel should close */
    onClose: () => void;
}

const ChatWorkflowViewer: React.FC<Props> = ({ selectedWorkflowId, onSelect, onClose }) => {
    const [allTemplates, setAllTemplates] = useState<AstWorkflow[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<AstWorkflow | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [loadingSelectedWorkflow, setLoadingSelectedWorkflow] = useState(false);

    // In-memory cache — avoids re-fetching already-loaded templates
    const cacheRef = useRef<Record<string, AstWorkflow>>({});

    // fetchTemplates — mirrors AssistantWorkflowBuilder.fetchTemplates()
    useEffect(() => {
        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                const response = await listAstWorkflowTemplates(true, false);
                setAllTemplates(
                    response.success && response.data?.templates
                        ? response.data.templates
                        : []
                );
            } catch {
                setAllTemplates([]);
            } finally {
                setIsLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }, []);

    // handleLoadTemplate — mirrors AssistantWorkflowBuilder.handleLoadTemplate()
    const handleLoadTemplate = async (templateId: string) => {
        if (selectedTemplateId === templateId) {
            setSelectedTemplateId(null);
            setSelectedTemplate(null);
            return;
        }

        setLoadingSelectedWorkflow(true);
        setSelectedTemplateId(templateId);

        if (cacheRef.current[templateId]?.template?.steps?.length) {
            setSelectedTemplate(cacheRef.current[templateId]);
            setLoadingSelectedWorkflow(false);
            return;
        }

        const listItem = allTemplates.find(t => t.templateId === templateId);
        if (listItem?.template?.steps?.length) {
            cacheRef.current[templateId] = listItem;
            setSelectedTemplate(listItem);
            setLoadingSelectedWorkflow(false);
            return;
        }

        try {
            const response = await getAstWorkflowTemplate(templateId);
            if (response.success && response.data) {
                const full = response.data;
                cacheRef.current[templateId] = full;
                setAllTemplates(prev =>
                    prev.map(t => t.templateId === templateId ? full : t)
                );
                setSelectedTemplate(full);
            } else {
                setSelectedTemplateId(null);
                setSelectedTemplate(null);
            }
        } finally {
            setLoadingSelectedWorkflow(false);
        }
    };

    // ── Left sidebar — matches OperationSelector left pane style ────────────
    const renderSidebar = () => (
        <div className="w-1/2 border-r border-gray-300 dark:border-gray-700 overflow-auto bg-gray-50 dark:bg-[#2b2c35] flex flex-col">
            {/* Header bar — exact OperationSelector header style */}
            <div className="bg-gray-100 dark:bg-[#343541] px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center text-sm">
                    <IconGitBranch size={16} stroke={1.5} className="mr-2" />
                    Workflow Templates
                </h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Close"
                >
                    <IconX size={16} />
                </button>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto p-2">
                {isLoadingTemplates ? (
                    <div className="flex items-center justify-center p-6 text-neutral-500 dark:text-neutral-400 text-sm">
                        <IconLoader2 size={16} className="animate-spin mr-2" />
                        Loading templates...
                    </div>
                ) : allTemplates.length === 0 ? (
                    <div className="text-center p-6 text-neutral-500 dark:text-neutral-400 text-sm">
                        No templates available
                    </div>
                ) : (
                    <div className="space-y-1">
                        {allTemplates.map(template => (
                            <div
                                key={template.templateId}
                                className={`px-3 py-2 rounded-md cursor-pointer flex flex-col ${
                                    selectedTemplateId === template.templateId
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent'
                                }`}
                                onClick={() => handleLoadTemplate(template.templateId)}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                        {template.name}
                                    </span>
                                    {loadingSelectedWorkflow && selectedTemplateId === template.templateId && (
                                        <IconLoader2 size={12} className="animate-spin text-blue-400 flex-shrink-0" />
                                    )}
                                </div>
                                {template.description && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                        {template.description}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // ── Right panel — Name / Description / Segments labels + AssistantWorkflow ──
    const renderPreviewContent = () => (
        <div className="w-2/3 overflow-auto">
            <div className="p-6">
                {/* Header row — fixed title + Add/Remove button */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Workflow Template Preview</h3>
                    <div className="flex gap-2">
                        {selectedWorkflowId === selectedTemplate?.templateId ? (
                            <button
                                className="flex items-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 shadow-sm"
                                onClick={() => onSelect(null)}
                            >
                                <IconCheck size={16} stroke={1.5} className="mr-1 text-green-500" />
                                Remove Workflow
                            </button>
                        ) : (
                            <button
                                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 shadow-sm"
                                onClick={() => {
                                    if (selectedTemplate) {
                                        const full = cacheRef.current[selectedTemplate.templateId] ?? selectedTemplate;
                                        onSelect(full);
                                    }
                                }}
                            >
                                <IconCirclePlus size={16} stroke={1.5} className="mr-1" />
                                Add Workflow
                            </button>
                        )}
                    </div>
                </div>

                {/* Loading state */}
                {loadingSelectedWorkflow ? (
                    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <IconLoader2 size={40} className="animate-spin text-blue-500 mb-3" />
                        <p className="text-gray-600 dark:text-gray-400">Loading workflow template...</p>
                    </div>
                ) : (
                    <AssistantWorkflow
                        id="chatWorkflowPreview"
                        workflowTemplate={selectedTemplate!}
                        enableCustomization={false}
                        onWorkflowTemplateUpdate={() => {}}
                    />
                )}
            </div>
        </div>
    );

    // ── Empty right panel ────────────────────────────────────────────────────
    const renderEmptyPanel = () => (
        <div className="w-2/3 overflow-auto">
            <div className="h-full flex items-center justify-center">
                <div className="text-center p-6">
                    <div className="flex justify-center mb-3">
                        <IconChevronRight size={24} stroke={1.5} className="text-gray-400 dark:text-gray-600" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Select a workflow from the list to view details
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="flex h-[400px] w-full border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg bg-white dark:bg-[#22232b] overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            {renderSidebar()}
            {selectedTemplateId ? renderPreviewContent() : renderEmptyPanel()}
        </div>
    );
};

export default ChatWorkflowViewer;

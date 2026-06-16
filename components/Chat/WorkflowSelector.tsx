import { useEffect, useState, useRef } from 'react';
import { AstWorkflow } from '@/types/assistantWorkflows';
import { listAstWorkflowTemplates, getAstWorkflowTemplate } from '@/services/assistantWorkflowService';
import { AssistantWorkflow } from '@/components/AssistantWorkflows/AssistantWorkflow';
import {
    IconPuzzle,
    IconX,
    IconCirclePlus,
    IconChevronRight,
    IconLoader2,
    IconCheck,
} from '@tabler/icons-react';

interface Props {
    selectedWorkflowId: string | null;
    onSelect: (workflow: AstWorkflow | null) => void;
    onClose: () => void;
}

const WorkflowSelector: React.FC<Props> = ({ selectedWorkflowId, onSelect, onClose }) => {
    const [workflows, setWorkflows] = useState<AstWorkflow[] | null>(null);
    const [hoveredWorkflowId, setHoveredWorkflowId] = useState<string | null>(null);
    // tracks which workflow is selected inside the selector (may differ from confirmed selectedWorkflowId)
    const [pendingId, setPendingId] = useState<string | null>(selectedWorkflowId);
    // Cache of fully-loaded workflows (with template.steps)
    const fullWorkflowCache = useRef<Record<string, AstWorkflow>>({});
    const [fullWorkflows, setFullWorkflows] = useState<Record<string, AstWorkflow>>({});
    const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

    useEffect(() => {
        listAstWorkflowTemplates(true, false).then((response) => {
            const templates = response.success ? response.data?.templates ?? [] : [];
            setWorkflows(templates);
        });
    }, []);

    // Keep pendingId in sync when parent clears the selection
    useEffect(() => {
        setPendingId(selectedWorkflowId);
    }, [selectedWorkflowId]);

    // The ID of the workflow to preview (hovered takes priority, then pending/selected)
    const previewId = hoveredWorkflowId ?? pendingId ?? null;

    // Fetch full template whenever previewId changes and it isn't cached yet
    useEffect(() => {
        if (!previewId) return;

        // Already cached — sync into state if needed
        if (fullWorkflowCache.current[previewId]) {
            setFullWorkflows(prev =>
                prev[previewId] ? prev : { ...prev, [previewId]: fullWorkflowCache.current[previewId] }
            );
            return;
        }

        // Capture the id this effect is fetching for — used to ignore stale responses
        const fetchingForId = previewId;
        setLoadingPreviewId(fetchingForId);

        getAstWorkflowTemplate(fetchingForId).then((response) => {
            if (response.success && response.data) {
                const fullTemplate = response.data;
                fullWorkflowCache.current[fetchingForId] = fullTemplate;
                setFullWorkflows(prev => ({ ...prev, [fetchingForId]: fullTemplate }));
            }
            // Only clear loading spinner if we're still showing this id
            setLoadingPreviewId(prev => (prev === fetchingForId ? null : prev));
        });
    }, [previewId]);

    // Only render the right pane once the full template (with steps) is loaded
    const previewWorkflow = previewId && fullWorkflows[previewId]?.template?.steps
        ? fullWorkflows[previewId]
        : null;

    return (
        <div className="flex h-[400px] w-full border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg bg-white dark:bg-[#22232b] overflow-hidden">

            {/* ── Left Pane – workflow list ── */}
            <div className="w-[240px] flex-shrink-0 border-r border-gray-300 dark:border-gray-700 overflow-auto bg-gray-50 dark:bg-[#2b2c35]">
                {/* Header */}
                <div className="sticky top-0 bg-gray-100 dark:bg-[#343541] px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center text-sm">
                        <IconPuzzle size={16} stroke={1.5} className="mr-2" />
                        Workflows
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        title="Close"
                    >
                        <IconX size={16} />
                    </button>
                </div>

                {/* List */}
                <div className="py-1">
                    {workflows === null ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 dark:text-gray-400">
                            <IconLoader2 className="animate-spin" size={16} />
                            Loading workflows...
                        </div>
                    ) : workflows.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400 text-center">
                            No workflow templates available
                        </div>
                    ) : (
                        workflows.map((workflow) => {
                            const isSelected = (pendingId ?? selectedWorkflowId) === workflow.templateId;
                            const isHovered = hoveredWorkflowId === workflow.templateId;
                            return (
                                <button
                                    key={workflow.templateId}
                                    className={`w-full text-left px-4 py-2.5 transition-colors flex items-start gap-2
                                        ${isSelected
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500'
                                            : isHovered
                                                ? 'bg-gray-100 dark:bg-[#3a3b44]'
                                                : 'hover:bg-gray-100 dark:hover:bg-[#3a3b44]'
                                        }`}
                                    onMouseEnter={() => setHoveredWorkflowId(workflow.templateId)}
                                    onMouseLeave={() => setHoveredWorkflowId(null)}
                                    onClick={() => setPendingId(workflow.templateId)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm truncate ${
                                                isSelected
                                                    ? 'font-semibold text-blue-700 dark:text-blue-300'
                                                    : 'text-gray-700 dark:text-gray-200'
                                            }`}>
                                                {workflow.name}
                                            </span>
                                            {isSelected && (
                                                <IconCheck size={14} className="flex-shrink-0 text-blue-500" />
                                            )}
                                        </div>
                                        {workflow.description && (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                                {workflow.description}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Right Pane – detail / preview ── */}
            <div className="flex-1 overflow-auto">
                {previewId && !previewWorkflow ? (
                    <div className="h-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <IconLoader2 className="animate-spin" size={18} />
                        Loading workflow details...
                    </div>
                ) : previewWorkflow ? (
                    <div className="px-6 pt-4 pb-6">
                        {/* Action buttons */}
                        <div className="flex justify-end gap-2 mb-2">
                            <button
                                className="flex items-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                                onClick={onClose}
                            >
                                <IconX size={14} stroke={1.5} className="mr-1" />
                                Cancel
                            </button>
                            <button
                                className={`flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                    selectedWorkflowId === previewWorkflow.templateId
                                        ? 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                                onClick={() => {
                                    if (selectedWorkflowId === previewWorkflow.templateId) {
                                        // already confirmed — remove it
                                        onSelect(null);
                                    } else {
                                        // confirm selection and close
                                        onSelect(fullWorkflows[previewWorkflow.templateId] ?? previewWorkflow);
                                    }
                                }}
                            >
                                {(pendingId === previewWorkflow.templateId && selectedWorkflowId === previewWorkflow.templateId) ? (
                                    <>
                                        <IconX size={14} stroke={1.5} className="mr-1" />
                                        Remove Workflow
                                    </>
                                ) : (
                                    <>
                                        <IconCirclePlus size={14} stroke={1.5} className="mr-1" />
                                        Add Workflow
                                    </>
                                )}
                            </button>

                        </div>

                        {/* Reuse the exact same AssistantWorkflow preview component, segments pre-expanded */}
                        <AssistantWorkflow
                            key={previewWorkflow.templateId}
                            id={`workflow-selector-preview-${previewWorkflow.templateId}`}
                            workflowTemplate={previewWorkflow}
                            enableCustomization={false}
                            onWorkflowTemplateUpdate={() => {}}
                            defaultExpandedSegments={true}
                        />
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center p-6">
                            <IconChevronRight size={24} stroke={1.5} className="mx-auto mb-3 text-gray-400 dark:text-gray-600" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Hover over or select a workflow to view details</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowSelector;

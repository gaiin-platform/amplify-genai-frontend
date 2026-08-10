/**
 * NewScheduledTasksView — New UI full-pane reimplementation of the old ScheduledTasks modal
 * (components/Agent/ScheduledTasks.tsx).
 *
 * Same design language as NewAssistantsView.tsx / NewLibraryView.tsx:
 *   - Sticky top bar with back button + title + search + "New Task" button
 *   - List pane (left) of TaskRow items, grouped/filterable by task type
 *   - Detail pane (right): form editor OR run-logs viewer for the selected task
 *
 * Data/services are IDENTICAL to the old component — no changes to services/types:
 *   services/scheduledTasksService.ts (create/get/list/update/delete/executeTask/getTaskExecutionDetails)
 *   types/scheduledTasks.ts (ScheduledTask, ScheduledTaskType, TASK_TYPE_MAP, TaskExecutionRecord)
 *
 * PORT: The "Task Type" object-selector sub-flow (Assistant / Action / Workflow picker,
 * including the "Create Action Set" builder) reuses several old, unmodified components
 * (CronScheduleBuilder, ActionSetList, CompositeActionsPanel, ApiItemSelector,
 * ApiParameterBindingEditor) inside a new-UI-styled wrapper. These sub-components still use
 * their original (old-UI) internal styling. TODO: give these a dedicated new-UI visual pass
 * in a future phase — tracked in NEW_UI_PORTING_STATUS.md.
 *
 * Design tokens: --bg-app, --bg-sidebar, --bg-raised, --bg-hover, --bg-active,
 *                --border-subtle, --text-primary, --text-secondary, --text-muted, --accent
 */

import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import toast from 'react-hot-toast';
import {
    IconX,
    IconSearch,
    IconPlus,
    IconTrash,
    IconLoader2,
    IconRobot,
    IconSettingsAutomation,
    IconTool,
    IconPuzzle,
    IconPlayerPlay,
    IconNotes,
    IconRefresh,
    IconAlarm,
    IconChevronDown,
    IconChevronRight,
    IconChevronUp,
    IconExclamationCircle,
    IconBulb,
    IconDeviceFloppy,
    IconAdjustments,
    IconInfoCircle,
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import {
    ScheduleDateRange,
    ScheduledTask,
    ScheduledTaskType,
    TASK_TYPE_MAP,
    TaskExecutionRecord,
} from '@/types/scheduledTasks';
import {
    createScheduledTask,
    deleteScheduledTask,
    executeTask,
    getScheduledTask,
    getTaskExecutionDetails,
    listScheduledTasks,
    updateScheduledTask,
} from '@/services/scheduledTasksService';
import { camelCaseToTitle } from '@/utils/app/data';
import { isAssistant } from '@/utils/app/assistants';
import { Prompt } from '@/types/prompt';
import { userFriendlyDate } from '@/utils/app/date';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import { getOpsForUser } from '@/services/opsService';
import { getAgentTools } from '@/services/agentService';
import { listAstWorkflowTemplates } from '@/services/assistantWorkflowService';
import { AstWorkflow } from '@/types/assistantWorkflows';
import { OpDef, OpBindingMode } from '@/types/op';
import { CompositeFunction } from '@/utils/app/compositeFunctions';

// PORT: old, unmodified sub-widgets reused as-is
import { CronScheduleBuilder } from '@/components/Agent/CronScheduleBuilder';
import { ActionSetList } from '@/components/Agent/ActionSets';
import CompositeActionsPanel from '@/components/Agent/CompositeActionsPanel';
import { ApiItemSelector } from '@/components/AssistantApi/ApiSelector';
import { ApiParameterBindingEditor } from '@/components/AssistantApi/ApiParameterBindingEditor';
import AgentLogBlock from '@/components/Chat/ChatContentBlocks/AgentLogBlock';
import { saveActionSet, ActionItem } from '@/services/actionSetsService';

// ── Constants ─────────────────────────────────────────────────────────────────

const PENDING_TASK_KEY = 'amplify_pending_scheduled_task';

const emptyTask = (): ScheduledTask => ({
    taskId: '',
    taskName: '',
    description: '',
    cronExpression: '0 9 * * *',
    active: true,
    taskInstructions: '',
    taskType: 'assistant',
    objectInfo: { objectId: '', objectName: '' },
    tags: [],
});

interface ScheduledTaskPreview {
    taskId: string;
    taskName: string;
    taskType: ScheduledTaskType;
    active: boolean;
}

const TYPE_ICON: Record<ScheduledTaskType, React.ReactNode> = {
    assistant: <IconRobot size={16} />,
    actionSet: <IconSettingsAutomation size={16} />,
    apiTool: <IconTool size={16} />,
    workflow: <IconPuzzle size={16} />,
};

// ── Small shared primitives (matching NewAssistantsView / NewLibraryView) ──────

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({
    value, onChange, placeholder = 'Search…',
}) => (
    <div className="relative">
        <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-[34px] pl-9 pr-3 rounded-[8px] text-[13px] border focus:outline-none w-[200px] transition-colors"
            style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        />
    </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{children}</label>
);

const textFieldClass = "w-full px-3 py-2 rounded-[8px] text-[13px] border focus:outline-none transition-colors";
const textFieldStyle = { backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' };

const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ icon, children, className = '', ...rest }) => (
    <button
        {...rest}
        className={`flex items-center justify-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${className}`}
        style={{ backgroundColor: 'var(--accent)' }}
    >
        {icon}
        {children}
    </button>
);

const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ icon, children, className = '', ...rest }) => (
    <button
        {...rest}
        className={`flex items-center justify-center gap-1.5 h-[32px] px-3 rounded-[8px] text-[12.5px] font-medium transition-colors disabled:opacity-50 ${className}`}
        style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
    >
        {icon}
        {children}
    </button>
);

const EmptyState: React.FC<{ message: string; subMessage?: string; onAction?: () => void; actionLabel?: string }> = ({
    message, subMessage, onAction, actionLabel,
}) => (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <IconAlarm size={32} className="mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
        <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        {subMessage && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{subMessage}</p>}
        {onAction && actionLabel && (
            <button
                onClick={onAction}
                className="mt-4 flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
            >
                <IconPlus size={14} />
                {actionLabel}
            </button>
        )}
    </div>
);

// ── Task list row ───────────────────────────────────────────────────────────────

const TaskRow: React.FC<{
    task: ScheduledTaskPreview;
    isSelected: boolean;
    isDeleting: boolean;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}> = ({ task, isSelected, isDeleting, onClick, onDelete }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            className="group relative flex items-center gap-3 px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors duration-100"
            style={{ backgroundColor: isSelected ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-[8px]" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                {TYPE_ICON[task.taskType] ?? <IconAlarm size={16} />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.taskName || 'Untitled task'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                        className="text-[11px] px-1.5 py-[1px] rounded-full"
                        style={{
                            backgroundColor: task.active ? 'rgba(90,180,110,0.15)' : 'var(--bg-hover)',
                            color: task.active ? '#4CAF6D' : 'var(--text-muted)',
                        }}
                    >
                        {task.active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            <button
                className="flex-shrink-0 flex items-center justify-center h-[26px] w-[26px] rounded-[6px] transition-opacity"
                style={{ color: '#e05252', opacity: hovered || isSelected ? 1 : 0 }}
                onClick={onDelete}
                title="Delete task"
                disabled={isDeleting}
            >
                {isDeleting ? <IconLoader2 size={14} className="animate-spin" /> : <IconTrash size={14} />}
            </button>
        </div>
    );
};

// ── Main component ───────────────────────────────────────────────────────────────

export const NewScheduledTasksView: React.FC = () => {
    const { state: { featureFlags, prompts }, dispatch: homeDispatch } = useContext(HomeContext);

    // Consume the one-shot sessionStorage handoff (mirrors the pending-message bridge pattern)
    const initTask = useMemo<ScheduledTask | undefined>(() => {
        if (typeof window === 'undefined') return undefined;
        try {
            const raw = sessionStorage.getItem(PENDING_TASK_KEY);
            sessionStorage.removeItem(PENDING_TASK_KEY);
            return raw ? (JSON.parse(raw) as ScheduledTask) : undefined;
        } catch {
            return undefined;
        }
    }, []);

    const [selectedTask, setSelectedTask] = useState<ScheduledTask>(initTask ?? emptyTask());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isViewingLogs, setIsViewingLogs] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [taskLogs, setTaskLogs] = useState<TaskExecutionRecord[]>([]);
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [selectedLogDetails, setSelectedLogDetails] = useState<any>(null);
    const [isLoadingLogDetails, setIsLoadingLogDetails] = useState(false);
    const [isLogsExpanded, setIsLogsExpanded] = useState(false);
    const [isTestingTask, setIsTestingTask] = useState(false);
    const pollingCancelledRef = useRef(false);

    const [allTasks, setAllTasks] = useState<ScheduledTaskPreview[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [isLoadingTask, setIsLoadingTask] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('All');

    // Object-selector sub-flow state (ported from old ScheduledTasks.tsx)
    const [showActionSelector, setShowActionSelector] = useState(false);
    const [actionSubMode, setActionSubMode] = useState<'actionSet' | 'apiTool' | 'createActionSet'>('apiTool');
    const [newActionSetName, setNewActionSetName] = useState('');
    const [newActionSetActions, setNewActionSetActions] = useState<ActionItem[]>([]);
    const [isSavingActionSet, setIsSavingActionSet] = useState(false);
    const [rawOpsOpen, setRawOpsOpen] = useState(false);
    const [rawAgentOpen, setRawAgentOpen] = useState(true);
    const [rawIntegrationOpen, setRawIntegrationOpen] = useState(true);
    const [editingActionName, setEditingActionName] = useState<string | null>(null);
    const [actionParamModes, setActionParamModes] = useState<Record<string, Record<string, OpBindingMode>>>({});
    const [actionParamValues, setActionParamValues] = useState<Record<string, Record<string, string>>>({});
    const [showWorkflowList, setShowWorkflowList] = useState(false);
    const [availableApis, setAvailableApis] = useState<any[] | null>(null);
    const [availableAgentTools, setAvailableAgentTools] = useState<Record<string, any> | null>(null);
    const [availableWorkflows, setAvailableWorkflows] = useState<AstWorkflow[] | null>(null);

    // ── Effects: load supporting data ──
    useEffect(() => {
        if (featureFlags.integrations && availableApis === null) {
            getOpsForUser().then((ops) => {
                if (ops.success) {
                    filterSupportedIntegrationOps(ops.data).then((filtered) => { if (filtered) setAvailableApis(filtered); });
                    return;
                }
                setAvailableApis([]);
            });
        }
    }, [availableApis, featureFlags.integrations]);

    useEffect(() => {
        if (featureFlags.agentTools && availableAgentTools === null) {
            getAgentTools().then((tools) => setAvailableAgentTools(tools.success ? tools.data : {}));
        }
    }, [availableAgentTools, featureFlags.agentTools]);

    useEffect(() => {
        if (featureFlags.assistantWorkflows && availableWorkflows === null) {
            listAstWorkflowTemplates(true, false).then((response) => {
                setAvailableWorkflows(response.success ? response.data?.templates ?? [] : []);
            });
        }
    }, [availableWorkflows, featureFlags.assistantWorkflows]);

    const fetchTasks = async () => {
        setIsLoadingTasks(true);
        try {
            const result = await listScheduledTasks();
            if (result.success && result.data?.tasks) {
                setAllTasks(result.data.tasks);
            } else {
                toast.error('Failed to load scheduled tasks');
            }
        } catch (err) {
            console.error('Failed to load tasks:', err);
            setAllTasks([]);
        }
        setIsLoadingTasks(false);
    };

    useEffect(() => { fetchTasks(); }, []);

    // If we arrived with a pre-filled task (from ScheduledTaskButton), treat as "new"
    useEffect(() => {
        if (initTask) setShowActionSelector(false);
    }, [initTask]);

    // ── Handlers ──

    const handleNewTask = () => {
        setSelectedTask(emptyTask());
        setShowActionSelector(false);
        setIsViewingLogs(false);
        setError(null);
    };

    const handleLoadTask = async (taskId: string) => {
        setIsLoadingTask(true);
        const result = await getScheduledTask(taskId);
        if (result.success && result.data?.task) {
            const task = result.data.task;
            pollingCancelledRef.current = true;
            setIsTestingTask(false);
            setShowActionSelector(false);
            setSelectedTask(task);
            setTaskLogs([]);
            setSelectedLogId(null);
            setSelectedLogDetails(null);
            setIsViewingLogs(false);
            setError(null);
            if (task.taskType === 'apiTool') setActionSubMode('apiTool');
            else if (task.taskType === 'actionSet') setActionSubMode('actionSet');
            setNewActionSetActions([]);
            setNewActionSetName('');
        } else {
            toast.error('Failed to load task');
        }
        setIsLoadingTask(false);
    };

    const handleSaveTask = async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            if (!selectedTask.taskName.trim()) { setError('Task name is required'); setIsSubmitting(false); return; }
            if (!selectedTask.cronExpression.trim()) { setError('Schedule is required'); setIsSubmitting(false); return; }
            if (!selectedTask.objectInfo.objectId) { setError('An object must be selected under "Task Type"'); setIsSubmitting(false); return; }

            if (selectedTask.taskId) {
                const result = await updateScheduledTask(selectedTask.taskId, selectedTask);
                if (result.success) toast.success('Successfully updated task');
                else toast.error('Failed to update task');
            } else {
                const task = cloneDeep(selectedTask);
                const { taskId, ...taskData } = task;
                const result = await createScheduledTask(taskData);
                if (result.success && result.data?.taskId) {
                    setSelectedTask({ ...selectedTask, taskId: result.data.taskId });
                    toast.success('Successfully created task');
                } else {
                    toast.error('Failed to save task');
                }
            }
            fetchTasks();
        } catch (err) {
            setError('An error occurred while saving the task');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeletingId(taskId);
        const result = await deleteScheduledTask(taskId);
        if (result.success) {
            toast.success('Successfully deleted task');
            setAllTasks((prev) => prev.filter((t) => t.taskId !== taskId));
            if (selectedTask.taskId === taskId) handleNewTask();
        } else {
            toast.error('Failed to delete task');
        }
        setIsDeletingId(null);
    };

    const handleRunTask = async (taskId: string) => {
        setIsViewingLogs(true);
        setIsTestingTask(true);
        pollingCancelledRef.current = false;
        const startTime = new Date().toISOString();

        try {
            const taskResult = await executeTask(taskId);
            if (!taskResult.success) {
                toast.error('Failed to run task: ' + (taskResult.message || 'Unknown error'));
                setIsTestingTask(false);
                return;
            }
            toast.success('Task execution started.');

            let attempts = 0;
            const maxAttempts = 80;
            let trackedExecutionId: string | null = null;
            let hasFoundRunning = false;

            const getInterval = () => (!hasFoundRunning ? Math.min(3000 + attempts * 500, 6000) : 1500);

            const pollForLogs = async () => {
                if (pollingCancelledRef.current) return;
                attempts++;
                try {
                    const fetchedLogs = await fetchTaskLogs(taskId, false);
                    if (pollingCancelledRef.current) return;

                    const executionLogs = fetchedLogs
                        .filter((log: TaskExecutionRecord) => log.executionId.startsWith('execution-') || log.executionId.startsWith('scheduled-task-'))
                        .sort((a: TaskExecutionRecord, b: TaskExecutionRecord) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

                    if (!trackedExecutionId && executionLogs.length > 0) {
                        let logToTrack = executionLogs.find((log: TaskExecutionRecord) => log.executedAt > startTime);
                        if (!logToTrack) logToTrack = executionLogs.find((log: TaskExecutionRecord) => log.status === 'running');
                        if (logToTrack) {
                            trackedExecutionId = logToTrack.executionId;
                            if (logToTrack.status === 'running') hasFoundRunning = true;
                            const isAlreadyCompleted = ['success', 'failure', 'timeout'].includes(logToTrack.status);
                            if (isAlreadyCompleted && logToTrack.executedAt > startTime) {
                                toast(`Task completed with status: ${logToTrack.status}`);
                                setSelectedLogId(logToTrack.executionId);
                                setIsTestingTask(false);
                                return;
                            }
                        }
                    }

                    if (trackedExecutionId) {
                        const trackedLog = fetchedLogs.find((log: TaskExecutionRecord) => log.executionId === trackedExecutionId);
                        if (trackedLog) {
                            if (trackedLog.status === 'running' && !hasFoundRunning) hasFoundRunning = true;
                            const isCompleted = ['success', 'failure', 'timeout'].includes(trackedLog.status);
                            if (isCompleted) {
                                toast(`Task completed with status: ${trackedLog.status}`);
                                setSelectedLogId(trackedLog.executionId);
                                setIsTestingTask(false);
                                return;
                            }
                        }
                    }

                    if (!trackedExecutionId && attempts > 2) {
                        const anyCompleted = executionLogs.find((log: TaskExecutionRecord) =>
                            ['success', 'failure', 'timeout'].includes(log.status) && log.executedAt > startTime);
                        if (anyCompleted) {
                            toast(`Task completed with status: ${anyCompleted.status}`);
                            setSelectedLogId(anyCompleted.executionId);
                            setIsTestingTask(false);
                            return;
                        }
                    }

                    if (attempts < maxAttempts) {
                        setTimeout(pollForLogs, getInterval());
                    } else {
                        toast.error('Timeout waiting for task completion logs. Please check logs manually.');
                        setIsTestingTask(false);
                    }
                } catch (err) {
                    console.error('Error polling for logs:', err);
                    if (attempts < maxAttempts) setTimeout(pollForLogs, 5000);
                    else { toast.error('Error monitoring task execution.'); setIsTestingTask(false); }
                }
            };

            setTimeout(pollForLogs, 1000);
        } catch (err) {
            console.error('Error executing task:', err);
            toast.error('Error executing task');
            setIsTestingTask(false);
        }
    };

    const fetchTaskLogs = async (taskId: string, notify: boolean = true) => {
        if (!taskId) return [];
        if (notify) setIsLoadingLogs(true);
        try {
            const result = await getScheduledTask(taskId);
            if (result.success && result.data?.task?.logs) {
                setTaskLogs(result.data.task.logs);
                return result.data.task.logs;
            }
            if (notify) { setTaskLogs([]); toast.error('Error fetching task logs'); }
            return [];
        } catch (err) {
            console.error('Error fetching task logs:', err);
            return [];
        } finally {
            if (notify) setIsLoadingLogs(false);
        }
    };

    const fetchLogDetails = async (taskId: string, executionId: string) => {
        if (!taskId || !executionId) return;
        setIsLoadingLogDetails(true);
        try {
            const result = await getTaskExecutionDetails(taskId, executionId);
            if (result.success && result.data?.details) {
                setSelectedLogDetails(result.data.details);
            } else {
                setSelectedLogId(null);
                setSelectedLogDetails(null);
            }
        } catch (err) {
            console.error('Error fetching log details:', err);
        } finally {
            setIsLoadingLogDetails(false);
        }
    };

    useEffect(() => { if (isViewingLogs) fetchTaskLogs(selectedTask.taskId); }, [isViewingLogs, selectedTask.taskId]);
    useEffect(() => {
        if (selectedLogId && selectedTask.taskId) fetchLogDetails(selectedTask.taskId, selectedLogId);
        else setSelectedLogDetails(null);
    }, [selectedLogId, selectedTask.taskId]);

    // Object selector handlers (ported)
    const handleActionSetSelect = (actionSet: any) => {
        setSelectedTask({ ...selectedTask, taskType: 'actionSet', objectInfo: { objectId: actionSet.id || '', objectName: actionSet.name || 'Unnamed Set' } });
        setShowActionSelector(false);
    };

    const handleAddRawActionToNewSet = (api: OpDef) => {
        const actionItem: ActionItem = {
            name: api.name,
            operation: { tool_name: api.name, name: api.name, description: api.description, id: api.name, type: api.type || '', parameters: api.parameters, tags: api.tags ?? [], bindings: api.bindings, method: (api as any).method },
        };
        setNewActionSetActions((prev) => (prev.find((a) => a.name === api.name) ? prev : [...prev, actionItem]));
    };

    const handleAddCompositeToNewSet = (fn: CompositeFunction) => {
        if (!availableApis) return;
        const opNames = new Set(fn.operations);
        const ops = (availableApis as OpDef[]).filter((api) => opNames.has(api.name));
        if (ops.length === 0) return;
        setNewActionSetActions((prev) => {
            const existingNames = new Set(prev.map((a) => a.name));
            const toAdd = ops.filter((api) => !existingNames.has(api.name)).map((api) => ({
                name: api.name,
                operation: { tool_name: api.name, name: api.name, description: api.description, id: api.name, type: api.type || '', parameters: api.parameters, tags: api.tags ?? [], bindings: api.bindings, method: api.method },
            }));
            return [...prev, ...toAdd];
        });
    };

    const handleRemoveActionFromNewSet = (name: string) => setNewActionSetActions((prev) => prev.filter((a) => a.name !== name));

    const handleUpdateOpBindingsInNewSet = (actionName: string, bindings: any) =>
        setNewActionSetActions((prev) => prev.map((a) => (a.name === actionName ? { ...a, operation: { ...a.operation, bindings } } : a)));

    const handleActionParamModeChange = (actionName: string, param: string, mode: OpBindingMode) => {
        const newModes = { ...actionParamModes, [actionName]: { ...(actionParamModes[actionName] || {}), [param]: mode } };
        setActionParamModes(newModes);
        const vals = actionParamValues[actionName] || {};
        const bindings: any = {};
        const action = newActionSetActions.find((a) => a.name === actionName);
        if (action?.operation?.parameters?.properties) {
            Object.keys(action.operation.parameters.properties).forEach((p) => {
                const m = (newModes[actionName] || {})[p] || 'ai';
                const v = vals[p] || '';
                if (v || m === 'manual') bindings[p] = { value: v, mode: m };
            });
        }
        handleUpdateOpBindingsInNewSet(actionName, bindings);
    };

    const handleActionParamValueChange = (actionName: string, param: string, value: string) => {
        const newVals = { ...actionParamValues, [actionName]: { ...(actionParamValues[actionName] || {}), [param]: value } };
        setActionParamValues(newVals);
        const modes = actionParamModes[actionName] || {};
        const bindings: any = {};
        const action = newActionSetActions.find((a) => a.name === actionName);
        if (action?.operation?.parameters?.properties) {
            Object.keys(action.operation.parameters.properties).forEach((p) => {
                const m = modes[p] || 'ai';
                const v = (newVals[actionName] || {})[p] || '';
                if (v || m === 'manual') bindings[p] = { value: v, mode: m };
            });
        }
        handleUpdateOpBindingsInNewSet(actionName, bindings);
    };

    const handleSaveNewActionSet = async () => {
        if (newActionSetActions.length === 0) return;
        if (!newActionSetName.trim()) { toast.error('Please enter a name for the action set'); return; }
        setIsSavingActionSet(true);
        try {
            const name = newActionSetName.trim();
            const savedSet = await saveActionSet({ name, tags: [], actions: newActionSetActions });
            setSelectedTask({ ...selectedTask, taskType: 'actionSet', objectInfo: { objectId: savedSet.id || '', objectName: savedSet.name } });
            setNewActionSetName('');
            setNewActionSetActions([]);
            setActionSubMode('actionSet');
            setShowActionSelector(false);
            toast.success(`Action set "${savedSet.name}" created and selected`);
        } catch (err) {
            console.error('Error saving action set:', err);
            toast.error('Failed to save action set');
        } finally {
            setIsSavingActionSet(false);
        }
    };

    const handleApiToolSelect = (name: string, opSpecs: any) => {
        setSelectedTask({ ...selectedTask, objectInfo: { objectId: name, objectName: name, data: { op: opSpecs } } });
        setShowActionSelector(false);
    };

    const handleWorkflowSelect = (templateId: string) => {
        const workflow = availableWorkflows?.find((w) => w.templateId === templateId);
        const workflowName = workflow?.name || `Workflow Template: ${templateId}`;
        setSelectedTask({ ...selectedTask, objectInfo: { objectId: templateId, objectName: workflowName, data: { templateId } } });
        setShowWorkflowList(false);
    };

    const isDisabled = () => selectedTask.taskType ? Boolean(selectedTask.objectInfo.data?.enforced) : false;

    // ── Derived list ──
    const tasksByType = useMemo(() => {
        const q = search.trim().toLowerCase();
        const acc: Record<string, ScheduledTaskPreview[]> = {};
        allTasks
            .filter((t) => !q || t.taskName.toLowerCase().includes(q))
            .forEach((t) => {
                if (!acc[t.taskType]) acc[t.taskType] = [];
                acc[t.taskType].push(t);
            });
        Object.keys(acc).forEach((type) => acc[type].sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)));
        return acc;
    }, [allTasks, search]);

    const availableTypes = ['All', ...Object.keys(tasksByType)];
    const totalVisible = Object.values(tasksByType).reduce((n, arr) => n + arr.length, 0);

    // ── Object selector renderer (ported, restyled) ──
    const getObjectSelector = () => {
        const taskType = selectedTask.taskType;
        if (!taskType) return null;
        const enforced = isDisabled();

        if (taskType === 'assistant') {
            const asts = prompts.filter((p: Prompt) => isAssistant(p));
            if (asts.length === 0) {
                return (
                    <div className="flex items-center gap-2 text-[13px] py-2" style={{ color: 'var(--text-muted)' }}>
                        <IconExclamationCircle size={16} style={{ color: '#e05252' }} />
                        No assistants found
                    </div>
                );
            }
            return (
                <select
                    disabled={enforced}
                    value={selectedTask.objectInfo?.objectId ?? ''}
                    onChange={(e) => setSelectedTask({ ...selectedTask, objectInfo: { objectId: e.target.value, objectName: prompts.find((p: Prompt) => p.data?.assistant?.definition.assistantId === e.target.value)?.name || '' } })}
                    className={textFieldClass}
                    style={textFieldStyle}
                >
                    <option value="">Select Assistant</option>
                    {asts.map((ast: Prompt, i: number) => (
                        <option key={i} value={ast.data?.assistant?.definition.assistantId ?? ast.id}>{ast.name}</option>
                    ))}
                </select>
            );
        }

        if (taskType === 'actionSet' || taskType === 'apiTool') {
            if (!featureFlags.actionSets && !featureFlags.integrations) return null;
            return (
                <div className={`flex flex-col gap-3 ${enforced ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div
                        onClick={() => !enforced && setShowActionSelector((v) => !v)}
                        className={`${textFieldClass} flex justify-between items-center cursor-pointer`}
                        style={textFieldStyle}
                    >
                        <span>{selectedTask.objectInfo?.objectName || 'Select Action'}</span>
                        <IconChevronDown size={16} className={`transition-transform ${(showActionSelector || !selectedTask.objectInfo?.objectId) ? 'rotate-180' : ''}`} />
                    </div>

                    {(showActionSelector || !selectedTask.objectInfo?.objectId) && !enforced && (
                        <>
                            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${[featureFlags.integrations, featureFlags.actionSets, featureFlags.actionSets].filter(Boolean).length}, minmax(0, 1fr))` }}>
                                {featureFlags.integrations && (
                                    <button
                                        onClick={() => { setActionSubMode('apiTool'); }}
                                        className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-[8px] border text-left transition-colors"
                                        style={{
                                            backgroundColor: actionSubMode === 'apiTool' ? 'var(--bg-active)' : 'transparent',
                                            borderColor: actionSubMode === 'apiTool' ? 'var(--accent)' : 'var(--border-subtle)',
                                        }}
                                    >
                                        <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>API Action</span>
                                        <span className="text-[11.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>Run a single API or agent tool once per schedule</span>
                                    </button>
                                )}
                                {featureFlags.actionSets && (
                                    <button
                                        onClick={() => setActionSubMode('actionSet')}
                                        className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-[8px] border text-left transition-colors"
                                        style={{
                                            backgroundColor: actionSubMode === 'actionSet' ? 'var(--bg-active)' : 'transparent',
                                            borderColor: actionSubMode === 'actionSet' ? 'var(--accent)' : 'var(--border-subtle)',
                                        }}
                                    >
                                        <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Action Set</span>
                                        <span className="text-[11.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>Use a pre-saved collection of actions</span>
                                    </button>
                                )}
                                {featureFlags.actionSets && (
                                    <button
                                        onClick={() => { setActionSubMode('createActionSet'); setNewActionSetActions([]); setNewActionSetName(''); }}
                                        className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-[8px] border text-left transition-colors"
                                        style={{
                                            backgroundColor: actionSubMode === 'createActionSet' ? 'var(--bg-active)' : 'transparent',
                                            borderColor: actionSubMode === 'createActionSet' ? 'var(--accent)' : 'var(--border-subtle)',
                                        }}
                                    >
                                        <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>+ Create Action Set</span>
                                        <span className="text-[11.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>Build and save a new set of actions</span>
                                    </button>
                                )}
                            </div>

                            {actionSubMode === 'actionSet' && featureFlags.actionSets && (
                                <div className="rounded-[8px] border p-3 overflow-y-auto" style={{ borderColor: 'var(--border-subtle)', maxHeight: 300 }}>
                                    <div className="text-neutral-900 dark:text-white">
                                        <ActionSetList onLoad={handleActionSetSelect} selectedId={selectedTask.objectInfo?.objectId} />
                                    </div>
                                </div>
                            )}

                            {actionSubMode === 'apiTool' && (
                                <div className="rounded-[8px] border p-3 overflow-y-auto text-neutral-900 dark:text-white" style={{ borderColor: 'var(--border-subtle)', maxHeight: 300 }}>
                                    <div className="flex flex-col gap-2">
                                        {availableAgentTools && Object.keys(availableAgentTools).length > 0 && (
                                            <div>
                                                <button className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }} onClick={() => setRawAgentOpen((v) => !v)}>
                                                    {rawAgentOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}Agent Tools
                                                </button>
                                                {rawAgentOpen && (
                                                    <ApiItemSelector
                                                        availableApis={Object.entries(availableAgentTools).map(([key, tool]: [string, any]) => ({ id: tool.tool_name || key, name: tool.tool_name || key, tool_name: tool.tool_name || key, description: tool.description || '', parameters: tool.parameters || {}, tags: [...(tool.tags || []), 'Agent Tool', 'native'], type: 'builtIn' }))}
                                                        selectedApis={selectedTask.objectInfo?.objectId ? [{ id: selectedTask.objectInfo.objectId, name: selectedTask.objectInfo.objectName } as any] : []}
                                                        setSelectedApis={() => {}}
                                                        onClickApiItem={(api: OpDef) => handleApiToolSelect(api.name, { tool_name: api.name, name: api.name, description: api.description, id: api.name, type: 'builtIn', parameters: api.parameters, tags: api.tags ?? [], bindings: api.bindings })}
                                                        disableSelection showDetails={false} allowConfiguration
                                                    />
                                                )}
                                            </div>
                                        )}
                                        {featureFlags.integrations && availableApis && (
                                            <div>
                                                <button className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }} onClick={() => setRawIntegrationOpen((v) => !v)}>
                                                    {rawIntegrationOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}Integration APIs
                                                </button>
                                                {rawIntegrationOpen && (
                                                    <ApiItemSelector
                                                        availableApis={availableApis}
                                                        selectedApis={selectedTask.objectInfo?.objectId ? [{ id: selectedTask.objectInfo.objectId, name: selectedTask.objectInfo.objectName } as any] : []}
                                                        setSelectedApis={() => {}}
                                                        apiFilter={(apis) => apis.filter((api) => api.type !== 'custom')}
                                                        onClickApiItem={(api: OpDef) => handleApiToolSelect(api.name, { tool_name: api.name, name: api.name, description: api.description, id: api.name, type: api.type || '', parameters: api.parameters, tags: api.tags ?? [], bindings: api.bindings, method: api.method })}
                                                        disableSelection showDetails={false} allowConfiguration
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {actionSubMode === 'createActionSet' && (
                                <div className="space-y-3">
                                    <div className="rounded-[8px] border p-3 overflow-y-auto text-neutral-900 dark:text-white" style={{ borderColor: 'var(--border-subtle)', maxHeight: 320 }}>
                                        <div className="flex flex-col gap-2">
                                            <CompositeActionsPanel selectedId={null} allOperations={availableApis} onSelect={handleAddCompositeToNewSet} />
                                            <div className="border-t pt-2 mt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                                                <button className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }} onClick={() => setRawOpsOpen((v) => !v)}>
                                                    {rawOpsOpen ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}Browse raw actions
                                                </button>
                                                {rawOpsOpen && (
                                                    <div className="flex flex-col gap-2 pl-2">
                                                        {availableAgentTools && Object.keys(availableAgentTools).length > 0 && (
                                                            <div>
                                                                <button className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }} onClick={() => setRawAgentOpen((v) => !v)}>
                                                                    {rawAgentOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}Agent Tools
                                                                </button>
                                                                {rawAgentOpen && (
                                                                    <ApiItemSelector
                                                                        availableApis={Object.entries(availableAgentTools).map(([key, tool]: [string, any]) => ({ id: tool.tool_name || key, name: tool.tool_name || key, tool_name: tool.tool_name || key, description: tool.description || '', parameters: tool.parameters || {}, tags: [...(tool.tags || []), 'Agent Tool', 'native'], type: 'builtIn' }))}
                                                                        selectedApis={newActionSetActions.map((a) => a.operation as any)} setSelectedApis={() => {}} onClickApiItem={(api: OpDef) => handleAddRawActionToNewSet(api)} disableSelection showDetails={false} allowConfiguration
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                        {featureFlags.integrations && availableApis && (
                                                            <div>
                                                                <button className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }} onClick={() => setRawIntegrationOpen((v) => !v)}>
                                                                    {rawIntegrationOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}Integration APIs
                                                                </button>
                                                                {rawIntegrationOpen && (
                                                                    <ApiItemSelector
                                                                        availableApis={availableApis} selectedApis={newActionSetActions.map((a) => a.operation as any)} setSelectedApis={() => {}}
                                                                        apiFilter={(apis) => apis.filter((api) => api.type !== 'custom')}
                                                                        onClickApiItem={(api: OpDef) => handleAddRawActionToNewSet(api)} disableSelection showDetails={false} allowConfiguration
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {newActionSetActions.length > 0 && (
                                        <div className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                                            <div className="flex flex-wrap gap-1.5">
                                                {newActionSetActions.map((action) => {
                                                    const hasParams = action.operation?.parameters?.properties && Object.keys(action.operation.parameters.properties).length > 0;
                                                    const isEditing = editingActionName === action.name;
                                                    return (
                                                        <span
                                                            key={action.name}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] border transition-colors"
                                                            style={{
                                                                backgroundColor: isEditing ? 'var(--bg-active)' : 'var(--bg-raised)',
                                                                color: 'var(--text-primary)',
                                                                borderColor: isEditing ? 'var(--accent)' : 'var(--border-subtle)',
                                                            }}
                                                        >
                                                            {action.name}
                                                            {hasParams && (
                                                                <button onClick={() => setEditingActionName(isEditing ? null : action.name)} title="Configure parameters" style={{ color: isEditing ? 'var(--accent)' : 'var(--text-muted)' }}>
                                                                    <IconAdjustments size={11} />
                                                                </button>
                                                            )}
                                                            <button onClick={() => { handleRemoveActionFromNewSet(action.name); if (isEditing) setEditingActionName(null); }} style={{ color: 'var(--text-muted)' }}>
                                                                <IconX size={11} />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            {editingActionName && newActionSetActions.find((a) => a.name === editingActionName) && (() => {
                                                const action = newActionSetActions.find((a) => a.name === editingActionName)!;
                                                return (
                                                    <div className="rounded-[8px] border p-3 text-neutral-900 dark:text-white" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-raised)' }}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Configure: {action.name}</span>
                                                            <button onClick={() => setEditingActionName(null)} style={{ color: 'var(--text-muted)' }}><IconX size={14} /></button>
                                                        </div>
                                                        <ApiParameterBindingEditor
                                                            paramSource={action.operation?.parameters}
                                                            paramModes={actionParamModes[action.name] || {}}
                                                            paramValues={actionParamValues[action.name] || {}}
                                                            onParamModeChange={(param, mode) => handleActionParamModeChange(action.name, param, mode)}
                                                            onParamValueChange={(param, value) => handleActionParamValueChange(action.name, param, value)}
                                                        />
                                                    </div>
                                                );
                                            })()}
                                            <input
                                                type="text" placeholder="Action set name (required)" value={newActionSetName}
                                                onChange={(e) => setNewActionSetName(e.target.value)}
                                                className={textFieldClass}
                                                style={{ ...textFieldStyle, borderColor: newActionSetName.trim() ? 'var(--border-subtle)' : '#e05252' }}
                                            />
                                            <PrimaryButton onClick={handleSaveNewActionSet} disabled={isSavingActionSet} icon={isSavingActionSet ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />} className="w-full">
                                                {isSavingActionSet ? 'Saving…' : 'Save Action Set & Use'}
                                            </PrimaryButton>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            );
        }

        if (taskType === 'workflow') {
            if (!featureFlags.assistantWorkflows) return null;
            return (
                <div className="relative flex flex-col">
                    <div
                        onClick={() => !enforced && setShowWorkflowList(!showWorkflowList)}
                        className={`${textFieldClass} flex justify-between items-center cursor-pointer`}
                        style={textFieldStyle}
                    >
                        <span>{selectedTask.objectInfo?.objectName || 'Select Workflow Template'}</span>
                        <IconChevronDown size={16} className={`transition-transform ${showWorkflowList && !enforced ? 'rotate-180' : ''}`} />
                    </div>
                    {showWorkflowList && !enforced && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-[8px] border shadow-lg text-neutral-900 dark:text-white" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
                            <div className="p-3 overflow-y-auto" style={{ maxHeight: 350 }}>
                                {availableWorkflows === null ? (
                                    <div className="text-center py-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading workflows…</div>
                                ) : availableWorkflows.length === 0 ? (
                                    <div className="text-center py-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>No workflow templates available</div>
                                ) : (
                                    <div className="space-y-2">
                                        {availableWorkflows.map((workflow) => (
                                            <div
                                                key={workflow.templateId}
                                                onClick={() => handleWorkflowSelect(workflow.templateId)}
                                                className="p-3 rounded-[8px] cursor-pointer border transition-colors"
                                                style={{
                                                    backgroundColor: selectedTask.objectInfo?.data?.templateId === workflow.templateId ? 'var(--bg-active)' : 'transparent',
                                                    borderColor: selectedTask.objectInfo?.data?.templateId === workflow.templateId ? 'var(--accent)' : 'transparent',
                                                }}
                                            >
                                                <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{workflow.name}</div>
                                                {workflow.description && <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{workflow.description}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    // ── Logs panel ──
    const renderLogsPanel = () => {
        const statusColor = (status: string) => (
            status === 'success' ? '#4CAF6D' : status === 'failure' ? '#e05252' : status === 'timeout' ? '#E8A030' : 'var(--text-muted)'
        );
        return (
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[15px] font-semibold truncate max-w-[50%]" style={{ color: 'var(--text-primary)' }}>
                        Run Logs: {selectedTask.taskName}
                    </h2>
                    <div className="flex items-center gap-2">
                        <GhostButton icon={<IconRefresh size={14} />} onClick={() => { setSelectedLogId(null); fetchTaskLogs(selectedTask.taskId); }} disabled={isLoadingLogs || isTestingTask}>
                            Refresh
                        </GhostButton>
                        <GhostButton
                            icon={isTestingTask ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlayerPlay size={14} />}
                            onClick={() => handleRunTask(selectedTask.taskId)}
                            disabled={isTestingTask}
                        >
                            {isTestingTask ? 'Running…' : 'Run Task'}
                        </GhostButton>
                        <GhostButton icon={<IconAlarm size={14} />} onClick={() => { setIsViewingLogs(false); setSelectedLogId(null); }}>
                            Manage Task
                        </GhostButton>
                    </div>
                </div>

                {isLoadingLogs ? (
                    <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--text-muted)' }}>
                        <IconLoader2 size={20} className="animate-spin" /> Loading execution logs…
                    </div>
                ) : taskLogs.length === 0 ? (
                    <div className="text-center py-10 rounded-[10px] border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <IconNotes size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[13px]">No execution logs found for this task</p>
                        <p className="text-[11.5px] mt-1">Logs will appear here after task execution</p>
                    </div>
                ) : (
                    <div className="rounded-[10px] border mb-4 overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="overflow-y-auto" style={{ maxHeight: isLogsExpanded ? 600 : 250 }}>
                            <table className="min-w-full">
                                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                                    <tr>
                                        {['Execution Time', 'Status', 'Source'].map((h) => (
                                            <th key={h} className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {taskLogs.map((log) => (
                                        <tr
                                            key={log.executionId}
                                            onClick={() => setSelectedLogId(log.executionId)}
                                            className="cursor-pointer transition-colors border-t"
                                            style={{ borderColor: 'var(--border-subtle)', backgroundColor: selectedLogId === log.executionId ? 'var(--bg-active)' : 'transparent' }}
                                        >
                                            <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-primary)' }}>{userFriendlyDate(log.executedAt)}</td>
                                            <td className="px-4 py-3 text-[12.5px]">
                                                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-raised)', color: statusColor(log.status) }}>
                                                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                                                {log.source === 'manual-task-run' ? 'Manual Task Run' : log.source === 'scheduled-task' ? 'Scheduled Task' : log.source ?? 'Unknown'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-center py-1.5">
                            <button onClick={() => setIsLogsExpanded(!isLogsExpanded)} style={{ color: 'var(--text-muted)' }} title={isLogsExpanded ? 'Collapse logs' : 'Expand logs'}>
                                {isLogsExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                            </button>
                        </div>
                    </div>
                )}

                {selectedLogId && (
                    <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="text-[13.5px] font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <IconNotes size={16} /> Execution Details
                        </h3>
                        {isLoadingLogDetails ? (
                            <div className="flex items-center justify-center py-4 gap-2" style={{ color: 'var(--text-muted)' }}>
                                <IconLoader2 size={18} className="animate-spin" /> Loading details…
                            </div>
                        ) : selectedLogDetails ? (
                            <div className="space-y-4 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Executed At:</span> {userFriendlyDate(selectedLogDetails.executedAt)}</div>
                                    <div>
                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Status:</span>{' '}
                                        <span style={{ color: statusColor(selectedLogDetails.status) }}>
                                            {selectedLogDetails.status.charAt(0).toUpperCase() + selectedLogDetails.status.slice(1)}
                                        </span>
                                    </div>
                                </div>

                                {selectedLogDetails.details?.error && (
                                    <div className="rounded-[8px] p-3 border" style={{ backgroundColor: 'rgba(200,60,60,0.1)', borderColor: 'rgba(200,60,60,0.3)', color: '#e05252' }}>
                                        <div className="font-medium">Error:</div>
                                        <div className="mt-1">{selectedLogDetails.details.error}</div>
                                        {selectedLogDetails.details.message && <div className="mt-1">{selectedLogDetails.details.message}</div>}
                                    </div>
                                )}

                                {selectedLogDetails.details?.result && (
                                    <div className="rounded-[8px] p-3 border text-neutral-900 dark:text-white" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-subtle)' }}>
                                        <div className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Result:</div>
                                        {(() => {
                                            try {
                                                return (
                                                    <AgentLogBlock
                                                        messageIsStreaming={false}
                                                        message={{
                                                            id: selectedLogDetails.executionId,
                                                            data: { state: { agentLog: { data: { handled: true, result: selectedLogDetails.details.result } } } },
                                                            role: 'assistant',
                                                            content: '',
                                                            type: 'execution-log',
                                                        }}
                                                        conversationId={selectedLogDetails.details.sessionId || 'unknown-session'}
                                                        width={() => window.innerWidth * 0.5}
                                                    />
                                                );
                                            } catch {
                                                return (
                                                    <div className="text-[12.5px] whitespace-pre-wrap overflow-auto max-h-[300px]">
                                                        {typeof selectedLogDetails.details.result === 'object'
                                                            ? JSON.stringify(selectedLogDetails.details.result, null, 2)
                                                            : selectedLogDetails.details.result}
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>
                                )}

                                {selectedLogDetails.details?.startTime && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Started At:</span> {userFriendlyDate(selectedLogDetails.details.startTime)}</div>
                                        {selectedLogDetails.details.completedAt && <div><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Completed At:</span> {userFriendlyDate(selectedLogDetails.details.completedAt)}</div>}
                                        {selectedLogDetails.details.failedAt && <div><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Failed At:</span> {userFriendlyDate(selectedLogDetails.details.failedAt)}</div>}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-6 rounded-[8px] border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                                <IconExclamationCircle size={22} className="mx-auto mb-2 opacity-30" />
                                <p className="text-[13px]">No details available for this execution</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ── Editor panel ──
    const renderEditorPanel = () => (
        <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoadingTask ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                    <IconLoader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Loading task details…</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {selectedTask.taskId ? 'Edit Task' : 'New Task'}
                        </h2>
                        <div className="flex items-center gap-2">
                            {selectedTask.taskId && (
                                <>
                                    <GhostButton
                                        icon={isTestingTask ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlayerPlay size={14} />}
                                        onClick={() => handleRunTask(selectedTask.taskId)}
                                        disabled={isTestingTask}
                                    >
                                        {isTestingTask ? 'Running…' : 'Run Task'}
                                    </GhostButton>
                                    <GhostButton icon={<IconNotes size={14} />} onClick={() => setIsViewingLogs(true)}>
                                        View Logs
                                    </GhostButton>
                                </>
                            )}
                            <PrimaryButton
                                icon={isSubmitting ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
                                onClick={handleSaveTask}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Saving…' : 'Save Task'}
                            </PrimaryButton>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-[8px] text-[13px] border" style={{ backgroundColor: 'rgba(200,60,60,0.1)', borderColor: 'rgba(200,60,60,0.3)', color: '#e05252' }}>
                            {error}
                        </div>
                    )}

                    <div className="mb-4 p-3 rounded-[8px] flex items-start gap-2" style={{ backgroundColor: 'var(--bg-raised)' }}>
                        <IconInfoCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Scheduled tasks automate your Assistants, Action Sets, or Workflows to run at times you define.
                            {featureFlags.assistantEmailEvents && (
                                <> <IconBulb size={13} className="inline mx-0.5" style={{ color: '#E8A030' }} /> Tip: list assistant email event addresses under notifications.</>
                            )}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <FieldLabel>Task Name</FieldLabel>
                            <input
                                disabled={isDisabled()}
                                title={isDisabled() ? 'This task has been preconfigured and cannot be changed.' : ''}
                                type="text"
                                value={selectedTask.taskName}
                                onChange={(e) => setSelectedTask({ ...selectedTask, taskName: e.target.value })}
                                className={textFieldClass}
                                style={textFieldStyle}
                                placeholder="Name your task"
                            />
                        </div>

                        <div>
                            <FieldLabel>Description</FieldLabel>
                            <textarea
                                value={selectedTask.description}
                                onChange={(e) => setSelectedTask({ ...selectedTask, description: e.target.value })}
                                className={textFieldClass}
                                style={textFieldStyle}
                                rows={2}
                                placeholder="Describe what this task does"
                            />
                        </div>

                        <div>
                            <FieldLabel>Task Instructions</FieldLabel>
                            <textarea
                                value={selectedTask.taskInstructions}
                                onChange={(e) => setSelectedTask({ ...selectedTask, taskInstructions: e.target.value })}
                                className={textFieldClass}
                                style={textFieldStyle}
                                rows={4}
                                placeholder="Provide todo instructions for this task"
                            />
                        </div>

                        {!isDisabled() && (
                            <div>
                                <FieldLabel>Task Schedule</FieldLabel>
                                <div className="rounded-[8px] border p-3 text-neutral-900 dark:text-white" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <CronScheduleBuilder
                                        key={selectedTask.taskId || 'new'}
                                        value={selectedTask.cronExpression}
                                        onChange={(cronExpression) => setSelectedTask((prev) => ({ ...prev, cronExpression }))}
                                        dateRange={selectedTask.dateRange}
                                        onRangeChange={(range: ScheduleDateRange) => setSelectedTask((prev) => ({ ...prev, dateRange: range ? { ...range } : undefined }))}
                                        exclusionsEnabled={selectedTask.exclusionsEnabled}
                                        excludedDaysOfWeek={selectedTask.excludedDaysOfWeek}
                                        excludedWeeksOfMonth={selectedTask.excludedWeeksOfMonth}
                                        excludedMonths={selectedTask.excludedMonths}
                                        excludedDates={selectedTask.excludedDates}
                                        onExclusionsChange={(exclusions) => setSelectedTask((prev) => ({
                                            ...prev,
                                            exclusionsEnabled: exclusions.exclusionsEnabled,
                                            excludedDaysOfWeek: exclusions.excludedDaysOfWeek,
                                            excludedWeeksOfMonth: exclusions.excludedWeeksOfMonth,
                                            excludedMonths: exclusions.excludedMonths,
                                            excludedDates: exclusions.excludedDates,
                                        }))}
                                    />
                                </div>
                            </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedTask.active}
                                onChange={(e) => setSelectedTask({ ...selectedTask, active: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Active</span>
                        </label>

                        <div title={isDisabled() ? 'This task has been preconfigured and cannot be changed.' : ''}>
                            <FieldLabel>Task Type</FieldLabel>
                            <select
                                disabled={isDisabled()}
                                value={selectedTask.taskType === 'actionSet' || selectedTask.taskType === 'apiTool' ? 'actions' : (selectedTask.taskType ?? '')}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setNewActionSetActions([]);
                                    setNewActionSetName('');
                                    if (val === 'actions') {
                                        setShowActionSelector(true);
                                        setActionSubMode('apiTool');
                                        setSelectedTask({ ...selectedTask, objectInfo: { objectId: '', objectName: '' }, taskType: 'apiTool' });
                                        return;
                                    }
                                    setSelectedTask({ ...selectedTask, objectInfo: { objectId: '', objectName: '' }, taskType: val as ScheduledTaskType });
                                }}
                                className={textFieldClass}
                                style={textFieldStyle}
                            >
                                <option value="">Select Task Type</option>
                                <option value="assistant">Assistant</option>
                                {(featureFlags.actionSets || featureFlags.integrations) && <option value="actions">Action</option>}
                                {featureFlags.assistantWorkflows && <option value="workflow">Workflow</option>}
                            </select>
                        </div>

                        <div title={isDisabled() ? 'This task has been preconfigured and cannot be changed.' : ''}>
                            {getObjectSelector()}
                        </div>

                        <div>
                            <FieldLabel>Tags (comma separated)</FieldLabel>
                            <input
                                type="text"
                                value={selectedTask.tags?.join(', ') || ''}
                                onChange={(e) => setSelectedTask({ ...selectedTask, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                                className={textFieldClass}
                                style={textFieldStyle}
                                placeholder="maintenance, report, etc."
                            />
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Notification Settings</h3>
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={selectedTask.notifyOnCompletion ?? false} onChange={(e) => setSelectedTask({ ...selectedTask, notifyOnCompletion: e.target.checked })} className="w-4 h-4" />
                                    <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Notify on Successful Completion</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={selectedTask.notifyOnFailure ?? false} onChange={(e) => setSelectedTask({ ...selectedTask, notifyOnFailure: e.target.checked })} className="w-4 h-4" />
                                    <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Notify on Run Failure</span>
                                </label>
                                <div>
                                    <FieldLabel>Notification Email Addresses</FieldLabel>
                                    <input
                                        type="text"
                                        value={selectedTask.notifyEmailAddresses?.join(', ') || ''}
                                        onChange={(e) => setSelectedTask({ ...selectedTask, notifyEmailAddresses: e.target.value.split(',').map((email) => email.trim()).filter(Boolean) })}
                                        className={textFieldClass}
                                        style={textFieldStyle}
                                        placeholder="email1@example.com, email2@example.com"
                                    />
                                    <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-muted)' }}>Enter email addresses separated by commas</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div
            className="flex flex-col h-full w-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-app)', fontFamily: 'Inter, sans-serif' }}
        >
            {/* Top bar */}
            <div
                className="flex-shrink-0 flex items-center px-4 border-b gap-3"
                style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)', height: 48 }}
            >
                <button
                    onClick={() => homeDispatch({ field: 'page', value: 'chat' })}
                    className="flex items-center justify-center h-8 w-8 rounded-[8px] transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                    title="Back to chat"
                >
                    <IconX size={16} />
                </button>
                <div className="flex items-center gap-2">
                    <IconAlarm size={16} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Scheduled Tasks</span>
                </div>
            </div>

            {/* Body: list + detail */}
            <div className="flex flex-1 overflow-hidden">
                {/* List pane */}
                <div className="flex flex-col flex-shrink-0 w-[340px] border-r overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex flex-col gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between gap-2">
                            <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" />
                        </div>
                        <PrimaryButton onClick={handleNewTask} icon={<IconPlus size={14} />} className="w-full">
                            New Task
                        </PrimaryButton>
                        {availableTypes.length > 1 && (
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-[8px] text-[12.5px] border focus:outline-none"
                                style={textFieldStyle}
                            >
                                {availableTypes.map((t) => (
                                    <option key={t} value={t}>{t === 'All' ? 'All Types' : camelCaseToTitle(t)}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 py-2">
                        {isLoadingTasks ? (
                            <div className="flex flex-col gap-2 px-2 pt-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-[52px] rounded-[8px] animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
                                ))}
                            </div>
                        ) : totalVisible === 0 ? (
                            <EmptyState
                                message={search ? 'No tasks match your search' : 'No scheduled tasks yet'}
                                subMessage={!search ? 'Automate an assistant, action set, or workflow' : undefined}
                                onAction={!search ? handleNewTask : undefined}
                                actionLabel="Create your first task"
                            />
                        ) : (
                            Object.entries(tasksByType)
                                .filter(([type]) => typeFilter === 'All' || type === typeFilter)
                                .map(([type, tasks]) => (
                                    <div key={type} className="mb-3">
                                        {typeFilter === 'All' && (
                                            <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                                                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                    {camelCaseToTitle(type)}
                                                </span>
                                            </div>
                                        )}
                                        {tasks.map((task) => (
                                            <TaskRow
                                                key={task.taskId}
                                                task={task}
                                                isSelected={selectedTask.taskId === task.taskId}
                                                isDeleting={isDeletingId === task.taskId}
                                                onClick={() => handleLoadTask(task.taskId)}
                                                onDelete={(e) => handleDeleteTask(task.taskId, e)}
                                            />
                                        ))}
                                    </div>
                                ))
                        )}
                    </div>
                </div>

                {/* Detail pane */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    {isViewingLogs ? renderLogsPanel() : renderEditorPanel()}
                </div>
            </div>
        </div>
    );
};

export default NewScheduledTasksView;

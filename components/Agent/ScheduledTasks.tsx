// Manage scheduled tasks for agents

import React, { useState, useEffect, useContext } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import { IconPlus, IconTrash, IconLoader2, IconInfoCircle, IconNotes, IconBulb, IconExclamationCircle, IconSettingsAutomation, IconAlarm, IconChevronDown, IconChevronUp, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import cloneDeep from 'lodash/cloneDeep';
import toast from 'react-hot-toast';
import { ScheduleDateRange, ScheduledTask, ScheduledTaskType, TASK_TYPE_MAP, TaskExecutionRecord } from '@/types/scheduledTasks';
import { CronScheduleBuilder } from './CronScheduleBuilder';
import { InfoBox } from '../ReusableComponents/InfoBox';
import ExpansionComponent from '../Chat/ExpansionComponent';
import HomeContext from '@/pages/api/home/home.context';
import { createScheduledTask, deleteScheduledTask, executeTask, getScheduledTask, getTaskExecutionDetails, listScheduledTasks, updateScheduledTask } from '@/services/scheduledTasksService';
import { camelCaseToTitle } from '@/utils/app/data';
import { isAssistant } from '@/utils/app/assistants';
import { Prompt } from '@/types/prompt';
import { ActionSetList } from './ActionSets';
import AgentLogBlock from '../Chat/ChatContentBlocks/AgentLogBlock';
import { userFriendlyDate } from '@/utils/app/date';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import { getOpsForUser } from '@/services/opsService';
import { getAgentTools } from '@/services/agentService';
import ApiIntegrationsPanel from '../AssistantApi/ApiIntegrationsPanel';
import { AgentTool } from '@/types/agentTools';
import { OpDef } from '@/types/op';

const emptyTask = (): ScheduledTask => {
  return {
    taskId: '',
    taskName: '',
    description: '',
    cronExpression: '',
    active: true,
    taskInstructions: '',
    taskType: 'assistant',
    objectInfo: {objectId: '' , objectName: ''},
    tags: []
  }
}

interface ScheduledTaskPreview {
  taskId: string;
  taskName: string;
  taskType: ScheduledTaskType;
  active: boolean;  
}

interface ScheduledTasksProps {
  isOpen: boolean;
  onClose: () => void;
  initTask?: ScheduledTask;
}

export const ScheduledTasks: React.FC<ScheduledTasksProps> = ({
  isOpen, onClose, initTask }) => {

    const { state: { featureFlags, prompts, amplifyUsers } } = useContext(HomeContext);

  const [selectedTask, setSelectedTask] = useState<ScheduledTask>(initTask ?? emptyTask());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [isViewingLogs, setIsViewingLogs] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [taskLogs, setTaskLogs] = useState<TaskExecutionRecord[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedLogDetails, setSelectedLogDetails] = useState<any>(null);
  const [isLoadingLogDetails, setIsLoadingLogDetails] = useState(false);
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);
  const [showActionSetList, setShowActionSetList] = useState(false);
  const [showApiToolList, setShowApiToolList] = useState(false);
  const [availableApis, setAvailableApis] = useState<any[] | null>(null);
  const [availableAgentTools, setAvailableAgentTools] = useState<Record<string, any> | null>(null);

  const [isTestingTask, setIsTestingTask] = useState(false);

  // State for all tasks for the sidebar
  const [allTasks, setAllTasks] = useState<ScheduledTaskPreview[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");
  const [isLoadingTask, setIsLoadingTask] = useState(false);

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

  // Fetch tasks (mock for now)
  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      // This would be an actual API call in a real implementation
      const taskResult = await listScheduledTasks();

      if (taskResult.success && taskResult.data?.tasks) {
        setAllTasks(taskResult.data.tasks);
      } else {
        alert("Failed to load tasks");
      };
  
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setAllTasks([]);
    }
    setIsLoadingTasks(false);
  };
  
  // Load tasks when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen]);
  
  const handleSaveTask = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      if (!selectedTask.taskName.trim()) {
        setError('Task name is required');
        setIsSubmitting(false);
        return;
      }
      
      if (!selectedTask.cronExpression.trim()) {
        setError('Schedule is required');
        setIsSubmitting(false);
        return;
      }
      
      if (!selectedTask.objectInfo.objectId) {
        setError('An object must be selected under "Task Type"');
        setIsSubmitting(false);
        return;
      }

      
      if (selectedTask.taskId) {
        // Update existing task
        // console.log("updating task", selectedTask);
        const taskResult = await updateScheduledTask(
                           selectedTask.taskId, selectedTask)

        if (taskResult.success) {
          toast("Successfully updated task");
        } else {
          alert('Failed to update task');
        }
      } else {
        console.log("creating new task", selectedTask);
        // Create new task
        const task = cloneDeep(selectedTask);
        const { taskId, ...taskData } = task;
        const taskResult = await createScheduledTask(taskData);
        
        if (taskResult.success && taskResult.data?.taskId) {
          setSelectedTask({... selectedTask, taskId: taskResult.data.taskId});
          toast("Successfully saved task");
        } else {
          alert('Failed to save task');
          
        }
      }
      fetchTasks();
      
      
    } catch (err) {
      setError('An error occurred while saving the task');
      console.error(err);
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string, index: number) => {
    setIsDeletingTask(index);
    const taskResult = await deleteScheduledTask(taskId);
    if (taskResult.success) {
      toast("Successfully deleted task");
      setAllTasks(allTasks.filter(task => task.taskId !== taskId));
    } else {
      alert('Failed to delete task');
    }
  }
  
  const handleNewTask = () => {
    setSelectedTask(emptyTask());
  };

  const handleLoadTask = async (taskId: string) => {
    setIsLoadingTask(true);
    const taskResult = await getScheduledTask(taskId);
    if (taskResult.success && taskResult.data?.task) {
      // console.log("taskResult", taskResult.data.task);
      const task = taskResult.data.task;
      setSelectedTask(task);
      setSelectedLogId(null);
      setSelectedLogDetails(null);
      setIsViewingLogs(false);
    } else {
      alert("Failed to load task");
    }
    setIsLoadingTask(false);
  };

  const handleRunTask = async (taskId: string) => {
    setIsViewingLogs(true);
    setIsTestingTask(true);
    const startTime = new Date().toISOString();

    try {
      const taskResult = await executeTask(taskId);
      if (taskResult.success) {
        toast.success("Task execution started.");
        
        let attempts = 0;
        const maxAttempts = 200;
        
        const pollForLogs = async () => {
          attempts++;
          
          try {
            const fetchedLogs = await fetchTaskLogs(taskId, false);
            
            // Look for any new logs created after task start that are in an end state
            const completedLog = fetchedLogs.find((log: TaskExecutionRecord) => 
              log.executedAt > startTime && 
              ['success', 'failure', 'timeout'].includes(log.status)
            );

            if (completedLog) {
              toast(`Task completed with status: ${completedLog.status}`);
              setTimeout(() => {
                setSelectedLogId(completedLog.executionId);
                setIsTestingTask(false);
              }, 1000);
              return; // Stop polling
            }

            // Continue polling if we haven't reached max attempts
            if (attempts <= maxAttempts) {
              setTimeout(pollForLogs, 2500);
            } else {
              toast.error("Timeout waiting for task completion logs. Please check logs manually.");
              setIsTestingTask(false);
            }
            
          } catch (error) {
            console.error("Error fetching logs:", error);
            toast.error("Failed to fetch task logs");
            setIsTestingTask(false);
          }
        };

        // Start polling after 1 second
        setTimeout(pollForLogs, 1000);

      } else {
        toast.error("Failed to run task: " + (taskResult.message || "Unknown error"));
        setIsTestingTask(false);
      }
    } catch (error) {
      console.error("Error executing task:", error);
      toast.error("Error executing task");
      setIsTestingTask(false);
    }
  };

  const renderRunTaskButton = () => (
      <button
        className={`px-2  ${buttonStyle}`}
        onClick={() => handleRunTask(selectedTask.taskId)}>
        {isTestingTask ? 
        <><IconLoader2 size={18} className='animate-spin' />Running Task...</> : 
        <> <IconPlayerPlay size={18} />Run Task</>}
        
      </button>
  );


  const renderSidebar = () => {
    // Group tasks by type and sort by active status within each group
    const tasksByType = allTasks.reduce((acc, task) => {
      if (!acc[task.taskType]) {
        acc[task.taskType] = [];
      }
      acc[task.taskType].push(task);
      return acc;
    }, {} as Record<ScheduledTaskType, typeof allTasks>);
    
    // Sort tasks by active status (active first, then inactive)
    Object.keys(tasksByType).forEach(type => {
      tasksByType[type as ScheduledTaskType].sort((a, b) => {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return 0;
      });
    });

    const getIcon = (taskType: keyof typeof TASK_TYPE_MAP) => {
      const IconComponent = TASK_TYPE_MAP[taskType];
      return <IconComponent size={18} />
    }

    // Get all available types for the filter dropdown
    const availableTypes = ["All", ...Object.keys(tasksByType)];

    return (
      <div className="w-1/4 border-r border-neutral-300 dark:border-neutral-700 overflow-y-auto pr-4"
          style={{height: '100% !important'}}>
    
        <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-bold">Scheduled Tasks</div>
            <button onClick={handleNewTask} title="Add New Task" className="hover:text-blue-600">
                <IconPlus size={18} />
            </button>
        </div>

        
        {isLoadingTasks ? (
          <div className="text-center p-4 text-neutral-500 dark:text-neutral-400">
            Loading tasks...
          </div>
        ) : 
        !Array.isArray(allTasks) || allTasks.length === 0 ? (
          <div className="text-center p-4 text-neutral-500 dark:text-neutral-400">
            No tasks available
          </div>
        ) : (
          <div className="space-y-4">
              <div className="mb-3">
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Filter by type
            </label>
            <select 
              className="w-full px-2 py-1 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
            >
              {availableTypes.map((type, i) => (
                <option key={i} value={type}>
                  {camelCaseToTitle(type)}
                </option>
              ))}
            </select>
          </div>
            {Object.entries(tasksByType)
              .filter(([type, _]) => selectedTypeFilter === "All" || type === selectedTypeFilter)
              .map(([type, tasks]) => (
                <div key={type} className="space-y-2">
                  {selectedTypeFilter === "All" && (
                    <div className="flex flex-row gap-2 text-sm font-semibold justify-center text-neutral-400 dark:text-neutral-500 capitalize border-b border-neutral-500 pb-1">
                      {type} {getIcon(type as keyof typeof TASK_TYPE_MAP)}
                    </div>
                  )}
                  {tasks.map((task, index) => (
                    <div
                      key={task.taskId}
                      className={`px-2 py-1 rounded-lg cursor-pointer flex flex-row ${
                        selectedTask.taskId === task.taskId
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handleLoadTask(task.taskId)}>
                      <div className="flex flex-col truncate w-full">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200">
                         {task.taskName}  
                        </div>
                        
                        <div className="flex flex-row items-center mt-1">
                          {getIcon(task.taskType)}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            task.active 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                              : 'text-gray-500'
                          }`}>
                            {task.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      
                      {selectedTask.taskId === task.taskId &&
                        <button className="ml-auto right-2 flex-shrink-0"
                          title="Delete Task"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(task.taskId, index);
                          }}
                        >
                          {isDeletingTask === index ? (
                            <IconLoader2 size={18} className="animate-spin text-neutral-500" />
                          ) : (<IconTrash className="text-red-500 hover:text-red-700" size={18} />)}
                        </button>
                      }
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  const handleActionSetSelect = (actionSet: any) => {
    setSelectedTask({...selectedTask, objectInfo: {objectId: actionSet.id || '', objectName: actionSet.name || 'Unnamed Set'}});
    setShowActionSetList(false);
  };

  const handleApiToolSelect = (name: string, opSpecs: any) => {
    setSelectedTask({...selectedTask, objectInfo: {objectId: name, objectName: name, data: {op: opSpecs}}});
    setShowApiToolList(false);
  }
  
  // useEffect(() => {
  //   console.log("selectedTask", selectedTask);
  // }, [selectedTask]);

  const isDisabled = () => {
    if (!selectedTask.taskType) return false;
    const isEnforced = selectedTask.objectInfo.data?.enforced || false;
    return isEnforced;
  }

  const getTitleComment = () => `${isDisabled() ? "This Task has been preconfigured and cannot to be changed." : ""}`

  const getObjectSelector = (taskType: ScheduledTaskType | undefined) => {
    if (!taskType) return <></>;
    
    const isEnforced = isDisabled();
    
    switch (taskType) {
      case 'assistant':
        const asts = prompts.filter((p:Prompt) => isAssistant(p));
        if (asts.length === 0) {
          return <div className="flex flex-row gap-2 text-center p-4 text-neutral-500 dark:text-neutral-400">
                  <IconExclamationCircle className='text-red-500' size={18} />
                  No assistants found
                 </div>;
        }

        return (
          <div className="flex flex-row gap-2 mb-4">
              <select
                  className={`mt-[-4px] w-full rounded-lg px-4 border py-2 text-neutral-900 shadow focus:outline-none bg-neutral-100 dark:bg-[#40414F] dark:text-neutral-100 custom-shadow 
                  ${selectedTask.objectInfo?.objectId ? 'border-neutral-500 dark:border-neutral-800 dark:border-opacity-50 ' : 'border-red-500 dark:border-red-800'}
                  ${isEnforced ? 'opacity-50 cursor-not-allowed' : ''}`}
                  id="autoPopulateSelect"
                  value={selectedTask.objectInfo?.objectId ?? ''}
                  disabled={isEnforced}
                  onChange={(e) => setSelectedTask({...selectedTask, objectInfo: {objectId: e.target.value, objectName: prompts.find(p => p.data?.assistant?.definition.assistantId === e.target.value)?.name || ''}})}
                  >
                    <option value="">Select Assistant</option>
                  {asts.map((ast, index) => (
                      <option key={index} value={ast.data?.assistant?.definition.assistantId ?? ast.id}>
                          {ast.name}
                      </option>
                      ))}
              </select>
          </div>
        )
      case 'actionSet':
        if (!featureFlags.actionSets) return <></>;
        return (
          <div className="flex flex-col mb-4 relative">
            <div 
              onClick={() => !isEnforced && setShowActionSetList(!showActionSetList)}
              className={`mt-[-4px] w-full rounded-lg px-4 border py-2 text-neutral-900 shadow focus:outline-none bg-neutral-100 dark:bg-[#40414F] dark:text-neutral-100 custom-shadow flex justify-between items-center
              ${selectedTask.objectInfo?.objectId ? 'border-neutral-500 dark:border-neutral-800 dark:border-opacity-50 ' : 'border-red-500 dark:border-red-800'}
              ${isEnforced ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span>{selectedTask.objectInfo?.objectName || 'Select Action Set'}</span>
              <IconChevronDown 
                size={18} 
                className={`transition-transform ${showActionSetList && !isEnforced ? 'rotate-180' : ''}`}
              />
            </div>
            
            {featureFlags.actionSets && showActionSetList && !isEnforced && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-[#343541] border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg">
                <div className="p-3" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <ActionSetList onLoad={handleActionSetSelect} />
                </div>
              </div>
            )}
          </div>
        );
      case "apiTool":

      return (
        <div className="flex flex-col mb-4 relative">
          <div 
            onClick={() => !isEnforced && setShowApiToolList(!showApiToolList)}
            className={`mt-[-4px] w-full rounded-lg px-4 border py-2 text-neutral-900 shadow focus:outline-none bg-neutral-100 dark:bg-[#40414F] dark:text-neutral-100 custom-shadow flex justify-between items-center
            ${selectedTask.objectInfo?.objectId ? 'border-neutral-500 dark:border-neutral-800 dark:border-opacity-50 ' : 'border-red-500 dark:border-red-800'}
            ${isEnforced ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span>{selectedTask.objectInfo?.objectName || 'Select API Tool'}</span>
            <IconChevronDown 
              size={18} 
              className={`transition-transform ${showApiToolList && !isEnforced ? 'rotate-180' : ''}`}
            />
          </div>
          
          {featureFlags.integrations && showApiToolList && !isEnforced && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-[#343541] border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg">
              <div className="p-3" >
                <div className='border-b flex flex-col border-neutral-500'>
                  <ApiIntegrationsPanel
                      // API-related props
                      availableApis={availableApis}
                      onClickApiItem={(api: OpDef) => {
                        const op = {
                              "tool_name": api.name,
                              "name": api.name,
                              "description": api.description,
                              "id": api.name,
                              "type": api.type || '',
                              "parameters": api.parameters,
                              "tags": api.tags ?? [],
                              "bindings": api.bindings,
                              "method": api.method
                            }
                        handleApiToolSelect(api.name, op);
                      }}
                      // Agent tools props
                      availableAgentTools={availableAgentTools}
                      onClickAgentTool={ (tool: AgentTool) => {
                        const op = {
                          "tool_name": tool.tool_name,
                          "name": tool.tool_name,
                          "description": tool.description,
                          "id": tool.tool_name,
                          "type": "builtIn",
                          "parameters": tool.parameters,
                          "tags": tool.tags ?? [],
                          "bindings": tool.bindings
                        }
                        handleApiToolSelect(tool.tool_name, op);
                      }}
                      // Configuration
                      allowConfiguration={true}
                      // python function 
                      allowCreatePythonFunction={false}
                      hideApisPanel={['external']}
                      height="300px"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      );
        
      default:
        return <></>
    }
  }

  
  const renderMainContent = () => (
    <div className="flex-1 pl-4">
      {isLoadingTask ? (
        <div className="flex flex-col items-center justify-center h-full">
          <IconLoader2 size={32} className="animate-spin mb-4 text-blue-500" />
          <p className="text-neutral-600 dark:text-neutral-300">Loading task details...</p>
        </div>
      ) : (
        <>
          <div className="relative mt-2 ">
            <ExpansionComponent
              closedWidget={<IconInfoCircle size={18} className='flex-shrink-0'/>}
              title="Understanding Scheduled Tasks"
              content={<div className="mb-8 py-2">
                <InfoBox
                  content={
                    <span className=''>
                      <p className="mb-2">
                        Scheduled tasks automate your Assistants or Action Sets, running them at times you define.
                      </p>
                      <h4 className="font-semibold mt-3 mb-1">Key Configuration Points:</h4>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li><strong>Task Instructions:</strong> {'Provide specific instructions or context that the Assistant or Action Set will use when it executes. This is your "todo" for the task.'}</li>
                        <li><strong>Active/Inactive:</strong> {'This toggle allows you to enable or pause the task\'s schedule. Inactive tasks will not run until re-activated.'}</li>
                        <li><strong>Task Type:</strong>
                          <ul className="list-disc pl-5 mt-1">
                            <li><strong>Assistant:</strong> Runs one of your configured AI Assistants.</li>
                            {featureFlags.actionSets && <li><strong>Action Set:</strong> Executes a predefined sequence of operations or tool usages.</li>}
                          </ul>
                        </li>
                        <li><strong>Tags:</strong> {'Assign tags (e.g., "reporting", "maintenance") to help organize and filter your scheduled tasks.'}</li>
                        <li><strong>Notification Settings:</strong>
                          <ul className="list-disc pl-5 mt-1">
                            <li>Choose to receive email notifications upon successful completion or failure of the task.</li>
                            <li>Specify email addresses where these notifications should be sent.</li>
                          </ul>
                        </li>
                      </ul>
                      <p className="mt-3 text-sm">
                        {'You can also manually trigger a task at any time using the "Run Task" button and review "Scheduled Run Logs" to monitor its execution history, status, and any generated outputs or errors.'}
                      </p>
                    </span>
                  }
                />
              </div> }
              /> 
              <div className="absolute right-1 top-[-6px] flex flex-row gap-3">
                { selectedTask.taskId &&
                <>
                {renderRunTaskButton()}
                
                <button
                  className={`px-1.5  ${buttonStyle}`}
                  onClick={() => setIsViewingLogs(true)}>
                  <IconNotes size={18} />
                  View Scheduled Run Logs
                </button>
                </>
                }
              </div>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <div className="my-4">
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Task Name
            </label>
            <input
              disabled={isDisabled()}
              title={getTitleComment()}
              type="text"
              value={selectedTask.taskName}
              onChange={(e) => setSelectedTask({...selectedTask, taskName: e.target.value})}
              className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
              placeholder="Name your task"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Description
            </label>
            <textarea
              value={selectedTask.description}
              onChange={(e) => setSelectedTask({...selectedTask, description: e.target.value})}
              className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
              rows={2}
              placeholder="Describe what this task does"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Task Instructions
            </label>
            <textarea
              value={selectedTask.taskInstructions}
              onChange={(e) => setSelectedTask({...selectedTask, taskInstructions: e.target.value})}
              className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
              rows={4}
              placeholder="Provide todo instructions for this task"
            />
          </div>
          
          {!isDisabled() && 
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Task Schedule
            </label>
            <CronScheduleBuilder 
              value={selectedTask.cronExpression} 
              onChange={(cronExpression) => setSelectedTask({...selectedTask, cronExpression})}
              dateRange={selectedTask.dateRange}
              onRangeChange={(range: ScheduleDateRange) => setSelectedTask(prevTask => ({...prevTask, dateRange: range ? { ...range } : undefined})) }
            />
          </div>}
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedTask.active}
                onChange={(e) => setSelectedTask({...selectedTask, active: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm font-medium dark:text-neutral-200">Active</span>
            </label>
          </div>
          
          <div className="mb-4" 
               title={`${isDisabled() ? "This Task has been preconfigured and cannot to be changed." : ""}`}>
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Task Type
            </label> 
            <select
              disabled={isDisabled() }
              value={selectedTask.taskType ?? ''}
              onChange={(e) => {
                const updatedSelectedTask = {...selectedTask, 
                                             objectInfo: {objectId: '', objectName: ''},
                                             taskType: e.target.value as ScheduledTaskType}
                setSelectedTask(updatedSelectedTask);
              }}
              className="w-full shadow custom-shadow p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
            >
              <option value="">Select Task Type</option>
              <option value="assistant">Assistant</option>
              {featureFlags.actionSets && <option value="actionSet">Action Set</option>}
              {featureFlags.integrations &&  <option value="apiTool">API Action</option>}
            </select>
          </div>

          <div title={`${isDisabled() ? "This Task has been preconfigured and cannot to be changed." : ""}`}>
            {getObjectSelector(selectedTask.taskType)}
          </div>
          

          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={selectedTask.tags?.join(', ') || ''}
              onChange={(e) => setSelectedTask({...selectedTask, tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)})}
              className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
              placeholder="maintenance, report, etc."
            />
          </div>

          <div className="mb-4 border-t pt-4 dark:border-neutral-700">
            <h3 className="text-sm font-medium mb-3 dark:text-neutral-200">Notification Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedTask.notifyOnCompletion ?? false}
                  onChange={(e) => setSelectedTask({...selectedTask, notifyOnCompletion: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm dark:text-neutral-200">Notify on Successful Completion</span>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedTask.notifyOnFailure ?? false}
                  onChange={(e) => setSelectedTask({...selectedTask, notifyOnFailure: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm dark:text-neutral-200">Notify on Run Failure</span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
                  Notification Email Addresses
                </label>
                <input
                  type="text"
                  value={selectedTask.notifyEmailAddresses?.join(', ') || ''}
                  onChange={(e) => setSelectedTask({
                    ...selectedTask, 
                    notifyEmailAddresses: e.target.value.split(',').map(email => email.trim()).filter(email => email)
                  })}
                  className="w-full p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
                  placeholder="email1@example.com, email2@example.com"
                />
                <div className="flex flex-row items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Enter email addresses separated by commas
                  {featureFlags.assistantEmailEvents &&
                   <> <IconBulb className='text-amber-400 dark:text-amber-300' size={16}/>
                    {"Tip: List Assistant Email Event Adresses"}
                  </>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const fetchTaskLogs = async (taskId: string, notify: boolean = true) => {
    if (!taskId) return [];
    
    if (notify) setIsLoadingLogs(true);
    try {
      const result = await getScheduledTask(taskId);
      if (result.success && result.data?.task?.logs) {
        setTaskLogs(result.data.task.logs);
        return result.data.task.logs; // Return the fetched logs
      } else {
        if (notify) setTaskLogs([]);
        // Do not alert here as it's used for polling
        if (notify) alert("Error fetching task logs"); 
        return [];
      }
    } catch (error) {
      console.error("Error fetching task logs:", error);
      return []; // Return empty on error
    } finally {
      if (notify) setIsLoadingLogs(false);
    }
  };

  const fetchLogDetails = async (taskId: string, executionId: string) => {
    if (!taskId || !executionId) return;
    
    setIsLoadingLogDetails(true);
    try {
      // Fetch the log details from the API
      const result = await getTaskExecutionDetails(taskId, executionId);
      if (result.success && result.data?.details) {
        setSelectedLogDetails(result.data.details);
      } else {
        alert("Error fetching log details: " + (result.data?.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error fetching log details:", error);
    } finally {
      setIsLoadingLogDetails(false);
    }
  };

  useEffect(() => {
    if (isViewingLogs ) {
      fetchTaskLogs(selectedTask.taskId);
    }
  }, [isViewingLogs, selectedTask.taskId]);

  useEffect(() => {
    if (selectedLogId && selectedTask.taskId) {
      fetchLogDetails(selectedTask.taskId, selectedLogId);
    } else {
      setSelectedLogDetails(null);
    }
  }, [selectedLogId, selectedTask.taskId]);

  const renderLogsContent = () => {


    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'success':
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              Success
            </span>
          );
        case 'failure':
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              Failed
            </span>
          );
        case 'timeout':
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
              Timeout
            </span>
          );
        default:
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
              {status}
            </span>
          );
      }
    };

    return (
      <div className="flex-1 pl-4">
        <div className="relative mt-2">
          <h2 className="text-lg font-semibold mb-4 truncate max-w-[48%]">Run Logs: {selectedTask.taskName}</h2>
          <div className="absolute right-1 top-[-6px] flex flex-row gap-3">
            <>
            <button
                title={`Refresh Logs`}
                className={`flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 p-2 dark:text-white transition-colors duration-200 cursor-pointer hover:bg-neutral-200  dark:hover:bg-gray-500/10`}
                onClick={() => {
                    setSelectedLogId(null);
                    fetchTaskLogs(selectedTask.taskId);
                }}
                disabled={isLoadingLogs || isTestingTask}

            >
                <IconRefresh size={16}/>
            </button>
            {renderRunTaskButton()}
            <button
              className={`px-2 mr-1.5 ${buttonStyle}`}
              onClick={() => {
                setIsViewingLogs(false);
                setSelectedLogId(null);
              }}>
              <IconAlarm size={18} />
              Manage Scheduled Task
            </button>
            </>
          </div>
        </div>

        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 size={24} className="animate-spin text-blue-500 mr-2" />
            <span>Loading execution logs...</span>
          </div>
        ) : taskLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <IconNotes size={32} className="mx-auto mb-2 opacity-30" />
            <p>No execution logs found for this task</p>
            <p className="text-xs mt-1">Logs will appear here after task execution</p>
          </div>
        ) : (
          <div className="border border-gray-300 dark:border-gray-600 rounded mb-4">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">
                      Execution Time
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">
                      Status
                    </th>
                    {/* <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">
                      ID
                    </th> */}
              
                  </tr>
                </thead>
              </table>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: isLogsExpanded ? '600px' : '250px' }}>
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {taskLogs.map((log) => (
                    <tr 
                      key={log.executionId} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${selectedLogId === log.executionId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => setSelectedLogId(log.executionId)}
                    >
                      <td className="px-4 py-3 text-sm w-1/3">
                        {userFriendlyDate(log.executedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm w-1/3 ">
                        <div>
                        {getStatusBadge(log.status)}
                        </div>
                      </td>
                       <td className="px-4 py-3 text-sm w-1/3 font-mono text-xs">
                        {log.source ?? 'Unknown'}
                      </td>
                      {/* <td className="px-4 py-3 text-sm w-1/3 font-mono text-xs">
                        {log.executionId}
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center text-center">
               <button
                onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title={isLogsExpanded ? "Collapse logs" : "Expand logs"}
              >
                {isLogsExpanded ? <IconChevronUp size={24} /> : <IconChevronDown size={24} />}
              </button>
              </div>
          </div>
        )}

        {/* Log details panel */}
        {selectedLogId && (
          <div className="border border-gray-300 dark:border-gray-600 rounded p-4">
            <h3 className="text-md font-medium mb-3 flex items-center">
              <IconNotes size={18} className="mr-2" />
              Execution Details
            </h3>
            
            {isLoadingLogDetails ? (
              <div className="flex items-center justify-center py-4">
                <IconLoader2 size={20} className="animate-spin text-blue-500 mr-2" />
                <span>Loading details...</span>
              </div>
            ) : selectedLogDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Executed At:</span> {userFriendlyDate(selectedLogDetails.executedAt)}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <span className={
                      selectedLogDetails.status === 'success' ? 'text-green-600 dark:text-green-400' : 
                      selectedLogDetails.status === 'failure' ? 'text-red-600 dark:text-red-400' : 
                      selectedLogDetails.status === 'running' ? 'text-blue-600 dark:text-blue-400' : 
                      'text-gray-600 dark:text-gray-400'
                    }>
                      {' '}{selectedLogDetails.status.charAt(0).toUpperCase() + selectedLogDetails.status.slice(1)}
                    </span>
                  </div>
                </div>
                
                {selectedLogDetails.details?.error && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                    <div className="font-medium">Error:</div>
                    <div className="mt-1">{selectedLogDetails.details.error}</div>
                    {selectedLogDetails.details.message && (
                      <div className="mt-1">{selectedLogDetails.details.message}</div>
                    )}
                  </div>
                )}
                
                {selectedLogDetails.details?.result && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <div className="font-medium mb-2">Result:</div>
                    
                    {typeof selectedLogDetails.details.result && <>{renderAgentResult()}</> }

                  </div>
                )}
                
                {selectedLogDetails.details?.startTime && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Started At:</span> {userFriendlyDate(selectedLogDetails.details.startTime)}
                    </div>
                    {selectedLogDetails.details.completedAt && (
                      <div>
                        <span className="font-medium">Completed At:</span> {userFriendlyDate(selectedLogDetails.details.completedAt)}
                      </div>
                    )}
                    {selectedLogDetails.details.failedAt && (
                      <div>
                        <span className="font-medium">Failed At:</span> {userFriendlyDate(selectedLogDetails.details.failedAt)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <IconExclamationCircle size={24} className="mx-auto mb-2 opacity-30" />
                <p>No details available for this execution</p>
                <p className="text-xs mt-1">Try selecting a different log entry</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAgentResult = () => {
    try {
      // console.log(selectedLogDetails.details.result);
      const agentLog = (<AgentLogBlock 
        messageIsStreaming={false} 
        message={{ 
          id: selectedLogDetails.executionId,
          data: { state: { agentLog: {"data": { "handled": true, "result": selectedLogDetails.details.result } } } },
          role: 'assistant',
          content: '',
          type: 'execution-log'
        }}
        conversationId={selectedLogDetails.details.sessionId || 'unknown-session'}
        width={() => window.innerWidth * 0.5}
      />);
      return agentLog;

    } catch {
      console.error("Error rendering agent result:", error);
      return (
        <div className="text-sm whitespace-pre-wrap overflow-auto max-h-[300px]">
          {typeof selectedLogDetails.details.result === 'object' 
            ? JSON.stringify(selectedLogDetails.details.result, null, 2)
            : selectedLogDetails.details.result}
        </div>
      )
    }
  }
  
  if (!isOpen) return null;
  
  return (
    <Modal
      title="Manage Scheduled Tasks"
      content={
        <div className="flex flex-row" style={{height: (window.innerHeight * 0.9) * 0.8}}>
          {renderSidebar()}
          {isViewingLogs ? renderLogsContent() : renderMainContent()}
        </div>
      }
      showCancel={true}
      submitLabel={isSubmitting ? 'Saving Task...' : 'Save Task'}
      onSubmit={handleSaveTask}
      onCancel={onClose}
      // disableSubmit={isSubmitting}
    />
  );
};

const buttonStyle = "py-2 border rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-2";



interface ScheduleButtonProps {
  taskType: ScheduledTaskType;
  objectInfo: {objectId: string, objectName: string};
}

export const ScheduledTaskButton: React.FC<ScheduleButtonProps> = ({
  taskType, objectInfo}) => {
    const handleClick = () => {
      const task = emptyTask();
      task.taskType = taskType;
      task.objectInfo = objectInfo;

      window.dispatchEvent(new CustomEvent('homeChatBarTabSwitch', 
        { detail: { tab: "Settings" , side: "left", action: () => {
          window.dispatchEvent(new CustomEvent('openScheduledTasksTrigger', {detail: {scheduledTask: task}}));
        } } }))

    }
  return (
    <button id={`scheduled-task-button-${objectInfo.objectId}`}
        title={`Schedule ${camelCaseToTitle(taskType)} Task`}
        className={"flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 p-2 dark:text-white transition-colors duration-200 cursor-pointer hover:bg-neutral-200  dark:hover:bg-gray-500/10"}
        onClick={handleClick}
    >
        <IconAlarm size={16}/>
    </button>
  )
};

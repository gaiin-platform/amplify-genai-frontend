// Manage scheduled tasks for agents

import React, { useState, useEffect, useContext } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import { IconPlus, IconTrash, IconLoader2, IconEdit, IconInfoCircle, IconNotes, IconBulb, IconExclamationCircle, IconSettingsAutomation, IconAlarm, IconChevronDown, IconPlayerPlay } from '@tabler/icons-react';
import cloneDeep from 'lodash/cloneDeep';
import ActionButton from '../ReusableComponents/ActionButton';
import toast from 'react-hot-toast';
import { ScheduleDateRange, ScheduledTask, ScheduledTaskType, TASK_TYPE_MAP, TaskExecutionRecord } from '@/types/scheduledTasks';
import { CronScheduleBuilder } from './CronScheduleBuilder';
import { InfoBox } from '../ReusableComponents/InfoBox';
import ExpansionComponent from '../Chat/ExpansionComponent';
import HomeContext from '@/pages/api/home/home.context';
import { createScheduledTask, deleteScheduledTask, getScheduledTask, listScheduledTasks, updateScheduledTask } from '@/services/scheduledTasksService';
import { camelCaseToTitle } from '@/utils/app/data';
import { isAssistant } from '@/utils/app/assistants';
import { Prompt } from '@/types/prompt';
import { ActionSetList } from './ActionSets';

const emptyTask = (): ScheduledTask => {
  return {
    taskId: '',
    taskName: '',
    description: '',
    cronExpression: '',
    active: false,
    taskInstructions: '',
    type: 'assistant',
    object_id: '',
    tags: []
  }
}

interface ScheduledTaskPreview {
  taskId: string;
  taskName: string;
  type: ScheduledTaskType;
  active: boolean;  
}

interface ScheduledTasksProps {
  isOpen: boolean;
  onClose: () => void;
  width?: () => number;
  height?: () => number;
  initTask?: ScheduledTask;
}

export const ScheduledTasks: React.FC<ScheduledTasksProps> = ({
  isOpen, onClose, width, height, initTask }) => {

    const { state: { featureFlags, prompts, amplifyUsers }, dispatch: homeDispatch } = useContext(HomeContext);

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
  const [showActionSetList, setShowActionSetList] = useState(false);
  const [selectedActionSetName, setSelectedActionSetName] = useState('Select Action Set');
  const [isTestingTask, setIsTestingTask] = useState(false);

  // State for all tasks for the sidebar
  const [allTasks, setAllTasks] = useState<ScheduledTaskPreview[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");

  // Fetch tasks (mock for now)
  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      // This would be an actual API call in a real implementation
      // const taskResult = await listScheduledTasks();
      setAllTasks([
        {
          "taskId": "a4f2c8e6-7b31-4d9a-8f15-2c6d85e9b741",
          "taskName": "Daily Email Summary",
          "type": "assistant",
          "active": true
        },  
        {
          "taskId": "b8e3d9f2-1c67-4a53-9b84-5f2d91e3c087",
          "taskName": "Weekly Report Generator",
          "type": "actionSet",
          "active": true
        },
        {
          "taskId": "c7d1e9f3-5a82-4b61-8c23-9e7d34f5a216",
          "taskName": "Customer Support Follow-up",
          "type": "assistant",
          "active": false
        },
        {
          "taskId": "d2f8e4c1-9b37-4a52-8d69-1f7e34c8b902",
          "taskName": "Project Status Update",
          "type": "actionSet",
          "active": true
        },
        {
          "taskId": "e9f7d5c3-4a18-4b29-9c65-3f8d27e6b415",
          "taskName": "Market Research Analysis",
          "type": "assistant",
          "active": true
        },
        {
          "taskId": "f1e8d7c6-2b35-4a91-8d47-5e9c23f7b841",
          "taskName": "Social Media Content Creation",
          "type": "actionSet",
          "active": false
        },
        {
          "taskId": "a3b9c8d7-6e51-4f27-9c83-2e7d16f5a432",
          "taskName": "Data Backup Verification",
          "type": "assistant",
          "active": true
        },
        {
          "taskId": "b5e2f1d9-3c74-4a82-9d56-1e7f32c8b415",
          "taskName": "Invoice Processing",
          "type": "actionSet",
          "active": true
        },
        {
          "taskId": "c8d9e7f6-5b21-4c93-8a65-9f7d34e2b185",
          "taskName": "Security Audit Check",
          "type": "assistant",
          "active": false
        },
        {
          "taskId": "d7f6e5c4-1a92-4b83-7d65-2f9e13c8b745",
          "taskName": "Customer Onboarding Workflow",
          "type": "actionSet",
          "active": true
        }
      ])

      // if (taskResult.success && taskResult.data?.tasks) {
      //   setAllTasks(taskResult.data.tasks);
      // } else {
      //   alert("Failed to load tasks");
      // };
  
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
      
      if (!selectedTask.object_id) {
        setError('An object must be selected under "Task Type"');
        setIsSubmitting(false);
        return;
      }

      
      if (selectedTask.taskId) {
        // Update existing task
        const taskResult = await updateScheduledTask(
                           selectedTask.taskId, selectedTask)

        if (taskResult.success) {
          toast("Successfully updated task");
        } else {
          alert('Failed to update task');
          
        }
      } else {
        // Create new task
        const task = cloneDeep(selectedTask);
        const { taskId, ...taskData } = task;
        const taskResult = await createScheduledTask(taskData);
      
        if (taskResult.success) {
          toast("Successfully saved task");
        } else {
          alert('Failed to save task');
          
        }
      }
      setIsSubmitting(false);
      fetchTasks();
      
      
    } catch (err) {
      setError('An error occurred while saving the task');
      console.error(err);
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
    const taskResult = await getScheduledTask(taskId);
    if (taskResult.success && taskResult.data?.task) {
      setSelectedTask(taskResult.data.task);
      setSelectedLogId(null);
      setSelectedLogDetails(null);
    } else {
      alert("Failed to load task");
    }
  };

  const handleRunTask = async (taskId: string) => {
    setIsTestingTask(true);
    // executeTask
    // we will need to keep refreshing logs until we get some results, then we can say its done 
    // const taskResult = await runScheduledTask(selectedTask.taskId);
    // if (taskResult.success) {
    //   toast("Successfully ran task");
    // } else {
    //   alert("Failed to run task");
    // }
    setIsTestingTask(false);
  }
  const renderSidebar = () => {
    // Group tasks by type and sort by active status within each group
    const tasksByType = allTasks.reduce((acc, task) => {
      if (!acc[task.type]) {
        acc[task.type] = [];
      }
      acc[task.type].push(task);
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
                          {getIcon(task.type)}
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
    setSelectedTask({...selectedTask, object_id: actionSet.id || ''});
    setSelectedActionSetName(actionSet.name || 'Unnamed Set');
    setShowActionSetList(false);
  };

  const getObjectSelector = (taskType: ScheduledTaskType) => {
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
                  ${selectedTask.object_id ? 'border-neutral-500 dark:border-neutral-800 dark:border-opacity-50 ' : 'border-red-500 dark:border-red-800'}`}
                  id="autoPopulateSelect"
                  value={selectedTask.object_id}
                  onChange={(e) => setSelectedTask({...selectedTask, object_id: e.target.value})}
                  >
                  <option key={-1} value={''}>
                          {'Select Assistant'}
                  </option>  
                  {prompts.map((ast, index) => (
                      <option key={index} value={ast.data?.assistant?.definition.assistantId ?? ast.id}>
                          {ast.name}
                      </option>
                      ))}
              </select>
          </div>
        )
      case 'actionSet':
        return (
          <div className="flex flex-col mb-4 relative">
            <div 
              onClick={() => setShowActionSetList(!showActionSetList)}
              className={`mt-[-4px] w-full rounded-lg px-4 border py-2 text-neutral-900 shadow focus:outline-none bg-neutral-100 dark:bg-[#40414F] dark:text-neutral-100 custom-shadow cursor-pointer flex justify-between items-center
              ${selectedTask.object_id ? 'border-neutral-500 dark:border-neutral-800 dark:border-opacity-50 ' : 'border-red-500 dark:border-red-800'}`}
            >
              <span>{selectedActionSetName}</span>
              <IconChevronDown 
                size={18} 
                className={`transition-transform ${showActionSetList ? 'rotate-180' : ''}`}
              />
            </div>
            
            {showActionSetList && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-[#343541] border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg">
                <div className="p-3" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <ActionSetList onLoad={handleActionSetSelect} />
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
      <div className="relative mt-2 ">
        <ExpansionComponent
          closedWidget={<IconInfoCircle size={18} className='flex-shrink-0'/>}
          title="Understanding Scheduled Tasks"
          content={<div className="mb-8 py-2">
            <InfoBox
              content={
                <span className='px-4'>
                 Scheduled tasks are used to run assistant workflows at specified intervals.
              
              {/* <ul className="mt-2 list-disc pl-5">
                <li><strong>Steps and Tools:</strong> Each step allows you to select a Tool (internal API, custom API, or agent tool). </li>
                <li className="ml-4"> Selecting a tool will automatically populate the Arguments section. </li>
                <li className="ml-4"> {"Edit the Arguments instructions to influence the Assistant's generated argument value."} </li>
                <li className="ml-4"> Use the Values section to assign permanent values to specific arguments, otherwise the assistant will decide the value at runtime.</li>
                <li className="ml-4"> Arguments are not required and can be removed by clicking the Trash Icon to the right of the argument name. </li>
                <li className="ml-4"> Select the Edit Icon to the right of the argument name to enable/disable the ability to edit the argument value when adding this workflow to an assistant. </li>
                <li><strong>Action Segments:</strong> Group related steps by giving them the same Action Segment name. Steps with the same segment will be color-coded together. When creating an assistant with this template, you can enable/disable entire segments at once.</li>
                <li><strong>Terminate Step:</strong> Every workflow must end with a terminate step. This step is automatically added and should always remain as the last step in your workflow.</li>
              </ul> */}
            </span>
            }
          /></div> }
          /> 
          <div className="absolute right-1 top-[-6px] flex flex-row gap-3">
            { selectedTask.taskId &&
             <button
              className={`px-2  ${buttonStyle}`}
              onClick={() => handleRunTask(selectedTask.taskId)}>
              {isTestingTask ? <IconLoader2 size={18} className='animate-spin' /> : <IconPlayerPlay size={18} />}
              Run Task
            </button>
            }
            <button
              className={`px-1.5  ${buttonStyle}`}
              onClick={() => setIsViewingLogs(true)}>
              <IconNotes size={18} />
              View Scheduled Run Logs
            </button>
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
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Task Schedule
        </label>
        <CronScheduleBuilder 
          value={selectedTask.cronExpression} 
          onChange={(cronExpression) => setSelectedTask({...selectedTask, cronExpression})}
          onRangeChange={(range: ScheduleDateRange) => setSelectedTask({...selectedTask, dateRange: range})}
        />
      </div>
      
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
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          Task Type
        </label>
        <select
          value={selectedTask.type}
          onChange={(e) => {
            const updatedSelectedTask = {...selectedTask, 
                                         object_id: '',
                                         type: e.target.value as ScheduledTaskType}
            setSelectedTask(updatedSelectedTask);
          }}
          className="w-full shadow custom-shadow p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
        >
          <option value="assistant">Assistant</option>
          <option value="actionSet">Action Set</option>
        </select>
      </div>

      {getObjectSelector(selectedTask.type)}
      

      
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
              checked={selectedTask.notifyOnCompletion}
              onChange={(e) => setSelectedTask({...selectedTask, notifyOnCompletion: e.target.checked})}
              className="mr-2"
            />
            <span className="text-sm dark:text-neutral-200">Notify on Successful Completion</span>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedTask.notifyOnFailure}
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
    </div>
  );

  const fetchTaskLogs = async (taskId: string) => {
    // if (!taskId) return;
    
    setIsLoadingLogs(true);
    try {
      const result = await getScheduledTask(taskId);
      if (result.success && result.data?.task?.logs) {
        setTaskLogs(result.data.task.logs);
      } else {
        setTaskLogs([]);
        alert("Error fetching task logs");
      }

    } catch (error) {
      console.error("Error fetching task logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchLogDetails = async (taskId: string, executionId: string) => {
    if (!taskId || !executionId) return;
    
    setIsLoadingLogDetails(true);
    try {
      // In a real implementation, we would fetch the log details from the API
      // const result = await getTaskExecutionDetails(taskId, executionId);
      // if (result.success && result.data?.executionDetails) {
      //   setSelectedLogDetails(result.data.executionDetails);
      // }
      
      // Mock data for demonstration
      setSelectedLogDetails({
        id: executionId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 1000 * 60 * 2), // 2 minutes later
        output: "Task completed successfully. Generated daily report and sent to 3 recipients.",
        error: executionId === "log-003" ? "Failed to connect to email server" : null,
        steps: [
          { name: "Initialize", status: "completed", duration: "0.5s" },
          { name: "Fetch Data", status: "completed", duration: "1.2s" },
          { name: "Process Results", status: "completed", duration: "3.7s" },
          { name: "Generate Report", status: "completed", duration: "2.1s" },
          { name: "Send Notifications", status: executionId === "log-003" ? "failed" : "completed", duration: executionId === "log-003" ? "N/A" : "1.5s" }
        ]
      });
    } catch (error) {
      console.error("Error fetching log details:", error);
    } finally {
      setIsLoadingLogDetails(false);
    }
  };

  useEffect(() => {
    if (isViewingLogs ) { //&& selectedTask.taskId
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
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    };

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
          <h2 className="text-lg font-semibold mb-4">Run Logs: {selectedTask.taskName}</h2>
          <div className="absolute right-1 top-[-6px]">
            <button
              className={`px-2.5 mr-0.5 ${buttonStyle}`}
              onClick={() => setIsViewingLogs(false)}>
              <IconAlarm size={18} />
              Manage Scheduled Task
            </button>
          </div>
        </div>

        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 size={24} className="animate-spin text-blue-500 mr-2" />
            <span>Loading execution logs...</span>
          </div>
        ) : taskLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No execution logs found for this task
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">
                      ID
                    </th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '250px' }}>
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {taskLogs.map((log) => (
                    <tr 
                      key={log.executionId} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${selectedLogId === log.executionId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => setSelectedLogId(log.executionId)}
                    >
                      <td className="px-4 py-3 text-sm w-1/3">
                        {formatDate(log.executedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm w-1/3">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-4 py-3 text-sm w-1/3 font-mono text-xs">
                        {log.executionId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Log details panel */}
        {selectedLogId && (
          <div className="border border-gray-300 dark:border-gray-600 rounded p-4">
            <h3 className="text-md font-medium mb-3">Execution Details</h3>
            
            {isLoadingLogDetails ? (
              <div className="flex items-center justify-center py-4">
                <IconLoader2 size={20} className="animate-spin text-blue-500 mr-2" />
                <span>Loading details...</span>
              </div>
            ) : selectedLogDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Started:</span> {formatDate(selectedLogDetails.startTime)}
                  </div>
                  <div>
                    <span className="font-medium">Completed:</span> {formatDate(selectedLogDetails.endTime)}
                  </div>
                </div>
                
                {selectedLogDetails.error && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                    <div className="font-medium">Error:</div>
                    <div className="mt-1">{selectedLogDetails.error}</div>
                  </div>
                )}
                
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-medium mb-2">Output:</div>
                  <div className="text-sm">{selectedLogDetails.output}</div>
                </div>
                
                <div>
                  <div className="font-medium mb-2">Execution Steps:</div>
                  <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Step
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Duration
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedLogDetails.steps.map((step: any, index: number) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm">{step.name}</td>
                            <td className="px-3 py-2 text-sm">
                              {step.status === 'completed' ? (
                                <span className="text-green-600 dark:text-green-400">Completed</span>
                              ) : step.status === 'failed' ? (
                                <span className="text-red-600 dark:text-red-400">Failed</span>
                              ) : (
                                <span>{step.status}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm">{step.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Select a log to view details
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  if (!isOpen) return null;
  
  return (
    <Modal
      title="Manage Scheduled Tasks"
      content={
        <div className="flex flex-row" style={{height: (height ? height() : window.innerHeight * 0.9) * 0.8}}>
          {renderSidebar()}
          {isViewingLogs ? renderLogsContent() : renderMainContent()}
        </div>
      }
      showCancel={true}
      submitLabel={isSubmitting ? 'Saving Task...' : 'Save Task'}
      onSubmit={handleSaveTask}
      onCancel={onClose}
      disableSubmit={isSubmitting}
      width={() => width ? width() : Math.min(1000, window.innerWidth * 0.9)}
      height={() => height ? height() : window.innerHeight * 0.9}
    />
  );
};

const buttonStyle = "py-2 border rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-2";

import { AttachedDocument } from '@/types/attacheddocument';
import { createScheduledTask, deleteScheduledTask, getScheduledTask, updateScheduledTask } from '@/services/scheduledTasksService';
import { isWebsiteDs } from '@/components/DataSources/WebsiteURLInput';
import { OpDef } from '@/types/op';
import { getOpByName } from '@/services/opsService';
import { DriveRescanSchedule } from '@/components/Promptbar/components/AssistantModalComponents/AssistantDriveDataSources';

export type AssistantScheduledTaskUses = 'websites' | 'driveFiles';

/**
 * Determines the appropriate cron expression for website scanning based on data sources
 * Returns null if no website data sources need scheduling
 */
export const determineWebsiteScanCron = (dataSources: AttachedDocument[]): string | null => {
  const websiteDataSources = dataSources.filter(ds => 
    isWebsiteDs(ds) && ds.metadata?.scanFrequency !== null && ds.metadata?.scanFrequency !== undefined
  );
  
  if (websiteDataSources.length === 0) return null;
  
  const now = new Date();
  const websiteSchedules: Array<{
    frequency: number;
    lastScanned: Date | null;
    nextDueDate: Date;
    dayOfMonth: number;
    dayOfWeek: number;
  }> = [];
  
  // Analyze each website's schedule
  for (const ds of websiteDataSources) {
    const frequency = ds.metadata!.scanFrequency as number;
    const lastScannedStr = ds.metadata?.lastScanned;
    
    let lastScanned: Date | null = null;
    let nextDueDate: Date;
    
    if (lastScannedStr) {
      lastScanned = new Date(lastScannedStr);
      nextDueDate = new Date(lastScanned.getTime() + (frequency * 24 * 60 * 60 * 1000));
    } else {
      // No lastScanned - assume it was just scanned (when assistant was created)
      nextDueDate = new Date(now.getTime() + (frequency * 24 * 60 * 60 * 1000));
    }
    
    websiteSchedules.push({
      frequency,
      lastScanned,
      nextDueDate,
      dayOfMonth: nextDueDate.getDate(),
      dayOfWeek: nextDueDate.getDay()
    });
  }
  
  // Group by frequency type
  const dailyWebsites = websiteSchedules.filter(w => w.frequency === 1);
  const weeklyWebsites = websiteSchedules.filter(w => w.frequency >= 6 && w.frequency <= 8);
  const monthlyWebsites = websiteSchedules.filter(w => w.frequency >= 28 && w.frequency <= 32);
  const otherWebsites = websiteSchedules.filter(w => 
    w.frequency > 1 && w.frequency < 6 || (w.frequency > 8 && w.frequency < 28) || w.frequency > 32
  );
  
  // If we have daily websites, we need daily checks
  if (dailyWebsites.length > 0) return "0 2 * * *"; // Daily at 2 AM
  
  // Handle monthly websites with smart day-of-month scheduling
  if (monthlyWebsites.length > 0 && weeklyWebsites.length === 0 && otherWebsites.length === 0) {
    const daysOfMonth = monthlyWebsites.map(w => Math.min(28, w.dayOfMonth + 1)); // Add 1 day buffer, cap at 28
    const uniqueDays = Array.from(new Set(daysOfMonth)).sort((a, b) => a - b);
    
    if (uniqueDays.length === 1) {
      // Single day needed
      return `0 2 ${uniqueDays[0]} * *`; // e.g., "0 2 25 * *"
    } else {
      // Multiple days needed - schedule for all of them
      return `0 2 ${uniqueDays.join(',')} * *`; // e.g., "0 2 24,26 * *"
    }
  }
  
  // Handle weekly websites
  if (weeklyWebsites.length > 0 && otherWebsites.length === 0) {
    const daysOfWeek = weeklyWebsites.map(w => w.dayOfWeek);
    
    if (daysOfWeek.length === 1 || new Set(daysOfWeek).size === 1) {
      // All on same day of week - schedule for that day
      const targetDay = daysOfWeek[0];
      return `0 2 * * ${targetDay}`; // e.g., "0 2 * * 1" for Mondays
    } else {
      // Multiple different days - analyze spacing to find optimal pattern
      const uniqueDays = Array.from(new Set(daysOfWeek)).sort((a, b) => a - b);
      
      if (uniqueDays.length === 2) {
        // Two different days - check spacing
        const spacing = Math.min(
          Math.abs(uniqueDays[1] - uniqueDays[0]),
          7 - Math.abs(uniqueDays[1] - uniqueDays[0]) // wrap-around spacing
        );
        
        if (spacing === 1) {
          // Adjacent days (e.g., Mon & Tue) - check daily to be safe
          return "0 2 * * *";
        } else if (spacing === 2) {
          // 2 days apart (e.g., Mon & Wed) - check every other day
          return "0 2 */2 * *";
        } else if (spacing === 3) {
          // 3 days apart (e.g., Mon & Thu) - check every 3 days
          return "0 2 */3 * *";
        } else {
          // More spaced out - schedule for both specific days
          return `0 2 * * ${uniqueDays.join(',')}`;
        }
      } else if (uniqueDays.length === 3) {
        // Three different days - check spacing pattern
        const spacings = [];
        for (let i = 0; i < uniqueDays.length; i++) {
          const next = uniqueDays[(i + 1) % uniqueDays.length];
          const spacing = next > uniqueDays[i] ? next - uniqueDays[i] : (7 - uniqueDays[i]) + next;
          spacings.push(spacing);
        }
        const minSpacing = Math.min(...spacings);
        
        if (minSpacing === 1) {
          // Any consecutive days - check daily to avoid missing any
          return "0 2 * * *";
        } else if (minSpacing === 2) {
          // Minimum 2 days apart - check every other day
          return "0 2 */2 * *";
        } else if (minSpacing >= 3) {
          // Well spaced - check every 3 days or schedule specific days
          const maxSpacing = Math.max(...spacings);
          if (maxSpacing <= 3) {
            return "0 2 */3 * *";
          } else {
            return `0 2 * * ${uniqueDays.join(',')}`;
          }
        }
      } else {
        // 4+ different days or complex pattern - check every other day to be safe
        return "0 2 */2 * *";
      }
    }
  }
  
  // Handle mixed frequencies or other cases
  const shortestFrequency = Math.min(...websiteSchedules.map(w => w.frequency));
  
  if (shortestFrequency <= 3) {
    return "0 2 * * *"; // Daily
  } else if (shortestFrequency <= 7) {
    return "0 2 */2 * *"; // Every other day
  } else if (shortestFrequency <= 14) {
    return "0 2 */3 * *"; // Every 3 days
  } else {
    return "0 2 */7 * *"; // Weekly
  }
};

/**
 * Converts a cron expression back to DriveRescanSchedule format
 * Used for initializing UI state from existing scheduled tasks
 */
export const cronToDriveRescanSchedule = (cronExpression: string): DriveRescanSchedule => {
  if (!cronExpression) {
    return {
      enabled: false,
      frequency: 'none'
    };
  }

  // Parse cron format: "minute hour dayOfMonth month dayOfWeek"
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    console.warn('Invalid cron expression:', cronExpression);
    return {
      enabled: false,
      frequency: 'none'
    };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  // Convert hour:minute back to HH:MM format
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  // Determine frequency based on cron pattern
  if (dayOfMonth === '*' && dayOfWeek === '*') {
    // Daily: "30 9 * * *"
    return {
      enabled: true,
      frequency: 'daily',
      time
    };
  } else if (dayOfMonth === '*' && dayOfWeek !== '*') {
    // Weekly: "30 9 * * 1"
    return {
      enabled: true,
      frequency: 'weekly',
      time,
      dayOfWeek: parseInt(dayOfWeek)
    };
  } else if (dayOfMonth !== '*' && dayOfWeek === '*') {
    // Monthly: "30 9 15 * *"
    return {
      enabled: true,
      frequency: 'monthly',
      time,
      dayOfMonth: parseInt(dayOfMonth)
    };
  }

  // Fallback for unrecognized patterns
  console.warn('Unrecognized cron pattern:', cronExpression);
  return {
    enabled: false,
    frequency: 'none'
  };
};

/**
 * Converts DriveRescanSchedule to cron expression
 * Returns null if scheduling is disabled
 */
export const determineDriveScanCron = (driveRescanSchedule: DriveRescanSchedule): string | null => {
  if (!driveRescanSchedule.enabled || driveRescanSchedule.frequency === 'none') {
    return null;
  }

  const time = driveRescanSchedule.time || '09:00';
  const [hour, minute] = time.split(':');

  switch (driveRescanSchedule.frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    
    case 'weekly':
      const dayOfWeek = driveRescanSchedule.dayOfWeek || 1; // Default to Monday
      return `${minute} ${hour} * * ${dayOfWeek}`;
    
    case 'monthly':
      const dayOfMonth = driveRescanSchedule.dayOfMonth || 1; // Default to 1st
      return `${minute} ${hour} ${dayOfMonth} * *`;
    
    default:
      return null;
  }
};


/**
 * Gets the operation definition for different scheduled task types
 */
export const getOp = async (opName: AssistantScheduledTaskUses, assistantId: string): Promise<OpDef> => {

  const bindings = {
    assistantId: {
      value: assistantId,
      mode: "manual" as const
    }
  }
    let tag: string;
    let operationId: string;
    
    switch (opName) {
      case 'websites':
        tag = "rescan-websites";
        operationId = "rescanWebsites";
        break;
      case 'driveFiles':
        tag = "process-drive-sources";
        operationId = "processDriveSources";
        break;
      default:
        throw new Error(`Unknown operation type: ${opName}`);
    }
  
    try {
      const result = await getOpByName(tag, operationId, true); // system_op = true
      
      if (!result.success) {
        throw new Error(`Failed to fetch operation: ${result.message}`);
      }
      
      return {
        ...result.data,
        bindings // Add bindings if needed
      } as OpDef;
    } catch (error) {
      throw new Error(`Error fetching operation ${opName}`);
    }
};

interface ManageScheduledTasksParams {
  currentTaskId?: string | null;
  needsScheduledTask: boolean;
  cronExpression?: string | null;
  scheduledUse: AssistantScheduledTaskUses;
  assistantInfo: {
    name: string;
    assistantId: string;
  };
  dataSources?: AttachedDocument[]; // Added dataSources to the interface
}

/**
 * Manages the lifecycle of scheduled tasks (create/update/delete) based on requirements
 * Returns the task ID if a task exists/was created, null if no task is needed
 */
export const manageScheduledTasks = async (params: ManageScheduledTasksParams): Promise<string | null> => {
  const { currentTaskId, needsScheduledTask, cronExpression, scheduledUse, assistantInfo, dataSources } = params;
  
  // Case 1: No task needed and no existing task
  if (!needsScheduledTask && !currentTaskId) {
    console.log(`No task needed and no existing task for ${scheduledUse}`);
    return null;
  }
  
  // Case 2: No task needed but existing task exists - delete it
  if (!needsScheduledTask && currentTaskId) {
    console.log(`Deleting scheduled task ${currentTaskId} for ${scheduledUse}`);
    try {
      await deleteScheduledTask(currentTaskId);
      console.log(`Deleted scheduled task ${currentTaskId} for ${scheduledUse}`);
    } catch (error) {
      console.error(`Failed to delete scheduled task ${currentTaskId}:`, error);
    }
    return null;
  }
  
  // Case 3: Task needed but no existing task - create new one
  if (needsScheduledTask && !currentTaskId) {
    if (!cronExpression) {
      console.error('Cron expression required to create scheduled task');
      return null;
    }
    
    try {
      // Get scan frequency info for better task description
      let scanInfo = '';
      let description = '';
      if (scheduledUse === 'websites') {
        const websiteDataSources = dataSources?.filter(ds => 
          ds.metadata?.scanFrequency !== null && ds.metadata?.scanFrequency !== undefined
        ) || [];
        const frequencies = websiteDataSources.map(ds => ds.metadata!.scanFrequency as number);
        const uniqueFreqs = Array.from(new Set(frequencies)).sort((a, b) => a - b);
        scanInfo = uniqueFreqs.length > 1 
          ? ` (scan frequencies: ${uniqueFreqs.join(', ')} days)`
          : ` (scan frequency: ${uniqueFreqs[0]} days)`;

        description = `Automatically rescans ${scheduledUse} data sources for assistant ${assistantInfo.name}${scanInfo}. The system checks if individual sources are due for rescanning based on their lastScanned timestamp and scanFrequency setting.`;
      }

      const instructions = `Execute the ${scheduledUse === 'websites' ? 'website' : 'drive file'} rescanning operation for assistant "${assistantInfo.name}" at assistantId ${assistantInfo.assistantId}.
Provide a brief report on the execution result, including whether the operation succeeded and any message returned by the rescan function.`
      
      const newTask = {
        taskName: getTaskName(scheduledUse, assistantInfo.name),
        description: description,
        cronExpression: cronExpression,
        active: true,
        taskInstructions: instructions,
        taskType: 'apiTool' as const,
        objectInfo: {
          objectId: `rescan_assistant_${scheduledUse}`,
          objectName: `rescan_assistant_${scheduledUse}`, 
          data: {
            op: await getOp(scheduledUse, assistantInfo.assistantId),
            enforced: true,
            assistant: {
              name: assistantInfo.name,
              assistantId: assistantInfo.assistantId,
            }
          }
        },
        tags: [`auto-${scheduledUse}-rescan`]
      };
      
      const result = await createScheduledTask(newTask);
      if (result.success && result.data?.taskId) {
        console.log(`Created scheduled task ${result.data.taskId} for ${scheduledUse} with cron: ${cronExpression}`);
        return result.data.taskId;
      } else {
        console.error(`Failed to create scheduled task for ${scheduledUse}:`, result);
        return null;
      }
    } catch (error) {
      console.error(`Error creating scheduled task for ${scheduledUse}:`, error);
      return null;
    }
  }
  
  // Case 4: Task needed and existing task exists - check if update needed
  if (needsScheduledTask && currentTaskId) {
    if (!cronExpression) {
      console.error('Cron expression required to update scheduled task');
      return currentTaskId; // Return existing task ID
    }
    return await updateScheduledTasks(currentTaskId, cronExpression, scheduledUse, assistantInfo);
  }
  
  return null;
};

const getTaskName = (scheduledUse: AssistantScheduledTaskUses, assistantName: string ) => {
    return `Auto-rescan ${scheduledUse} for ${assistantName}`;
}

export const updateScheduledTasks = async (currentTaskId: string, cronExpression: string, scheduledUse: AssistantScheduledTaskUses, assistantInfo: { name: string, assistantId: string }) => {
      
      try {
        const existingTaskResult = await getScheduledTask(currentTaskId);
        if (existingTaskResult.success && existingTaskResult.data?.task) {
          const currentTask = existingTaskResult.data.task;
          if (!cronExpression && !currentTask.cronExpression) {
            console.error('Cron expression required to update scheduled task');
            return currentTaskId; // Return existing task ID
          }
          if (!cronExpression) cronExpression = currentTask.cronExpression;

          const taskName = getTaskName(scheduledUse, assistantInfo.name);
          
          // Check if cron expression or assistant info changed
          const needsUpdate = 
            currentTask.cronExpression !== cronExpression || currentTask.taskName !== taskName || 
            currentTask.objectInfo.data.assistant.assistantId !== assistantInfo.assistantId;
          
          if (needsUpdate) {
            // always enforce the assistantId
            currentTask.objectInfo.data.op.bindings.assistantId.value = assistantInfo.assistantId;
            const updatedTask = {
              ...currentTask,
              cronExpression: cronExpression,
              taskName: taskName,
              description: `Automatically rescans ${scheduledUse} data sources for assistant ${assistantInfo.name}`,
              taskInstructions: `Rescan ${scheduledUse} data sources for assistant ${assistantInfo.name}`,
              objectInfo: {
                ...currentTask.objectInfo,
                data: {
                  ...currentTask.objectInfo.data,
                  assistant: {
                    name: assistantInfo.name,
                    assistantId: assistantInfo.assistantId
                  },
                }
              }
            };
            
            const updateResult = await updateScheduledTask(currentTaskId, updatedTask);
            if (updateResult.success) {
              console.log(`Updated scheduled task ${currentTaskId} for ${scheduledUse}`);
            } else {
              console.error(`Failed to update scheduled task ${currentTaskId}:`, updateResult);
              alert(`Failed to update scheduled task ${currentTaskId}: ${updateResult.message}`);
            }
          }
          
          return currentTaskId;
        } else {
          // Existing task not found, create new one
          console.warn(`Scheduled task ${currentTaskId} not found, creating new one`);
          return await manageScheduledTasks({
            currentTaskId: null,
            needsScheduledTask: true,
            cronExpression,
            scheduledUse,
            assistantInfo
          });
        }
      } catch (error) {
        console.error(`Error managing existing scheduled task ${currentTaskId}:`, error);
        return currentTaskId; // Return existing task ID as fallback
      }
   
}

import {IconRobot, IconSettingsAutomation} from '@tabler/icons-react';

// Type of task that can be scheduled
export const TASK_TYPE_MAP = {
  'assistant': IconRobot,
  'actionSet':  IconSettingsAutomation,
} as const;

// Then derive the type from the keys
export type ScheduledTaskType = keyof typeof TASK_TYPE_MAP;

// Date range for scheduling
export interface ScheduleDateRange {
  startDate?: Date | null;
  endDate?: Date | null;
}

// Execution history entry
export interface TaskExecutionRecord {
  executionId: string;
  executedAt: Date;
  status: 'success' | 'failure' | 'timeout';
}

/**
 * Main scheduled task interface
 */
export interface ScheduledTask {
  // Core identification
  taskId: string;
  taskName: string;
  description: string;
  
  // Task configuration
  taskInstructions: string; // todo 
  type: ScheduledTaskType;
  object_id: string; // ID of the associated object (actionSet, assistant, etc.)
  
  // Scheduling
  cronExpression: string;
  dateRange?: ScheduleDateRange;
  
  // Status
  active: boolean;
  lastRunAt?: Date;

  // Optional
  tags?: string[];
  notifyOnCompletion?: boolean;
  notifyOnFailure?: boolean;
  notifyEmailAddresses?: string[]; // consider ast email 
  
  logs?: TaskExecutionRecord[];
}


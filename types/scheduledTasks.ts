import {IconPuzzle, IconRobot, IconSettingsAutomation, IconTool} from '@tabler/icons-react';

// Type of task that can be scheduled
export const TASK_TYPE_MAP = {
  'assistant': IconRobot,
  'actionSet':  IconSettingsAutomation,
  'apiTool' : IconTool,
  'workflow' : IconPuzzle
} as const;

// Then derive the type from the keys
export type ScheduledTaskType = keyof typeof TASK_TYPE_MAP;

// Date range for scheduling
export interface ScheduleDateRange {
  startDate: string | null;
  endDate: string | null;
}

// Execution history entry
export interface TaskExecutionRecord {
  executionId: string;
  executedAt: string;
  status: 'success' | 'failure' | 'timeout' | 'running';
  source?: string;
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
  taskInstructions: string; 
  taskType: ScheduledTaskType;
  objectInfo: {objectId: string, objectName: string, data?: any}; 
  
  // Scheduling
  // For biweekly tasks cronExpression is BIWEEKLY:{dayName}:{hour}:{minute}:{startDate}
  cronExpression: string;
  dateRange?: ScheduleDateRange;

  // Exclusion rules
  exclusionsEnabled?: boolean;       // true when the "Set exclusion rules" checkbox is ticked
  excludedDaysOfWeek?: string[];     // e.g. ["saturday","sunday"]  — Daily mode
  excludedWeeksOfMonth?: number[];   // e.g. [2,3]                  — Weekly mode (1=1st,5=Last)
  excludedMonths?: string[];         // e.g. ["june","july"]        — Monthly mode
  excludedDates?: string[];          // e.g. ["2026-12-25"]         — all modes
  
  // Status
  active: boolean;

  // Optional
  tags?: string[];
  notifyOnCompletion?: boolean;
  notifyOnFailure?: boolean;
  notifyEmailAddresses?: string[]; // consider ast email 
  
  logs?: TaskExecutionRecord[];
}


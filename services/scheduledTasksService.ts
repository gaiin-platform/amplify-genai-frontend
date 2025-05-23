import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/vu-agent";
const SERVICE_NAME = "scheduled-tasks";

/**
 * Create a new scheduled task
 */
export const createScheduledTask = async (
  scheduledTask: any = {}
) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/create-scheduled-task",
    data: {...scheduledTask, timeZone},
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Get a scheduled task by ID
 */
export const getScheduledTask = async (taskId: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/get-scheduled-task",
    data: { taskId },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * List all scheduled tasks for the current user
 */
export const listScheduledTasks = async () => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/list-scheduled-tasks",
    data: {},
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Update an existing scheduled task
 */
export const updateScheduledTask = async (
  taskId: string,
  scheduledTask: any = {}
) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/update-scheduled-task",
    data: {
      taskId,
      ...scheduledTask,
      timeZone
    },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Delete a scheduled task
 */
export const deleteScheduledTask = async (taskId: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/delete-scheduled-task",
    data: { taskId },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Get detailed logs for a specific task execution
 */
export const getTaskExecutionDetails = async (taskId: string, executionId: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/get-task-execution-details",
    data: { taskId, executionId },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Manually execute a specific scheduled task immediately
 */
export const executeTask = async (taskId: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/execute-task",
    data: { taskId },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

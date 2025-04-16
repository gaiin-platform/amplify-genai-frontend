import { doRequestOp } from './doRequestOp';

const URL_PATH = '/vu-agent';
const SERVICE_NAME = 'emailEvents';

/**
 * Add or update an event template
 */
export const addEventTemplate = async (
  tag: string,
  prompt: Array<{ role: string; content: string }>,
  assistantId: string
) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/add-event-template",
    data: { tag, prompt, assistantId },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Remove an event template
 */
export const removeEventTemplate = async (tag: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/remove-event-template",
    data: { tag },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Retrieve an event template
 */
export const getEventTemplate = async (tag: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/get-event-template",
    data: { tag },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * List all event templates for the current user
 */
export const listEventTemplatesForUser = async () => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/list-event-templates",
    data: {},
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Add an allowed sender for a tag
 */
export const addAllowedSender = async (tag: string, sender: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/add-allowed-sender",
    data: { tag, sender },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Remove an allowed sender for a tag
 */                                                    // default to * to remove all allowed senders
export const removeAllowedSender = async (tag: string, sender: string = "*") => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/remove-allowed-sender",
    data: { tag, sender },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * List all allowed senders for a tag
 */
export const listAllowedSenders = async (tag: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/list-allowed-senders",
    data: { tag },
    service: SERVICE_NAME
  };
  const response = await doRequestOp(op);

  return response.data?.success ? response.data : response;
};

/**
 * Check if an event template tag is available for the current user and assistant
 */
export const isEventTemplateTagAvailable = async (tag: string, assistantId?: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/is-event-template-tag-available",
    data: { tag, ...(assistantId ? { assistantId } : {}) },
    service: SERVICE_NAME
  };
  const response = await doRequestOp(op);

  return response.data?.success ? response.data : response;
};
/**
 * The workflow template a New UI chat has attached, stored on `conversation.data` (like the skill and
 * connector selections) so it survives the home → chat handoff and never leaks into another chat.
 * The backend reads `workflowTemplateId` off the LAST message's `data` (amplify-lambda-js
 * assistants/assistants.js), exactly as the classic ChatInput sends it.
 */

export const CONVERSATION_WORKFLOW_KEY = 'nuiWorkflow';

export interface ConversationWorkflow {
  templateId: string;
  name: string;
}

/** Invalid / legacy values read as "no workflow" rather than reaching a request. */
export const getConversationWorkflow = (conversation: any): ConversationWorkflow | null => {
  const value = conversation?.data?.[CONVERSATION_WORKFLOW_KEY];
  if (!value || typeof value.templateId !== 'string' || !value.templateId.trim()) return null;
  return { templateId: value.templateId, name: typeof value.name === 'string' ? value.name : '' };
};

/** Conversation copy with the workflow set, or removed when `workflow` is null. */
export const withConversationWorkflow = <T extends { data?: any }>(
  conversation: T,
  workflow: ConversationWorkflow | null,
): T => {
  const { [CONVERSATION_WORKFLOW_KEY]: _previous, ...rest } = conversation.data ?? {};
  return { ...conversation, data: workflow ? { ...rest, [CONVERSATION_WORKFLOW_KEY]: workflow } : rest };
};

/** `data` to merge onto the outgoing user message. */
export const workflowMessageData = (workflow: ConversationWorkflow | null): { workflowTemplateId?: string } =>
  workflow ? { workflowTemplateId: workflow.templateId } : {};

/**
 * Why a workflow can't be attached right now, or undefined when it can. A workflow replaces the
 * assistant's own tooling, so it can't sit beside an assistant's workflow or built-in actions (the
 * classic input blocks the same combinations). Connector actions are not a block: attaching either
 * one detaches the other.
 */
export const workflowBlockReason = (opts: {
  assistantData?: { workflowTemplateId?: string; baseWorkflowTemplateId?: string; operations?: unknown[]; builtInOperations?: unknown[] } | null;
}): string | undefined => {
  const data = opts.assistantData;
  if (data?.workflowTemplateId || data?.baseWorkflowTemplateId) return 'This assistant already has a workflow';
  if ((data?.operations?.length ?? 0) > 0 || (data?.builtInOperations?.length ?? 0) > 0) return 'This assistant has built-in actions';
  return undefined;
};

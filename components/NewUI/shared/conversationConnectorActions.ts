import type { SelectedAction } from './AttachMenu';

/** Conversation.data key for the New UI's active connector selection. */
export const CONVERSATION_CONNECTOR_ACTIONS_KEY = 'nuiConnectorActions';

/**
 * Read the active New UI connector selection stored on one conversation.
 * Invalid/legacy values are treated as an empty selection rather than leaked
 * into a request.
 */
export const getConversationConnectorActions = (conversation: any): SelectedAction[] => {
  const actions = conversation?.data?.[CONVERSATION_CONNECTOR_ACTIONS_KEY];
  if (!Array.isArray(actions)) return [];
  return actions.filter(
    (action): action is SelectedAction =>
      Boolean(action) &&
      typeof action.fnId === 'string' &&
      typeof action.name === 'string' &&
      Array.isArray(action.ops),
  );
};

/** Flatten the selected composites to the configuredTools request shape. */
export const getConfiguredToolsForActions = (actions: SelectedAction[]) =>
  actions.flatMap((action) => action.ops);

/** Return a conversation copy with its New UI connector selection updated. */
export const withConversationConnectorActions = <T extends { data?: any }>(
  conversation: T,
  actions: SelectedAction[],
): T => ({
  ...conversation,
  data: {
    ...(conversation.data ?? {}),
    [CONVERSATION_CONNECTOR_ACTIONS_KEY]: actions,
  },
});

import type { Conversation } from '@/types/chat';

import {
  type DeploymentFeatureFlags,
  getDeploymentFeatureAvailability,
} from './deploymentFeaturePolicy';

const MANUAL_CHAT_TOOLS = [
  'webSearch',
  'artifacts',
  'codeInterpreter',
] as const;
export type ManualChatTool = (typeof MANUAL_CHAT_TOOLS)[number];

export const CONVERSATION_CHAT_TOOLS_KEY = 'nuiChatTools';

export function getAvailableManualChatTools(
  flags: DeploymentFeatureFlags,
): ManualChatTool[] {
  // A live, explicit opt-out is required. Callers pass the flags from HomeContext.
  if (flags.deploymentFeatures?.routingEnabled !== false) return [];
  const availability = getDeploymentFeatureAvailability(flags);
  return MANUAL_CHAT_TOOLS.filter((tool) => availability[tool]);
}

export function getConversationChatTools(
  conversation: Pick<Conversation, 'data'> | null | undefined,
): ManualChatTool[] {
  const saved: unknown = conversation?.data?.[CONVERSATION_CHAT_TOOLS_KEY];
  return Array.isArray(saved)
    ? MANUAL_CHAT_TOOLS.filter((tool) => saved.includes(tool))
    : [];
}

export function toggleManualChatTool(
  selection: readonly ManualChatTool[],
  tool: ManualChatTool,
): ManualChatTool[] {
  if (selection.includes(tool))
    return selection.filter((selected) => selected !== tool);
  // Artifacts and Code Interpreter each use a different backend assistant.
  const retained =
    tool === 'webSearch'
      ? selection
      : selection.filter((selected) => selected === 'webSearch');
  return [...retained, tool];
}

export function withConversationChatTools<T extends Pick<Conversation, 'data'>>(
  conversation: T,
  tools: ManualChatTool[],
): T {
  return {
    ...conversation,
    data: { ...conversation.data, [CONVERSATION_CHAT_TOOLS_KEY]: tools },
  };
}

export function getManualChatToolOptions(
  conversation: Pick<Conversation, 'data'>,
  flags: DeploymentFeatureFlags,
) {
  const selected = getConversationChatTools(conversation);
  const active = getAvailableManualChatTools(flags).filter((tool) =>
    selected.includes(tool),
  );
  return {
    ...(active.includes('webSearch') ? { enableWebSearch: true } : {}),
    ...(active.includes('artifacts') ? { artifactsMode: true } : {}),
    ...(active.includes('codeInterpreter') && !active.includes('artifacts')
      ? {
          codeInterpreterOnly: true,
          skipRag: true,
          ragOnly: false,
          ragEvaluation: false,
        }
      : {}),
  };
}

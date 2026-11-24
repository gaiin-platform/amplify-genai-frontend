import { PluginID } from '@/types/plugin';

type ChatOptions = { [key: string]: any } | undefined;

/**
 * RAG and document-cache options for a chat send.
 *
 * Deliberately independent of which plugins are selected: RAG/RAG_EVAL are hidden from the
 * plugin selector, so they never appear in `pluginIds`. Gating `skipRag` on them would flip
 * it for every request whenever the classic selector is active and break document
 * retrieval/caching. Document caching stays on for chat and off for assistant/group chats.
 */
export function applyRagOptions(
  options: ChatOptions,
  flags: { ragEnabled?: boolean; ragEvaluation?: boolean },
  pluginIds: string[] | null,
): ChatOptions {
  let result = options;
  if (!flags.ragEnabled) {
    result = { ...(result || {}), skipRag: true, ragOnly: false, ragEvaluation: false };
  } else if (flags.ragEvaluation && pluginIds?.includes(PluginID.RAG) && pluginIds?.includes(PluginID.RAG_EVAL)) {
    result = { ...(result || {}), ragEvaluation: true };
  }
  if (result?.assistantId || result?.groupId) {
    result = { ...(result || {}), skipDocumentCache: true };
  }
  return result;
}

/**
 * Classic plugin selector -> backend veto flags. The backend routes web search / artifacts
 * automatically; the selector can only veto them. Never send `artifactsMode` for this: it is
 * the raw artifact-generation stream, which a normal chat cannot render as an artifact.
 */
export function selectorVetoFlags(
  pluginActive: boolean,
  pluginIds: string[] | null,
): { disableArtifacts?: true; disableWebSearch?: true } {
  if (!pluginActive) return {};
  const flags: { disableArtifacts?: true; disableWebSearch?: true } = {};
  if (!pluginIds?.includes(PluginID.ARTIFACTS)) flags.disableArtifacts = true;
  if (!pluginIds?.includes(PluginID.WEB_SEARCH)) flags.disableWebSearch = true;
  return flags;
}

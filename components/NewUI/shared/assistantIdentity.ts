/**
 * assistantIdentity — the one answer to "is this actually an assistant, or is it
 * a placeholder that means *no* assistant?".
 *
 * Two different layers invent a placeholder, which is why a conversation with no
 * assistant could show a phantom chip named either "default" or
 * "Standard Conversation":
 *
 *   • `"default"` — the **backend's** built-in fallback assistant
 *     (`amplify-lambda-js/assistants/assistants.js`, `defaultAssistant.name`).
 *     Every plain send streams `data.state.currentAssistant = "default"` and
 *     `currentAssistantId = "default"` onto the reply, so an assistant-less
 *     conversation still looks stamped.
 *   • `"Amplify Automation"`, `"Code Interpreter Assistant"`, `"Artifacts Assistant"` —
 *     the backend's **internal, mode-selected** assistants
 *     (`assistants.js#chooseAssistantForRequest`). They are picked server-side
 *     (configuredTools → Automation; code-interpreter/artifacts mode) when the
 *     client names no assistant, and are streamed back with the same
 *     `currentAssistant`/`currentAssistantId` state (id === name) as `"default"`.
 *     Treating them as a user pick re-sends them as `options.assistantId`; the
 *     backend cannot resolve that id, skips its tools/mode branches, and the
 *     follow-up loses its connectors ("I can't do that").
 *   • `"Standard Conversation"` — the **frontend's** `DEFAULT_ASSISTANT`
 *     (`types/assistant.ts`) and the old-UI `AssistantSelectModal` "Standard
 *     Conversation" row, which dispatches `{ id: 'amplify', assistantId: '' }`.
 *     That id is *not* `DEFAULT_ASSISTANT.id` ('chat'), so an id-only check lets
 *     it through, and `utils/app/assistants#setAssistant` only strips the
 *     canonical `DEFAULT_ASSISTANT` **by reference** — so the look-alike gets
 *     stamped onto the user message and persists in the transcript forever.
 *
 * Deliberately free of React and of service imports so the React-free vocabulary
 * modules (`chatFilters.ts`) can share it with the hook.
 */

/** Names that mean "no assistant". Compared lower-cased and trimmed. */
export const PLACEHOLDER_ASSISTANT_NAMES = new Set([
  'standard conversation',
  'default',
  // Backend-internal assistants chosen per request, never by the client.
  'amplify automation',
  'code interpreter assistant',
  'artifacts assistant',
]);

/**
 * True when a name/id pair is a "no assistant" placeholder.
 *
 * A real assistant always carries a server-issued `assistantId` (`ast/…`,
 * `astp/…`, `astgp/…`, `astr/…`), so a user assistant genuinely named "Default"
 * is still recognised — only a placeholder name paired with a missing or
 * equally-placeholder id is rejected.
 */
export const isPlaceholderAssistantName = (
  name?: string,
  assistantId?: string,
): boolean => {
  const normalizedName = (name ?? '').trim().toLowerCase();
  if (!normalizedName) return true;
  if (!PLACEHOLDER_ASSISTANT_NAMES.has(normalizedName)) return false;
  const normalizedId = (assistantId ?? '').trim().toLowerCase();
  return !normalizedId || PLACEHOLDER_ASSISTANT_NAMES.has(normalizedId);
};

/**
 * assistantDeletion — the "what does deleting an assistant actually mean?" vocabulary.
 *
 * Deleting an assistant is a TWO-store operation and the local half alone is a lie:
 * `home.tsx` re-seeds `prompts` from `listAssistants()` → `utils/app/assistants#syncAssistants`
 * on every load, so an assistant that was only filtered out of `prompts` + `savePrompts()`
 * walks back in on the next refresh or login. The backend `/assistant/delete` call is the
 * part that persists; the local filter is only there so the row disappears immediately.
 *
 * Two further details this module encodes, both of which are easy to get wrong inline:
 *
 *   1. One assistant can own MORE THAN ONE row in `prompts`. Rows are keyed by the
 *      version-specific `prompt.id`, while the thing the backend deletes is the root
 *      `definition.assistantId` (see `handleUpdateAssistantPrompt`, which filters by
 *      assistantId for exactly this reason). Filtering on `prompt.id` alone leaves the
 *      other versions on screen.
 *
 *   2. An assistant with no `definition.assistantId` is local-only (an imported
 *      assistant that was never persisted server-side). There is nothing to call the
 *      backend with, and passing the version id instead would target the wrong record,
 *      so those delete locally — matching `Promptbar/components/Prompt.tsx`.
 *
 * React-free by design so it can be unit tested without a DOM.
 */

import { Prompt } from '@/types/prompt';
import { Assistant, AssistantDefinition } from '@/types/assistant';

/**
 * Whether this row may be deleted at all. Mirrors the old UI's `canDelete`:
 * shared read-only assistants and reserved/system ones carry `data.noDelete`.
 */
export const canDeleteAssistantPrompt = (prompt: Prompt): boolean =>
    !prompt.data?.noDelete;

/**
 * The id to hand `services/assistantService#deleteAssistant`, or `null` when this
 * assistant exists only in local storage and there is nothing to delete server-side.
 *
 * Deliberately does NOT fall back to `data.assistant.id` — that is the version id,
 * not the root assistant id the delete op expects.
 */
export const getDeletableAssistantId = (prompt: Prompt): string | null => {
    const definition = prompt.data?.assistant?.definition as AssistantDefinition | undefined;
    const assistantId = definition?.assistantId;
    return typeof assistantId === 'string' && assistantId.trim() ? assistantId : null;
};

/**
 * The prompt list with every row belonging to the deleted assistant removed —
 * the targeted row plus any other version sharing its `definition.assistantId`.
 */
export const promptsAfterAssistantDelete = (prompts: Prompt[], deleted: Prompt): Prompt[] => {
    const assistantId = getDeletableAssistantId(deleted);
    return prompts.filter((p: Prompt) => {
        if (p.id === deleted.id) return false;
        if (!assistantId) return true;
        const otherId = (p.data?.assistant?.definition as AssistantDefinition | undefined)?.assistantId;
        return otherId !== assistantId;
    });
};

/**
 * Whether the globally-selected assistant is the one just deleted, in which case the
 * caller must reset `selectedAssistant` — otherwise the next send routes an
 * `options.assistantId` the backend can no longer resolve.
 */
export const isSelectedAssistantDeleted = (
    selectedAssistant: Assistant | null | undefined,
    deleted: Prompt,
): boolean => {
    const assistantId = getDeletableAssistantId(deleted);
    if (!assistantId) return false;
    return selectedAssistant?.definition?.assistantId === assistantId;
};

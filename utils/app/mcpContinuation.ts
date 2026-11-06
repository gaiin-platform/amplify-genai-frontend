import { ChatBody } from '@/types/chat';

/**
 * Request fields that must survive the client-side MCP tool-result continuation.
 *
 * When the model calls an MCP tool that runs in the browser, the client executes it and then
 * sends a *second* chat request carrying the tool results. The backend only applies an
 * assistant's instructions when `options.assistantId` (or a group id) is on the request, so a
 * continuation that omits them silently falls back to the default assistant and the model
 * stops following the assistant's instructions.
 */
const CONTINUATION_CARRY_OVER_KEYS = [
    'assistantId',
    'assistantName',
    'groupId',
    'groupType',
    // Assistants can enforce a thinking level / disable reasoning; keep it consistent mid-turn.
    'reasoningLevel',
    'disableReasoning',
    // Set by the send path whenever an assistant/group is selected.
    'skipDocumentCache',
] as const;

/**
 * Returns the subset of the original request body that a tool-result continuation must repeat:
 * the selected assistant/group identity plus the data sources the original request used.
 * Spread the result into the continuation body, then override messages and skip flags.
 */
export function getContinuationCarryOver(originalBody: ChatBody): Partial<ChatBody> {
    const carried: Partial<ChatBody> = {};
    for (const key of CONTINUATION_CARRY_OVER_KEYS) {
        if (originalBody[key] !== undefined && originalBody[key] !== null) {
            carried[key] = originalBody[key];
        }
    }
    if (originalBody.dataSources && originalBody.dataSources.length > 0) {
        carried.dataSources = originalBody.dataSources;
    }
    return carried;
}

/**
 * assistantConfiguredTools — the tools an assistant brings to every chat turn.
 *
 * The backend runs tools from the last user message's `configuredTools` (agent path)
 * or from `assistant.data.operations` (older path); it never reads
 * `definition.tools`. `components/Chat/ChatInput.tsx` merges an assistant's
 * `data.operations` and `data.builtInOperations` into `configuredTools` for every
 * message it sends. The New UI sends some messages itself (first send from home,
 * and any send with attachments / skills / connector actions) and used to build
 * `configuredTools` from the user's chat connector selection only — so an assistant
 * with Outlook tools lost them on exactly those sends.
 *
 * This is the same mapping ChatInput applies, kept React-free so both New UI send
 * paths share it.
 */

import type { Assistant } from '@/types/assistant';

export interface ConfiguredToolEntry {
    name: string;
    operation: any;
    /** Per-parameter bindings; the backend reads these from the entry, not from `operation`. */
    parameters?: Record<string, any>;
    [key: string]: any;
}

const hasBindings = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === 'object' && Object.keys(value as object).length > 0;

const toEntry = (op: any): ConfiguredToolEntry => {
    const entry: ConfiguredToolEntry = { name: op?.name ?? op, operation: op };
    // Bindings configured in the assistant editor live on the op; the backend builds
    // its bindings from `entry.parameters`, so without this they are silently dropped.
    if (hasBindings(op?.bindings)) entry.parameters = op.bindings;
    return entry;
};

/** `configuredTools` entries for everything the assistant was saved with. */
export const getAssistantConfiguredTools = (
    assistant: Pick<Assistant, 'definition'> | null | undefined,
): ConfiguredToolEntry[] => {
    const data = (assistant?.definition?.data ?? {}) as Record<string, any>;
    const ops: any[] = Array.isArray(data.operations) ? data.operations : [];
    const builtIns: any[] = Array.isArray(data.builtInOperations) ? data.builtInOperations : [];
    return [...ops, ...builtIns].filter((op) => op !== null && op !== undefined).map(toEntry);
};

/**
 * Assistant tools first, then the user's chat-selected ones. When both name the same
 * tool the chat selection wins (it is the more specific, per-conversation choice), so
 * the model is never offered one tool twice.
 */
export const mergeConfiguredTools = (
    assistantTools: ConfiguredToolEntry[],
    chatTools: ConfiguredToolEntry[] | undefined,
): ConfiguredToolEntry[] | undefined => {
    const chat = chatTools ?? [];
    const chatNames = new Set(chat.map((tool) => tool.name));
    const seen = new Set<string>();
    const merged = [...assistantTools.filter((tool) => !chatNames.has(tool.name)), ...chat].filter((tool) => {
        if (seen.has(tool.name)) return false;
        seen.add(tool.name);
        return true;
    });
    return merged.length > 0 ? merged : undefined;
};

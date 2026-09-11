/**
 * promptConversation — new-UI variant of handleStartConversationWithPrompt.
 *
 * WHY THIS EXISTS
 * ---------------
 * `utils/app/prompts#handleStartConversationWithPrompt` names the conversation
 * `prompt.name + " " + dateTimeString()`, e.g. "My Template 09/11/26 11:51".
 * Regular new chats are named "New Conversation" and get renamed by the AI after
 * the first reply. Prompt-template conversations should follow the same pattern.
 *
 * `utils/` is read-only (NEW_UI_GUIDE §2), so we replicate the function here
 * with the only change being `name: 'New Conversation'`.
 *
 * No React imports.
 */

import { v4 as uuidv4 } from 'uuid';
import { MessageType } from '@/types/chat';
import { Prompt } from '@/types/prompt';
import { parsePromptVariables, fillInTemplate } from '@/utils/app/prompts';

/**
 * The one home-state field this module writes.  Typed structurally so the module
 * stays React-free; `HomeContext`'s `dispatch` satisfies it.
 */
export type SuppressFillDialogDispatch = (action: {
    field: 'isStandalonePromptCreation';
    value: boolean;
}) => void;

/**
 * Reasoning effort, structurally identical to `ModelPicker#EffortLevel`. Spelled
 * out here rather than imported so this module stays free of React imports.
 */
export type TemplateEffortLevel = 'low' | 'medium' | 'high' | 'off';

/**
 * Identical to `handleStartConversationWithPrompt` from utils except the
 * conversation name is always 'New Conversation', matching how every other chat
 * is created and letting the AI rename it after the first reply.
 *
 * @param homeDispatch — HomeContext dispatch.  REQUIRED, and it must be called
 *   from the same synchronous handler that creates the conversation — see the
 *   `isStandalonePromptCreation` block below.  Omitting it silently discards the
 *   user's model choice.
 * @param userSelectedModelId — optional model the user explicitly picked in the
 *   fill dialog.  The template's enforced model always takes priority; this is
 *   only used as a fallback when the template imposes no model of its own.
 * @param userSelectedEffort — optional reasoning effort the user picked in the
 *   fill dialog.  Lands on the conversation as `data.reasoningLevel`, which is
 *   the ONLY place `useChatSendService` looks for it (:629-644).  An assistant
 *   with `enforceThinkingLevel` still overrides it there.
 */
export const startConversationWithTemplate = (
    handleNewConversation: (params: Record<string, unknown>) => void,
    homeDispatch: SuppressFillDialogDispatch,
    prompts: Prompt[],
    startPrompt: Prompt,
    availableModels?: Record<string, unknown>,
    userSelectedModelId?: string,
    userSelectedEffort?: TemplateEffortLevel,
): void => {
    let prompt: Prompt = startPrompt;

    // Root-prompt resolution — identical to the utils version
    let rootPromptObj: Prompt | null =
        prompt.data?.rootPromptId
            ? (prompts.find((p) => p.id === prompt.data?.rootPromptId) ?? null)
            : null;

    if (rootPromptObj == null && prompt.type === MessageType.ROOT) {
        rootPromptObj = prompt;
        prompt = {
            description: rootPromptObj.description,
            folderId: null,
            id: uuidv4(),
            name: 'Chat with ' + rootPromptObj.name,
            type: MessageType.PROMPT,
            content: 'Tell me about what you can help me with.',
            data: {
                rootPromptId: rootPromptObj.id,
                ...(prompt.data || {}),
            },
        };
    }

    // Fill the root prompt's variables with empty strings (same as original)
    let rootPromptContent: string | null = null;
    if (rootPromptObj?.content) {
        const vars = parsePromptVariables(rootPromptObj.content);
        const vals = vars.map(() => '');
        rootPromptContent = fillInTemplate(rootPromptObj.content, vars, vals, [], true);
    }

    // Tags — same logic as original
    const getPromptTags = (p: Prompt | null | undefined): string[] =>
        p?.data?.conversationTags ?? [];

    let tags: string[] = [...getPromptTags(rootPromptObj), ...getPromptTags(prompt)];
    if (prompt.type === 'automation') tags.push('automation');
    if (prompt.type === MessageType.PREFIX_PROMPT) {
        tags = [...tags, ...(prompt.data?.requiredTags || [])];
    }
    tags = Array.from(new Set(tags));

    // Enforced model — template takes priority; user selection is fallback
    const enforcedModelId: string | undefined =
        prompt.data?.assistant?.definition?.data?.model;
    const enforcedModel =
        enforcedModelId && availableModels ? availableModels[enforcedModelId] : undefined;

    // Use the user-selected model only when the template doesn't enforce one
    const userModel =
        !enforcedModel && userSelectedModelId && availableModels
            ? availableModels[userSelectedModelId]
            : undefined;

    const resolvedModel = enforcedModel ?? userModel;

    // ── Suppress Chat.tsx's own fill dialog ──────────────────────────────────
    //
    // Chat.tsx renders the old `VariableModal` for ANY conversation that has a
    // `promptTemplate` and zero messages (Chat.tsx:1164 sets
    // `isPromptTemplateDialogVisible`, :1373 renders it) — which is exactly the
    // state the conversation we are about to create is in. The new UI already
    // collected the variables itself (NEW_UI_GUIDE §26), so that modal is
    // invisible here, but it is still MOUNTED, and its mount effect
    // (VariableModal.tsx:181-186) unconditionally runs
    //
    //     setSelectedModel(models[0]); handleUpdateModel(models[0]);
    //
    // `handleUpdateModel` → `handleUpdateConversation(conv, {key:'model'})` →
    // `dispatch({field:'selectedConversation'})`. `models` is Chat's
    // `filteredModels` (alphabetically sorted), so the conversation's model is
    // overwritten with a fixed model a few ms after creation — before the
    // pending-message bridge fires the send ~160ms later. That is why the user's
    // pick never reached the request no matter what `handleNewConversation`
    // received. The same hidden modal also registers a `window` click listener
    // that calls `onClose(true)` → `handlePromptTemplateDialogCancel(true)`,
    // which DELETES a promptTemplate conversation that still has zero messages.
    //
    // `isStandalonePromptCreation` is the only gate on that effect and Chat.tsx's
    // effect is its ONLY consumer in the codebase, so setting it is a precise
    // "do not open your own fill dialog" switch with no other side effects.
    //
    // TIMING IS LOAD-BEARING: Chat reads the flag during render, and its effect
    // has already fired by the time any effect of ours could run. This dispatch
    // must therefore batch into the same render as `handleNewConversation`'s —
    // i.e. stay in this synchronous call, immediately before it.
    homeDispatch({ field: 'isStandalonePromptCreation', value: true });

    handleNewConversation({
        // ↓ The only difference from the original — no datetime suffix
        name: 'New Conversation',
        messages: [],
        promptTemplate: prompt,
        processors: [],
        tools: [],
        tags,
        ...(rootPromptContent != null && { prompt: rootPromptContent }),
        ...(resolvedModel != null && { model: resolvedModel }),
        // `data.reasoningLevel` is the only channel for reasoning effort:
        // useChatSendService reads `selectedConversation.data?.reasoningLevel`
        // and turns it into `options.reasoningLevel` (or `disableReasoning` for
        // 'off'). There is no per-request field, so it has to be set at
        // conversation-creation time — nothing downstream will pick it up from a
        // sessionStorage bridge.
        ...(userSelectedEffort != null && {
            data: { reasoningLevel: userSelectedEffort },
        }),
    });
};

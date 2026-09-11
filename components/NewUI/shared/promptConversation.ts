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
 * Identical to `handleStartConversationWithPrompt` from utils except the
 * conversation name is always 'New Conversation', matching how every other chat
 * is created and letting the AI rename it after the first reply.
 */
export const startConversationWithTemplate = (
    handleNewConversation: (params: Record<string, unknown>) => void,
    prompts: Prompt[],
    startPrompt: Prompt,
    availableModels?: Record<string, unknown>,
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

    // Enforced model — same logic as original
    const enforcedModelId: string | undefined =
        prompt.data?.assistant?.definition?.data?.model;
    const enforcedModel =
        enforcedModelId && availableModels ? availableModels[enforcedModelId] : undefined;

    handleNewConversation({
        // ↓ The only difference from the original — no datetime suffix
        name: 'New Conversation',
        messages: [],
        promptTemplate: prompt,
        processors: [],
        tools: [],
        tags,
        ...(rootPromptContent != null && { prompt: rootPromptContent }),
        ...(enforcedModel != null && { model: enforcedModel }),
    });
};

/**
 * Regression tests for `startConversationWithTemplate`.
 *
 * The bug these pin down: a prompt-template conversation always ran on a fixed
 * model no matter what the user picked in the fill dialog's ModelPicker.
 * `handleNewConversation({ model })` was correct, but Chat.tsx mounts the old
 * `VariableModal` for any conversation with a `promptTemplate` and zero messages,
 * and that modal's mount effect calls `handleUpdateModel(models[0])` — clobbering
 * the conversation's model a few ms after creation, well before the
 * pending-message bridge fires the send.
 *
 * `isStandalonePromptCreation` is the only gate on that Chat.tsx effect, so the
 * fix dispatches it, and it has to happen BEFORE `handleNewConversation` so both
 * land in the same React batch (Chat reads the flag during render).
 */

import { describe, it, expect, vi } from 'vitest';
import { MessageType } from '@/types/chat';
import { Prompt } from '@/types/prompt';
import { startConversationWithTemplate } from '@/components/NewUI/shared/promptConversation';

const HAIKU = { id: 'haiku', name: 'Claude Haiku' };
const OPUS = { id: 'opus', name: 'Claude Opus' };
const AVAILABLE_MODELS: Record<string, unknown> = { haiku: HAIKU, opus: OPUS };

const template = (overrides: Partial<Prompt> = {}): Prompt =>
  ({
    id: 'tpl-1',
    name: 'My Template',
    description: '',
    folderId: null,
    type: MessageType.PROMPT,
    content: 'Summarise {{topic}}',
    data: {},
    ...overrides,
  } as Prompt);

describe('startConversationWithTemplate', () => {
  it('passes the user-selected model through to handleNewConversation', () => {
    const handleNewConversation = vi.fn();
    startConversationWithTemplate(
      handleNewConversation,
      vi.fn(),
      [],
      template(),
      AVAILABLE_MODELS,
      'opus',
    );

    expect(handleNewConversation).toHaveBeenCalledTimes(1);
    expect(handleNewConversation.mock.calls[0][0].model).toBe(OPUS);
  });

  it("suppresses Chat.tsx's fill dialog BEFORE creating the conversation", () => {
    const order: string[] = [];
    const homeDispatch = vi.fn((a: { field: string; value: boolean }) =>
      order.push(`dispatch:${a.field}=${a.value}`),
    );
    const handleNewConversation = vi.fn(() => order.push('create'));

    startConversationWithTemplate(
      handleNewConversation,
      homeDispatch,
      [],
      template(),
      AVAILABLE_MODELS,
      'opus',
    );

    // Order is load-bearing: Chat.tsx reads isStandalonePromptCreation during the
    // render triggered by the selectedConversation dispatch, so a suppression that
    // lands after (or in a later effect) is too late and VariableModal mounts.
    expect(order).toEqual([
      'dispatch:isStandalonePromptCreation=true',
      'create',
    ]);
  });

  it("lets the template's enforced model win over the user's pick", () => {
    const handleNewConversation = vi.fn();
    startConversationWithTemplate(
      handleNewConversation,
      vi.fn(),
      [],
      template({
        data: {
          assistant: { definition: { data: { model: 'haiku' } } },
        },
      } as Partial<Prompt>),
      AVAILABLE_MODELS,
      'opus',
    );

    expect(handleNewConversation.mock.calls[0][0].model).toBe(HAIKU);
  });

  it('omits `model` entirely when the selected id is not an available model', () => {
    // A `model: undefined` key would still override home.tsx's default via the
    // trailing `...conversationParams` spread, leaving the conversation with no
    // model at all — useChatSendService then falls back to the default and logs
    // "MODEL IS UNDEFINED".
    const handleNewConversation = vi.fn();
    startConversationWithTemplate(
      handleNewConversation,
      vi.fn(),
      [],
      template(),
      AVAILABLE_MODELS,
      'a-model-the-user-can-no-longer-access',
    );

    expect('model' in handleNewConversation.mock.calls[0][0]).toBe(false);
  });

  it("names the conversation 'New Conversation' so the AI renames it", () => {
    const handleNewConversation = vi.fn();
    startConversationWithTemplate(handleNewConversation, vi.fn(), [], template());
    expect(handleNewConversation.mock.calls[0][0].name).toBe('New Conversation');
  });

  // ── Reasoning effort ──────────────────────────────────────────────────────
  // `data.reasoningLevel` is the ONLY channel: useChatSendService:629-644 reads
  // `selectedConversation.data?.reasoningLevel`. There is no per-request field,
  // and the `amplify_pending_effort` sessionStorage key is never applied — so an
  // effort that doesn't land on the conversation here is silently dropped and the
  // backend falls back to its own default.
  it('carries the selected effort onto the conversation as data.reasoningLevel', () => {
    const handleNewConversation = vi.fn();
    startConversationWithTemplate(
      handleNewConversation,
      vi.fn(),
      [],
      template(),
      AVAILABLE_MODELS,
      'opus',
      'high',
    );

    expect(handleNewConversation.mock.calls[0][0].data).toEqual({
      reasoningLevel: 'high',
    });
  });

  it("passes 'off' through rather than treating it as absent", () => {
    // 'off' is a real choice — useChatSendService maps it to
    // `disableReasoning: true`, which is very different from "unset".
    const handleNewConversation = vi.fn();
    startConversationWithTemplate(
      handleNewConversation,
      vi.fn(),
      [],
      template(),
      AVAILABLE_MODELS,
      'opus',
      'off',
    );

    expect(handleNewConversation.mock.calls[0][0].data).toEqual({
      reasoningLevel: 'off',
    });
  });

  it('omits `data` when no effort was chosen', () => {
    const handleNewConversation = vi.fn();
    startConversationWithTemplate(
      handleNewConversation,
      vi.fn(),
      [],
      template(),
      AVAILABLE_MODELS,
      'opus',
    );

    expect('data' in handleNewConversation.mock.calls[0][0]).toBe(false);
  });
});

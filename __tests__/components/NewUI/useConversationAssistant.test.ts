/**
 * Tests for shared/useConversationAssistant's pure derivation function.
 *
 * These cover the cases that made the assistant tag vanish after the first send:
 *   - the assistant only exists as a stamp on the sent user message
 *     (`data.assistant.definition`, written by utils/app/assistants#setAssistant)
 *   - the assistant only exists as the streamed `data.state.currentAssistant`
 *     name on the reply, and is not present in `prompts` (shared / layered)
 *   - the newest turn's assistant wins when a conversation switched assistants
 */
import { describe, it, expect } from 'vitest';
import { Conversation, Message } from '@/types/chat';
import { Prompt } from '@/types/prompt';
import { LayeredAssistant } from '@/types/layeredAssistant';
import {
  ASSISTANT_SCAN_WINDOW,
  deriveConversationAssistant,
} from '@/components/NewUI/shared/useConversationAssistant';

const conversation = (messages: Message[], extra: Partial<Conversation> = {}): Conversation =>
  ({
    id: 'conv-1',
    name: 'Test',
    messages,
    model: { id: 'gpt-4o' } as any,
    folderId: null,
    ...extra,
  }) as Conversation;

const userMsg = (assistant?: { name: string; assistantId?: string }): Message => ({
  role: 'user',
  content: 'hi',
  id: `m-${Math.random()}`,
  type: 'prompt',
  data: assistant ? { assistant: { definition: { ...assistant } } } : {},
});

const replyMsg = (currentAssistant?: string, currentAssistantId?: string): Message => ({
  role: 'assistant',
  content: 'hello',
  id: `m-${Math.random()}`,
  type: undefined,
  data: currentAssistant ? { state: { currentAssistant, currentAssistantId } } : {},
});

const assistantPrompt = (
  name: string,
  assistantId: string,
  extra: Partial<Prompt> = {},
): Prompt =>
  ({
    id: `p-${assistantId}`,
    name,
    description: '',
    content: '',
    folderId: null,
    type: 'prompt',
    data: { assistant: { id: assistantId, definition: { name, assistantId } } },
    ...extra,
  }) as unknown as Prompt;

describe('deriveConversationAssistant', () => {
  it('returns null for a plain conversation', () => {
    expect(deriveConversationAssistant(conversation([userMsg(), replyMsg()]), [], [])).toBeNull();
  });

  it('returns null when there is no conversation', () => {
    expect(deriveConversationAssistant(null, [], [])).toBeNull();
  });

  it('reads the assistant stamped on a sent user message', () => {
    const derived = deriveConversationAssistant(
      conversation([userMsg({ name: 'Grant Helper', assistantId: 'ast/123' }), replyMsg()]),
      [],
      [],
    );
    expect(derived?.definition.name).toBe('Grant Helper');
    expect(derived?.definition.assistantId).toBe('ast/123');
  });

  it('prefers the full prompt definition over the message stamp', () => {
    const prompt = assistantPrompt('Grant Helper', 'ast/123', { groupId: 'grp-9' } as any);
    const derived = deriveConversationAssistant(
      conversation([userMsg({ name: 'Grant Helper', assistantId: 'ast/123' })]),
      [prompt],
      [],
    );
    // groupId lives on the prompt, not the definition — it must be merged in so
    // follow-up sends keep routing to the group assistant.
    expect(derived?.definition.groupId).toBe('grp-9');
  });

  it('falls back to the streamed currentAssistant name on the reply', () => {
    const derived = deriveConversationAssistant(
      conversation([userMsg(), replyMsg('Policy Bot', 'ast/777')]),
      [],
      [],
    );
    expect(derived?.definition.name).toBe('Policy Bot');
    expect(derived?.definition.assistantId).toBe('ast/777');
  });

  it('ignores the default "Standard Conversation" state name', () => {
    const derived = deriveConversationAssistant(
      conversation([userMsg(), replyMsg('Standard Conversation')]),
      [],
      [],
    );
    expect(derived).toBeNull();
  });

  it('lets the newest turn win when the assistant changed mid-conversation', () => {
    const derived = deriveConversationAssistant(
      conversation([
        userMsg({ name: 'First', assistantId: 'ast/1' }),
        replyMsg('First', 'ast/1'),
        userMsg({ name: 'Second', assistantId: 'ast/2' }),
      ]),
      [],
      [],
    );
    expect(derived?.definition.name).toBe('Second');
  });

  it('resolves a layered assistant from the layered list', () => {
    const layered: LayeredAssistant[] = [
      {
        assistantId: 'astr/abc',
        name: 'Layered One',
        description: 'd',
        rootNode: {} as any,
        createdAt: '',
        updatedAt: '',
        model: 'gpt-4o',
      },
    ];
    const derived = deriveConversationAssistant(
      conversation([userMsg({ name: 'Layered One', assistantId: 'astr/abc' })]),
      [],
      layered,
    );
    expect(derived?.definition.data?.isLayeredAssistant).toBe(true);
    expect(derived?.definition.data?.model).toBe('gpt-4o');
  });

  it('does not resurrect an assistant abandoned many turns ago', () => {
    const plainTurns: Message[] = [];
    for (let i = 0; i < ASSISTANT_SCAN_WINDOW; i++) plainTurns.push(userMsg(), replyMsg());
    const derived = deriveConversationAssistant(
      conversation([
        userMsg({ name: 'Long Gone', assistantId: 'ast/old' }),
        replyMsg('Long Gone', 'ast/old'),
        ...plainTurns,
      ]),
      [],
      [],
    );
    expect(derived).toBeNull();
  });

  it('still finds an assistant stamped within the scan window', () => {
    const derived = deriveConversationAssistant(
      conversation([
        ...Array.from({ length: 40 }, () => userMsg()),
        userMsg({ name: 'Recent', assistantId: 'ast/new' }),
        replyMsg(),
      ]),
      [],
      [],
    );
    expect(derived?.definition.name).toBe('Recent');
  });

  it('uses the conversation promptTemplate when the transcript is empty', () => {
    const prompt = assistantPrompt('Gallery Assistant', 'ast/gal');
    const derived = deriveConversationAssistant(
      conversation([], { promptTemplate: prompt }),
      [prompt],
      [],
    );
    expect(derived?.definition.name).toBe('Gallery Assistant');
  });
});

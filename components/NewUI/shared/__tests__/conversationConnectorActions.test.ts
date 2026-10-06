import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_CONNECTOR_ACTIONS_KEY,
  getConfiguredToolsForActions,
  getConversationConnectorActions,
  withConversationConnectorActions,
} from '@/components/NewUI/shared/conversationConnectorActions';
import type { SelectedAction } from '@/components/NewUI/shared/AttachMenu';

const action = (fnId: string, name = fnId): SelectedAction => ({
  fnId,
  name,
  ops: [{ name: `${fnId}_operation`, operation: { name: `${fnId}_operation` } }],
});

const conversation = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  data,
  messages: [],
});

describe('conversationConnectorActions', () => {
  it('stores and reloads connector selections on the owning conversation', () => {
    const original = conversation('chat-a', { reasoningLevel: 'high' });
    const selected = [action('read-email')];
    const updated = withConversationConnectorActions(original, selected);

    expect(getConversationConnectorActions(updated)).toEqual(selected);
    expect(updated.data).toMatchObject({
      reasoningLevel: 'high',
      [CONVERSATION_CONNECTOR_ACTIONS_KEY]: selected,
    });
    expect(original.data).toEqual({ reasoningLevel: 'high' });
  });

  it('does not carry actions into a different conversation or retain removed actions', () => {
    const chatA = withConversationConnectorActions(conversation('chat-a'), [action('read-email')]);
    const chatB = conversation('chat-b');
    const clearedChatA = withConversationConnectorActions(chatA, []);

    expect(getConversationConnectorActions(chatB)).toEqual([]);
    expect(getConversationConnectorActions(clearedChatA)).toEqual([]);
    expect(getConversationConnectorActions(chatA)).toEqual([action('read-email')]);
  });

  it('flattens each active action into the configuredTools sent on a user message', () => {
    const selected = [action('read-email'), action('write-draft')];
    const outgoingUserMessage = {
      role: 'user',
      content: 'Use the selected connector actions',
      configuredTools: getConfiguredToolsForActions(selected),
    };

    expect(outgoingUserMessage.configuredTools).toEqual([
      ...selected[0].ops,
      ...selected[1].ops,
    ]);
    expect(getConfiguredToolsForActions([])).toEqual([]);
  });

  it('ignores malformed stored selections', () => {
    const malformed = conversation('chat-a', {
      [CONVERSATION_CONNECTOR_ACTIONS_KEY]: [
        null,
        { fnId: 'bad', name: 'Bad action', ops: 'not-an-array' },
      ],
    });

    expect(getConversationConnectorActions(malformed)).toEqual([]);
  });
});

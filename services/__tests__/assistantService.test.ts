import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendDirectAssistantMessage } from '@/services/assistantService';
import { saveStore } from '@/components/NewUI/shared/customInstructions';
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendChatRequestWithDocuments: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ getSession: mocks.getSession }));
vi.mock('@/services/chatService', () => ({
  sendChatRequestWithDocuments: mocks.sendChatRequestWithDocuments,
}));

const ACTIVE_INSTRUCTION = 'Prefer concise answers.';

const activateInstruction = (content = ACTIVE_INSTRUCTION) => {
  saveStore({
    activeId: 'instruction-1',
    instructions: [{
      id: 'instruction-1',
      name: 'Preferences',
      content,
      createdAt: 1,
      updatedAt: 1,
    }],
  });
};

const send = (options: Record<string, unknown> = {}) =>
  sendDirectAssistantMessage(
    '/chat',
    'assistant-1',
    'Assistant One',
    'Hello',
    { id: 'model-1', outputTokenLimit: 1000 },
    [],
    options,
    {},
    vi.fn(),
    vi.fn(),
    new AbortController(),
  );

afterEach(() => {
  vi.clearAllMocks();
  saveStore({ instructions: [], activeId: null });
});

describe('sendDirectAssistantMessage custom instructions', () => {
  it('appends the active instruction to the system prompt and preserves assistant request data', async () => {
    activateInstruction();
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.sendChatRequestWithDocuments.mockResolvedValue({ ok: true });

    await send({ prompt: 'An existing base prompt.', conversationId: 'conversation-1' });

    const [, chatBody] = mocks.sendChatRequestWithDocuments.mock.calls[0];
    expect(chatBody.prompt).toBe(
      `An existing base prompt.\n\n---\n\n## Custom Instructions:\n${ACTIVE_INSTRUCTION}`,
    );
    expect(chatBody.assistantId).toBe('assistant-1');
    expect(chatBody.assistantName).toBe('Assistant One');
    expect(chatBody.conversationId).toBe('conversation-1');
    expect(chatBody.messages[chatBody.messages.length - 1]).toMatchObject({ role: 'user', content: 'Hello' });
  });

  it('uses the default system prompt when options do not provide a prompt', async () => {
    activateInstruction();
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.sendChatRequestWithDocuments.mockResolvedValue({ ok: true });

    await send();

    const [, chatBody] = mocks.sendChatRequestWithDocuments.mock.calls[0];
    expect(chatBody.prompt).toContain(`## Custom Instructions:\n${ACTIVE_INSTRUCTION}`);
    expect(chatBody.prompt.startsWith(DEFAULT_SYSTEM_PROMPT)).toBe(true);
  });
});

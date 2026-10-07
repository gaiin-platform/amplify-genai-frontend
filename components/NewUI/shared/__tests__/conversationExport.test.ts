import { describe, expect, it } from 'vitest';
import type { Conversation, Message } from '@/types/chat';
import { formatConversationAsMarkdown } from '@/components/NewUI/shared/ArtifactExportMenu';

const message = (role: Message['role'], content: string): Message =>
  ({
    id: `${role}-${content.slice(0, 4)}`,
    role,
    content,
    type: undefined,
    data: undefined,
  }) as Message;

const conversation = (over: Partial<Conversation> = {}): Conversation =>
  ({
    id: 'conversation-1',
    name: 'Export me',
    messages: [],
    model: {} as Conversation['model'],
    folderId: null,
    ...over,
  }) as Conversation;

describe('formatConversationAsMarkdown', () => {
  it('includes the title and preserves message order with role headings', () => {
    const result = formatConversationAsMarkdown(
      conversation({
        messages: [
          message('user', 'What is **Markdown**?'),
          message('assistant', 'It supports fenced code:\n\n```ts\nconst answer = 42;\n```'),
        ],
      }),
    );

    expect(result).toBe(
      '# Export me\n\n## User\n\nWhat is **Markdown**?\n\n## Assistant\n\nIt supports fenced code:\n\n```ts\nconst answer = 42;\n```',
    );
  });

  it('retains system and tool turns instead of silently dropping them', () => {
    const result = formatConversationAsMarkdown(
      conversation({
        messages: [
          message('system', 'Follow the policy.'),
          message('tool', '{"ok":true}'),
        ],
      }),
    );

    expect(result).toContain('## System\n\nFollow the policy.');
    expect(result).toContain('## Tool\n\n{"ok":true}');
    expect(result.indexOf('## System')).toBeLessThan(result.indexOf('## Tool'));
  });

  it('skips empty turns and uses a fallback title', () => {
    expect(
      formatConversationAsMarkdown(
        conversation({ name: '   ', messages: [message('user', '  ')] }),
      ),
    ).toBe('# Conversation');
  });

  it('does not rewrite Markdown content while normalizing surrounding whitespace', () => {
    const content = '\n# Nested heading\n\n- one\n- two\n';
    const result = formatConversationAsMarkdown(
      conversation({ messages: [message('assistant', content)] }),
    );

    expect(result).toBe('# Export me\n\n## Assistant\n\n# Nested heading\n\n- one\n- two');
  });
});

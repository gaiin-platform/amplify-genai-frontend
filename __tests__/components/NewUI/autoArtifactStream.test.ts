import { describe, expect, it } from 'vitest';
import { appendAutoArtifactChunk, mergeAutoArtifactMessage } from '@/components/NewUI/shared/autoArtifactStream';
import { conversationWithCompressedMessages, conversationWithUncompressedMessages } from '@/utils/app/conversation';

describe('appendAutoArtifactChunk', () => {
  it('routes artifact contents and assistant commentary across split markers', () => {
    const first = appendAutoArtifactChunk('', 'State,Capital\nAlabama,Montgomery\n<', false);
    expect(first.artifactText).toBe('State,Capital\nAlabama,Montgomery\n');
    expect(first.assistantText).toBe('');
    expect(first.buffer).toBe('<');
    expect(first.inAssistantText).toBe(false);

    const second = appendAutoArtifactChunk(first.buffer, '>What would you like me to do with this data?<', first.inAssistantText);
    expect(second.artifactText).toBe('');
    expect(second.assistantText).toBe('What would you like me to do with this data?');
    expect(second.inAssistantText).toBe(true);
    expect(second.buffer).toBe('<');

    const third = appendAutoArtifactChunk(second.buffer, '/>State,Capital\nAlabama,Montgomery', second.inAssistantText, true);
    expect(third.assistantText).toBe('');
    expect(third.artifactText).toBe('State,Capital\nAlabama,Montgomery');
    expect(third.inAssistantText).toBe(false);
  });

  it('updates the originating assistant message by id without losing messages appended during generation', () => {
    const original = {
      id: 'conv-1',
      name: 'Conversation',
      messages: [
        { id: 'assistant-1', role: 'assistant', content: 'before', data: { state: {} } },
        { id: 'user-2', role: 'user', content: 'new turn', data: {} },
        { id: 'assistant-2', role: 'assistant', content: 'new answer', data: {} },
      ],
    } as any;

    const updated = mergeAutoArtifactMessage(original, 'assistant-1', {
      content: 'before\n\nDone.',
      artifactStatus: 'complete',
      artifactDetails: [{ artifactId: 'artifact-1', version: 1 }],
    });

    expect(updated.messages).toHaveLength(3);
    expect(updated.messages[0].content).toBe('before\n\nDone.');
    expect(updated.messages[0].data.artifactStatus).toBe('complete');
    expect(updated.messages[0].data.artifacts).toEqual([{ artifactId: 'artifact-1', version: 1 }]);
    expect(updated.messages[1].content).toBe('new turn');
    expect(updated.messages[2].content).toBe('new answer');

    const persisted = conversationWithCompressedMessages(updated);
    const restored = conversationWithUncompressedMessages(persisted);
    expect(restored.messages[0].data.artifacts[0].artifactId).toBe('artifact-1');
    expect(restored.messages[0].content).toBe('before\n\nDone.');
    expect(restored.messages).toHaveLength(3);
  });

  it('splits the artifact end marker and excludes commentary from artifact text', () => {
    const first = appendAutoArtifactChunk('', '# Report\ncontent\n<>Summary begins here<', false);
    expect(first.artifactText).toBe('# Report\ncontent\n');
    expect(first.assistantText).toBe('Summary begins here');
    expect(first.buffer).toBe('<');
    expect(first.inAssistantText).toBe(true);

    const second = appendAutoArtifactChunk(first.buffer, '/>More artifact', first.inAssistantText, true);
    expect(second.artifactText).toBe('More artifact');
    expect(second.assistantText).toBe('');
    expect(second.inAssistantText).toBe(false);
  });
});

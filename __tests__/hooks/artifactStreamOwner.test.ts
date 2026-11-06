import { describe, expect, it } from 'vitest';
import {
  blockIfOtherChatGenerating,
  claimArtifactStream,
  clearStreamingConversations,
  getStreamingConversationIds,
  releaseArtifactStream,
} from '@/hooks/useChatSendService';

describe('artifact stream ownership', () => {
  it('keeps the artifact chat recorded through the chat reply\'s "streaming off" clear', () => {
    claimArtifactStream('source');
    // The chat reply that requested the artifact ends and clears streaming ids after the claim.
    clearStreamingConversations();

    expect(getStreamingConversationIds()).toEqual(['source']);
    // A send from a newly opened chat is held back (and the busy notice raised) instead of silently dropped.
    expect(blockIfOtherChatGenerating('new-chat')).toBe(true);
    expect(blockIfOtherChatGenerating('source')).toBe(false);

    releaseArtifactStream('source');
    clearStreamingConversations();
    expect(getStreamingConversationIds()).toEqual([]);
    expect(blockIfOtherChatGenerating('new-chat')).toBe(false);
  });

  it('ignores a release from a stream that no longer owns the claim', () => {
    claimArtifactStream('first');
    claimArtifactStream('second');
    releaseArtifactStream('first');
    clearStreamingConversations();
    expect(getStreamingConversationIds()).toEqual(['second']);

    releaseArtifactStream('second');
    clearStreamingConversations();
  });
});

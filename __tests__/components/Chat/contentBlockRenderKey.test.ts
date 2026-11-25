import { describe, expect, it } from 'vitest';
import {
  initialRenderedContent,
  shouldRemountContent,
} from '@/components/Chat/ChatContentBlocks/contentBlockRenderKey';

// Mirrors the state and effect in ChatContentBlock: lastRenderContent starts
// from initialRenderedContent, and after each render the effect bumps the
// render key (a remount) when shouldRemountContent says so.
const mountBlock = (finalContent: string, messageIsStreaming: boolean) => {
  let lastRenderContent = initialRenderedContent(finalContent, messageIsStreaming);
  let renderKey = 0;
  const render = (content: string, streaming: boolean) => {
    if (shouldRemountContent(content, streaming, lastRenderContent)) {
      lastRenderContent = content;
      renderKey += 1;
    }
  };
  render(finalContent, messageIsStreaming);
  return {
    render,
    remounts: () => renderKey,
  };
};

describe('ChatContentBlock render key', () => {
  it('does not remount a message that is already finished when it mounts', () => {
    const block = mountBlock('# Done\n\nSome text', false);
    expect(block.remounts()).toBe(0);
    block.render('# Done\n\nSome text', false);
    expect(block.remounts()).toBe(0);
  });

  it('does not remount while streaming and remounts once when streaming ends', () => {
    const block = mountBlock('', true);
    block.render('Hel', true);
    block.render('Hello wor', true);
    expect(block.remounts()).toBe(0);
    block.render('Hello world', false);
    expect(block.remounts()).toBe(1);
    block.render('Hello world', false);
    expect(block.remounts()).toBe(1);
  });

  it('still remounts at the end of streaming when the content did not change while streaming', () => {
    // messageIsStreaming is shared by every message, so a block can mount during
    // a stream with content that never changes; it still remounts once when the stream ends.
    const block = mountBlock('Earlier message', true);
    expect(block.remounts()).toBe(0);
    block.render('Earlier message', false);
    expect(block.remounts()).toBe(1);
  });

  it('remounts when a finished message is edited', () => {
    const block = mountBlock('First version', false);
    block.render('Second version', false);
    expect(block.remounts()).toBe(1);
    block.render('Third version', false);
    expect(block.remounts()).toBe(2);
  });

  it('remounts when a finished message is streamed again and completes', () => {
    const block = mountBlock('Old answer', false);
    block.render('', true);
    block.render('New ans', true);
    expect(block.remounts()).toBe(0);
    block.render('New answer', false);
    expect(block.remounts()).toBe(1);
  });

  it('starts from the first-render content only for finished messages', () => {
    expect(initialRenderedContent('text', false)).toBe('text');
    expect(initialRenderedContent('text', true)).toBe('');
  });
});

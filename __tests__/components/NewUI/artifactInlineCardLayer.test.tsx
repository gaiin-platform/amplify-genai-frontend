// @vitest-environment jsdom
/**
 * ArtifactInlineCardLayer used to attach a MutationObserver to `.chatcontainer` and, on every
 * mutation, walk every `div.flex-col` in the transcript and all of its descendants looking for
 * the text "Creating Your Artifact". Nothing has rendered that text since AutoArtifactBlock
 * started drawing its own card, so the walk could never match; it only cost time on every
 * streamed token (#361, item 1).
 *
 * Regression: the layer must not observe the transcript and must not touch it, even when the
 * transcript holds the old markup it used to look for.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, Root } from 'react-dom/client';

import { ArtifactInlineCardLayer } from '@/components/NewUI/chat/ArtifactInlineCardLayer';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

/** What the classic block rendered while an artifact was being written. */
const LEGACY_CREATING_BOX =
  '<div class="flex flex-col gap-4"><div class="flex items-center"><span>Creating Your Artifact...</span></div></div>';

let container: HTMLElement;
let host: HTMLElement;
let root: Root;
let observed: Node[];
let RealMutationObserver: typeof MutationObserver;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;

  document.body.innerHTML =
    '<div data-new-ui="true"><div class="chatcontainer"><div class="enhanced-chat-message assistant-message"><p>earlier answer</p></div></div></div>';
  container = document.querySelector('.chatcontainer') as HTMLElement;

  // Record every node any MutationObserver is pointed at while the layer is mounted.
  observed = [];
  RealMutationObserver = window.MutationObserver;
  class RecordingObserver extends RealMutationObserver {
    observe(target: Node, options?: MutationObserverInit) {
      observed.push(target);
      super.observe(target, options);
    }
  }
  (window as any).MutationObserver = RecordingObserver;
  (globalThis as any).MutationObserver = RecordingObserver;

  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  root.unmount();
  await tick();
  (window as any).MutationObserver = RealMutationObserver;
  (globalThis as any).MutationObserver = RealMutationObserver;
  document.body.innerHTML = '';
});

describe('ArtifactInlineCardLayer', () => {
  it('renders nothing and does not observe the transcript', async () => {
    root.render(<ArtifactInlineCardLayer />);
    await tick();

    expect(host.innerHTML).toBe('');
    expect(observed).toEqual([]);
  });

  it('leaves the old "Creating Your Artifact" markup alone, also while the transcript changes', async () => {
    container.insertAdjacentHTML('beforeend', LEGACY_CREATING_BOX);
    const before = container.innerHTML;

    root.render(<ArtifactInlineCardLayer />);
    await tick();
    expect(container.innerHTML).toBe(before);

    // A streamed token: new text arrives in the transcript.
    const streamed = document.createElement('p');
    streamed.textContent = 'next token';
    container.appendChild(streamed);
    await tick();

    expect(container.querySelector('[data-nui-artifact-creating]')).toBeNull();
    expect(document.querySelector('[data-nui-inline-card-host]')).toBeNull();
    expect(container.innerHTML).toBe(before + '<p>next token</p>');
  });
});

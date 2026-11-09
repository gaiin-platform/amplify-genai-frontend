// @vitest-environment jsdom
/**
 * NewUIStatusExitLayer leaves a short-lived COPY of an indicator that React just removed. The copy
 * is a deep clone, so it has the same classes as the real thing (`new-ui-awaiting-answer`, …).
 *
 * Regression: ConversationViewShell looked the awaiting-answer node up by class, found a copy,
 * removed it, and the exit layer answered that removal with a copy of the copy — a chain of
 * MutationObserver callbacks that never yields to the event loop, so React could never render
 * the real indicator that would have ended it. The tab froze (and, as the DOM grew, crashed with
 * "Aw, Snap!") on the first follow-up message of a chat. Copies must be inert: never the subject
 * of another effect, and never copied themselves.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, Root } from 'react-dom/client';

import { NewUIStatusExitLayer, isInStatusGhost } from '@/components/NewUI/chat/NewUIStatusExitLayer';

const GHOST = '[data-nui-status-ghost]';
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/** `<div class="new-ui-awaiting-answer"><span data-nui-status>…</span></div>` — what the shell injects. */
const awaitingIndicator = (): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'new-ui-awaiting-answer';
  el.innerHTML =
    '<span data-nui-status="" data-source="awaiting"><span class="mark"></span><span class="label">Thinking…</span></span>';
  return el;
};

let container: HTMLElement;
let hover: HTMLElement;
let root: Root;
let host: HTMLElement;

beforeEach(async () => {
  (window as any).matchMedia = () => ({ matches: false });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;

  document.body.innerHTML =
    '<div data-new-ui="true"><div class="chatcontainer"><div class="enhanced-chat-message assistant-message"><div id="chatHover"><p>earlier answer</p></div></div></div></div>';
  container = document.querySelector('.chatcontainer') as HTMLElement;
  hover = container.querySelector('#chatHover') as HTMLElement;

  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(<NewUIStatusExitLayer />);
  await tick(); // the layer attaches its observer in an effect
});

afterEach(() => {
  root.unmount();
  document.body.innerHTML = '';
});

describe('isInStatusGhost', () => {
  it('is true for a copy and anything inside it, false for live nodes', () => {
    const ghost = document.createElement('div');
    ghost.setAttribute('data-nui-status-ghost', '');
    const inner = document.createElement('span');
    ghost.appendChild(inner);
    const live = document.createElement('div');

    expect(isInStatusGhost(ghost)).toBe(true);
    expect(isInStatusGhost(inner)).toBe(true);
    expect(isInStatusGhost(live)).toBe(false);
    expect(isInStatusGhost(null)).toBe(false);
    expect(isInStatusGhost(undefined)).toBe(false);
  });
});

describe('NewUIStatusExitLayer', () => {
  it('still leaves one fading copy where a live indicator was removed', async () => {
    const el = awaitingIndicator();
    hover.prepend(el);
    await tick();

    el.remove();
    await tick();

    const ghosts = container.querySelectorAll(GHOST);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('never makes a copy of a copy', async () => {
    const el = awaitingIndicator();
    hover.prepend(el);
    await tick();
    el.remove();
    await tick();
    expect(container.querySelectorAll(GHOST)).toHaveLength(1);

    // What the shell used to do: grab the copy by its class and remove it.
    const copyOfIndicator = container.querySelector(`${GHOST} .new-ui-awaiting-answer`) as HTMLElement;
    expect(copyOfIndicator).not.toBeNull();
    copyOfIndicator.remove();
    await tick();

    expect(container.querySelectorAll(GHOST)).toHaveLength(1);
    expect(container.querySelectorAll(`${GHOST} ${GHOST}`)).toHaveLength(0);
  });

  it('does not keep producing copies when a copy keeps being removed (no runaway)', async () => {
    const el = awaitingIndicator();
    hover.prepend(el);
    await tick();
    el.remove();
    await tick();

    // Simulate the old feedback loop for a few rounds: if a copy were re-copied, the count would grow.
    for (let i = 0; i < 5; i++) {
      const copy = container.querySelector(`${GHOST} .new-ui-awaiting-answer`);
      copy?.remove();
      await tick(5);
    }
    expect(container.querySelectorAll('.new-ui-awaiting-answer').length).toBeLessThanOrEqual(1);
    expect(container.querySelectorAll(GHOST).length).toBeLessThanOrEqual(1);
  });
});

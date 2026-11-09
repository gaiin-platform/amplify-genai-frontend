import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * The classic "Reasoning / Actions" disclosure (AgentLogBlock) must never show in a new-UI chat message.
 * It used to be hidden only while the tool-steps layer reported visible steps, so a message whose log held
 * only hidden tools (terminate / think) — e.g. a tool is attached but the model never calls it — leaked it.
 * The hide rule is now unconditional; this guards against it being gated on layer state again.
 */
const css = readFileSync(join(__dirname, '../../../styles/conversation-view.css'), 'utf8');

describe('conversation-view.css: Reasoning / Actions is always hidden in chat', () => {
  it('hides the disclosure for every chat message, not conditioned on the layer', () => {
    const rule = css.match(
      /\[data-new-ui="true"\] #chatHover \.mt-3\.pointer-events-none > \.pointer-events-auto\.max-w-full\.overflow-hidden \{\s*display: none !important;/,
    );
    expect(rule).not.toBeNull();
  });

  it('no longer gates any rule on a data-agentlog-takeover flag', () => {
    expect(css).not.toContain('agentlog-takeover');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The classic modals launched from inside an assistant/prompt creation modal (for example
 * AssistantWorkflowBuilder's full-screen `Modal`, which is `position: fixed` and sized from
 * `window.innerWidth`) must be positioned against the viewport.
 *
 * Any `transform` other than `none` on an ancestor makes that ancestor their containing
 * block, and the panel is `overflow: hidden` and at most 1100px wide, so they get clipped.
 * An animation with fill-mode `both`/`forwards` keeps its last keyframe
 * (`transform: translateY(0)`) applied forever, which is exactly that.
 */
const css = readFileSync(path.resolve(__dirname, '../../../styles/conversation-view.css'), 'utf8');

function panelAnimation(): string {
  const rule = css.match(/\.new-ui-creation-modal-panel\s*\{([^}]*)\}/);
  expect(rule, 'rule for .new-ui-creation-modal-panel').not.toBeNull();
  const animation = rule![1].match(/animation\s*:\s*([^;]+);/);
  expect(animation, 'animation declaration').not.toBeNull();
  return animation![1];
}

describe('CreationModalShell panel animation', () => {
  it('does not keep the final keyframe applied after it ends', () => {
    expect(panelAnimation()).not.toMatch(/\b(both|forwards)\b/);
  });

  it('still plays the entrance animation', () => {
    expect(panelAnimation()).toContain('creationModalIn');
  });
});

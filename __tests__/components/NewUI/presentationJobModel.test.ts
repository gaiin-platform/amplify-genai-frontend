import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_STEPS,
  buildPresentationSource,
  clampProgress,
  isTerminal,
  latestScore,
  pickDefaultTemplate,
  stepIndexForStage,
  suggestTitle,
} from '@/components/NewUI/shared/presentationJobModel';

const msg = (role: string, content: string, data: any = undefined) =>
  ({ role, content, id: `${role}-${content}`, type: undefined, data }) as any;

describe('presentationJobModel', () => {
  it('maps backend stages onto ordered UI steps', () => {
    const ids = PRESENTATION_STEPS.map((s) => s.id);
    expect(stepIndexForStage('queued')).toBe(ids.indexOf('start'));
    expect(stepIndexForStage('planning')).toBe(ids.indexOf('plan'));
    expect(stepIndexForStage('rendering')).toBe(ids.indexOf('build'));
    expect(stepIndexForStage('reviewing')).toBe(ids.indexOf('review'));
    expect(stepIndexForStage('finalizing')).toBe(ids.indexOf('finish'));
    expect(stepIndexForStage('something-new')).toBe(0);
    expect(stepIndexForStage(undefined)).toBe(0);
  });

  it('detects terminal jobs', () => {
    expect(isTerminal({ status: 'completed' })).toBe(true);
    expect(isTerminal({ status: 'failed' })).toBe(true);
    expect(isTerminal({ status: 'running' })).toBe(false);
    expect(isTerminal(null)).toBe(false);
  });

  it('clamps progress', () => {
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(42.6)).toBe(43);
    expect(clampProgress(250)).toBe(100);
    expect(clampProgress(undefined)).toBe(0);
    expect(clampProgress(NaN)).toBe(0);
  });

  it('prefers the Vanderbilt template like the old download dialog', () => {
    expect(pickDefaultTemplate(['a.pptx', 'vanderbilt_1.pptx'])).toBe('vanderbilt_1.pptx');
    expect(pickDefaultTemplate(['a.pptx', 'b.pptx'])).toBe('a.pptx');
    expect(pickDefaultTemplate([])).toBe('');
  });

  it('builds the whole visible conversation as markdown', () => {
    const source = buildPresentationSource({
      name: 'Budget review',
      messages: [
        msg('user', 'Summarize the budget'),
        msg('tool', 'ignored tool output'),
        msg('assistant', 'Hidden action', { actionResult: true }),
        msg('assistant', 'The budget grew 12%.'),
      ],
    });
    expect(source).toBe('# Budget review\n\n## User\n\nSummarize the budget\n\n## Assistant\n\nThe budget grew 12%.');
  });

  it('builds a single response with the request that produced it', () => {
    const conversation = {
      name: 'Plan',
      messages: [msg('user', 'First ask'), msg('assistant', 'First answer'), msg('user', 'Make slides about X'), msg('assistant', 'Outline for X')],
    };
    const source = buildPresentationSource(conversation, 3);
    expect(source).toContain('## Request\n\nMake slides about X');
    expect(source).toContain('## Content to present\n\nOutline for X');
    expect(source).not.toContain('First answer');
  });

  it('suggests the conversation name as title unless it is the placeholder', () => {
    expect(suggestTitle({ name: 'Q3 review' })).toBe('Q3 review');
    expect(suggestTitle({ name: 'New Conversation' })).toBe('');
    expect(suggestTitle(undefined)).toBe('');
  });

  it('reports the final review score', () => {
    expect(latestScore([6, 8])).toBe(8);
    expect(latestScore([])).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  hasLoadedSteps,
  knownStepCount,
  mergeFullTemplate,
  replaceTemplate,
} from '@/components/NewUI/views/workflowTemplateData';
import type { AstWorkflow } from '@/types/assistantWorkflows';

// What /list-workflow-templates returns: metadata only, no `template` body.
const listed = {
  templateId: 't1',
  name: 'Palindrome Checker',
  description: 'Check if a word is a palindrome',
  inputSchema: {},
  outputSchema: {},
  isBaseTemplate: true,
  isPublic: false,
  user: 'owner@x.edu',
} as unknown as AstWorkflow;

// What /get-workflow-template returns: the same plus the steps (and no `user`).
const full = {
  templateId: 't1',
  name: 'Palindrome Checker',
  description: 'Check if a word is a palindrome',
  inputSchema: {},
  outputSchema: {},
  isBaseTemplate: true,
  isPublic: false,
  template: {
    steps: [
      { tool: 'isPalindrome', stepName: 'check' },
      { tool: 'terminate', stepName: 'done' },
    ],
  },
} as unknown as AstWorkflow;

describe('hasLoadedSteps / knownStepCount', () => {
  it('treats a list item (no template body) as not loaded, so no step count is claimed', () => {
    expect(hasLoadedSteps(listed)).toBe(false);
    expect(knownStepCount(listed)).toBeNull();
  });

  it('counts only real steps once loaded (terminate/done excluded)', () => {
    expect(hasLoadedSteps(full)).toBe(true);
    expect(knownStepCount(full)).toBe(1);
  });

  it('knows a loaded template with no steps has zero', () => {
    const empty = { ...full, template: { steps: [] } } as unknown as AstWorkflow;
    expect(hasLoadedSteps(empty)).toBe(true);
    expect(knownStepCount(empty)).toBe(0);
  });

  it('is not fooled by a template object without a steps list', () => {
    const odd = { ...listed, template: {} } as unknown as AstWorkflow;
    expect(hasLoadedSteps(odd)).toBe(false);
    expect(knownStepCount(odd)).toBeNull();
  });
});

describe('mergeFullTemplate', () => {
  it('adds the steps and keeps list-only fields such as the owner', () => {
    const merged = mergeFullTemplate(listed, full);
    expect(merged.template?.steps).toHaveLength(2);
    expect((merged as any).user).toBe('owner@x.edu');
    expect(merged.name).toBe('Palindrome Checker');
  });

  it('always yields a steps list, even if the server omitted the body', () => {
    const merged = mergeFullTemplate(listed, { ...full, template: undefined } as unknown as AstWorkflow);
    expect(merged.template?.steps).toEqual([]);
    expect(hasLoadedSteps(merged)).toBe(true);
  });

  it('works when the template was removed from the list meanwhile', () => {
    expect(mergeFullTemplate(undefined, full).template?.steps).toHaveLength(2);
  });
});

describe('replaceTemplate', () => {
  it('swaps only the matching template and leaves the others untouched', () => {
    const other = { ...listed, templateId: 't2', name: 'Other' } as unknown as AstWorkflow;
    const result = replaceTemplate([listed, other], full);
    expect(result[0].template?.steps).toHaveLength(2);
    expect(result[1]).toBe(other);
  });

  it('returns the list unchanged when the template is no longer in it', () => {
    const other = { ...listed, templateId: 't2' } as unknown as AstWorkflow;
    const list = [other];
    expect(replaceTemplate(list, full)).toEqual(list);
  });
});

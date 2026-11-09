import { describe, expect, it } from 'vitest';
import { decideWorkflowTemplateSave } from '@/components/NewUI/views/assistant/workflowTemplateSave';
import type { AstWorkflow } from '@/types/assistantWorkflows';

const customized = {
  templateId: 'base-1',
  name: 'My workflow',
  description: 'customized copy',
  template: { steps: [{ tool: 'search', description: 'd', instructions: 'i' }] },
} as unknown as AstWorkflow;

describe('decideWorkflowTemplateSave', () => {
  it('registers the customized copy when the user configured the workflow', () => {
    const decision = decideWorkflowTemplateSave({
      baseWorkflowTemplateId: 'base-1',
      astWorkflowTemplateId: undefined,
      savedWorkflowTemplateId: undefined,
      currentWorkflowTemplate: customized,
    });
    expect(decision).toEqual({ kind: 'register', workflow: customized });
  });

  it('registers again when an existing customization was edited', () => {
    const decision = decideWorkflowTemplateSave({
      baseWorkflowTemplateId: 'base-1',
      astWorkflowTemplateId: 'ast-9',
      savedWorkflowTemplateId: 'ast-9',
      currentWorkflowTemplate: customized,
    });
    expect(decision.kind).toBe('register');
  });

  it('keeps the existing customized template id when nothing was changed', () => {
    // The bug: this used to be rewritten to the base id, dropping the configuration.
    const decision = decideWorkflowTemplateSave({
      baseWorkflowTemplateId: 'base-1',
      astWorkflowTemplateId: 'ast-9',
      savedWorkflowTemplateId: 'ast-9',
      currentWorkflowTemplate: null,
    });
    expect(decision).toEqual({ kind: 'keep', workflowTemplateId: 'ast-9' });
  });

  it('falls back to the base template for a new assistant that has no customization yet', () => {
    const decision = decideWorkflowTemplateSave({
      baseWorkflowTemplateId: 'base-1',
      astWorkflowTemplateId: undefined,
      savedWorkflowTemplateId: undefined,
      currentWorkflowTemplate: null,
    });
    expect(decision).toEqual({ kind: 'keep', workflowTemplateId: 'base-1' });
  });

  it('blocks the save when the base template was switched and the new one is not configured yet', () => {
    // The assistant had a saved workflow; the picker cleared the customized id; the new
    // template's setup has not reported anything. Saving would silently drop the config.
    const decision = decideWorkflowTemplateSave({
      baseWorkflowTemplateId: 'base-2',
      astWorkflowTemplateId: undefined,
      savedWorkflowTemplateId: 'ast-9',
      currentWorkflowTemplate: null,
    });
    expect(decision.kind).toBe('blocked');
    expect((decision as { message: string }).message).toMatch(/workflow/i);
  });

  it('does not register a template that has no steps', () => {
    const empty = { ...customized, template: { steps: [] } } as unknown as AstWorkflow;
    // `steps: []` is still a list, so it is registered like the classic editor does;
    // a missing template is not.
    expect(
      decideWorkflowTemplateSave({
        baseWorkflowTemplateId: 'base-1',
        astWorkflowTemplateId: 'ast-9',
        savedWorkflowTemplateId: 'ast-9',
        currentWorkflowTemplate: { ...customized, template: undefined } as unknown as AstWorkflow,
      }),
    ).toEqual({ kind: 'keep', workflowTemplateId: 'ast-9' });
    expect(
      decideWorkflowTemplateSave({
        baseWorkflowTemplateId: 'base-1',
        astWorkflowTemplateId: undefined,
        savedWorkflowTemplateId: undefined,
        currentWorkflowTemplate: empty,
      }).kind,
    ).toBe('register');
  });
});

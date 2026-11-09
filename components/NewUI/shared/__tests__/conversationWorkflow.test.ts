import { describe, it, expect } from 'vitest';
import {
  CONVERSATION_WORKFLOW_KEY,
  getConversationWorkflow,
  withConversationWorkflow,
  workflowBlockReason,
  workflowMessageData,
} from '../conversationWorkflow';

describe('conversation workflow selection', () => {
  it('reads back what was stored and ignores junk', () => {
    const conv = withConversationWorkflow({ data: { keep: 1 } }, { templateId: 't1', name: 'Weekly report' });
    expect(getConversationWorkflow(conv)).toEqual({ templateId: 't1', name: 'Weekly report' });
    expect(conv.data.keep).toBe(1);
    expect(getConversationWorkflow({ data: { [CONVERSATION_WORKFLOW_KEY]: { templateId: '' } } })).toBeNull();
    expect(getConversationWorkflow({ data: { [CONVERSATION_WORKFLOW_KEY]: 'x' } })).toBeNull();
    expect(getConversationWorkflow(undefined)).toBeNull();
  });

  it('removes the key when detached, without touching the rest', () => {
    const attached = withConversationWorkflow({ data: { keep: 1 } }, { templateId: 't1', name: 'n' });
    const detached = withConversationWorkflow(attached, null);
    expect(detached.data).toEqual({ keep: 1 });
    expect((attached.data as Record<string, unknown>)[CONVERSATION_WORKFLOW_KEY]).toBeDefined();
  });

  it('puts only the template id on the outgoing message', () => {
    expect(workflowMessageData({ templateId: 't1', name: 'n' })).toEqual({ workflowTemplateId: 't1' });
    expect(workflowMessageData(null)).toEqual({});
  });
});

describe('workflowBlockReason', () => {
  it('allows a workflow with no assistant or a plain one', () => {
    expect(workflowBlockReason({ assistantData: null })).toBeUndefined();
    expect(workflowBlockReason({ assistantData: { operations: [], builtInOperations: [] } })).toBeUndefined();
  });

  it('blocks beside an assistant workflow or built-in actions', () => {
    expect(workflowBlockReason({ assistantData: { workflowTemplateId: 'w' } })).toMatch(/already has a workflow/);
    expect(workflowBlockReason({ assistantData: { baseWorkflowTemplateId: 'w' } })).toMatch(/already has a workflow/);
    expect(workflowBlockReason({ assistantData: { builtInOperations: ['x'] } })).toMatch(/built-in actions/);
  });
});

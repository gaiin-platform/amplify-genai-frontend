/**
 * Tests for views/assistant/assistantDeletion — the delete-an-assistant vocabulary.
 *
 * These cover the cases behind "I deleted it, refreshed, and it came back":
 *   - the row that was clicked is not necessarily the only row for that assistant
 *     (versions are separate prompts sharing one definition.assistantId)
 *   - a local-only (imported) assistant has no assistantId to delete server-side
 *   - the globally-selected assistant must be released when it is the one deleted
 */
import { describe, it, expect } from 'vitest';
import { Prompt } from '@/types/prompt';
import { Assistant } from '@/types/assistant';
import { MessageType } from '@/types/chat';
import {
  canDeleteAssistantPrompt,
  getDeletableAssistantId,
  isSelectedAssistantDeleted,
  promptsAfterAssistantDelete,
} from '@/components/NewUI/views/assistant/assistantDeletion';

const assistantPrompt = (
  promptId: string,
  assistantId?: string,
  extraData: Record<string, any> = {},
): Prompt =>
  ({
    id: promptId,
    type: MessageType.ROOT,
    name: `Assistant ${promptId}`,
    description: '',
    content: '',
    folderId: 'assistants',
    data: {
      assistant: {
        id: promptId,
        definition: { name: `Assistant ${promptId}`, ...(assistantId ? { assistantId } : {}) },
      },
      ...extraData,
    },
  }) as unknown as Prompt;

const plainPrompt = (promptId: string): Prompt =>
  ({
    id: promptId,
    type: MessageType.PROMPT,
    name: `Template ${promptId}`,
    description: '',
    content: 'hello',
    folderId: null,
  }) as unknown as Prompt;

const selected = (assistantId: string): Assistant =>
  ({ id: assistantId, definition: { assistantId } }) as unknown as Assistant;

describe('getDeletableAssistantId', () => {
  it('returns the root assistantId from the definition', () => {
    expect(getDeletableAssistantId(assistantPrompt('p1', 'astp/root-1'))).toBe('astp/root-1');
  });

  it('returns null when the assistant only exists locally (no assistantId)', () => {
    // Must not fall back to data.assistant.id — that is the version id, and calling
    // /assistant/delete with it would target the wrong record.
    expect(getDeletableAssistantId(assistantPrompt('p1'))).toBeNull();
  });

  it('treats a blank assistantId as absent', () => {
    expect(getDeletableAssistantId(assistantPrompt('p1', '   '))).toBeNull();
  });

  it('returns null for a non-assistant prompt', () => {
    expect(getDeletableAssistantId(plainPrompt('p9'))).toBeNull();
  });
});

describe('canDeleteAssistantPrompt', () => {
  it('allows deleting an owned assistant', () => {
    expect(canDeleteAssistantPrompt(assistantPrompt('p1', 'astp/root-1'))).toBe(true);
  });

  it('refuses a reserved / read-only assistant marked noDelete', () => {
    expect(
      canDeleteAssistantPrompt(assistantPrompt('p1', 'astp/root-1', { noDelete: true })),
    ).toBe(false);
  });
});

describe('promptsAfterAssistantDelete', () => {
  it('removes every version sharing the deleted assistantId, not just the clicked row', () => {
    const v1 = assistantPrompt('ast/v1', 'astp/root-1');
    const v2 = assistantPrompt('ast/v2', 'astp/root-1');
    const other = assistantPrompt('ast/other', 'astp/root-2');
    const template = plainPrompt('tmpl-1');

    const result = promptsAfterAssistantDelete([v1, v2, other, template], v2);

    expect(result.map((p) => p.id)).toEqual(['ast/other', 'tmpl-1']);
  });

  it('leaves other assistants and templates untouched', () => {
    const target = assistantPrompt('ast/v1', 'astp/root-1');
    const other = assistantPrompt('ast/other', 'astp/root-2');
    const template = plainPrompt('tmpl-1');

    const result = promptsAfterAssistantDelete([target, other, template], target);

    expect(result).toEqual([other, template]);
  });

  it('removes only the clicked row for a local-only assistant with no assistantId', () => {
    // Two idless imported assistants must not delete each other.
    const a = assistantPrompt('local-a');
    const b = assistantPrompt('local-b');

    const result = promptsAfterAssistantDelete([a, b], a);

    expect(result.map((p) => p.id)).toEqual(['local-b']);
  });

  it('is a no-op when the assistant is already gone from the list', () => {
    const gone = assistantPrompt('ast/v1', 'astp/root-1');
    const other = assistantPrompt('ast/other', 'astp/root-2');

    expect(promptsAfterAssistantDelete([other], gone)).toEqual([other]);
  });
});

describe('isSelectedAssistantDeleted', () => {
  it('is true when the selected assistant is the deleted one', () => {
    expect(
      isSelectedAssistantDeleted(selected('astp/root-1'), assistantPrompt('p1', 'astp/root-1')),
    ).toBe(true);
  });

  it('is false for a different selected assistant', () => {
    expect(
      isSelectedAssistantDeleted(selected('astp/root-2'), assistantPrompt('p1', 'astp/root-1')),
    ).toBe(false);
  });

  it('is false when nothing is selected', () => {
    expect(isSelectedAssistantDeleted(null, assistantPrompt('p1', 'astp/root-1'))).toBe(false);
    expect(isSelectedAssistantDeleted(undefined, assistantPrompt('p1', 'astp/root-1'))).toBe(false);
  });

  it('is false for a local-only assistant, which can never be the routed one', () => {
    expect(isSelectedAssistantDeleted(selected('astp/root-1'), assistantPrompt('p1'))).toBe(false);
  });
});

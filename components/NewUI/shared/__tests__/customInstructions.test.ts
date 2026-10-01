import { afterEach, describe, expect, it } from 'vitest';
import {
  buildPromptWithInstruction,
  saveStore,
} from '@/components/NewUI/shared/customInstructions';

const ACTIVE_INSTRUCTION = 'Prefer concise answers.';
const BASE_PROMPT = 'You are a helpful assistant.';

const activateInstruction = (content = ACTIVE_INSTRUCTION) => {
  saveStore({
    activeId: 'instruction-1',
    instructions: [{
      id: 'instruction-1',
      name: 'Preferences',
      content,
      createdAt: 1,
      updatedAt: 1,
    }],
  });
};

afterEach(() => {
  saveStore({ instructions: [], activeId: null });
});

describe('buildPromptWithInstruction', () => {
  it('leaves the base prompt unchanged when no instruction is active', () => {
    expect(buildPromptWithInstruction(BASE_PROMPT)).toBe(BASE_PROMPT);
  });

  it('appends the active instruction to existing system prompt content', () => {
    activateInstruction();

    expect(buildPromptWithInstruction(BASE_PROMPT)).toBe(
      `${BASE_PROMPT}\n\n---\n\n## Custom Instructions:\n${ACTIVE_INSTRUCTION}`,
    );
  });

  it('does not duplicate the exact active instruction suffix', () => {
    activateInstruction();
    const composed = buildPromptWithInstruction(BASE_PROMPT);

    expect(buildPromptWithInstruction(composed)).toBe(composed);
  });

  it('preserves non-matching custom-instruction-like text in the base prompt', () => {
    activateInstruction('A different instruction.');
    const existingText = `${BASE_PROMPT}\n\n## Custom Instructions:\nExisting text.`;

    expect(buildPromptWithInstruction(existingText)).toBe(
      `${existingText}\n\n---\n\n## Custom Instructions:\nA different instruction.`,
    );
  });
});

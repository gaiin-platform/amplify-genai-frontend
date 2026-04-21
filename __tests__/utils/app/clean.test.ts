import { describe, it, expect } from 'vitest';
import { cleanSelectedConversation, cleanConversationHistory } from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { Conversation } from '@/types/chat';
import { Model } from '@/types/model';

const mockModel: Model = {
  id: 'test-model',
  name: 'Test Model',
  maxLength: 4096,
  tokenLimit: 4096,
  actualTokenLimit: 4096,
  inputCost: 0,
  outputCost: 0,
} as Model;

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'test-id',
  name: 'Test Conversation',
  messages: [],
  model: mockModel,
  prompt: 'Test prompt',
  temperature: 0.7,
  folderId: null,
  ...overrides,
} as Conversation);

describe('cleanSelectedConversation', () => {
  it('returns conversation unchanged when all fields are present', () => {
    const conversation = makeConversation();
    const result = cleanSelectedConversation(conversation, mockModel);
    expect(result.model).toBe(mockModel);
    expect(result.prompt).toBe('Test prompt');
    expect(result.temperature).toBe(0.7);
  });

  it('fills in default model when model is missing', () => {
    const conversation = makeConversation({ model: undefined as any });
    const result = cleanSelectedConversation(conversation, mockModel);
    expect(result.model).toBe(mockModel);
  });

  it('fills in default prompt when prompt is missing', () => {
    const conversation = makeConversation({ prompt: undefined as any });
    const result = cleanSelectedConversation(conversation, mockModel);
    expect(result.prompt).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('fills in default temperature when temperature is missing', () => {
    const conversation = makeConversation({ temperature: undefined as any });
    const result = cleanSelectedConversation(conversation, mockModel);
    expect(result.temperature).toBe(DEFAULT_TEMPERATURE);
  });

  it('fills in empty messages array when messages is missing', () => {
    const conversation = makeConversation({ messages: undefined as any });
    const result = cleanSelectedConversation(conversation, mockModel);
    expect(result.messages).toEqual([]);
  });

  it('sets folderId to null when missing', () => {
    const conversation = makeConversation({ folderId: undefined as any });
    const result = cleanSelectedConversation(conversation, mockModel);
    expect(result.folderId).toBeNull();
  });
});

describe('cleanConversationHistory', () => {
  it('returns empty array for non-array input', () => {
    const result = cleanConversationHistory('not-an-array' as any, mockModel);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    const result = cleanConversationHistory([], mockModel);
    expect(result).toEqual([]);
  });

  it('fills in defaults for conversations missing fields', () => {
    const incomplete = [{ id: 'test', name: 'Test' }];
    const result = cleanConversationHistory(incomplete, mockModel);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe(mockModel);
    expect(result[0].prompt).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(result[0].temperature).toBe(DEFAULT_TEMPERATURE);
    expect(result[0].messages).toEqual([]);
    expect(result[0].folderId).toBeNull();
  });

  it('preserves existing values and only fills missing ones', () => {
    const existing = [{
      id: 'test',
      name: 'Test',
      model: mockModel,
      prompt: 'Custom prompt',
      temperature: 0.9,
      messages: [{ role: 'user', content: 'hello' }],
      folderId: 'folder-1',
    }];
    const result = cleanConversationHistory(existing, mockModel);
    expect(result[0].prompt).toBe('Custom prompt');
    expect(result[0].temperature).toBe(0.9);
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].folderId).toBe('folder-1');
  });
});

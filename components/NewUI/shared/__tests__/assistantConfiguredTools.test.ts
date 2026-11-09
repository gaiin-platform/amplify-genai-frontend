import { describe, expect, it } from 'vitest';
import {
  getAssistantConfiguredTools,
  mergeConfiguredTools,
} from '@/components/NewUI/shared/assistantConfiguredTools';

const assistant = (data: Record<string, unknown>, tools: unknown[] = []) =>
  ({ id: 'a1', definition: { name: 'Outlook', tools, data } }) as any;

const op = (name: string, extra: Record<string, unknown> = {}) => ({ id: name, name, ...extra });

describe('getAssistantConfiguredTools', () => {
  it('maps data.operations and data.builtInOperations the way ChatInput does', () => {
    const tools = getAssistantConfiguredTools(
      assistant({ operations: [op('microsoftListMessages')], builtInOperations: ['web_search'] }),
    );
    expect(tools).toEqual([
      { name: 'microsoftListMessages', operation: op('microsoftListMessages') },
      { name: 'web_search', operation: 'web_search' },
    ]);
  });

  it('does not read definition.tools — chat never consults it', () => {
    expect(getAssistantConfiguredTools(assistant({}, [op('microsoftListMessages')]))).toEqual([]);
  });

  it('forwards editor-configured bindings as entry.parameters, which is where the backend reads them', () => {
    const bindings = { folder: { value: 'inbox', mode: 'manual' } };
    const [entry] = getAssistantConfiguredTools(assistant({ operations: [op('microsoftListMessages', { bindings })] }));
    expect(entry.parameters).toEqual(bindings);
  });

  it('omits parameters when there are no bindings', () => {
    const [entry] = getAssistantConfiguredTools(assistant({ operations: [op('a', { bindings: {} })] }));
    expect(entry).not.toHaveProperty('parameters');
  });

  it('returns nothing for a missing, default or malformed assistant', () => {
    expect(getAssistantConfiguredTools(null)).toEqual([]);
    expect(getAssistantConfiguredTools(undefined)).toEqual([]);
    expect(getAssistantConfiguredTools(assistant({ operations: 'nope', builtInOperations: null }))).toEqual([]);
  });
});

describe('mergeConfiguredTools', () => {
  const entry = (name: string, tag = '') => ({ name, operation: { name, tag } });

  it('returns undefined when there is nothing to send', () => {
    expect(mergeConfiguredTools([], undefined)).toBeUndefined();
    expect(mergeConfiguredTools([], [])).toBeUndefined();
  });

  it('keeps the assistant tools when the chat selected none', () => {
    expect(mergeConfiguredTools([entry('a')], undefined)).toEqual([entry('a')]);
  });

  it('puts assistant tools first, then chat tools', () => {
    expect(mergeConfiguredTools([entry('a')], [entry('b')])?.map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('lets the chat selection win when both name the same tool', () => {
    const merged = mergeConfiguredTools([entry('a', 'assistant')], [entry('a', 'chat')]);
    expect(merged).toEqual([entry('a', 'chat')]);
  });

  it('drops repeats within the chat selection', () => {
    expect(mergeConfiguredTools([], [entry('a'), entry('a')])).toEqual([entry('a')]);
  });
});

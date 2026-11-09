import { describe, expect, it } from 'vitest';
import {
  buildStoredOperations,
  describeToolSelection,
  httpApisFromStoredOperations,
  integrationOpsFromStoredOperations,
} from '../toolSelectionModel';
import { COMPOSITE_FUNCTION_CATEGORIES } from '@/utils/app/compositeFunctions';
import { getAssistantConfiguredTools } from '@/components/NewUI/shared/assistantConfiguredTools';

const outlookOp = (name: string) => ({ id: name, name, type: 'integration', tags: ['integration'] }) as any;

describe('buildStoredOperations', () => {
  it('mirrors the selected integration ops into data.operations', () => {
    const tools = [outlookOp('microsoftListMessages'), outlookOp('microsoftListEvents')];
    expect(buildStoredOperations(tools, [])).toEqual(tools);
  });

  it('appends custom HTTP APIs marked type "http"', () => {
    const stored = buildStoredOperations([outlookOp('a')], [{ name: 'weather', url: 'https://x' }]);
    expect(stored).toEqual([outlookOp('a'), { name: 'weather', url: 'https://x', type: 'http' }]);
  });

  it('is empty when nothing is selected', () => {
    expect(buildStoredOperations([], [])).toEqual([]);
  });
});

describe('httpApisFromStoredOperations', () => {
  it('keeps only HTTP APIs so integration ops are not re-saved as stale copies', () => {
    const stored = [outlookOp('a'), { name: 'weather', type: 'http' }];
    expect(httpApisFromStoredOperations(stored)).toEqual([{ name: 'weather', type: 'http' }]);
  });

  it('tolerates a missing or malformed list', () => {
    expect(httpApisFromStoredOperations(undefined)).toEqual([]);
    expect(httpApisFromStoredOperations('x')).toEqual([]);
    expect(httpApisFromStoredOperations([null, 3])).toEqual([]);
  });
});

describe('editor save → chat round trip', () => {
  it('unticking a tool removes it from what chat sends (no stale data.operations)', () => {
    const mail = outlookOp('microsoftListMessages');
    const cal = outlookOp('microsoftListEvents');

    // First save with both tools, then reload the way the editor does.
    const firstSave = { tools: [mail, cal], data: { operations: buildStoredOperations([mail, cal], []) } };
    const apiInfo = httpApisFromStoredOperations(firstSave.data.operations);
    expect(apiInfo).toEqual([]);

    // User unticks the calendar; save again from the reloaded state.
    const secondSave = { tools: [mail], data: { operations: buildStoredOperations([mail], apiInfo) } };
    const sent = getAssistantConfiguredTools({ definition: secondSave } as any).map((t) => t.name);
    expect(sent).toEqual(['microsoftListMessages']);
  });
});

describe('integrationOpsFromStoredOperations', () => {
  it('restores the editor selection from data.operations, which is all the backend keeps', () => {
    const stored = [outlookOp('microsoftListMessages'), { name: 'weather', type: 'http' }];
    expect(integrationOpsFromStoredOperations(stored)).toEqual([outlookOp('microsoftListMessages')]);
  });

  it('is the exact inverse of buildStoredOperations for the integration half', () => {
    const tools = [outlookOp('a'), outlookOp('b')];
    const stored = buildStoredOperations(tools, [{ name: 'weather' }]);
    expect(integrationOpsFromStoredOperations(stored)).toEqual(tools);
    expect(httpApisFromStoredOperations(stored)).toEqual([{ name: 'weather', type: 'http' }]);
  });

  it('tolerates a missing or malformed list', () => {
    expect(integrationOpsFromStoredOperations(undefined)).toEqual([]);
    expect(integrationOpsFromStoredOperations({})).toEqual([]);
    expect(integrationOpsFromStoredOperations([null, 1])).toEqual([]);
  });
});

describe('describeToolSelection', () => {
  // The live catalogue carries every op every task needs; a trimmed one would make other tasks
  // resolve to the same two ops and tie with Read Email.
  const catalogue = Array.from(
    new Set(COMPOSITE_FUNCTION_CATEGORIES.flatMap((c) => c.functions.flatMap((f) => f.operations))),
  ).map(outlookOp);

  it('reports the Read Email task once, not its three ops', () => {
    const saved = [outlookOp('microsoftListFolders'), outlookOp('microsoftListMessages'), outlookOp('microsoftGetMessageDetails')];
    expect(describeToolSelection(saved, catalogue, 0)).toBe('1 task');
  });

  it('counts ops no task explains as individual tools', () => {
    const saved = [
      outlookOp('microsoftListFolders'),
      outlookOp('microsoftListMessages'),
      outlookOp('microsoftGetMessageDetails'),
      outlookOp('microsoftListEvents'),
    ];
    const label = describeToolSelection(saved, catalogue, 2)!;
    expect(label).toContain('1 task');
    expect(label).toContain('individual tool');
    expect(label).toContain('2 agent tools');
  });

  it('falls back to a plain op count until the catalogue has loaded', () => {
    const saved = [outlookOp('microsoftListMessages'), outlookOp('microsoftGetMessageDetails')];
    expect(describeToolSelection(saved, null, 0)).toBe('2 tools');
    expect(describeToolSelection([outlookOp('a')], null, 0)).toBe('1 tool');
  });

  it('is undefined when nothing is selected', () => {
    expect(describeToolSelection([], catalogue, 0)).toBeUndefined();
    expect(describeToolSelection([], null, 0)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { applyRagOptions } from '@/utils/app/ragOptions';

const on = { ragEnabled: true };

describe('applyRagOptions — cached documents must not depend on the plugin selector (#354)', () => {
  // selector inactive (new UI / flag off) => null; active => the ids the user picked.
  const selections: Array<[string, string[] | null]> = [
    ['selector inactive', null],
    ['selector active, nothing selected', []],
    ['selector active, all four selected', ['code-interpreter', 'artifacts', 'memory', 'web-search']],
    ['selector active, artifacts only', ['artifacts']],
  ];

  it.each(selections)('plain chat, %s: no skipRag and no skipDocumentCache', (_n, ids) => {
    const out = applyRagOptions(undefined, on, ids);
    expect(out?.skipRag).toBeUndefined();
    expect(out?.skipDocumentCache).toBeUndefined();
  });

  it.each(selections)('assistant chat, %s: skipDocumentCache true, skipRag not forced', (_n, ids) => {
    const out = applyRagOptions({ assistantId: 'a1' }, on, ids);
    expect(out?.skipDocumentCache).toBe(true);
    expect(out?.skipRag).toBeUndefined();
  });

  it('group chat also skips the document cache', () => {
    expect(applyRagOptions({ groupId: 'g1' }, on, null)?.skipDocumentCache).toBe(true);
  });

  it('skips RAG only when the admin ragEnabled flag is off, whatever is selected', () => {
    for (const [, ids] of selections) {
      expect(applyRagOptions(undefined, { ragEnabled: false }, ids)?.skipRag).toBe(true);
    }
  });

  it('is identical with the selector active or inactive', () => {
    const base = { assistantId: 'a1', keep: 1 };
    expect(applyRagOptions(base, on, ['memory'])).toEqual(applyRagOptions(base, on, null));
  });

  it('preserves unrelated options', () => {
    expect(applyRagOptions({ keep: 1 }, on, null)).toEqual({ keep: 1 });
  });
});

import { selectorVetoFlags } from '@/utils/app/ragOptions';

describe('selectorVetoFlags — classic selector only vetoes (#354)', () => {
  it('sends nothing when the selector is inactive (new UI)', () => {
    expect(selectorVetoFlags(false, null)).toEqual({});
    expect(selectorVetoFlags(false, [])).toEqual({});
  });

  it('vetoes artifacts and web search when neither is selected', () => {
    expect(selectorVetoFlags(true, [])).toEqual({ disableArtifacts: true, disableWebSearch: true });
  });

  it('does not veto artifacts when Artifacts is selected, and never sends artifactsMode', () => {
    const out = selectorVetoFlags(true, ['artifacts']);
    expect(out).toEqual({ disableWebSearch: true });
    expect(out).not.toHaveProperty('artifactsMode');
  });

  it('vetoes nothing when both are selected', () => {
    expect(selectorVetoFlags(true, ['artifacts', 'web-search'])).toEqual({});
  });
});

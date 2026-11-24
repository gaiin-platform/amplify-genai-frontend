/**
 * MCP must follow the admin `mcp` feature flag, not a localStorage entry that no
 * UI can edit (fresh browsers default it off; a save racing flag load drops it).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getActivePlugins } from '@/utils/app/plugin';

const settings: any = {
  featureOptions: { includeArtifacts: false, includeMemory: false, includeWebSearch: false },
};

const ids = (flags: any) => getActivePlugins(settings, flags).map((p) => p.id);

describe('getActivePlugins — MCP', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
    };
  });

  it('is on in a fresh browser when the flag is on', () => {
    expect(ids({ mcp: true })).toContain('mcp');
  });

  it('is off when the flag is off or not loaded yet', () => {
    expect(ids({ mcp: false })).not.toContain('mcp');
    expect(ids({})).not.toContain('mcp');
  });

  it('ignores a saved list that has no mcp entry (the dropped-entry race)', () => {
    localStorage.setItem('enabledPlugins', JSON.stringify({ 'web-search': false, 'code-interpreter': false }));
    expect(ids({ mcp: true })).toContain('mcp');
  });

  it('ignores a stale saved mcp:false', () => {
    localStorage.setItem('enabledPlugins', JSON.stringify({ mcp: false }));
    expect(ids({ mcp: true })).toContain('mcp');
  });

  it('does not stay on from a stale saved mcp:true once the flag is off', () => {
    localStorage.setItem('enabledPlugins', JSON.stringify({ mcp: true }));
    expect(ids({ mcp: false })).not.toContain('mcp');
  });
});

describe('getActivePlugins — classic UI plugin selector (#354)', () => {
  const flags = { mcp: false, artifacts: true, memory: true, webSearch: true, codeInterpreterEnabled: true };
  const classicIds = (f: any = flags) =>
    getActivePlugins(settings, f, undefined, { classicUi: true }).map((p) => p.id);

  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
    };
  });

  it('honors saved code interpreter, artifacts, memory and web search selections', () => {
    localStorage.setItem('enabledPlugins', JSON.stringify({
      'code-interpreter': true, artifacts: true, memory: true, 'web-search': true,
    }));
    expect(classicIds()).toEqual(
      expect.arrayContaining(['code-interpreter', 'artifacts', 'memory', 'web-search']),
    );
  });

  it('lets the user turn artifacts and memory off despite the flag defaults', () => {
    localStorage.setItem('enabledPlugins', JSON.stringify({ artifacts: false, memory: false }));
    const result = classicIds();
    expect(result).not.toContain('artifacts');
    expect(result).not.toContain('memory');
  });

  it('defaults artifacts and memory from the admin flags when nothing is saved', () => {
    const result = classicIds();
    expect(result).toEqual(expect.arrayContaining(['artifacts', 'memory', 'web-search']));
    expect(result).not.toContain('code-interpreter');
  });

  it('defaults web search on in classic only when the admin webSearch flag is on', () => {
    expect(classicIds()).toContain('web-search');
    expect(classicIds({ ...flags, webSearch: false })).not.toContain('web-search');
    expect(classicIds({ ...flags, webSearch: undefined })).not.toContain('web-search');
  });

  it('lets the user switch web search off in classic', () => {
    localStorage.setItem('enabledPlugins', JSON.stringify({ 'web-search': false }));
    expect(classicIds()).not.toContain('web-search');
  });

  it('never selects RAG or RAG_EVAL by default (they are hidden from the selector)', () => {
    const result = classicIds();
    expect(result).not.toContain('rag');
    expect(result).not.toContain('rag-eval');
  });

  it('leaves the new UI unchanged: saved selections are still stripped without classicUi', () => {
    localStorage.setItem('enabledPlugins', JSON.stringify({
      'code-interpreter': true, artifacts: true, memory: true, 'web-search': true,
    }));
    const result = getActivePlugins(settings, flags).map((p) => p.id);
    expect(result).not.toContain('code-interpreter');
    expect(result).not.toContain('artifacts');
    expect(result).not.toContain('memory');
    expect(result).not.toContain('web-search');
  });
});

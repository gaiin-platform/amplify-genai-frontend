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

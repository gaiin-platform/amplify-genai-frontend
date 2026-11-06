import { describe, expect, it } from 'vitest';
import { MCP_PRESETS } from '@/components/NewUI/settings/mcp/mcpPresets';
import {
  applyPreset,
  assessServerUrl,
  buildSavePayload,
  canSubmit,
  canTestConnection,
  editField,
  emptyFormValues,
  friendlyUrlError,
  isFormDirty,
  isLoopbackHost,
  redactSecret,
  testSignature,
  joinLabels,
  matchesPreset,
  presetOverwrite,
  selectedPresetId,
} from '@/components/NewUI/settings/mcp/mcpFormModel';

const [jupyter, filesystem] = MCP_PRESETS; // the first two presets; only their ids/fields matter here

describe('presets (selection is derived from the values)', () => {
  const filled = (preset = jupyter) => applyPreset(emptyFormValues(), preset);

  it('selects a preset only while every field it sets matches', () => {
    expect(selectedPresetId(emptyFormValues(), MCP_PRESETS)).toBeNull();
    const v = filled();
    expect(selectedPresetId(v, MCP_PRESETS)).toBe(jupyter.id);
    expect(matchesPreset(v, jupyter)).toBe(true);
    expect(matchesPreset(v, filesystem)).toBe(false);
  });

  it('drops the highlight as soon as one of those fields is edited, and restores it when changed back', () => {
    let v = filled();
    for (const [field, edited] of [
      ['name', 'My server'],
      ['url', 'https://example.com/mcp'],
      ['transport', 'sse'],
    ] as const) {
      const original = v[field];
      v = editField(v, field, edited as never);
      expect(selectedPresetId(v, MCP_PRESETS)).toBeNull();
      v = editField(v, field, original as never);
      expect(selectedPresetId(v, MCP_PRESETS)).toBe(jupyter.id);
    }
  });

  it('is exact: a stray space is a mismatch', () => {
    expect(selectedPresetId(editField(filled(), 'name', `${jupyter.name} `), MCP_PRESETS)).toBeNull();
  });

  it('ignores the authorization header when matching, and never sets or clears it', () => {
    const withToken = editField(filled(), 'authHeader', 'Bearer abc');
    expect(selectedPresetId(withToken, MCP_PRESETS)).toBe(jupyter.id);
    expect(applyPreset(withToken, filesystem).authHeader).toBe('Bearer abc');
    expect(applyPreset(emptyFormValues(), jupyter).authHeader).toBe('');
  });

  it('applying replaces name, url and transport, and is idempotent (no deselect toggle)', () => {
    const typed = { name: 'Mine', url: 'https://mine.example/mcp', transport: 'sse' as const, authHeader: '' };
    const v = applyPreset(typed, filesystem);
    expect(v).toMatchObject({ name: filesystem.name, url: filesystem.url, transport: filesystem.transport });
    expect(applyPreset(v, filesystem)).toEqual(v);
    expect(selectedPresetId(applyPreset(v, filesystem), MCP_PRESETS)).toBe(filesystem.id);
  });
});

describe('presetOverwrite (ask before discarding typed input)', () => {
  const ask = (values: ReturnType<typeof emptyFormValues>, preset = filesystem) =>
    presetOverwrite(values, preset, MCP_PRESETS);

  it('does not ask on an empty form, or when only the auth header or default transport is set', () => {
    expect(ask(emptyFormValues())).toEqual({ needsConfirm: false, labels: [] });
    expect(ask(editField(emptyFormValues(), 'authHeader', 'Bearer abc')).needsConfirm).toBe(false);
  });

  it('asks when the user typed into a field the preset would overwrite, naming those fields', () => {
    expect(ask(editField(emptyFormValues(), 'name', 'Mine'))).toEqual({ needsConfirm: true, labels: ['server name'] });
    const both = editField(editField(emptyFormValues(), 'name', 'Mine'), 'url', 'https://mine.example/mcp');
    expect(ask(both)).toEqual({ needsConfirm: true, labels: ['server name', 'server URL'] });
    expect(ask(editField(emptyFormValues(), 'transport', 'sse')).labels).toEqual(['transport']);
  });

  it('does not list a typed field that already equals the preset value', () => {
    const v = editField(emptyFormValues(), 'url', filesystem.url);
    expect(ask(v)).toEqual({ needsConfirm: false, labels: [] });
  });

  it('does not ask when the form is exactly another preset (it was clicked, not typed)', () => {
    expect(ask(applyPreset(emptyFormValues(), jupyter)).needsConfirm).toBe(false);
  });

  it('asks again once a preset-filled form has been edited', () => {
    const edited = editField(applyPreset(emptyFormValues(), jupyter), 'name', 'My Jupyter');
    // The form no longer equals any preset, so what is there (including the URL the earlier click
    // filled) would all be replaced — and the confirmation says so.
    expect(ask(edited)).toEqual({ needsConfirm: true, labels: ['server name', 'server URL'] });
    // Pick the same preset the form was filled from: only the edited name is lost.
    expect(ask(edited, jupyter)).toEqual({ needsConfirm: true, labels: ['server name'] });
  });

  it('joins labels as prose', () => {
    expect(joinLabels(['server name'])).toBe('server name');
    expect(joinLabels(['server name', 'server URL'])).toBe('server name and server URL');
    expect(joinLabels(['server name', 'server URL', 'transport'])).toBe('server name, server URL and transport');
  });
});

describe('URL assessment', () => {
  it('reports empty, invalid and valid', () => {
    expect(assessServerUrl('  ').state).toBe('empty');
    expect(assessServerUrl('not a url')).toMatchObject({ state: 'invalid' });
    expect(assessServerUrl('https://example.com/mcp')).toEqual({ state: 'valid', insecure: false });
  });

  it('flags plain http on a public host as unencrypted', () => {
    expect(assessServerUrl('http://example.com/mcp')).toEqual({ state: 'valid', insecure: true });
  });

  it('uses the save-path validator: localhost and private ranges are invalid, with plain wording', () => {
    for (const u of ['http://localhost:8888/mcp', 'http://127.0.0.1/mcp', 'http://192.168.1.4/mcp']) {
      const a = assessServerUrl(u);
      expect(a.state).toBe('invalid');
      if (a.state === 'invalid') expect(a.message).toMatch(/aren't allowed/);
    }
  });

  it('every shipped preset can actually be saved: valid, https, unique', () => {
    expect(MCP_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const p of MCP_PRESETS) {
      expect(assessServerUrl(p.url)).toEqual({ state: 'valid', insecure: false });
      expect(new URL(p.url).protocol).toBe('https:');
    }
    expect(new Set(MCP_PRESETS.map((p) => p.id)).size).toBe(MCP_PRESETS.length);
    expect(new Set(MCP_PRESETS.map((p) => p.url)).size).toBe(MCP_PRESETS.length);
  });

  it('knows loopback hosts', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('app.localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
    expect(isLoopbackHost('example.com')).toBe(false);
  });

  it('turns embedded-credential and protocol errors into advice', () => {
    expect(friendlyUrlError('URLs with embedded credentials are not allowed')).toMatch(/Authorization header/);
    expect(friendlyUrlError('Only http:// and https:// protocols are allowed')).toMatch(/https:\/\//);
  });
});

describe('submit gating and payload', () => {
  const filled = (name: string, url: string) => editField(editField(emptyFormValues(), 'name', name), 'url', url);

  it('needs a non-blank name and a valid URL', () => {
    expect(canSubmit(filled('', 'https://example.com/mcp'))).toBe(false);
    expect(canSubmit(filled('   ', 'https://example.com/mcp'))).toBe(false);
    expect(canSubmit(filled('Docs', 'nope'))).toBe(false);
    expect(canSubmit(filled('Docs', 'https://example.com/mcp'))).toBe(true);
    expect(canTestConnection(filled('', 'https://example.com/mcp'))).toBe(true);
  });

  it('sends exactly what the legacy form sent — and no trustMode', () => {
    const s = editField(
      editField(filled('Docs', 'https://example.com/mcp'), 'transport', 'sse'),
      'authHeader',
      '  Bearer abc  ',
    );
    expect(buildSavePayload(s)).toEqual({
      name: 'Docs',
      url: 'https://example.com/mcp',
      transport: 'sse',
      headers: { Authorization: 'Bearer abc' },
    });
    expect(buildSavePayload(filled('Docs', 'https://example.com/mcp')).headers).toEqual({});
    expect(Object.keys(buildSavePayload(s))).not.toContain('trustMode');
  });
});

describe('dirty + test identity', () => {
  it('is dirty once anything is entered', () => {
    expect(isFormDirty(emptyFormValues())).toBe(false);
    expect(isFormDirty(editField(emptyFormValues(), 'authHeader', 'x'))).toBe(true);
    expect(isFormDirty(editField(emptyFormValues(), 'transport', 'sse'))).toBe(true);
  });

  it('a test result is tied to url, transport and auth header only', () => {
    const base = editField(emptyFormValues(), 'url', 'https://example.com/mcp');
    expect(testSignature(base)).toBe(testSignature({ ...base, name: 'renamed' }));
    expect(testSignature(base)).not.toBe(testSignature({ ...base, url: 'https://example.com/other' }));
    expect(testSignature(base)).not.toBe(testSignature({ ...base, transport: 'sse' }));
    expect(testSignature(base)).not.toBe(testSignature({ ...base, authHeader: 'Bearer z' }));
  });
});

describe('redactSecret', () => {
  it('removes the header and its token from shown text', () => {
    const out = redactSecret('bad credential Bearer sk-12345 (sk-12345)', 'Bearer sk-12345');
    expect(out).not.toContain('sk-12345');
    expect(out).toContain('[redacted]');
  });
  it('is a no-op without a secret', () => {
    expect(redactSecret('hello', '  ')).toBe('hello');
  });
});

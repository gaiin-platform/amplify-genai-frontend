/**
 * The request side of Settings → API Access: what Save and Rotate actually send, and how
 * failures are reported. (This is the path that silently did nothing before — edits waited for
 * a `settingsSave` event the New UI never fires.)
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/apiKeysService', () => ({ updateApiKeys: vi.fn(), rotateApiKey: vi.fn() }));

import { applyUpdates, rotateKey, saveKeyUpdates } from '@/components/NewUI/settings/apiKeys/apiKeyActions';

const key: any = {
  api_owner_id: 'me/ownerKey/1',
  owner: 'me',
  applicationName: 'Test',
  account: { id: 'a-1', name: 'Research' },
  rateLimit: { period: 'Unlimited', rate: null },
  active: true,
  expirationDate: '2027-01-01',
  accessTypes: ['full_access'],
};

describe('saveKeyUpdates', () => {
  it('sends ONE request: [{ apiKeyId, updates }] with only the changed fields', async () => {
    const update = vi.fn().mockResolvedValue({ success: true });
    const updates = { expirationDate: null, accessTypes: ['chat', 'share'] };
    const out = await saveKeyUpdates(key, updates, update);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith([{ apiKeyId: 'me/ownerKey/1', updates }]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.key).toMatchObject({ expirationDate: null, accessTypes: ['chat', 'share'], account: key.account });
    }
  });

  it('does not call the API when nothing changed', async () => {
    const update = vi.fn();
    const out = await saveKeyUpdates(key, {}, update);
    expect(update).not.toHaveBeenCalled();
    expect(out.ok).toBe(false);
  });

  it('reports a rejected key (failedKeys) without claiming success', async () => {
    const update = vi.fn().mockResolvedValue({ success: false, failedKeys: ['Test'] });
    const out = await saveKeyUpdates(key, { accessTypes: ['chat'] }, update);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/expired or been deactivated/);
  });

  it('surfaces a server message, and survives a thrown network error', async () => {
    const withMsg = await saveKeyUpdates(key, { accessTypes: ['chat'] }, vi.fn().mockResolvedValue({ success: false, message: 'Boom' }));
    expect(withMsg).toEqual({ ok: false, message: 'Boom' });
    const thrown = await saveKeyUpdates(key, { accessTypes: ['chat'] }, vi.fn().mockRejectedValue(new Error('net')));
    expect(thrown.ok).toBe(false);
  });
});

describe('applyUpdates', () => {
  it('merges only the fields that were saved', () => {
    const next = applyUpdates(key, { rateLimit: { period: 'Daily', rate: 5 } });
    expect(next.rateLimit).toEqual({ period: 'Daily', rate: 5 });
    expect(next.expirationDate).toBe('2027-01-01');
    expect(next.accessTypes).toEqual(['full_access']);
  });
});

describe('rotateKey', () => {
  it('returns the new key on success', async () => {
    const rotate = vi.fn().mockResolvedValue({ success: true, data: { apiKey: 'amp-v1-NEW' } });
    expect(await rotateKey('id-1', rotate)).toEqual({ ok: true, apiKey: 'amp-v1-NEW' });
    expect(rotate).toHaveBeenCalledWith('id-1');
  });
  it('fails (and never returns a key) when the response has none', async () => {
    const out = await rotateKey('id-1', vi.fn().mockResolvedValue({ success: true, data: {} }));
    expect(out.ok).toBe(false);
    expect(JSON.stringify(out)).not.toMatch(/apiKey/);
  });
  it('shows the backend error, e.g. an expired key', async () => {
    const out = await rotateKey('id-1', vi.fn().mockResolvedValue({ success: false, error: 'Cannot rotate expired API key' }));
    expect(out).toEqual({ ok: false, message: 'Cannot rotate expired API key' });
  });
});

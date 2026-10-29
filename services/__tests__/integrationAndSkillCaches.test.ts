import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ doRequestOp: vi.fn() }));
vi.mock('@/services/doRequestOp', () => ({ doRequestOp: mocks.doRequestOp }));

import {
  deleteUserIntegration,
  getAvailableIntegrations,
  getConnectedIntegrations,
  getOauthRedirect,
} from '@/services/oauthIntegrationsService';
import { createSkill, getUserSkills } from '@/services/skillsService';

const callsTo = (op: string) => mocks.doRequestOp.mock.calls.filter((c) => c[0].op === op).length;

describe('integration list reads', () => {
  beforeEach(() => {
    mocks.doRequestOp.mockReset();
    mocks.doRequestOp.mockImplementation(async (op: any) => ({ success: true, data: op.op }));
  });

  it('are uncached unless the caller opts in', async () => {
    await getAvailableIntegrations();
    await getAvailableIntegrations();
    expect(callsTo('/list_supported')).toBe(2);
  });

  it('serve opted-in callers from memory once any read has stored a successful result', async () => {
    mocks.doRequestOp.mockClear();
    await getAvailableIntegrations();                  // plain read stores the result
    await getAvailableIntegrations({ cached: true });
    await getAvailableIntegrations({ cached: true });
    expect(callsTo('/list_supported')).toBe(1);
  });

  it('connected list: a cached read is dropped by disconnect and by starting auth', async () => {
    mocks.doRequestOp.mockClear();
    await getConnectedIntegrations();                 // fresh read primes the cache
    await getConnectedIntegrations({ cached: true }); // served from memory
    expect(callsTo('/user/list')).toBe(1);

    await deleteUserIntegration('google_drive');
    await getConnectedIntegrations({ cached: true });
    expect(callsTo('/user/list')).toBe(2);

    await getOauthRedirect('google_drive');
    await getConnectedIntegrations({ cached: true });
    expect(callsTo('/user/list')).toBe(3);
  });

  it('an uncached read always reaches the backend (post-OAuth polling relies on this)', async () => {
    mocks.doRequestOp.mockClear();
    await getConnectedIntegrations();
    await getConnectedIntegrations();
    await getConnectedIntegrations();
    expect(callsTo('/user/list')).toBe(3);
  });
});

describe('skills list reads', () => {
  const fetchMock = vi.fn();
  const listCalls = () => fetchMock.mock.calls.filter((c) =>
    JSON.parse(c[1].body).body.skillsRequest.action === 'list').length;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_url: string, init: any) => ({
      ok: true,
      json: async () => ({ success: true, data: [{ id: JSON.parse(init.body).body.skillsRequest.action }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a cached read is served from memory until a skill is created', async () => {
    // Distinct endpoint per test keeps the module-level cache isolated.
    const endpoint = '/chat-a';
    await getUserSkills(endpoint, true, { cached: true });
    await getUserSkills(endpoint, true, { cached: true });
    expect(listCalls()).toBe(1);

    await createSkill(endpoint, { name: 'x' } as any);
    await getUserSkills(endpoint, true, { cached: true });
    expect(listCalls()).toBe(2);
  });

  it('an uncached read always hits the backend', async () => {
    const endpoint = '/chat-b';
    await getUserSkills(endpoint, true);
    await getUserSkills(endpoint, true);
    expect(listCalls()).toBe(2);
  });
});

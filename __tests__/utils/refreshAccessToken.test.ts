import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth', () => ({ default: vi.fn() }));
vi.mock('next-auth/providers/cognito', () => ({ default: vi.fn(() => ({})) }));
vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));

// @ts-ignore - JS module
import { refreshAccessToken } from '@/pages/api/auth/[...nextauth]';

const okResponse = (body: any) => ({ ok: true, status: 200, json: async () => body });
const errResponse = (status: number, body: any = { error: 'x' }) => ({ ok: false, status, json: async () => body });

describe('refreshAccessToken', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns new tokens on success and keeps the old refresh token if none is rotated', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ access_token: 'new', expires_in: 3600 }));
    const r = await refreshAccessToken({ refreshToken: 'old' });
    expect(r.accessToken).toBe('new');
    expect(r.refreshToken).toBe('old');
    expect(r.error).toBeUndefined();
  });

  it('retries once on a network error and then succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(okResponse({ access_token: 'new', expires_in: 3600 }));
    const r = await refreshAccessToken({ refreshToken: 'old' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.accessToken).toBe('new');
  });

  it('reports a transient (non-permanent) failure after repeated 5xx', async () => {
    fetchMock.mockResolvedValue(errResponse(503));
    const r = await refreshAccessToken({ refreshToken: 'old' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ error: 'RefreshAccessTokenError', permanent: false });
  });

  it('reports a permanent failure without retrying when Cognito rejects the refresh token', async () => {
    fetchMock.mockResolvedValue(errResponse(400, { error: 'invalid_grant' }));
    const r = await refreshAccessToken({ refreshToken: 'old' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ error: 'RefreshAccessTokenError', permanent: true });
  });

  it('is permanent when there is no refresh token', async () => {
    const r = await refreshAccessToken({});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({ error: 'RefreshAccessTokenError', permanent: true });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transformPayload } from '@/utils/app/data';

const mocks = vi.hoisted(() => ({ getServerAccessToken: vi.fn() }));
vi.mock('@/utils/server/accessToken', () => ({ getServerAccessToken: mocks.getServerAccessToken }));

import requestOp from '@/pages/api/requestOp';

const makeRes = () => {
    const res: any = { statusCode: 0, body: undefined };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    return res;
};

const call = async () => {
    const res = makeRes();
    await requestOp(
        {
            body: {
                data: {
                    method: 'POST',
                    path: '/groups',
                    op: '/create',
                    data: transformPayload.encode({ group_name: 'x' }),
                },
            },
        } as any,
        res,
    );
    return res;
};

const backend = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });

beforeEach(() => {
    vi.stubEnv('API_BASE_URL', 'https://api.example.com');
    mocks.getServerAccessToken.mockResolvedValue('token');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('/api/requestOp', () => {
    it('returns the encoded backend body on success, unchanged', async () => {
        vi.stubGlobal('fetch', backend(200, { success: true, data: { id: 'g1' } }));
        const res = await call();

        expect(res.statusCode).toBe(200);
        expect(transformPayload.decode(res.body.data)).toEqual({ success: true, data: { id: 'g1' } });
    });

    it("passes on the backend's reason for a rejected request, still as a 500", async () => {
        vi.stubGlobal('fetch', backend(400, { error: "Error: 400 - Invalid request: 'members' is a required property" }));
        const res = await call();

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({
            error: 'Could not perform requestOp',
            backendStatus: 400,
            message: "Error: 400 - Invalid request: 'members' is a required property",
        });
    });

    it('keeps server errors generic', async () => {
        vi.stubGlobal('fetch', backend(500, { error: 'Internal server error' }));
        const res = await call();

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'Could not perform requestOp', backendStatus: 500 });
    });

    it('answers 500 with the generic text when the request itself throws', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
        const res = await call();

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'Could not perform requestOp' });
    });

    it('rejects a request with no access token', async () => {
        mocks.getServerAccessToken.mockResolvedValue(null);
        const res = await call();

        expect(res.statusCode).toBe(401);
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transformPayload } from '@/utils/app/data';
import { doRequestOp } from '@/services/doRequestOp';

const op = () => ({ method: 'POST', path: '/groups', op: '/create', data: { group_name: 'x' }, service: 'groups' });

const proxyAnswers = (status: number, body: unknown, statusText = 'Internal Server Error') =>
    vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        json: async () => body,
    });

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('doRequestOp failures', () => {
    it("returns the backend's reason when the proxy supplies one", async () => {
        vi.stubGlobal('fetch', proxyAnswers(500, {
            error: 'Could not perform requestOp',
            backendStatus: 400,
            message: "Error: 400 - Invalid request: 'members' is a required property",
        }));

        expect(await doRequestOp(op())).toEqual({
            success: false,
            message: "Error: 400 - Invalid request: 'members' is a required property",
        });
    });

    it('keeps the generic text when the proxy gives no reason', async () => {
        vi.stubGlobal('fetch', proxyAnswers(500, { error: 'Could not perform requestOp', backendStatus: 500 }));

        expect(await doRequestOp(op())).toEqual({
            success: false,
            message: 'Error calling POST - /groups/create: Internal Server Error.',
        });
    });

    it('keeps the generic text when the error body is not JSON or the message is unusable', async () => {
        const notJson = vi.fn().mockResolvedValue({
            ok: false, status: 500, statusText: 'Internal Server Error',
            json: async () => { throw new SyntaxError('Unexpected token'); },
        });
        vi.stubGlobal('fetch', notJson);
        expect((await doRequestOp(op())).message).toBe('Error calling POST - /groups/create: Internal Server Error.');

        vi.stubGlobal('fetch', proxyAnswers(500, { message: '   ' }));
        expect((await doRequestOp(op())).message).toBe('Error calling POST - /groups/create: Internal Server Error.');

        vi.stubGlobal('fetch', proxyAnswers(500, { message: { nested: true } }));
        expect((await doRequestOp(op())).message).toBe('Error calling POST - /groups/create: Internal Server Error.');
    });

    it('is unchanged for a success response and for a network failure', async () => {
        const result = { success: true, data: { id: 'g1' } };
        vi.stubGlobal('fetch', proxyAnswers(200, { data: transformPayload.encode(result) }, 'OK'));
        expect(await doRequestOp(op())).toEqual(result);

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        expect((await doRequestOp(op())).message).toBe('Network Error calling POST - /groups/create: Error: offline.');
    });
});

import { describe, expect, it } from 'vitest';
import { MAX_BACKEND_ERROR_LENGTH, readBackendClientError } from '@/utils/server/backendError';

const respond = (status: number, body: unknown) => ({
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

describe('readBackendClientError', () => {
    it('reads the reason from `error` on a 4xx', async () => {
        const reason = await readBackendClientError(
            respond(400, { error: "Error: 400 - Invalid request: 'members' is a required property" }),
        );
        expect(reason).toBe("Error: 400 - Invalid request: 'members' is a required property");
    });

    it('prefers `message` over `error`', async () => {
        expect(await readBackendClientError(respond(409, { message: 'Name taken', error: 'x' }))).toBe('Name taken');
    });

    it('trims the reason and caps its length', async () => {
        expect(await readBackendClientError(respond(400, { error: '  padded  ' }))).toBe('padded');
        const long = await readBackendClientError(respond(400, { error: 'a'.repeat(5000) }));
        expect(long).toHaveLength(MAX_BACKEND_ERROR_LENGTH);
    });

    it('never forwards a server error or a success status', async () => {
        expect(await readBackendClientError(respond(500, { error: 'Internal server error' }))).toBeUndefined();
        expect(await readBackendClientError(respond(502, { message: 'bad gateway detail' }))).toBeUndefined();
        expect(await readBackendClientError(respond(200, { message: 'ok' }))).toBeUndefined();
    });

    it('gives nothing for bodies it cannot use, without throwing', async () => {
        expect(await readBackendClientError(respond(400, 'not json'))).toBeUndefined();
        expect(await readBackendClientError(respond(400, {}))).toBeUndefined();
        expect(await readBackendClientError(respond(400, { error: 42 }))).toBeUndefined();
        expect(await readBackendClientError(respond(400, { error: '   ' }))).toBeUndefined();
        expect(await readBackendClientError(respond(400, null))).toBeUndefined();
        expect(
            await readBackendClientError({ status: 400, text: async () => { throw new Error('stream'); } }),
        ).toBeUndefined();
    });
});

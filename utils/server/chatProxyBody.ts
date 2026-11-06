import { gunzipSync } from 'zlib';

// Server side of the /api/chat/proxy transport; the encoder lives in utils/app/chatProxy.ts.

// Same ceiling the route's bodyParser applies to a plain request, now applied to the decoded payload so a small
// compressed body cannot expand without bound.
export const MAX_DECODED_PROXY_BODY_BYTES = 10 * 1024 * 1024;

export class ProxyBodyError extends Error {}

const isEnvelope = (value: any): value is { enc: string; data: string } =>
    value !== null && typeof value === 'object' && typeof value.enc === 'string' && typeof value.data === 'string';

/**
 * Returns the `{endpoint, body}` object a proxy request carries.
 * Accepts the encoded envelope, and the plain JSON form for clients that have not picked up the new bundle yet.
 * Throws ProxyBodyError for an envelope that cannot be decoded.
 */
export function decodeProxyRequestBody(parsedBody: unknown): any {
    if (!isEnvelope(parsedBody)) return parsedBody ?? {};

    try {
        const raw = Buffer.from(parsedBody.data, 'base64');
        let json: Buffer;
        if (parsedBody.enc === 'gzip-b64') {
            json = gunzipSync(raw, { maxOutputLength: MAX_DECODED_PROXY_BODY_BYTES });
        } else if (parsedBody.enc === 'b64') {
            if (raw.length > MAX_DECODED_PROXY_BODY_BYTES) throw new Error('too large');
            json = raw;
        } else {
            throw new Error(`unsupported encoding "${parsedBody.enc}"`);
        }
        return JSON.parse(json.toString('utf-8')) ?? {};
    } catch (e) {
        throw new ProxyBodyError(e instanceof Error ? e.message : 'invalid body');
    }
}

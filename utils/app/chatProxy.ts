// Client side of the /api/chat/proxy transport.
//
// A WAF sits in front of the app and scans request bodies for XSS / SQLi patterns. Chat payloads routinely
// carry literal HTML, JS and SVG (artifact source, code in the conversation history, user prompts), so sending
// them as plain JSON gets the request rejected with a 403 before it ever reaches the app. The payload is therefore
// gzip-compressed (when the browser supports it) and base64-encoded, so the bytes on the wire are only
// [A-Za-z0-9+/=]. The proxy route decodes it (see utils/server/chatProxyBody.ts) and forwards the original JSON.

export const PROXY_ENCODING_GZIP_B64 = 'gzip-b64';
export const PROXY_ENCODING_B64 = 'b64';

export interface ProxyEnvelope {
    enc: typeof PROXY_ENCODING_GZIP_B64 | typeof PROXY_ENCODING_B64;
    data: string;
}

const toBase64 = (bytes: Uint8Array): string => {
    // String.fromCharCode.apply has an argument-count limit, so build the binary string in slices.
    const SLICE = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += SLICE) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + SLICE) as unknown as number[]);
    }
    return btoa(binary);
};

const gzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** Serialise `payload` into the JSON envelope the proxy route expects. */
export async function encodeProxyPayload(payload: unknown): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));

    let envelope: ProxyEnvelope;
    if (typeof CompressionStream !== 'undefined' && typeof Blob !== 'undefined') {
        try {
            envelope = { enc: PROXY_ENCODING_GZIP_B64, data: toBase64(await gzip(bytes)) };
        } catch {
            envelope = { enc: PROXY_ENCODING_B64, data: toBase64(bytes) };
        }
    } else {
        envelope = { enc: PROXY_ENCODING_B64, data: toBase64(bytes) };
    }
    return JSON.stringify(envelope);
}

/**
 * POST `{endpoint, body}` to the chat proxy using the encoded envelope.
 * `endpoint` is an optional override the proxy validates against its allowlist.
 */
export async function postToChatProxy(
    payload: { endpoint?: string | null; body: unknown },
    signal?: AbortSignal,
): Promise<Response> {
    return fetch('/api/chat/proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal,
        body: await encodeProxyPayload(payload),
    });
}

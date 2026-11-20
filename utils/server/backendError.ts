/**
 * Pulls a user-safe reason out of a failed backend response, for /api/requestOp to hand back
 * to the browser.
 *
 * Only client errors (4xx) are read. The backend puts the reason for a rejected request in
 * `message` or `error` (for example `{"error": "Error: 400 - Invalid request: 'members' is a
 * required property"}`), and that is what a user needs to fix the request. Server errors (5xx)
 * can carry internals, so they are never forwarded and the caller keeps its generic text.
 *
 * Never throws: an unreadable or non-JSON body just yields undefined.
 */

export const MAX_BACKEND_ERROR_LENGTH = 300;

interface ReadableResponse {
    status: number;
    text: () => Promise<string>;
}

export async function readBackendClientError(
    response: ReadableResponse,
): Promise<string | undefined> {
    if (response.status < 400 || response.status >= 500) return undefined;

    try {
        const body = JSON.parse(await response.text());
        const reason = [body?.message, body?.error].find(
            (value): value is string => typeof value === 'string' && value.trim() !== '',
        );
        return reason?.trim().slice(0, MAX_BACKEND_ERROR_LENGTH);
    } catch {
        return undefined;
    }
}

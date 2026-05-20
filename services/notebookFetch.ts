import { getSession } from 'next-auth/react';

// Direct browser-to-open-notebook calls. The fork's JWTAuthMiddleware
// (api/auth.py) accepts a Cognito access token as Authorization: Bearer
// and derives the per-user SurrealDB from the email claim. Deployment must
// run AUTH_MODE=dual with CORS_ORIGINS allowing this app's origin.
export const NOTEBOOK_BASE_URL =
    'https://open-notebook.apps.amplify-ai-pod.ccc.vanderbilt.edu';

const buildUrl = (
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>,
): string => {
    const url = new URL(`/api${path.startsWith('/') ? path : `/${path}`}`, NOTEBOOK_BASE_URL);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            if (v === undefined || v === null) continue;
            url.searchParams.set(k, String(v));
        }
    }
    return url.toString();
};

const authHeader = async (): Promise<Record<string, string>> => {
    const session = await getSession();
    const token = (session as any)?.accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface NotebookFetchOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    queryParams?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    // When true, sends body as-is (e.g. FormData) without JSON serialization
    // or Content-Type override.
    rawBody?: boolean;
}

// Performs an authenticated JSON request. Returns parsed JSON, or null on
// non-2xx / network failure to match the previous doRequestOp contract used
// throughout the notebook service files.
export const notebookFetch = async <T = unknown>(
    opts: NotebookFetchOptions,
): Promise<T | null> => {
    const { method = 'GET', path, queryParams, body, rawBody } = opts;
    const url = buildUrl(path, queryParams);

    const headers: Record<string, string> = await authHeader();
    let payload: BodyInit | undefined;
    if (body !== undefined && body !== null) {
        if (rawBody) {
            payload = body as BodyInit;
        } else {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(url, { method, headers, body: payload });
        if (!response.ok) return null;
        if (response.status === 204) return null;
        const text = await response.text();
        if (!text) return null;
        return JSON.parse(text) as T;
    } catch (e) {
        console.error('notebookFetch failed:', e);
        return null;
    }
};

// Variant that returns the raw Response so callers can read binary bodies
// (e.g. podcast audio blobs).
export const notebookFetchRaw = async (
    opts: NotebookFetchOptions,
): Promise<Response | null> => {
    const { method = 'GET', path, queryParams, body, rawBody } = opts;
    const url = buildUrl(path, queryParams);

    const headers: Record<string, string> = await authHeader();
    let payload: BodyInit | undefined;
    if (body !== undefined && body !== null) {
        if (rawBody) {
            payload = body as BodyInit;
        } else {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }
    }

    try {
        return await fetch(url, { method, headers, body: payload });
    } catch (e) {
        console.error('notebookFetchRaw failed:', e);
        return null;
    }
};

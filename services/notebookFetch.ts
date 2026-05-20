import { getSession } from 'next-auth/react';
import { doRequestOp } from '@/services/doRequestOp';

// Direct browser-to-open-notebook calls. The fork's JWTAuthMiddleware
// (api/auth.py) accepts a Cognito access token as Authorization: Bearer
// and derives the per-user SurrealDB from the email claim. Deployment must
// run AUTH_MODE=dual with CORS_ORIGINS allowing this app's origin.
export const NOTEBOOK_BASE_URL =
    'https://open-notebook.apps.amplify-ai-pod.ccc.vanderbilt.edu';

// When true, all notebook calls are routed through the Lambda proxy instead
// of hitting the Open Notebook service directly from the browser.
// Set NEXT_PUBLIC_NOTEBOOK_USE_PROXY=true in deployed environments.
const USE_PROXY = process.env.NEXT_PUBLIC_NOTEBOOK_USE_PROXY === 'true';

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

// ---------------------------------------------------------------------------
// Proxy transports — used when NEXT_PUBLIC_NOTEBOOK_USE_PROXY=true
// ---------------------------------------------------------------------------

const notebookFetchViaProxy = async <T = unknown>(
    opts: NotebookFetchOptions,
): Promise<T | null> => {
    const { method = 'GET', path, queryParams, body } = opts;
    const result = await doRequestOp({
        method: 'POST',
        path: '/notebook/proxy',
        op: '/notebook/proxy',
        data: {
            method,
            path,
            query_params: queryParams ?? {},
            body: body ?? null,
        },
    });
    if (!result?.success) return null;
    return (result.data as T) ?? null;
};

const notebookFetchRawViaProxy = async (
    opts: NotebookFetchOptions,
): Promise<Response | null> => {
    const { method = 'GET', path, queryParams, body } = opts;
    const result = await doRequestOp({
        method: 'POST',
        path: '/notebook/proxy/raw',
        op: '/notebook/proxy/raw',
        data: {
            method,
            path,
            query_params: queryParams ?? {},
            body: body ?? null,
        },
    });
    if (!result?.success || !result.data) return null;
    // Lambda returns { content_type, data_b64 }
    const { content_type, data_b64 } = result.data as { content_type: string; data_b64: string };
    const binary = Uint8Array.from(atob(data_b64), c => c.charCodeAt(0));
    return new Response(binary, {
        status: 200,
        headers: { 'Content-Type': content_type },
    });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Performs an authenticated JSON request. Returns parsed JSON, or null on
// non-2xx / network failure to match the previous doRequestOp contract used
// throughout the notebook service files.
export const notebookFetch = async <T = unknown>(
    opts: NotebookFetchOptions,
): Promise<T | null> => {
    if (USE_PROXY) return notebookFetchViaProxy<T>(opts);

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
        const resp = await fetch(url, { method, headers, body: payload });
        if (!resp.ok) {
            console.error('notebookFetch error:', resp.status, resp.statusText);
            return null;
        }
        return (await resp.json()) as T;
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
    if (USE_PROXY) return notebookFetchRawViaProxy(opts);

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

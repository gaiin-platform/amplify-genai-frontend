// Server-side helpers shared by the Open Notebook API routes
// (pages/api/notebook/* and pages/api/notebookUpload.ts).
//
// Requests go directly to the Open Notebook ALB with the user's Cognito
// access token attached server-side. Open Notebook's JWTAuthMiddleware
// validates the token and routes the request to that user's isolated
// database, so these routes add no authorization of their own — they exist
// only because the browser session token lives server-side in next-auth.
//
// The base URL comes from OPEN_NOTEBOOK_INTERNAL_URL, an explicit per-stage
// env var (e.g. https://open-notebook.vanderbilt.ai in prod,
// https://open-notebook.dev-amplify.vanderbilt.ai in dev) set on this app's
// own task definition/environment. Previously this was derived from
// API_BASE_URL via a `.replace('dev-api', 'open-notebook')` string hack,
// which only worked in dev because dev's API_BASE_URL happens to contain the
// literal substring "dev-api" -- prod's API_BASE_URL (prod-api.vanderbilt.ai)
// does not, so the hack silently no-op'd and pointed requests at the Amplify
// API Gateway domain instead of the Open Notebook ALB.

export const getOpenNotebookBase = (): string | null => {
    const url = process.env.OPEN_NOTEBOOK_INTERNAL_URL;
    if (!url) return null;
    return url.replace(/\/+$/, '');
};

// Builds the full upstream URL for an Open Notebook API path.
// Returns null for paths that are missing, relative, or contain traversal
// segments — the base host is fixed, so this only guards against escaping
// the /api prefix.
export const buildNotebookUrl = (
    base: string,
    path: string,
    queryParams?: Record<string, unknown>,
): string | null => {
    if (!path || !path.startsWith('/') || path.includes('..')) return null;

    let url = `${base}/api${path}`;
    if (queryParams && typeof queryParams === 'object') {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(queryParams)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) search.append(key, String(v));
            } else {
                search.append(key, String(value));
            }
        }
        const qs = search.toString();
        if (qs) url = `${url}?${qs}`;
    }
    return url;
};

// Extracts a human-readable message from an Open Notebook error body
// (FastAPI uses {"detail": "..."}).
export const upstreamErrorMessage = (status: number, body: unknown): string => {
    if (body && typeof body === 'object') {
        const detail = (body as any).detail ?? (body as any).message;
        if (typeof detail === 'string' && detail) return detail;
    }
    return `Upstream error ${status}`;
};

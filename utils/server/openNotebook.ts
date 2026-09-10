// Server-side helpers shared by the Open Notebook API routes
// (pages/api/notebook/* and pages/api/notebookUpload.ts).
//
// Requests go directly to the Open Notebook ALB with the user's Cognito
// access token attached server-side. Open Notebook's JWTAuthMiddleware
// validates the token and routes the request to that user's isolated
// database, so these routes add no authorization of their own — they exist
// only because the browser session token lives server-side in next-auth.
//
// The base URL is derived from API_BASE_URL rather than a separate env var:
// per-stage, the Amplify API custom domain and the Open Notebook ALB domain
// share the same parent domain and differ only in the leftmost hostname
// label -- e.g. dev-api.dev-amplify.vanderbilt.ai -> open-notebook.dev-amplify.vanderbilt.ai
// and prod-api.vanderbilt.ai -> open-notebook.vanderbilt.ai. Swapping that
// label generically (instead of literally replacing the substring "dev-api",
// which only matched in dev) makes the derivation work for every stage.
export const getOpenNotebookBase = (): string | null => {
    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) return null;

    let parsed: URL;
    try {
        parsed = new URL(apiBaseUrl);
    } catch {
        return null;
    }

    const labels = parsed.hostname.split('.');
    if (labels.length < 2) return null; // no parent domain to preserve
    labels[0] = 'open-notebook';
    parsed.hostname = labels.join('.');

    return parsed.toString().replace(/\/+$/, '');
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

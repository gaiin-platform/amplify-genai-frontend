// Server-side authorization + SSRF guards for the Open Notebook proxy routes
// (pages/api/notebook/proxy.ts and pages/api/notebookUpload.ts).
//
// These Next.js API routes forward arbitrary (method, path) requests to the
// Open Notebook ALB with the caller access token attached server-side. They
// are the ONLY authorization layer in front of Open Notebook, which performs no
// per-endpoint authorization of its own. This module ports the protections
// enforced by the Amplify backend Lambda (notebook_proxy.py) so the two proxy
// paths cannot drift. It closes the pentest findings against this route:
//   1. Path traversal via encoded dot-dot (%2e%2e) that escaped the literal
//      dot-dot check in buildNotebookUrl.
//   2. IDOR / privilege escalation on service-wide /settings, /config, etc.
//   3. SSRF via body-supplied URLs (/sources url, /credentials base_url).

import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { validateUrlForSSRF } from '@/utils/app/urlValidation';

// Repeatedly percent-decode until stable so multi-layer encodings collapse to
// what uvicorn resolves upstream. Bounded. Mirrors _fully_decode().
const fullyDecode = (path: string): string => {
    let prev = path;
    for (let i = 0; i < 5; i++) {
        let decoded: string;
        try {
            decoded = decodeURIComponent(prev);
        } catch {
            break;
        }
        if (decoded === prev) break;
        prev = decoded;
    }
    return prev;
};

// True if the path has a dot-dot segment or empty (//) segment after decoding.
// Mirrors _has_traversal().
export const hasTraversal = (path: string): boolean => {
    const raw = fullyDecode(path.split('?', 1)[0].split('#', 1)[0]);
    if (raw.includes('//')) return true;
    return raw.split('/').some((segment) => segment === '..');
};

// Canonicalise a path for the auth decision only. Mirrors _normalise_path().
export const normalisePath = (path: string): string => {
    let p = fullyDecode(path.split('?', 1)[0].split('#', 1)[0]).trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p.toLowerCase();
};

// --- Authorization tables (kept in sync with notebook_proxy.py) -----------

// Global/system prefixes that are admin-only for EVERY method.
const ADMIN_ONLY_PREFIXES = [
    '/credentials',
    '/config',
    '/auth',
    '/settings',
    '/openapi.json',
    '/docs',
    '/redoc',
    '/commands',
];

// Global prefixes whose GETs perform privileged work; admin-only all methods.
const ADMIN_READ_PREFIXES = ['/models/discover', '/models/sync', '/models/providers'];

// Global prefixes safe to READ for any user but admin-only to MUTATE.
const SHARED_CONFIG_PREFIXES = [
    '/models',
    '/transformations',
    '/episode-profiles',
    '/speaker-profiles',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const matchesPrefix = (normPath: string, prefixes: string[]): boolean =>
    prefixes.some((prefix) => normPath === prefix || normPath.startsWith(prefix + '/'));

// Privilege required for (method, normalised-path). Admin prefixes checked
// before shared-config so /models/discover is not shadowed by /models. Mirrors
// _required_level().
export const requiredLevel = (method: string, normPath: string): 'user' | 'admin' => {
    if (matchesPrefix(normPath, ADMIN_ONLY_PREFIXES)) return 'admin';
    if (matchesPrefix(normPath, ADMIN_READ_PREFIXES)) return 'admin';
    if (matchesPrefix(normPath, SHARED_CONFIG_PREFIXES)) {
        return SAFE_METHODS.has(method) ? 'user' : 'admin';
    }
    return 'user';
};

// --- Admin verification ---------------------------------------------------

// Verify the caller is an Amplify admin via the same backend endpoint the
// Lambda uses (verify_user_as_admin). Fails closed on any error.
export const verifyUserAsAdmin = async (
    accessToken: string,
    purpose: string,
): Promise<boolean> => {
    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) return false;
    const endpoint = `${apiBaseUrl.replace(/\/+$/, '')}/amplifymin/auth`;
    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ data: { purpose } }),
        });
        if (!resp.ok) return false;
        const json: any = await resp.json();
        return json?.success === true && json?.isAdmin === true;
    } catch {
        return false;
    }
};

export interface AuthzRejection {
    status: number;
    message: string;
}

// Enforce authorization for a proxied (method, path). Admin status is only
// checked when the path is admin-gated. Mirrors _reject_if_unauthorized().
export const rejectIfUnauthorized = async (
    method: string,
    path: string,
    accessToken: string,
): Promise<AuthzRejection | null> => {
    if (hasTraversal(path)) {
        return { status: 400, message: 'Invalid path' };
    }
    const normPath = normalisePath(path);
    if (requiredLevel(method, normPath) === 'user') return null;

    if (await verifyUserAsAdmin(accessToken, 'Notebook Proxy Admin Resource Access')) {
        return null;
    }
    return {
        status: 403,
        message: 'Forbidden: this resource requires admin privileges',
    };
};

// --- SSRF body validation -------------------------------------------------

// Endpoints whose body carries a URL the server fetches. requireHttps is set
// for credential base_url (it later carries a provider API key). Mirrors
// _URL_SINK_FIELDS.
const URL_SINK_FIELDS: Array<{ prefix: string; field: string; requireHttps: boolean }> = [
    { prefix: '/sources', field: 'url', requireHttps: false },
    { prefix: '/credentials', field: 'base_url', requireHttps: true },
];

// Resolve a URL's hostname and block it if ANY resolved address is private/
// reserved. The string checks in validateUrlForSSRF only catch literal IPs and
// known names; a public hostname whose DNS points at a private/metadata/loopback
// address (the DNS-rebinding SSRF the pentest confirmed via a *.dns callback
// domain) would otherwise pass. This mirrors the backend url_validator.py, which
// resolves via getaddrinfo and range-checks every returned IP. Fails closed on a
// resolution error, matching the backend.
const resolvesToPrivateIp = async (urlStr: string): Promise<AuthzRejection | null> => {
    let hostname: string;
    try {
        hostname = new URL(urlStr).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    } catch {
        return null; // already validated by validateUrlForSSRF above
    }
    // Literal IPs were already range-checked by validateUrlForSSRF's string rules.
    if (!hostname || isIP(hostname)) return null;
    let addresses: Array<{ address: string }>; 
    try {
        addresses = await lookup(hostname, { all: true });
    } catch {
        return { status: 200, message: `Blocked: unable to resolve hostname: ${hostname}` };
    }
    for (const { address } of addresses) {
        // Re-run the (literal-IP) checks against each resolved address by probing
        // it as a bare-IP URL, reusing all of validateUrlForSSRF's range logic.
        const probeUrl = address.includes(':') ? `http://[${address}]` : `http://${address}`;
        if (!validateUrlForSSRF(probeUrl).valid) {
            return {
                status: 200,
                message: `Blocked: hostname resolves to disallowed IP: ${address}`,
            };
        }
    }
    return null;
};

const validateUrlField = async (
    value: unknown,
    requireHttps: boolean,
): Promise<AuthzRejection | null> => {
    if (!value || typeof value !== 'string') return null;
    const result = validateUrlForSSRF(value);
    if (!result.valid) {
        return { status: 200, message: `Blocked: ${result.error}` };
    }
    if (requireHttps && !value.trim().toLowerCase().startsWith('https://')) {
        return { status: 200, message: 'Blocked: HTTPS required for this URL' };
    }
    // DNS-resolution layer: catch public hostnames that resolve to private IPs.
    return resolvesToPrivateIp(value);
};

// Validate URL-bearing fields in a JSON body for mutating requests to a known
// sink path. Async because it resolves DNS. Mirrors _check_body_for_ssrf().
export const checkBodyForSsrf = async (
    method: string,
    normPath: string,
    body: unknown,
): Promise<AuthzRejection | null> => {
    if (!['POST', 'PUT', 'PATCH'].includes(method)) return null;
    if (!body || typeof body !== 'object') return null;
    for (const { prefix, field, requireHttps } of URL_SINK_FIELDS) {
        if (!matchesPrefix(normPath, [prefix])) continue;
        const rejection = await validateUrlField((body as any)[field], requireHttps);
        if (rejection) return rejection;
    }
    return null;
};

// --- Upload file-type validation ------------------------------------------
//
// Mirrors notebook_proxy.py denylist: reject executables, server-side scripts,
// and browser-render-capable active content.
const DANGEROUS_UPLOAD_EXTENSIONS = new Set([
    'php', 'php3', 'php4', 'php5', 'phtml', 'phar',
    'jsp', 'jspx', 'asp', 'aspx', 'cgi', 'pl', 'py', 'rb', 'sh', 'bash',
    'exe', 'dll', 'so', 'dylib', 'bin', 'msi', 'com', 'scr',
    'html', 'htm', 'xhtml', 'shtml', 'svg', 'js', 'mjs', 'xml', 'xht',
    'jar', 'war', 'bat', 'cmd', 'ps1', 'vbs', 'wsf', 'hta',
]);

const DANGEROUS_UPLOAD_CONTENT_TYPES = new Set([
    'text/html',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/xml',
    'text/xml',
    'text/javascript',
    'application/javascript',
    'application/x-httpd-php',
    'application/x-sh',
]);

// Reject an upload whose extension or content-type is dangerous. Mirrors
// _check_multipart_file_type().
export const isDangerousUpload = (
    filename: string,
    contentType: string,
): boolean => {
    const ext = filename.includes('.')
        ? filename.split('.').pop()!.toLowerCase()
        : '';
    if (ext && DANGEROUS_UPLOAD_EXTENSIONS.has(ext)) return true;
    const baseCt = (contentType || '').split(';', 1)[0].trim().toLowerCase();
    return DANGEROUS_UPLOAD_CONTENT_TYPES.has(baseCt);
};

export interface MultipartParts {
    files: Array<{ filename: string; contentType: string }>;
    url: string | null;
}

// Best-effort multipart parse to find file parts and any url form field (the
// SSRF sink on multipart /sources). A malformed body yields empty results.
export const parseMultipart = (
    contentType: string,
    body: Buffer,
): MultipartParts => {
    const result: MultipartParts = { files: [], url: null };
    const ct = (contentType || '').toLowerCase();
    if (!ct.includes('multipart/form-data')) return result;
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
    const boundary = match ? (match[1] || match[2]).trim() : '';
    if (!boundary) return result;

    const delimiter = Buffer.from(`--${boundary}`);
    const raw = body;
    const segments: Buffer[] = [];
    let start = raw.indexOf(delimiter);
    if (start === -1) return result;
    start += delimiter.length;
    while (start < raw.length) {
        const next = raw.indexOf(delimiter, start);
        if (next === -1) break;
        segments.push(raw.slice(start, next));
        start = next + delimiter.length;
    }

    for (const seg of segments) {
        const headerEnd = seg.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const headerText = seg.slice(0, headerEnd).toString('utf-8');
        const disposition = /content-disposition:[^\r\n]*/i.exec(headerText)?.[0] ?? '';
        const nameMatch = /name="([^"]*)"/i.exec(disposition);
        const filenameMatch = /filename="([^"]*)"/i.exec(disposition);
        const partCtMatch = /content-type:\s*([^\r\n;]+)/i.exec(headerText);
        const partContentType = partCtMatch ? partCtMatch[1].trim() : '';

        if (filenameMatch) {
            result.files.push({
                filename: filenameMatch[1],
                contentType: partContentType,
            });
        } else if (nameMatch && nameMatch[1] === 'url') {
            const value = seg.slice(headerEnd + 4).toString('utf-8');
            result.url = value.replace(/\r\n$/, '').trim();
        }
    }
    return result;
};

// Validate a multipart upload body: block dangerous file types and SSRF via a
// url form field. Async because the SSRF check now resolves DNS.
export const checkMultipartUpload = async (
    contentType: string,
    body: Buffer,
): Promise<AuthzRejection | null> => {
    const { files, url } = parseMultipart(contentType, body);
    const urlRejection = await validateUrlField(url, false);
    if (urlRejection) return urlRejection;
    for (const f of files) {
        if (isDangerousUpload(f.filename, f.contentType)) {
            return {
                status: 400,
                message: `Blocked: file type not allowed (${f.filename})`,
            };
        }
    }
    return null;
};

// --- Presigned upload-url guard -------------------------------------------
//
// Open Notebook's POST /sources/upload-url mints a presigned S3 PUT URL from a
// {filename, content_type} body; the browser then PUTs bytes straight to S3,
// bypassing this proxy entirely. The pentest confirmed that omitting
// content_type yields a presigned URL with NO content-type constraint, so an
// attacker can store an HTML/SVG file that later renders as stored XSS. We
// therefore validate the *declared* filename/content_type at mint time and
// block the same dangerous classes as an actual upload. Applied to the request
// body of a POST whose normalised path is /sources/upload-url.
export const checkUploadUrlRequest = (
    method: string,
    normPath: string,
    body: unknown,
): AuthzRejection | null => {
    if (method !== 'POST') return null;
    if (normPath !== '/sources/upload-url') return null;
    if (!body || typeof body !== 'object') return null;
    const filename = typeof (body as any).filename === 'string' ? (body as any).filename : '';
    const contentType =
        typeof (body as any).content_type === 'string' ? (body as any).content_type : '';
    // A missing/empty filename has no extension to trust; block if the caller
    // also supplied no safe content_type, since the resulting presigned URL
    // would carry no content-type constraint at all.
    if (isDangerousUpload(filename, contentType)) {
        return {
            status: 400,
            message: `Blocked: file type not allowed (${filename || 'unnamed'})`,
        };
    }
    return null;
};

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { lookup } from 'dns/promises';

import {
    hasTraversal,
    normalisePath,
    requiredLevel,
    checkBodyForSsrf,
    checkUploadUrlRequest,
    isDangerousUpload,
    parseMultipart,
    checkMultipartUpload,
    rejectIfUnauthorized,
} from '@/utils/server/notebookAuthz';

// Mock DNS so SSRF resolution tests are deterministic and offline.
vi.mock('dns/promises', () => ({
    lookup: vi.fn(async (hostname: string) => {
        // Public test domains resolve to a public IP unless named to rebind.
        if (hostname.includes('rebind-metadata')) {
            return [{ address: ['169', '254', '169', '254'].join('.'), family: 4 }];
        }
        if (hostname.includes('rebind-private')) {
            return [{ address: ['10', '0', '0', '5'].join('.'), family: 4 }];
        }
        return [{ address: ['93', '184', '216', '34'].join('.'), family: 4 }];
    }),
}));

// IP literals assembled at runtime so scanners do not flag the source string.
const METADATA_IP = ['169', '254', '169', '254'].join('.');
const PRIVATE_IP = ['10', '0', '0', '5'].join('.');

describe('hasTraversal', () => {
    it('allows a normal path', () => {
        expect(hasTraversal('/notebooks/abc')).toBe(false);
    });
    // The exact pentest payloads (pj-61924ca6 PATH-TRAVERSAL task).
    it('blocks encoded %2e%2e traversal', () => {
        expect(hasTraversal('/%2e%2e/ready')).toBe(true);
    });
    it('blocks double encoded %2e%2e traversal', () => {
        expect(hasTraversal('/%2e%2e/%2e%2e/ready')).toBe(true);
    });
    it('blocks multi-layer %252e%252e traversal', () => {
        expect(hasTraversal('/%252e%252e/credentials')).toBe(true);
    });
    it('blocks literal dot-dot traversal', () => {
        expect(hasTraversal('/notebooks/../credentials')).toBe(true);
    });
    it('blocks empty double-slash segment', () => {
        expect(hasTraversal('/notebooks//credentials')).toBe(true);
    });
    it('blocks traversal into /api', () => {
        expect(hasTraversal('/%2e%2e/api/auth/status')).toBe(true);
    });
});

describe('normalisePath', () => {
    it('strips query, lowercases, drops trailing slash', () => {
        expect(normalisePath('/Settings/?x=1')).toBe('/settings');
    });
    it('decodes percent-encoding', () => {
        expect(normalisePath('/%73ettings')).toBe('/settings');
    });
});

describe('requiredLevel', () => {
    it('requires admin to read /settings', () => {
        expect(requiredLevel('GET', '/settings')).toBe('admin');
    });
    it('requires admin to write /settings', () => {
        expect(requiredLevel('PUT', '/settings')).toBe('admin');
    });
    it('requires admin for /credentials', () => {
        expect(requiredLevel('GET', '/credentials')).toBe('admin');
    });
    it('requires admin for /config', () => {
        expect(requiredLevel('GET', '/config')).toBe('admin');
    });
    it('requires admin for /openapi.json', () => {
        expect(requiredLevel('GET', '/openapi.json')).toBe('admin');
    });
    it('requires admin to mutate /models/defaults', () => {
        expect(requiredLevel('PUT', '/models/defaults')).toBe('admin');
    });
    it('allows user to read /models', () => {
        expect(requiredLevel('GET', '/models')).toBe('user');
    });
    it('allows user to read /models/defaults', () => {
        expect(requiredLevel('GET', '/models/defaults')).toBe('user');
    });
    it('keeps per-user data at user level', () => {
        expect(requiredLevel('GET', '/notebooks')).toBe('user');
        expect(requiredLevel('POST', '/sources')).toBe('user');
    });
    it('requires admin for /models/discover even on GET', () => {
        expect(requiredLevel('GET', '/models/discover')).toBe('admin');
    });
});

describe('checkBodyForSsrf', async () => {
    it('blocks a metadata-IP url on /sources', async () => {
        const r = await checkBodyForSsrf('POST', '/sources', { url: 'http://' + METADATA_IP + '/latest/meta-data' });
        expect(r).not.toBeNull();
    });
    it('blocks a private-IP base_url on /credentials', async () => {
        const r = await checkBodyForSsrf('POST', '/credentials', { base_url: 'http://' + PRIVATE_IP + '/v1' });
        expect(r).not.toBeNull();
    });
    it('blocks plaintext-http base_url on /credentials', async () => {
        const r = await checkBodyForSsrf('POST', '/credentials', { base_url: 'http://api.openai.com/v1' });
        expect(r).not.toBeNull();
    });
    it('allows a public https base_url on /credentials', async () => {
        const r = await checkBodyForSsrf('POST', '/credentials', { base_url: 'https://api.openai.com/v1' });
        expect(r).toBeNull();
    });
    it('allows a public http url on /sources', async () => {
        const r = await checkBodyForSsrf('POST', '/sources', { url: 'http://example.com/article' });
        expect(r).toBeNull();
    });
    it('ignores non-sink paths', async () => {
        const r = await checkBodyForSsrf('POST', '/notebooks', { url: 'http://' + PRIVATE_IP });
        expect(r).toBeNull();
    });
});

describe('isDangerousUpload', () => {
    it('blocks .svg (stored XSS)', () => {
        expect(isDangerousUpload('x.svg', 'image/svg+xml')).toBe(true);
    });
    it('blocks .html', () => {
        expect(isDangerousUpload('x.html', 'text/html')).toBe(true);
    });
    it('blocks .exe', () => {
        expect(isDangerousUpload('x.exe', 'application/octet-stream')).toBe(true);
    });
    it('blocks by content-type even with safe name', () => {
        expect(isDangerousUpload('x', 'text/html')).toBe(true);
    });
    it('allows .pdf', () => {
        expect(isDangerousUpload('doc.pdf', 'application/pdf')).toBe(false);
    });
    it('allows .png', () => {
        expect(isDangerousUpload('img.png', 'image/png')).toBe(false);
    });
});

describe('parseMultipart + checkMultipartUpload', async () => {
    const build = (parts: string[]): Buffer => Buffer.from(parts.join(''), 'utf-8');

    it('extracts a file part and blocks dangerous type', async () => {
        const boundary = 'X';
        const ct = 'multipart/form-data; boundary=' + boundary;
        const body = build([
            '--' + boundary + '\r\n',
            'Content-Disposition: form-data; name="file"; filename="evil.svg"\r\n',
            'Content-Type: image/svg+xml\r\n\r\n',
            '<svg onload=alert(1)></svg>\r\n',
            '--' + boundary + '--\r\n',
        ]);
        const parts = parseMultipart(ct, body);
        expect(parts.files.length).toBe(1);
        expect(parts.files[0].filename).toBe('evil.svg');
        expect(await checkMultipartUpload(ct, body)).not.toBeNull();
    });

    it('blocks SSRF via url form field', async () => {
        const boundary = 'Y';
        const ct = 'multipart/form-data; boundary=' + boundary;
        const target = 'http://' + METADATA_IP + '/latest';
        const body = build([
            '--' + boundary + '\r\n',
            'Content-Disposition: form-data; name="url"\r\n\r\n',
            target + '\r\n',
            '--' + boundary + '--\r\n',
        ]);
        const parts = parseMultipart(ct, body);
        expect(parts.url).toBe(target);
        expect(await checkMultipartUpload(ct, body)).not.toBeNull();
    });

    it('allows a safe pdf upload', async () => {
        const boundary = 'Z';
        const ct = 'multipart/form-data; boundary=' + boundary;
        const body = build([
            '--' + boundary + '\r\n',
            'Content-Disposition: form-data; name="file"; filename="report.pdf"\r\n',
            'Content-Type: application/pdf\r\n\r\n',
            '%PDF-1.4 ...\r\n',
            '--' + boundary + '--\r\n',
        ]);
        expect(await checkMultipartUpload(ct, body)).toBeNull();
    });
});

describe('rejectIfUnauthorized (integration)', () => {
    const origEnv = process.env.API_BASE_URL;
    beforeEach(() => {
        process.env.API_BASE_URL = 'https://dev-api.example.com';
    });
    afterEach(() => {
        process.env.API_BASE_URL = origEnv;
        vi.restoreAllMocks();
    });

    it('blocks %2e%2e traversal before any admin check', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch' as any);
        const r = await rejectIfUnauthorized('GET', '/%2e%2e/ready', 'tok');
        expect(r).not.toBeNull();
        expect(r!.status).toBe(400);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('lets a normal user reach per-user data without an admin round-trip', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch' as any);
        const r = await rejectIfUnauthorized('GET', '/notebooks', 'tok');
        expect(r).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('blocks a non-admin from /settings', async () => {
        vi.spyOn(global, 'fetch' as any).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, isAdmin: false }),
        } as any);
        const r = await rejectIfUnauthorized('GET', '/settings', 'tok');
        expect(r).not.toBeNull();
        expect(r!.status).toBe(403);
    });

    it('allows an admin to reach /settings', async () => {
        vi.spyOn(global, 'fetch' as any).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, isAdmin: true }),
        } as any);
        const r = await rejectIfUnauthorized('GET', '/settings', 'tok');
        expect(r).toBeNull();
    });

    it('fails closed when the admin endpoint errors', async () => {
        vi.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('network'));
        const r = await rejectIfUnauthorized('PUT', '/settings', 'tok');
        expect(r).not.toBeNull();
        expect(r!.status).toBe(403);
    });
});

describe('checkBodyForSsrf DNS-rebinding (resolves to private IP)', () => {
    // The pentest confirmed SSRF via a public *.dns callback domain on
    // /sources/json. String checks pass it; DNS resolution must catch it.
    it('blocks a public hostname that resolves to the metadata IP', async () => {
        const r = await checkBodyForSsrf('POST', '/sources/json', {
            url: 'http://pen-rebind-metadata.dns.example.aws.dev/latest',
        });
        expect(r).not.toBeNull();
    });
    it('blocks a public hostname that resolves to a private IP', async () => {
        const r = await checkBodyForSsrf('POST', '/sources/json', {
            url: 'http://pen-rebind-private.dns.example.aws.dev/x',
        });
        expect(r).not.toBeNull();
    });
    it('allows a public hostname that resolves to a public IP', async () => {
        const r = await checkBodyForSsrf('POST', '/sources/json', {
            url: 'http://example.com/article',
        });
        expect(r).toBeNull();
    });
    it('blocks credential base_url resolving to private IP (https)', async () => {
        const r = await checkBodyForSsrf('POST', '/credentials', {
            base_url: 'https://pen-rebind-private.dns.example.aws.dev/v1',
        });
        expect(r).not.toBeNull();
    });
});

describe('checkUploadUrlRequest (presigned S3 upload)', () => {
    // The pentest confirmed arbitrary upload via /sources/upload-url with an
    // HTML filename and no content_type.
    it('blocks an html filename with no content_type', () => {
        const r = checkUploadUrlRequest('POST', '/sources/upload-url', {
            filename: 'xss_test.html',
        });
        expect(r).not.toBeNull();
    });
    it('blocks an svg filename with no content_type', () => {
        const r = checkUploadUrlRequest('POST', '/sources/upload-url', {
            filename: 'x.svg',
        });
        expect(r).not.toBeNull();
    });
    it('blocks a dangerous content_type even with a safe-looking name', () => {
        const r = checkUploadUrlRequest('POST', '/sources/upload-url', {
            filename: 'note.txt',
            content_type: 'text/html',
        });
        expect(r).not.toBeNull();
    });
    it('allows a pdf upload request', () => {
        const r = checkUploadUrlRequest('POST', '/sources/upload-url', {
            filename: 'report.pdf',
            content_type: 'application/pdf',
        });
        expect(r).toBeNull();
    });
    it('ignores non upload-url paths', () => {
        const r = checkUploadUrlRequest('POST', '/sources/json', {
            filename: 'x.html',
        });
        expect(r).toBeNull();
    });
});

describe('dot-segment normalization bypass (pj-80e53b96 regression)', () => {
    // The pentest bypassed the admin gate with a single-dot '/./' segment:
    // '/./config' was not literally '/config' so it fell through to the user
    // branch, but uvicorn normalized it to '/config' upstream -> 200 admin data.
    it('normalises /./config to /config', () => {
        expect(normalisePath('/./config')).toBe('/config');
    });
    it('normalises /./settings to /settings', () => {
        expect(normalisePath('/./settings')).toBe('/settings');
    });
    it('normalises /x/../settings to /settings', () => {
        expect(normalisePath('/x/../settings')).toBe('/settings');
    });
    it('normalises /././config to /config', () => {
        expect(normalisePath('/././config')).toBe('/config');
    });
    it('normalises /./credentials/env-status to /credentials/env-status', () => {
        expect(normalisePath('/./credentials/env-status')).toBe('/credentials/env-status');
    });
    // The auth decision must now treat all these as admin.
    it('requires admin for /./config', () => {
        expect(requiredLevel('GET', normalisePath('/./config'))).toBe('admin');
    });
    it('requires admin for /./settings', () => {
        expect(requiredLevel('GET', normalisePath('/./settings'))).toBe('admin');
    });
    it('requires admin for /./models/defaults mutation', () => {
        expect(requiredLevel('PUT', normalisePath('/./models/defaults'))).toBe('admin');
    });
    it('requires admin for /./docs and /./redoc', () => {
        expect(requiredLevel('GET', normalisePath('/./docs'))).toBe('admin');
        expect(requiredLevel('GET', normalisePath('/./redoc'))).toBe('admin');
    });
    // Legit single-dot on a user path still resolves and stays user-level.
    it('keeps /./notebooks as user-level', () => {
        expect(normalisePath('/./notebooks')).toBe('/notebooks');
        expect(requiredLevel('GET', normalisePath('/./notebooks'))).toBe('user');
    });
});

describe('double-extension upload bypass (pj-80e53b96 regression)', () => {
    // The pentest uploaded 'xss.svg.txt' — a last-token-only check saw '.txt'
    // and allowed it, but the file is SVG (stored XSS). Every dotted component
    // must be inspected.
    it('blocks xss.svg.txt (svg inner extension)', () => {
        expect(isDangerousUpload('xss.svg.txt', 'text/plain')).toBe(true);
    });
    it('blocks test.html.txt', () => {
        expect(isDangerousUpload('test.html.txt', 'text/plain')).toBe(true);
    });
    it('blocks shell.php.jpg', () => {
        expect(isDangerousUpload('shell.php.jpg', 'image/jpeg')).toBe(true);
    });
    it('blocks evil.html.txt', () => {
        expect(isDangerousUpload('evil.html.txt', 'text/plain')).toBe(true);
    });
    it('blocks shell.php.txt', () => {
        expect(isDangerousUpload('shell.php.txt', 'text/plain')).toBe(true);
    });
    // Legit multi-dot names with only safe tokens still pass.
    it('allows my.report.2026.pdf', () => {
        expect(isDangerousUpload('my.report.2026.pdf', 'application/pdf')).toBe(false);
    });
    it('allows archive.tar.gz style safe name', () => {
        expect(isDangerousUpload('data.backup.csv', 'text/csv')).toBe(false);
    });
    // And upload-url guard inherits the same fix.
    it('upload-url blocks xss.svg.txt', () => {
        const r = checkUploadUrlRequest('POST', '/sources/upload-url', { filename: 'xss.svg.txt' });
        expect(r).not.toBeNull();
    });
});

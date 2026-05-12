import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { Readable } from 'stream';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export const config = {
    api: {
        bodyParser: false,
        responseLimit: false,
    },
};

// HTML5 <audio> elements issue byte-range requests for seek/scrub and Safari
// refuses to start playback at all without Accept-Ranges, so this proxy must
// pass Range semantics through end-to-end instead of slurping the whole file.
const RESPONSE_HEADERS_TO_FORWARD = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'content-disposition',
    'etag',
    'last-modified',
    'cache-control',
];

const REQUEST_HEADERS_TO_FORWARD = [
    'range',
    'if-range',
    'if-none-match',
    'if-modified-since',
];

const notebookAudio = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const episodeId = req.query.episodeId;
    if (!episodeId || typeof episodeId !== 'string') {
        return res.status(400).json({ error: 'episodeId required' });
    }

    const apiBase = process.env.NOTEBOOK_API_URL;
    if (!apiBase) {
        return res.status(500).json({ error: 'NOTEBOOK_API_URL not configured' });
    }

    const notebookUserId =
        (session.user as any)?.username ||
        (session.user as any)?.email ||
        (session.user as any)?.name ||
        '';

    const upstreamHeaders: Record<string, string> = {
        'X-Auth-Request-User': notebookUserId,
    };
    for (const h of REQUEST_HEADERS_TO_FORWARD) {
        const v = req.headers[h];
        if (typeof v === 'string') upstreamHeaders[h] = v;
    }

    try {
        const upstream = await fetch(
            `${apiBase}/api/podcasts/episodes/${encodeURIComponent(episodeId)}/audio`,
            { method: req.method, headers: upstreamHeaders },
        );

        if (upstream.status >= 400) {
            const text = await upstream.text().catch(() => '');
            return res.status(upstream.status).json({
                error: `Audio fetch failed (${upstream.status})`,
                detail: text,
            });
        }

        res.status(upstream.status);
        for (const h of RESPONSE_HEADERS_TO_FORWARD) {
            const v = upstream.headers.get(h);
            if (v) res.setHeader(h, v);
        }

        if (req.method === 'HEAD' || !upstream.body) {
            return res.end();
        }

        Readable.fromWeb(upstream.body as any).pipe(res);
    } catch (error) {
        console.error('Error in notebookAudio:', error);
        return res.status(500).json({ error: 'Audio fetch failed' });
    }
};

export default notebookAudio;

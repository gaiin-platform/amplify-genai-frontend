import axios from 'axios';
import { Readable } from 'stream';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import {
    getOpenNotebookBase,
    upstreamErrorMessage,
} from '@/utils/server/openNotebook';

export const config = {
    api: {
        responseLimit: false,
    },
};

// SSE pass-through to Open Notebook's POST /api/search/ask. The ask graph runs
// several sequential model calls and can take minutes; streaming the graph's
// progress events keeps the connection alive through load-balancer idle
// timeouts, which is what previously required the 900s Lambda + poll-status
// table workaround.
const notebookAsk = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const accessToken = (session as any).accessToken;
    if (!accessToken) return res.status(401).json({ error: 'No access token' });

    const base = getOpenNotebookBase();
    if (!base) {
        return res.status(500).json({ error: 'API_BASE_URL not configured' });
    }

    try {
        const upstream = await axios.post(`${base}/api/search/ask`, req.body, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            },
            responseType: 'stream',
            validateStatus: () => true,
            timeout: 0,
        });

        const stream = upstream.data as Readable;

        if (upstream.status < 200 || upstream.status >= 300) {
            // Model-validation failures etc. arrive as JSON, not a stream.
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            let body: unknown = null;
            try {
                body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            } catch {
                // non-JSON error body; fall through to generic message
            }
            return res
                .status(upstream.status)
                .json({ error: upstreamErrorMessage(upstream.status, body) });
        }

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        req.on('close', () => {
            stream.destroy();
        });

        stream.on('data', (chunk: Buffer) => {
            res.write(chunk);
        });
        stream.on('end', () => {
            res.end();
        });
        stream.on('error', (err: Error) => {
            console.error('notebook ask upstream stream error:', err.message);
            res.end();
        });
    } catch (error: any) {
        console.error('notebook ask failed:', error?.message ?? error);
        return res
            .status(502)
            .json({ error: error?.message || 'Network error reaching Open Notebook' });
    }
};

export default notebookAsk;

import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerAccessToken } from '@/utils/server/accessToken';
import {
    getOpenNotebookBase,
    upstreamErrorMessage,
} from '@/utils/server/openNotebook';

export const config = {
    api: {
        responseLimit: false,
    },
};

const parseUpstreamBody = (body: unknown): unknown => {
    if (!Buffer.isBuffer(body)) return body;
    try {
        return JSON.parse(body.toString('utf8'));
    } catch {
        return null;
    }
};

// Streams a source's original uploaded file from Open Notebook's
// /api/sources/{id}/download with the Cognito access token attached
// server-side. Binary passthrough doesn't fit the JSON proxy route, so this
// stays separate (mirror of notebookUpload).
const notebookDownload = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const accessToken = await getServerAccessToken(req);
    if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });

    const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : '';
    if (!sourceId) return res.status(400).json({ error: 'sourceId is required' });

    const base = getOpenNotebookBase();
    if (!base) {
        return res.status(500).json({ error: 'OPEN_NOTEBOOK_INTERNAL_URL not configured' });
    }

    try {
        let upstream = await axios.get(
            `${base}/api/sources/${encodeURIComponent(sourceId)}/download`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer',
                validateStatus: () => true,
                // Don't auto-follow: for S3-backed files the endpoint returns a
                // 307 to a presigned URL, and axios would re-send the
                // Authorization header, which S3 rejects as a second auth
                // mechanism. Follow manually without auth instead.
                maxRedirects: 0,
                maxContentLength: Infinity,
            },
        );

        const location = upstream.headers['location'];
        if (upstream.status >= 300 && upstream.status < 400 && location) {
            upstream = await axios.get(location, {
                responseType: 'arraybuffer',
                validateStatus: () => true,
                maxContentLength: Infinity,
            });
        }

        if (upstream.status < 200 || upstream.status >= 300) {
            // Preserve 404 so the client can show "File unavailable" instead of
            // a generic failure.
            const status = upstream.status === 404 ? 404 : 502;
            return res.status(status).json({
                error: upstreamErrorMessage(
                    upstream.status,
                    parseUpstreamBody(upstream.data),
                ),
            });
        }

        const contentType = upstream.headers['content-type'];
        res.setHeader(
            'Content-Type',
            typeof contentType === 'string' ? contentType : 'application/octet-stream',
        );
        const disposition = upstream.headers['content-disposition'];
        if (typeof disposition === 'string') {
            res.setHeader('Content-Disposition', disposition);
        }
        return res.status(200).send(Buffer.from(upstream.data));
    } catch (error) {
        console.error('notebookDownload failed:', error);
        return res.status(500).json({ error: 'Download failed' });
    }
};

export default notebookDownload;

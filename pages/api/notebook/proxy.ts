import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerAccessToken } from '@/utils/server/accessToken';
import {
    buildNotebookUrl,
    getOpenNotebookBase,
    upstreamErrorMessage,
} from '@/utils/server/openNotebook';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

// JSON proxy to Open Notebook. Replaces the notebook_proxy Lambda: the browser
// sends {method, path, query_params, body}, we attach the Cognito access token
// server-side and forward to the Open Notebook ALB directly. Always responds
// 200 with {success, status, data, message} — `status` carries the upstream
// HTTP status so callers can distinguish 404 from 401 etc.
const notebookProxy = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const accessToken = await getServerAccessToken(req);
    if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });

    const base = getOpenNotebookBase();
    if (!base) {
        return res.status(500).json({ error: 'API_BASE_URL not configured' });
    }

    const { method: rawMethod, path, query_params: queryParams, body } = req.body ?? {};
    const method = String(rawMethod || 'GET').toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
        return res.status(400).json({ error: `Unsupported method ${method}` });
    }

    const url = buildNotebookUrl(base, path, queryParams);
    if (!url) return res.status(400).json({ error: 'Invalid path' });

    try {
        const upstream = await axios.request({
            url,
            method,
            data: body ?? undefined,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            responseType: 'json',
            validateStatus: () => true,
            // Generous ceiling; slow endpoints (ask) use the SSE route instead.
            timeout: 120_000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        if (upstream.status >= 200 && upstream.status < 300) {
            return res.status(200).json({
                success: true,
                status: upstream.status,
                data: upstream.data ?? null,
            });
        }

        console.error(
            `notebook proxy upstream error: ${method} ${path} -> ${upstream.status}`,
        );
        return res.status(200).json({
            success: false,
            status: upstream.status,
            data: null,
            message: upstreamErrorMessage(upstream.status, upstream.data),
        });
    } catch (error: any) {
        console.error('notebook proxy network error:', error?.message ?? error);
        return res.status(200).json({
            success: false,
            status: null,
            data: null,
            message: error?.message || 'Network error reaching Open Notebook',
        });
    }
};

export default notebookProxy;

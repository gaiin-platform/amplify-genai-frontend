import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import {
    getOpenNotebookBase,
    upstreamErrorMessage,
} from '@/utils/server/openNotebook';

export const config = {
    api: {
        bodyParser: false,
        responseLimit: false,
    },
};

const readRawBody = (req: NextApiRequest): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer | string) => {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });

// Forwards a multipart source upload straight to Open Notebook's /api/sources
// with the Cognito access token attached server-side. The body passes through
// as-is — no base64 JSON envelope and no Lambda in the path, so uploads are no
// longer capped by the Lambda payload limit.
const notebookUpload = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const accessToken = (session as any).accessToken;
    if (!accessToken) return res.status(401).json({ error: 'No access token' });

    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
        return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    const base = getOpenNotebookBase();
    if (!base) {
        return res.status(500).json({ error: 'OPEN_NOTEBOOK_URL not configured' });
    }

    try {
        const body = await readRawBody(req);

        const upstream = await axios.post(`${base}/api/sources`, body, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
                'Content-Length': String(body.length),
            },
            responseType: 'json',
            validateStatus: () => true,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        if (upstream.status < 200 || upstream.status >= 300) {
            console.error(
                `notebookUpload upstream error: ${upstream.status}`,
                upstream.data,
            );
            return res
                .status(502)
                .json({ error: upstreamErrorMessage(upstream.status, upstream.data) });
        }
        return res.status(200).json(upstream.data);
    } catch (error) {
        console.error('notebookUpload failed:', error);
        return res.status(500).json({ error: 'Upload failed' });
    }
};

export default notebookUpload;

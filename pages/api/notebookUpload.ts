import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

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

// Resolve the upload URL the same way doRequestOp resolves every other notebook
// call: route to the local service emulator when NEXT_PUBLIC_LOCAL_SERVICES lists
// `notebook`, otherwise to the deployed API_BASE_URL. This keeps uploads on the
// identical backend as the rest of the notebook API in every environment, with no
// upload-specific configuration of its own.
const resolveUploadUrl = (): string | null => {
    const localServices = process.env.NEXT_PUBLIC_LOCAL_SERVICES || '';
    for (const cfg of localServices.split(',')) {
        const [service, port, stage] = cfg.trim().split(':');
        if (service === 'notebook') {
            return `http://localhost:${port || '3015'}/${stage || 'dev'}/notebook/upload`;
        }
    }
    const apiBaseUrl = process.env.API_BASE_URL;
    return apiBaseUrl ? `${apiBaseUrl}/notebook/upload` : null;
};

// Multipart uploads can't go through the JSON requestOp pipeline, so this route
// reads the raw body and forwards it to the VPC-attached notebook_upload Lambda,
// which reaches the internal Open Notebook service and posts to /api/sources.
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

    const uploadUrl = resolveUploadUrl();
    if (!uploadUrl) {
        return res.status(500).json({ error: 'API_BASE_URL not configured' });
    }

    try {
        const body = await readRawBody(req);

        // Base64-encode the body so it fits inside the JSON payload the Lambda expects.
        const upstream = await axios.post(
            uploadUrl,
            JSON.stringify({
                data: {
                    body_b64: body.toString('base64'),
                    content_type: contentType,
                },
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'json',
                validateStatus: () => true,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            },
        );
        if (!upstream.data?.success) {
            console.error('notebookUpload upstream error:', upstream.data);
            return res.status(502).json({ error: upstream.data?.message ?? 'Upload failed' });
        }
        return res.status(200).json(upstream.data.data);
    } catch (error) {
        console.error('notebookUpload failed:', error);
        return res.status(500).json({ error: 'Upload failed' });
    }
};

export default notebookUpload;

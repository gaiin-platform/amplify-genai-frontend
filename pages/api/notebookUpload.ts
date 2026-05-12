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

const notebookUpload = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
        return res.status(400).json({ error: 'Expected multipart/form-data' });
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

    try {
        const body = await readRawBody(req);
        const upstream = await fetch(`${apiBase}/api/sources`, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                'X-Auth-Request-User': notebookUserId,
            },
            body,
        });

        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.status(upstream.status);
        const upstreamCt = upstream.headers.get('content-type');
        if (upstreamCt) res.setHeader('Content-Type', upstreamCt);
        return res.send(buffer);
    } catch (error) {
        console.error('Error in notebookUpload:', error);
        return res.status(500).json({ error: 'Upload failed' });
    }
};

export default notebookUpload;

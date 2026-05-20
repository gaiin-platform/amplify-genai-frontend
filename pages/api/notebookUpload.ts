import https from 'https';
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

const NOTEBOOK_BASE_URL =
    'https://open-notebook.apps.amplify-ai-pod.ccc.vanderbilt.edu';

// The dev OpenShift route is signed by Vanderbilt's internal CA, which Node's
// bundled CA store doesn't trust. Browsers work because the machine keychain
// has the CA installed. Setting NOTEBOOK_ALLOW_INSECURE_TLS=true in .env.local
// lets the proxy reach it; leave unset in prod so cert verification stays on.
const httpsAgent =
    process.env.NOTEBOOK_ALLOW_INSECURE_TLS === 'true'
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined;

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
    const accessToken = (session as any).accessToken;
    if (!accessToken) return res.status(401).json({ error: 'No access token' });

    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
        return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    try {
        const body = await readRawBody(req);
        const upstream = await axios.post(
            `${NOTEBOOK_BASE_URL}/api/sources`,
            body,
            {
                headers: {
                    'Content-Type': contentType,
                    Authorization: `Bearer ${accessToken}`,
                },
                httpsAgent,
                responseType: 'arraybuffer',
                validateStatus: () => true,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            },
        );

        const buffer = Buffer.from(upstream.data);
        if (upstream.status < 200 || upstream.status >= 300) {
            console.error(
                `notebookUpload upstream ${upstream.status}: ${buffer.toString('utf8').slice(0, 500)}`,
            );
        }
        const upstreamCt = upstream.headers['content-type'];
        if (upstreamCt) res.setHeader('Content-Type', upstreamCt);
        res.status(upstream.status);
        return res.send(buffer);
    } catch (error) {
        console.error('notebookUpload failed:', error);
        return res.status(500).json({ error: 'Upload failed' });
    }
};

export default notebookUpload;

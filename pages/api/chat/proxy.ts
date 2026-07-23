import { NextApiRequest, NextApiResponse } from "next";
import { getServerAccessToken } from "@/utils/server/accessToken";
import { validateUrlForSSRF } from "@/utils/app/urlValidation";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        },
        responseLimit: false
    }
}

// The chat backend is normally CHAT_ENDPOINT. Assistants may define their own uri,
// which the client passes as an endpoint override — but since this route attaches the
// user's Cognito token, overrides are only honored when they point at the same origin
// as CHAT_ENDPOINT or API_BASE_URL. Anything else would hand the token to an
// arbitrary host.
const resolveTargetEndpoint = (requested: unknown): string | null => {
    const defaultEndpoint = process.env.CHAT_ENDPOINT || '';

    if (!requested || requested === defaultEndpoint) {
        return defaultEndpoint || null;
    }

    if (typeof requested !== 'string') {
        return null;
    }

    const ssrfCheck = validateUrlForSSRF(requested);
    if (!ssrfCheck.valid) {
        return null;
    }

    const allowedOrigins = [defaultEndpoint, process.env.API_BASE_URL || '']
        .filter(Boolean)
        .map((url) => {
            try {
                return new URL(url).origin;
            } catch {
                return null;
            }
        })
        .filter(Boolean);

    try {
        return allowedOrigins.includes(new URL(requested).origin) ? requested : null;
    } catch {
        return null;
    }
};

const chatProxy = async (req: NextApiRequest, res: NextApiResponse) => {

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const accessToken = await getServerAccessToken(req);
    if (!accessToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { endpoint, body } = req.body || {};

    const targetEndpoint = resolveTargetEndpoint(endpoint);
    if (!targetEndpoint) {
        console.warn(`Blocked chat proxy request: endpoint "${endpoint}" failed validation`);
        return res.status(400).json({ error: 'Invalid chat endpoint' });
    }

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    try {
        const upstream = await fetch(targetEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(body ?? {}),
            signal: controller.signal
        });

        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        res.setHeader('Cache-Control', 'no-cache, no-transform');

        if (!upstream.body) {
            return res.end();
        }

        const reader = upstream.body.getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
            // Flush through Next's compression middleware so streamed chunks
            // reach the client immediately instead of being buffered.
            (res as any).flush?.();
        }
        res.end();
    } catch (error) {
        if (controller.signal.aborted) {
            try { res.end(); } catch { }
            return;
        }
        console.error("Error proxying chat request:", error);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Could not reach the chat service' });
        } else {
            res.end();
        }
    }
};

export default chatProxy;

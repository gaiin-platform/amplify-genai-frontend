import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const API_BASE_URL = process.env.API_BASE_URL || '';

const renderHtml = (title: string, heading: string, body: string, color: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
    .box { text-align: center; padding: 2rem; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,.1); max-width: 400px; }
    h1 { color: ${color}; margin-bottom: 0.5rem; }
    p { color: #555; margin-bottom: 1.5rem; }
    button { padding: 0.5rem 1.5rem; background: ${color}; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    button:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${heading}</h1>
    <p>${body}</p>
    <button onclick="window.close()">Close</button>
  </div>
</body>
</html>`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { code, state, error, error_description } = req.query;

    res.setHeader('Content-Type', 'text/html');

    if (error) {
        return res.status(400).send(renderHtml(
            'Authentication Failed',
            '&#x2715; Authentication Failed',
            String(error_description || error),
            '#e74c3c'
        ));
    }

    if (!code || !state) {
        return res.status(400).send(renderHtml(
            'Missing Parameters',
            '&#x2715; Missing Parameters',
            'No authorization code or state received.',
            '#e74c3c'
        ));
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) {
        return res.status(401).send(renderHtml(
            'Not Signed In',
            '&#x2715; Not Signed In',
            'Please sign in to Amplify first, then retry the connection.',
            '#e74c3c'
        ));
    }

    // @ts-ignore
    const accessToken: string = session.accessToken;

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/mcp/server/oauth/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ data: { code: String(code), state: String(state) } }),
        });

        const json = await response.json();

        if (json.success) {
            return res.status(200).send(renderHtml(
                'Connected',
                '&#x2713; Connected',
                'MCP server authenticated successfully. You can close this window.',
                '#2ecc71'
            ));
        }

        return res.status(400).send(renderHtml(
            'Authentication Failed',
            '&#x2715; Authentication Failed',
            json.message || 'Token exchange failed. Please try again.',
            '#e74c3c'
        ));
    } catch (e: any) {
        console.error('MCP OAuth callback error:', e);
        return res.status(500).send(renderHtml(
            'Error',
            '&#x2715; Unexpected Error',
            e?.message || 'An unexpected error occurred.',
            '#e74c3c'
        ));
    }
}

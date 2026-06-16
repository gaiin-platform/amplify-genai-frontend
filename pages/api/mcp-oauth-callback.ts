import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Optional OAuth callback route for providers configured with /api path.
 * Redirects to the unified frontend callback page, which performs exchange.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const params = new URLSearchParams();

    Object.entries(req.query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            if (value[0]) params.set(key, String(value[0]));
            return;
        }

        if (value) {
            params.set(key, String(value));
        }
    });

    const query = params.toString();
    const location = query ? `/mcp-oauth-callback?${query}` : '/mcp-oauth-callback';

    res.redirect(307, location);
}

// Server-side access to the user's Cognito access token.
//
// The token lives only in the encrypted next-auth JWT cookie; it is intentionally
// NOT copied onto the session object, so client JS (and /api/auth/session) never
// sees it. API routes must use this helper instead of getServerSession().accessToken.
import { NextApiRequest } from "next";
import { getToken } from "next-auth/jwt";
import { refreshAccessToken } from "@/pages/api/auth/[...nextauth]";

const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000; // keep in sync with authOptions.session.maxAge

export async function getServerAccessToken(req: NextApiRequest): Promise<string | null> {
    const token: any = await getToken({ req });

    if (!token || !token.accessToken) {
        return null;
    }

    // getToken() decodes the cookie without running the jwt callback, so re-apply
    // the absolute session lifetime the callback normally enforces.
    if (token.sessionIssuedAt && (Date.now() - token.sessionIssuedAt) > SESSION_MAX_AGE_MS) {
        return null;
    }

    if (token.accessTokenExpiresAt && Date.now() > token.accessTokenExpiresAt) {
        // Expired between session polls — refresh for this request. The refreshed
        // token can't be written back to the cookie from here; the jwt callback
        // persists it the next time the client hits /api/auth/session.
        const refreshed: any = await refreshAccessToken(token);
        if (!refreshed || refreshed.error || !refreshed.accessToken) {
            return null;
        }
        return refreshed.accessToken;
    }

    return token.accessToken;
}

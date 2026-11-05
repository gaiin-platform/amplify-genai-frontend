// Server-side access to the user's Cognito access token.
//
// The token lives only in the encrypted next-auth JWT cookie; it is intentionally
// NOT copied onto the session object, so client JS (and /api/auth/session) never
// sees it. API routes must use this helper instead of getServerSession().accessToken.
import { NextApiRequest } from "next";
import { getToken } from "next-auth/jwt";
import { refreshAccessToken } from "@/pages/api/auth/[...nextauth]";

export async function getServerAccessToken(req: NextApiRequest): Promise<string | null> {
    const token: any = await getToken({ req });

    if (!token || !token.accessToken) {
        return null;
    }

    // getToken() decodes the cookie without running the jwt callback, so surface a
    // refresh failure the callback has already recorded.
    if (token.error) {
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

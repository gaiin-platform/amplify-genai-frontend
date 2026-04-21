import NextAuth from "next-auth"
import CognitoProvider from "next-auth/providers/cognito"

console.log('[NextAuth] Initializing with issuer:', process.env.COGNITO_ISSUER);
console.log('[NextAuth] Client ID present:', !!process.env.COGNITO_CLIENT_ID);
console.log('[NextAuth] Client Secret present:', !!process.env.COGNITO_CLIENT_SECRET);
console.log('[NextAuth] NextAuth Secret present:', !!process.env.NEXTAUTH_SECRET);
console.log('[NextAuth] NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

/**
 * Refresh the Cognito access token using the refresh token.
 * Cognito tokens expire after 60 minutes by default.
 */
async function refreshAccessToken(token) {
    try {
        console.log('[NextAuth] Refreshing access token...');

        // Extract domain from issuer (e.g., cognito-idp.us-east-1.amazonaws.com/us-east-1_xxx)
        const cognitoDomain = process.env.COGNITO_DOMAIN;
        const tokenUrl = `${cognitoDomain}/oauth2/token`;

        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.COGNITO_CLIENT_ID,
            client_secret: process.env.COGNITO_CLIENT_SECRET,
            refresh_token: token.refreshToken,
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
            console.error('[NextAuth] Token refresh failed:', refreshedTokens);
            throw refreshedTokens;
        }

        console.log('[NextAuth] Token refresh successful');

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            idToken: refreshedTokens.id_token,
            // Cognito returns expires_in in seconds
            expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
            // Cognito may or may not return a new refresh token
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
            error: undefined,
        };
    } catch (error) {
        console.error('[NextAuth] Error refreshing access token:', error);

        return {
            ...token,
            error: 'RefreshAccessTokenError',
        };
    }
}

export const authOptions = {
    debug: true,
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            issuer: process.env.COGNITO_ISSUER,
        })
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, account, profile }) {
            // Initial sign in - capture tokens from OAuth provider
            if (account) {
                console.log('[NextAuth] JWT callback - initial signin, capturing tokens');
                return {
                    ...token,
                    accessToken: account.access_token,
                    idToken: account.id_token,
                    refreshToken: account.refresh_token,
                    expiresAt: account.expires_at,
                };
            }

            // Return previous token if it hasn't expired yet
            // Add 5-minute buffer to refresh before actual expiry
            const bufferSeconds = 5 * 60;
            if (token.expiresAt && Date.now() < (token.expiresAt * 1000 - bufferSeconds * 1000)) {
                return token;
            }

            // Token has expired (or will expire within 5 min), try to refresh it
            console.log('[NextAuth] Token expired or expiring soon, refreshing...');
            return await refreshAccessToken(token);
        },
        async session({ session, token }) {
            // Pass tokens to the client session
            console.log('[NextAuth] Session callback - token has accessToken:', !!token.accessToken);
            session.accessToken = token.accessToken;
            session.idToken = token.idToken;
            session.error = token.error;

            // If there's a refresh error, the client should handle re-authentication
            if (token.error) {
                console.warn('[NextAuth] Session has error:', token.error);
            }

            return session;
        },
    },
}

export default NextAuth(authOptions)

import NextAuth from "next-auth"
import CognitoProvider from "next-auth/providers/cognito"
import { signIn } from "next-auth/react";
import { decodeJwt } from "jose";

// Consecutive transient refresh failures (network blip, Cognito 5xx/429) tolerated — one per
// session poll, ~60 s apart — before the user is signed out.
const MAX_TRANSIENT_REFRESH_FAILURES = 3;
const REFRESH_ATTEMPTS = 2;
const REFRESH_RETRY_DELAY_MS = 500;

export const authOptions = {
    // Configure one or more authentication providers
    session: {
        // Rolling cookie lifetime (next-auth re-issues the JWT on every session poll). This is NOT
        // the inactivity limit: the client-side SessionActivityTracker signs users out after
        // 1 hour of inactivity. There is deliberately no absolute (login-time based) cap, since
        // that signed active users out a few minutes after they stepped away.
        maxAge: 3 * 60 * 60
    },
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            issuer: process.env.COGNITO_ISSUER,
            checks: 'nonce',
        })
    ],
    pages: {
        signIn: '/',
        // signOut: '/auth/signout',
        // error: '/auth/error', // Error code passed in query string as ?error=
        // verifyRequest: '/auth/verify-request', // (used for check email message)
        // newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out if not of interest)
    },
    callbacks: {
        async signIn({ account, profile }) {
            return true;
        },
        async jwt({ token, profile, account }) {
            const attr = process.env.IMMUTABLE_ID_ATTRIBUTE;
            if (profile && attr && profile[attr]) {
                token.immutableId = profile[attr];
            }
            // Persist the OAuth access_token to the token right after signin
            if (account) {
                token.accessTokenExpiresAt = account.expires_at * 1000;
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.refreshFailures = 0;
                delete token.error;
            } else if (Date.now() > token.accessTokenExpiresAt) {
                // Expired Cognito token — refresh it
                const newToken = await refreshAccessToken(token);
                if (!newToken.error) {
                    token.accessToken = newToken.accessToken;
                    token.accessTokenExpiresAt = newToken.accessTokenExpires;
                    token.refreshToken = newToken.refreshToken;
                    token.refreshFailures = 0;
                    delete token.error;
                } else {
                    // Keep the existing token (and its expiry) so the next session poll retries.
                    // Only surface the error — which signs the user out — if Cognito rejected
                    // the refresh token outright, or transient failures keep repeating.
                    token.refreshFailures = (token.refreshFailures || 0) + 1;
                    if (newToken.permanent || token.refreshFailures >= MAX_TRANSIENT_REFRESH_FAILURES) {
                        token.error = 'RefreshAccessTokenError';
                    }
                }
            }

            // This is so we don't constantly call the upgrade/create endpoint
            if (token.upgradedOrCreated) {
                return token;
            }

            // check if the account needs to be upgraded/created
            try {
                // if (!profile?.[attr]) return token;
                const response = await fetch((process.env.API_BASE_URL || "") + '/user/create', {
                // This is a hard coded value for local testing
                // const response = await fetch('http://localhost:3015/dev/user/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token.accessToken}`
                    },
                    body: JSON.stringify({
                        data: {
                        token: {...token, accessToken: undefined, refreshToken: undefined},
                        profile
                        },
                        immutable_id_field: attr
                    }),
                    signal: null,
                });
            
                if (!response.ok) {
                    // Should we fail here?
                    throw new Error(`Failed to call: ${response.status}`);
                }
                
                token.upgradedOrCreated = true;
                const result = await response.json();

            } catch (error) {
                console.error('Error calling /user/create: ', error);
            }

            return token
        },

        async session({ session, token, user }) {
            // Send properties to the client. The Cognito access token deliberately stays
            // server-side in the JWT cookie — API routes read it via getServerAccessToken()
            // (utils/server/accessToken.ts) instead of exposing it to client JS here.
            session.error = token.error;
            session.upgradedOrCreated = !!token.upgradedOrCreated;
            session.user.username = token.immutableId;
            return session;
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Exchanges the Cognito refresh token for a new access token.
// On failure returns { error, permanent }:
//   permanent: true  -> Cognito rejected the refresh token (revoked/expired/invalid): sign out.
//   permanent: false -> network error, 5xx or 429: worth retrying later without signing out.
export async function refreshAccessToken(token) {
    if (!token || !token.refreshToken) {
        return { error: 'RefreshAccessTokenError', permanent: true };
    }

    const url = `${process.env.COGNITO_DOMAIN}/oauth2/token`;

    for (let attempt = 1; attempt <= REFRESH_ATTEMPTS; attempt++) {
        let transient = true;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${process.env.COGNITO_CLIENT_ID}:${process.env.COGNITO_CLIENT_SECRET}`).toString('base64')}`,
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    'refresh_token': token.refreshToken,
                }),
            });

            // A 4xx other than 408/429 means Cognito rejected the request itself (e.g. invalid_grant).
            transient = !(response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429);

            const refreshedTokens = await response.json();

            if (!response.ok || !refreshedTokens || !refreshedTokens['access_token']) {
                throw refreshedTokens;
            }

            console.log("Got a new access token.");

            return {
                'accessToken': refreshedTokens['access_token'],
                'accessTokenExpires': Date.now() + refreshedTokens.expires_in * 1000,
                'refreshToken': refreshedTokens.refresh_token ? refreshedTokens.refresh_token : token.refreshToken, // Fall back to old refresh token
            };
        } catch (error) {
            console.error(`Failed to refresh access token (attempt ${attempt}/${REFRESH_ATTEMPTS}, ${transient ? 'transient' : 'permanent'}).`, error);
            if (!transient) return { error: 'RefreshAccessTokenError', permanent: true };
            if (attempt < REFRESH_ATTEMPTS) await sleep(REFRESH_RETRY_DELAY_MS);
        }
    }

    return { error: 'RefreshAccessTokenError', permanent: false };
}


export default NextAuth(authOptions)
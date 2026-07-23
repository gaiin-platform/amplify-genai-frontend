import NextAuth from "next-auth"
import CognitoProvider from "next-auth/providers/cognito"
import { signIn } from "next-auth/react";
import { decodeJwt } from "jose";

export const authOptions = {
    // Configure one or more authentication providers
    session: {
        maxAge: 3 * 60 * 60 // 3 hours - client-side inactivity tracker handles 1-hour timeout
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
            const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours - client-side inactivity tracker handles 1-hour timeout
            const attr = process.env.IMMUTABLE_ID_ATTRIBUTE;
            if (profile && attr && profile[attr]) {
                token.immutableId = profile[attr];
            }
            // Persist the OAuth access_token to the token right after signin
            if (account) {
                // New token — stamp absolute session start time
                token.sessionIssuedAt = Date.now();
                token.accessTokenExpiresAt = account.expires_at * 1000;
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
            } else {
                // Enforce absolute session lifetime — reject if older than maxAge regardless of rolling
                if (token.sessionIssuedAt && (Date.now() - token.sessionIssuedAt) > SESSION_MAX_AGE_MS) {
                    return { ...token, error: 'SessionExpiredError' };
                }
                if (Date.now() > token.accessTokenExpiresAt) {
                    // Expired Cognito token — refresh it
                    const newToken = await refreshAccessToken(token);
                    token.accessToken = newToken.accessToken;
                    token.accessTokenExpiresAt = newToken.accessTokenExpires;
                    token.refreshToken = newToken.refreshToken;
                    token.error = newToken.error;
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

export async function refreshAccessToken(token) {
    try {

        if(!token || !token.refreshToken){
            return token;
        }

        const url = `${process.env.COGNITO_DOMAIN}/oauth2/token`

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

        const refreshedTokens = await response.json()

        if (!response.ok || !refreshedTokens || !('access_token' in refreshedTokens)) {
            console.error('Failed to refresh access token.', refreshedTokens);
            throw refreshedTokens
        }

        const newAccessToken = refreshedTokens['access_token'];
        if(!newAccessToken){
            console.error("Failed to get a new access token.");
        }
        else {
            console.log("Got a new access token.");
        }

        let newRToken = refreshedTokens.refresh_token ? refreshedTokens.refresh_token : token.refreshToken;

        return {
            'accessToken': newAccessToken,
            'accessTokenExpires': Date.now() + refreshedTokens.expires_in * 1000,
            'refreshToken': newRToken, // Fall back to old refresh token
        }
    } catch (error) {
        console.error('RefreshAccessTokenError', error)

        return {
            ...token,
            error: 'RefreshAccessTokenError',
        }
    }
}


export default NextAuth(authOptions)
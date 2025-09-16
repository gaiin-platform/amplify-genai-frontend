import NextAuth from "next-auth"
import CognitoProvider from "next-auth/providers/cognito"
import { signIn } from "next-auth/react";
import { decodeJwt } from "jose";

export const authOptions = {
    // Configure one or more authentication providers
    session: {
        maxAge: 59 * 60
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
        // This ensures that any user trying to login has an 'immutable_id' attribute
        // TODO(Karely): we may wish to move this to check the token rather than the profile
        async signIn({ account, profile }) {
            if (profile && profile['custom:immutable_id']) {
                return true;
            } else {
                return false;
            }
        },
        async jwt({ token, profile, account }) {
            // Persist the OAuth access_token to the token right after signin
            if (account) {
                // New token
                token.accessTokenExpiresAt = account.expires_at * 1000;
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
            } else if (Date.now() > token.accessTokenExpiresAt) {
                // Expired token
                const newToken = await refreshAccessToken(token);
                token.accessToken = newToken.accessToken;
                token.accessTokenExpiresAt = newToken.accessTokenExpires;
                token.refreshToken = newToken.refreshToken;
                token.error = newToken.error;
            }

            // This is so we don't constantly call the upgrade/create endpoint
            if (token.upgradedOrCreated) {
                return token;
            }

            // check if the account needs to be upgraded/created
            try {
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
                        token,
                        profile
                        }
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
            // Send properties to the client, like an access_token from a provider.
            session.accessToken = token.accessToken
            session.error = token.error
            session.upgradedOrCreated = !!token.upgradedOrCreated;
            return session
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
}

async function refreshAccessToken(token) {
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
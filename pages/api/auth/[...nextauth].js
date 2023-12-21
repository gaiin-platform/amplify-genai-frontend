import NextAuth from "next-auth"
import CognitoProvider from "next-auth/providers/cognito"

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
        async jwt({ token, account }) {
            // Persist the OAuth access_token to the token right after signin

            if (account) {
                // New token
                token.accessTokenExpiresAt = account.expires_at * 1000;
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
            }
            else if (Date.now() < token.accessTokenExpiresAt) {
                // Valid token
            }
            else {
                // Expired token
                const newToken = await refreshAccessToken(token);
                token.accessToken = newToken.accessToken;
                token.accessTokenExpiresAt = newToken.accessTokenExpires;
                token.refreshToken = newToken.refreshToken;
                token.error = newToken.error;
            }

            return token
        },
        async session({ session, token, user }) {
            // Send properties to the client, like an access_token from a provider.
            session.accessToken = token.accessToken
            session.error = token.error
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
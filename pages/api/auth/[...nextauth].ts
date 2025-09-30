import NextAuth, { AuthOptions, Session } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";
import type { NextApiRequest, NextApiResponse } from 'next';

export const authOptions = (req: NextApiRequest): AuthOptions => ({
    // Configure one or more authentication providers
    session: {
        strategy: "jwt" as const,
        maxAge: 59 * 60
    },
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer: process.env.COGNITO_ISSUER!,
            
            // Manually override the endpoints to use COGNITO_DOMAIN
            token: {
                url: `${process.env.COGNITO_DOMAIN}/oauth2/token`,
            },
            authorization: {
                url: `${process.env.COGNITO_DOMAIN}/oauth2/authorize`,
                params: {
                    scope: 'openid email profile',
                },
            },
            userinfo: {
                url: `${process.env.COGNITO_DOMAIN}/oauth2/userInfo`,
            },
        }),
    ],
    theme: {
        colorScheme: "light",
        brandColor: "#2563eb",
        logo: "/icon-192x192.png",
    },
    pages: {
        signIn: '/auth/signin',
        signOut: '/auth/signout',
        error: '/auth/error',
        verifyRequest: '/auth/verify-request',
        //newUser: '/auth/new-user'
    },
    cookies: {
        sessionToken: {
            name: `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                // domain: '.hfu-amplify.org' // Removed - let NextAuth handle it automatically
            }
        },
        callbackUrl: {
            name: `next-auth.callback-url`,
            options: {
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                // domain: '.hfu-amplify.org' // Removed - let NextAuth handle it automatically
            }
        },
        csrfToken: {
            name: `next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                // domain: '.hfu-amplify.org' // Removed - let NextAuth handle it automatically
            }
        }
    },
    callbacks: {
        async redirect({ url, baseUrl }) {
            console.log('[NextAuth] Redirect callback - url:', url, 'baseUrl:', baseUrl);
            
            // Force domain consistency
            const configuredUrl = process.env.NEXTAUTH_URL || 'https://hfu-amplify.org';
            const configuredUrlObj = new URL(configuredUrl);
            
            // If it's a relative URL, make it absolute with our configured domain
            if (url.startsWith('/')) {
                const redirectUrl = `${configuredUrl}${url}`;
                console.log('[NextAuth] Redirecting to relative URL:', redirectUrl);
                return redirectUrl;
            }
            
            // If it's an absolute URL, ensure it uses our configured domain
            try {
                const urlObj = new URL(url);
                urlObj.protocol = configuredUrlObj.protocol;
                urlObj.host = configuredUrlObj.host;
                urlObj.hostname = configuredUrlObj.hostname;
                urlObj.port = configuredUrlObj.port;
                const redirectUrl = urlObj.toString();
                console.log('[NextAuth] Redirecting to absolute URL:', redirectUrl);
                return redirectUrl;
            } catch {
                // If URL parsing fails, return to base
                console.log('[NextAuth] URL parsing failed, returning base:', configuredUrl);
                return configuredUrl;
            }
        },
        async jwt({ token, account, profile }: any) {
            // Log for debugging
            console.log('[NextAuth] JWT callback triggered');
            console.log('[NextAuth] Account exists:', !!account);
            console.log('[NextAuth] Token before processing:', {
                hasAccessToken: !!token.accessToken,
                accessTokenType: typeof token.accessToken,
                tokenKeys: Object.keys(token)
            });
            
            // Persist the OAuth access_token to the token right after signin
            if (account) {
                console.log('[NextAuth] New login, setting tokens from account');
                console.log('[NextAuth] Account has access_token:', !!account.access_token);
                console.log('[NextAuth] Access token type:', typeof account.access_token);
                console.log('[NextAuth] Access token preview:', account.access_token ? 
                    account.access_token.substring(0, 50) + '...' : 'null');
                
                token.accessTokenExpiresAt = account.expires_at * 1000;
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.id_token = account.id_token;
                
                // Also store user info from profile if available
                if (profile) {
                    token.email = profile.email;
                    token.name = profile.name;
                }
            }
            else if (Date.now() < token.accessTokenExpiresAt) {
                // Valid token
                console.log('[NextAuth] Token still valid');
            }
            else {
                // Expired token
                console.log('[NextAuth] Token expired, refreshing');
                try {
                    const newToken = await refreshAccessToken(token);
                    token.accessToken = newToken.accessToken;
                    token.accessTokenExpiresAt = newToken.accessTokenExpires;
                    token.refreshToken = newToken.refreshToken;
                    token.error = newToken.error;
                } catch (error) {
                    console.error('[NextAuth] Failed to refresh token:', error);
                    token.error = "RefreshAccessTokenError";
                }
            }
            
            console.log('[NextAuth] Token after processing:', {
                hasAccessToken: !!token.accessToken,
                accessTokenType: typeof token.accessToken,
                isValidJWT: token.accessToken && typeof token.accessToken === 'string' ? 
                    token.accessToken.split('.').length === 3 : false
            });

            return token
        },
        async session({ session, token, user }: any) {
            console.log('[NextAuth] Session callback triggered');
            console.log('[NextAuth] Token in session callback:', {
                hasAccessToken: !!token.accessToken,
                accessTokenType: typeof token.accessToken,
                tokenKeys: Object.keys(token)
            });
            
            // Send properties to the client, like an access_token from a provider.
            session.accessToken = token.accessToken
            session.error = token.error
            session.user = {
                ...session.user,
                email: token.email,
                name: token.name
            }
            
            console.log('[NextAuth] Session after processing:', {
                hasAccessToken: !!session.accessToken,
                accessTokenType: typeof session.accessToken,
                isValidJWT: session.accessToken && typeof session.accessToken === 'string' ? 
                    session.accessToken.split('.').length === 3 : false
            });
            
            return session
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV !== 'production',
})

async function refreshAccessToken(token: any) {
    try {
        if(!token || !token.refreshToken){
            console.error('[NextAuth] No refresh token available');
            return token;
        }

        const url = `${process.env.COGNITO_DOMAIN}/oauth2/token`

        console.log('[NextAuth] Refreshing token at:', url);

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
            console.error('[NextAuth] Failed to refresh access token.', refreshedTokens);
            throw refreshedTokens
        }

        const newAccessToken = refreshedTokens['access_token'];
        if(!newAccessToken){
            console.error("[NextAuth] Failed to get a new access token.");
        }
        
        console.log('[NextAuth] Token refreshed successfully');

        return {
            ...token,
            accessToken: newAccessToken,
            accessTokenExpires: Date.now() + refreshedTokens['expires_in'] * 1000,
            refreshToken: refreshedTokens['refresh_token'] ?? token.refreshToken, // Fall back to old refresh token
        }
    } catch (error) {
        console.error('[NextAuth] Error refreshing token:', error)
        return {
            ...token,
            error: "RefreshAccessTokenError",
        }
    }
}

export default function auth(req: NextApiRequest, res: NextApiResponse) {
    console.log('[NextAuth] Auth handler called');
    console.log('[NextAuth] URL:', req.url);
    console.log('[NextAuth] Method:', req.method);
    console.log('[NextAuth] Headers:', {
        host: req.headers.host,
        'x-forwarded-host': req.headers['x-forwarded-host'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
    });
    console.log('[NextAuth] Cookies:', req.cookies);
    
    return NextAuth(req, res, authOptions(req))
}
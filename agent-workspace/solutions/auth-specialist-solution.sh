#!/bin/bash
echo "Frontend Authentication Specialist - Creating auth fixes..."

# Create NextAuth configuration fix
cat > nextauth-config-fix.js << 'EOAUTH'
// pages/api/auth/[...nextauth].js - FIXED VERSION
import NextAuth from "next-auth"
import CognitoProvider from "next-auth/providers/cognito"

// Helper function to determine cookie domain
const getCookieDomain = () => {
  const url = process.env.NEXTAUTH_URL || '';
  if (url.includes('amazonaws.com')) {
    return '.amazonaws.com';
  }
  return undefined; // Let browser handle it for localhost
};

export const authOptions = {
    debug: true, // Enable debug logs
    
    session: {
        strategy: "jwt",
        maxAge: 60 * 60, // 1 hour
        updateAge: 30 * 60, // Update every 30 minutes
    },
    
    cookies: {
        sessionToken: {
            name: `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'none',
                path: '/',
                secure: true,
                domain: getCookieDomain()
            }
        },
        callbackUrl: {
            name: `next-auth.callback-url`,
            options: {
                sameSite: 'none',
                path: '/',
                secure: true,
                domain: getCookieDomain()
            }
        },
        csrfToken: {
            name: `next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'none',
                path: '/',
                secure: true,
                domain: getCookieDomain()
            }
        },
        pkceCodeVerifier: {
            name: `next-auth.pkce.code_verifier`,
            options: {
                httpOnly: true,
                sameSite: 'none',
                path: '/',
                secure: true,
                domain: getCookieDomain()
            }
        },
        state: {
            name: `next-auth.state`,
            options: {
                httpOnly: true,
                sameSite: 'none',
                path: '/',
                secure: true,
                domain: getCookieDomain()
            }
        },
        nonce: {
            name: `next-auth.nonce`,
            options: {
                httpOnly: true,
                sameSite: 'none',
                path: '/',
                secure: true,
                domain: getCookieDomain()
            }
        }
    },
    
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            issuer: process.env.COGNITO_ISSUER,
            checks: ['state'], // Temporarily disable nonce check
            authorization: {
                params: {
                    scope: "openid email profile",
                    response_type: "code",
                }
            },
        })
    ],
    
    callbacks: {
        async jwt({ token, account, user, trigger }) {
            if (account && user) {
                // Initial sign in
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpires = account.expires_at * 1000;
                token.user = user;
            }
            
            // Return previous token if the access token has not expired yet
            if (Date.now() < token.accessTokenExpires) {
                return token;
            }
            
            // Access token has expired, try to update it
            return refreshAccessToken(token);
        },
        
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.error = token.error;
            session.user = token.user || session.user;
            return session;
        }
    },
    
    events: {
        async signIn(message) {
            console.log("SignIn event:", message);
        },
        async signOut(message) {
            console.log("SignOut event:", message);
        },
        async createUser(message) {
            console.log("CreateUser event:", message);
        },
        async updateUser(message) {
            console.log("UpdateUser event:", message);
        },
        async linkAccount(message) {
            console.log("LinkAccount event:", message);
        },
        async session(message) {
            console.log("Session event:", message);
        },
    },
    
    pages: {
        signIn: '/',
        error: '/auth/error',
    }
}

// Token refresh function
async function refreshAccessToken(token) {
    try {
        const url = `${process.env.COGNITO_DOMAIN}/oauth2/token`;
        
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            body: new URLSearchParams({
                client_id: process.env.COGNITO_CLIENT_ID,
                client_secret: process.env.COGNITO_CLIENT_SECRET,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            }),
        });
        
        const refreshedTokens = await response.json();
        
        if (!response.ok) {
            throw refreshedTokens;
        }
        
        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
        };
    } catch (error) {
        console.error("Error refreshing access token", error);
        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}

export default NextAuth(authOptions)
EOAUTH

echo "✓ Authentication fix created"

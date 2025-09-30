#!/bin/bash
set -e

echo "Building v34 with inline JWT fix..."

# Create a temporary copy with the fix inline
cp pages/api/auth/[...nextauth].ts pages/api/auth/[...nextauth].ts.backup

# Add a simple fix to store id_token as accessToken if access_token is missing
cat > pages/api/auth/[...nextauth].ts.temp << 'EOF'
import NextAuth, { AuthOptions, Session } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";
import type { NextApiRequest, NextApiResponse } from 'next';

export const authOptions = (req: NextApiRequest): AuthOptions => ({
    session: {
        strategy: "jwt" as const,
        maxAge: 59 * 60
    },
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer: process.env.COGNITO_ISSUER!,
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
    },
    cookies: {
        sessionToken: {
            name: `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                domain: '.hfu-amplify.org'
            }
        },
        callbackUrl: {
            name: `next-auth.callback-url`,
            options: {
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                domain: '.hfu-amplify.org'
            }
        },
        csrfToken: {
            name: `next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                domain: '.hfu-amplify.org'
            }
        }
    },
    callbacks: {
        async redirect({ url, baseUrl }) {
            const configuredUrl = process.env.NEXTAUTH_URL || 'https://hfu-amplify.org';
            const configuredUrlObj = new URL(configuredUrl);
            if (url.startsWith('/')) {
                return `${configuredUrl}${url}`;
            }
            try {
                const urlObj = new URL(url);
                urlObj.protocol = configuredUrlObj.protocol;
                urlObj.host = configuredUrlObj.host;
                urlObj.hostname = configuredUrlObj.hostname;
                urlObj.port = configuredUrlObj.port;
                return urlObj.toString();
            } catch {
                return configuredUrl;
            }
        },
        async jwt({ token, account, profile }: any) {
            // CRITICAL FIX: Store tokens from Cognito
            if (account) {
                // Cognito returns id_token, not access_token for implicit flow
                token.accessToken = account.id_token || account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600000;
                
                if (profile) {
                    token.email = profile.email;
                    token.name = profile.name;
                }
            }
            return token;
        },
        async session({ session, token }: any) {
            // Pass the token to the session
            session.accessToken = token.accessToken;
            session.error = token.error;
            session.user = {
                ...session.user,
                email: token.email,
                name: token.name
            };
            return session;
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV !== 'production',
})

export default function auth(req: NextApiRequest, res: NextApiResponse) {
    return NextAuth(req, res, authOptions(req));
}
EOF

mv pages/api/auth/[...nextauth].ts.temp pages/api/auth/[...nextauth].ts

# Build
docker build --platform linux/amd64 \
  --no-cache \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  -t amplify-frontend:v34 .

# Restore original file
mv pages/api/auth/[...nextauth].ts.backup pages/api/auth/[...nextauth].ts

echo "✅ Build complete!"
echo ""
echo "Next: Tag, push and deploy v34"
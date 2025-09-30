import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Get the raw cookies
        const cookies = req.cookies;
        const sessionTokenCookie = cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token'];
        
        // Get the JWT token
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        
        // Get the session
        const session = await getServerSession(req, res, authOptions(req));
        
        // Check what getAccessToken would return
        let accessTokenAnalysis = null;
        if (session) {
            const sessionAccessToken = (session as any).accessToken;
            accessTokenAnalysis = {
                exists: !!sessionAccessToken,
                type: typeof sessionAccessToken,
                length: sessionAccessToken ? String(sessionAccessToken).length : 0,
                preview: sessionAccessToken ? String(sessionAccessToken).substring(0, 50) + '...' : null,
                looksLikeJWT: sessionAccessToken && typeof sessionAccessToken === 'string' ? 
                    sessionAccessToken.split('.').length === 3 : false,
                looksLikeHash: sessionAccessToken && typeof sessionAccessToken === 'string' ? 
                    /^[A-Za-z0-9+/]+=*$/.test(sessionAccessToken) : false,
            };
        }
        
        res.status(200).json({
            message: 'Auth Flow Debug',
            cookies: {
                hasSessionToken: !!sessionTokenCookie,
                sessionTokenPreview: sessionTokenCookie ? sessionTokenCookie.substring(0, 50) + '...' : null,
            },
            jwtToken: {
                exists: !!token,
                hasAccessToken: !!token?.accessToken,
                accessTokenType: token ? typeof token.accessToken : null,
                accessTokenPreview: token?.accessToken ? 
                    String(token.accessToken).substring(0, 50) + '...' : null,
                tokenKeys: token ? Object.keys(token) : [],
            },
            session: {
                exists: !!session,
                sessionKeys: session ? Object.keys(session) : [],
                accessTokenAnalysis,
            },
            diagnosis: {
                sessionStrategy: 'jwt', // From config
                expectedFlow: 'Cognito → JWT callback → Session callback → Client',
                possibleIssue: !token?.accessToken ? 
                    'Access token not being stored in JWT' : 
                    !session?.accessToken ? 
                        'Access token not being transferred to session' : 
                        'Access token exists but may not be a valid JWT'
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to debug auth flow',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';
import { authOptions } from '../auth/[...nextauth]';
import { getToken } from 'next-auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Get the session
        const session = await getServerSession(req, res, authOptions(req));
        
        // Get the JWT token
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        
        // Debug information
        const debugInfo = {
            sessionExists: !!session,
            sessionAccessToken: session ? (session as any).accessToken : null,
            sessionAccessTokenType: session ? typeof (session as any).accessToken : null,
            sessionAccessTokenParts: session && (session as any).accessToken ? 
                (session as any).accessToken.split('.').length : 0,
            
            jwtTokenExists: !!token,
            jwtAccessToken: token?.accessToken || null,
            jwtAccessTokenType: token ? typeof token.accessToken : null,
            jwtAccessTokenParts: token && token.accessToken && typeof token.accessToken === 'string' ? 
                token.accessToken.split('.').length : 0,
            
            // Check if it's a hash
            sessionTokenLooksLikeHash: session && (session as any).accessToken ? 
                /^[A-Za-z0-9+/]+=*$/.test((session as any).accessToken) : false,
            
            // Raw session data (redacted)
            sessionKeys: session ? Object.keys(session) : [],
            tokenKeys: token ? Object.keys(token) : [],
        };
        
        res.status(200).json({
            message: 'Session JWT Debug Info',
            debug: debugInfo
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get session debug info',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
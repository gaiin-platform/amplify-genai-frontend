import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get both token and session to compare
    const token = await getToken({ req });
    const session = await getServerSession(req, res, authOptions(req));
    
    const debugInfo = {
      tokenInfo: {
        exists: !!token,
        hasAccessToken: !!(token as any)?.accessToken,
        accessTokenType: typeof (token as any)?.accessToken,
        accessTokenLength: (token as any)?.accessToken?.length || 0,
        tokenPreview: (token as any)?.accessToken?.substring(0, 50) + '...',
        isJWT: (token as any)?.accessToken?.split('.')?.length === 3,
        tokenKeys: token ? Object.keys(token) : [],
      },
      sessionInfo: {
        exists: !!session,
        hasAccessToken: !!(session as any)?.accessToken,
        accessTokenType: typeof (session as any)?.accessToken,
        accessTokenLength: (session as any)?.accessToken?.length || 0,
        sessionPreview: (session as any)?.accessToken?.substring(0, 50) + '...',
        isJWT: (session as any)?.accessToken?.split('.')?.length === 3,
      },
      raw: {
        // Log the raw token to see what we're getting
        tokenAccessToken: (token as any)?.accessToken,
        sessionAccessToken: (session as any)?.accessToken,
      }
    };

    res.status(200).json(debugInfo);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to debug tokens', 
      message: error.message,
      stack: error.stack 
    });
  }
}
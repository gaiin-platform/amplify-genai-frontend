import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get server session
    const serverSession = await getServerSession(req, res, authOptions(req));
    
    // Also try client session for comparison
    const clientSession = await getSession({ req });
    
    const debugInfo = {
      serverSession: {
        exists: !!serverSession,
        hasAccessToken: !!(serverSession as any)?.accessToken,
        accessTokenPreview: (serverSession as any)?.accessToken?.substring(0, 50) + '...',
        user: serverSession?.user?.email,
      },
      clientSession: {
        exists: !!clientSession,
        hasAccessToken: !!(clientSession as any)?.accessToken,
        accessTokenPreview: (clientSession as any)?.accessToken?.substring(0, 50) + '...',
      },
      cookies: {
        hasSessionToken: !!req.cookies['next-auth.session-token'],
        hasSecureSessionToken: !!req.cookies['__Secure-next-auth.session-token'],
      },
      headers: {
        authorization: req.headers.authorization,
        cookie: req.headers.cookie?.substring(0, 100) + '...',
      }
    };

    res.status(200).json(debugInfo);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get session info', 
      message: error.message,
      stack: error.stack 
    });
  }
}
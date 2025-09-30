import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Try all methods
    const clientSession = await getSession({ req });
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    // Try getServerSession without authOptions for now
    let serverSession = null;
    try {
      const { authOptions } = await import('./[...nextauth]');
      serverSession = await getServerSession(req, res, authOptions(req));
    } catch (e) {
      console.error('getServerSession failed:', e);
    }
    
    return res.status(200).json({
      clientSession: {
        exists: !!clientSession,
        hasAccessToken: !!(clientSession as any)?.accessToken,
        expires: clientSession?.expires
      },
      serverSession: {
        exists: !!serverSession,
        hasAccessToken: !!(serverSession as any)?.accessToken
      },
      token: {
        exists: !!token,
        hasAccessToken: !!token?.accessToken,
        keys: token ? Object.keys(token) : []
      },
      env: {
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
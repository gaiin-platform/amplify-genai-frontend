import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions(req));
    
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check what's in the session
    const debugInfo = {
      hasSession: !!session,
      hasAccessToken: !!(session as any).accessToken,
      accessTokenType: typeof (session as any).accessToken,
      accessTokenLength: (session as any).accessToken?.length || 0,
      // Check if it looks like a JWT (should have 3 parts separated by dots)
      looksLikeJWT: (session as any).accessToken?.split('.')?.length === 3,
      // First few characters (safe to log)
      tokenPreview: (session as any).accessToken?.substring(0, 20) + '...',
    };

    res.status(200).json(debugInfo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session', details: error });
  }
}
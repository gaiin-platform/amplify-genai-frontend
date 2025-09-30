import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get the session which contains the access token
    const session = await getServerSession(req, res, authOptions(req));
    
    if (!session) {
      return res.status(401).json({ error: 'No session found' });
    }
    
    // Return the access token from the session
    if (session.accessToken) {
      return res.status(200).json({ 
        accessToken: session.accessToken,
        expiresAt: session.expires
      });
    }
    
    return res.status(404).json({ error: 'No access token in session' });
  } catch (error) {
    console.error('[/api/auth/jwt] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve JWT',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add version info to confirm deployment
  const version = "v41-fixed";
  
  try {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ 
        error: 'No session found',
        version 
      });
    }
    
    // The session contains accessToken, so return it
    if ((session as any).accessToken) {
      return res.status(200).json({ 
        accessToken: (session as any).accessToken,
        expiresAt: session.expires,
        version
      });
    }
    
    return res.status(404).json({ 
      error: 'No access token in session',
      sessionKeys: Object.keys(session),
      version
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to retrieve JWT',
      details: error instanceof Error ? error.message : String(error),
      version
    });
  }
}
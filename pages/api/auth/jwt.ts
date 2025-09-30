import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const API_VERSION = 'v43-simple';
  
  try {
    // Use getToken with the secret
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET 
    });
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No session found',
        version: API_VERSION
      });
    }
    
    // Check for accessToken in the JWT token
    const accessToken = token.accessToken || token.access_token;
    
    if (accessToken) {
      return res.status(200).json({ 
        accessToken: accessToken as string,
        expiresAt: token.exp ? new Date(Number(token.exp) * 1000).toISOString() : null,
        version: API_VERSION
      });
    }
    
    // No access token found
    return res.status(404).json({ 
      error: 'No access token in session',
      tokenKeys: Object.keys(token),
      version: API_VERSION
    });
  } catch (error) {
    console.error('[/api/auth/jwt] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve JWT',
      details: error instanceof Error ? error.message : String(error),
      version: API_VERSION
    });
  }
}
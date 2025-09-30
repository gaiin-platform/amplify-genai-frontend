import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Get the access token from the session
 * This is a helper to ensure we always get the JWT access token, not the session token
 */
export async function getAccessToken(req?: NextApiRequest, res?: NextApiResponse): Promise<string | null> {
  try {
    let session;
    
    if (req && res) {
      // Server-side: use getServerSession
      session = await getServerSession(req, res, authOptions(req));
    } else {
      // Client-side: use getSession
      session = await getSession();
    }

    if (!session) {
      console.log('[getAccessToken] No session found');
      return null;
    }

    // The access token should be in session.accessToken
    const accessToken = (session as any).accessToken;
    
    console.log('[getAccessToken] Session data:', {
      hasSession: !!session,
      sessionKeys: Object.keys(session),
      hasAccessToken: !!accessToken,
      accessTokenType: typeof accessToken,
      accessTokenPreview: accessToken ? 
        (typeof accessToken === 'string' ? accessToken.substring(0, 50) + '...' : 'not a string') : 
        'null'
    });
    
    if (!accessToken) {
      console.log('[getAccessToken] No access token in session');
      return null;
    }

    // Validate it looks like a JWT (should have 3 parts separated by dots)
    if (typeof accessToken === 'string' && accessToken.split('.').length === 3) {
      console.log('[getAccessToken] Valid JWT token found');
      return accessToken;
    }

    console.error('[getAccessToken] Invalid access token format:', {
      type: typeof accessToken,
      parts: accessToken?.split ? accessToken.split('.').length : 'not splittable',
      value: accessToken
    });
    return null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}
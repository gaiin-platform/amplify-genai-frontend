import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { NextApiRequest, NextApiResponse } from 'next';
import { getJWTToken } from './getJWTToken';

/**
 * Gets the Cognito JWT access token from the NextAuth session
 * This function ensures we get the actual JWT token, not the session hash
 */
export async function getAuthToken(
  req: NextApiRequest, 
  res?: NextApiResponse
): Promise<string | null> {
  try {
    // Use the new getJWTToken function that has better logging
    const jwtAccessToken = await getJWTToken(req);
    if (jwtAccessToken) {
      console.log('[getAuthToken] Successfully retrieved JWT access token');
      return jwtAccessToken;
    }

    // If token approach failed, try session approach
    if (res) {
      const session = await getServerSession(req, res, authOptions(req));
      if (session?.accessToken && typeof session.accessToken === 'string') {
        const parts = session.accessToken.split('.');
        if (parts.length === 3) {
          console.log('Auth token retrieved from session (JWT format confirmed)');
          return session.accessToken as string;
        }
      }
    }

    console.error('No valid JWT access token found in token or session');
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}
import { getToken } from 'next-auth/jwt';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Get the JWT access token directly from the NextAuth JWT token
 * This bypasses the session and gets the token directly from the encrypted JWT
 */
export async function getJWTToken(req: NextApiRequest): Promise<string | null> {
  try {
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET,
      raw: false // We want the decoded token, not the raw JWT
    });
    
    if (!token) {
      console.log('[getJWTToken] No JWT token found');
      return null;
    }
    
    console.log('[getJWTToken] JWT token found:', {
      hasAccessToken: !!token.accessToken,
      accessTokenType: typeof token.accessToken,
      tokenKeys: Object.keys(token),
      accessTokenPreview: token.accessToken ? 
        String(token.accessToken).substring(0, 30) + '...' : 'null'
    });
    
    // The access token should be in token.accessToken
    const accessToken = token.accessToken as string | undefined;
    
    if (!accessToken) {
      console.log('[getJWTToken] No access token in JWT');
      return null;
    }
    
    // Validate it looks like a JWT (should have 3 parts separated by dots)
    if (typeof accessToken === 'string' && accessToken.split('.').length === 3) {
      console.log('[getJWTToken] Valid JWT access token found');
      return accessToken;
    }
    
    console.error('[getJWTToken] Invalid access token format:', {
      type: typeof accessToken,
      parts: accessToken?.split ? accessToken.split('.').length : 'not splittable',
      value: accessToken
    });
    return null;
  } catch (error) {
    console.error('[getJWTToken] Error getting JWT token:', error);
    return null;
  }
}
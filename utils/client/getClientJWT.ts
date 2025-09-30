import { getSession } from 'next-auth/react';

/**
 * Client-side function to get the JWT access token
 * This gets the token directly from the session if the JWT endpoint fails
 */
export async function getClientJWT(): Promise<string | null> {
  try {
    // First try the JWT endpoint
    const response = await fetch('/api/auth/jwt', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.accessToken && typeof data.accessToken === 'string') {
        console.log('[getClientJWT] Valid JWT retrieved from endpoint');
        return data.accessToken;
      }
    }
    
    // Fallback: get token directly from session
    console.log('[getClientJWT] JWT endpoint failed, trying session directly');
    const session = await getSession();
    
    if (session && (session as any).accessToken) {
      const accessToken = (session as any).accessToken;
      // Validate it's a JWT
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        console.log('[getClientJWT] Valid JWT retrieved from session');
        return accessToken;
      }
    }
    
    console.error('[getClientJWT] No valid JWT found');
    return null;
  } catch (error) {
    console.error('[getClientJWT] Error fetching JWT:', error);
    return null;
  }
}
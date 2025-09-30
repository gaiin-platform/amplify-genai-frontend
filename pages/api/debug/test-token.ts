import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getAuthToken } from '@/utils/auth/getAuthToken';
import { getJWTToken } from '@/utils/auth/getJWTToken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('=== Token Debug API Called ===');
  
  try {
    // Test 1: Get session
    const session = await getServerSession(req, res, authOptions(req));
    console.log('Session exists:', !!session);
    console.log('Session has accessToken:', !!session?.accessToken);
    
    // Test 2: Get JWT token directly
    const jwtToken = await getJWTToken(req);
    console.log('JWT token retrieved:', !!jwtToken);
    console.log('JWT token format valid:', jwtToken ? jwtToken.split('.').length === 3 : false);
    
    // Test 3: Get auth token using the utility
    const authToken = await getAuthToken(req, res);
    console.log('Auth token retrieved:', !!authToken);
    
    // Test 4: Decode JWT payload (without verification, just for debugging)
    if (authToken) {
      try {
        const [header, payload] = authToken.split('.');
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
        console.log('JWT payload:', {
          sub: decodedPayload.sub,
          exp: decodedPayload.exp,
          expDate: new Date(decodedPayload.exp * 1000).toISOString(),
          isExpired: decodedPayload.exp * 1000 < Date.now()
        });
      } catch (e) {
        console.error('Failed to decode JWT:', e);
      }
    }
    
    res.status(200).json({
      sessionExists: !!session,
      sessionHasAccessToken: !!session?.accessToken,
      jwtTokenRetrieved: !!jwtToken,
      authTokenRetrieved: !!authToken,
      tokenIsValid: authToken ? authToken.split('.').length === 3 : false,
      tokenPreview: authToken ? authToken.substring(0, 50) + '...' : null
    });
  } catch (error) {
    console.error('Token debug error:', error);
    res.status(500).json({ error: 'Failed to debug token' });
  }
}
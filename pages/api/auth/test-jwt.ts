import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession({ req });
    
    if (!session || !session.accessToken) {
      return res.status(401).json({ 
        error: 'No session or access token',
        hasSession: !!session,
        sessionData: session ? Object.keys(session) : null
      });
    }

    // Test the JWT by calling the backend
    const testEndpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL}/state/settings/get`;
    
    console.log('[JWT Test] Calling backend with token');
    console.log('[JWT Test] Token preview:', (session.accessToken as string).substring(0, 50) + '...');
    console.log('[JWT Test] Endpoint:', testEndpoint);
    
    const response = await fetch(testEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawText: responseText };
    }

    return res.status(200).json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      tokenInfo: {
        type: typeof session.accessToken,
        length: (session.accessToken as string).length,
        preview: (session.accessToken as string).substring(0, 50) + '...',
        isJWT: (session.accessToken as string).split('.').length === 3
      }
    });

  } catch (error: any) {
    console.error('[JWT Test] Error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}
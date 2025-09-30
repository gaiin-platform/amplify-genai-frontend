import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession({ req });
    
    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'No session or access token' });
    }

    // Test multiple endpoints
    const endpoints = [
      {
        name: 'available_models',
        url: 'https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/available_models',
        method: 'GET'
      },
      {
        name: 'settings_get',
        url: 'https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/state/settings/get',
        method: 'GET'
      }
    ];

    const results: any = {};

    for (const endpoint of endpoints) {
      console.log(`[Backend Auth Test] Testing ${endpoint.name}`);
      
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
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

        results[endpoint.name] = {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          authHeader: response.headers.get('x-amzn-errortype')
        };
      } catch (error: any) {
        results[endpoint.name] = {
          error: error.message
        };
      }
    }

    return res.status(200).json({
      testedAt: new Date().toISOString(),
      tokenPreview: (session.accessToken as string).substring(0, 50) + '...',
      results
    });

  } catch (error: any) {
    console.error('[Backend Auth Test] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
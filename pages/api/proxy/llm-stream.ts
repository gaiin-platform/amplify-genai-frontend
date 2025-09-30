import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[LLM Proxy] Request received');
  
  const session = await getServerSession(req, res, authOptions(req) as any);
  
  if (!session) {
    console.log('[LLM Proxy] No session - unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const llmRouterEndpoint = process.env.NEXT_PUBLIC_LLM_ROUTER_ENDPOINT || 'https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm';
  console.log('[LLM Proxy] Using endpoint:', llmRouterEndpoint);
  
  try {
    // Forward request to LLM router
    const response = await fetch(llmRouterEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`LLM router returned ${response.status}`);
    }

    const data = await response.json();
    console.log('[LLM Proxy] Response received:', JSON.stringify(data).substring(0, 200));

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Convert JSON response to SSE stream
    if (data.success && data.response) {
      console.log('[LLM Proxy] Converting to SSE stream');
      // Split response into words for streaming effect
      const words = data.response.split(' ');
      
      for (const word of words) {
        const escapedWord = word.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        res.write(`data: {"choices":[{"delta":{"content":"${escapedWord} "}}]}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 30)); // Small delay for streaming effect
      }
      
      // Send completion signal
      res.write(`data: [DONE]\n\n`);
    } else if (data.error) {
      // Handle error response
      res.write(`data: {"choices":[{"delta":{"content":"Error: ${data.error}"}}]}\n\n`);
      res.write(`data: [DONE]\n\n`);
    } else {
      // Fallback for unexpected response format
      res.write(`data: {"choices":[{"delta":{"content":"${JSON.stringify(data)}"}}]}\n\n`);
      res.write(`data: [DONE]\n\n`);
    }

  } catch (error) {
    console.error('Proxy error:', error);
    res.write(`data: {"error": "Failed to proxy request to LLM router"}\n\n`);
  } finally {
    res.end();
  }
}
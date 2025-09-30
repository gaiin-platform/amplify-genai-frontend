import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthToken } from '@/utils/auth/getAuthToken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = await getAuthToken(req, res);
    if (!accessToken) {
      return res.status(401).json({ error: 'Unauthorized - no valid access token' });
    }

    const { messages, model, provider } = req.body;

    // Use LLM Router endpoint
    const llmRouterEndpoint = process.env.NEXT_PUBLIC_LLM_ROUTER_ENDPOINT || 
      'https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm';
    
    const requestBody = {
      messages,
      model,
      provider,
      temperature: req.body.temperature,
      max_tokens: req.body.max_tokens || 1000,
      stream: true,
      dataSources: req.body.dataSources || [],
      prompt: req.body.prompt,
      options: req.body.options
    };
    
    const response = await fetch(llmRouterEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', response.status, error);
      return res.status(response.status).json({ error: error || 'Backend request failed' });
    }

    // For streaming responses
    if (req.body.stream !== false && response.body) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.write('data: [DONE]\n\n');
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              // Forward SSE lines as-is
              if (line.startsWith('data: ')) {
                res.write(line + '\n\n');
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      // Non-streaming response
      const data = await response.json();
      res.json(data);
    }
  } catch (error: any) {
    console.error('Handler error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
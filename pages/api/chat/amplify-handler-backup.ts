import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthToken } from '@/utils/auth/getAuthToken';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = await getAuthToken(req, res);
    if (!accessToken) {
      return res.status(401).json({ error: 'Unauthorized - no valid access token' });
    }

    // Extract all fields from request body
    const { 
      messages, 
      model, 
      provider,
      temperature,
      max_tokens,
      stream = true,
      dataSources,
      prompt,
      options,
      ...otherFields
    } = req.body;

    // Use LLM Router endpoint for all models
    const llmRouterEndpoint = process.env.NEXT_PUBLIC_LLM_ROUTER_ENDPOINT || 'https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm';
    
    // Prepare request body with all fields
    const requestBody = {
      messages,
      model,
      provider,
      temperature,
      max_tokens,
      stream,
      dataSources: dataSources || [],
      prompt,
      options,
      ...otherFields
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
      console.error('LLM Router backend error:', {
        status: response.status,
        error,
        endpoint: llmRouterEndpoint,
        model: model,
        provider: provider
      });
      return res.status(response.status).json({ 
        error: `LLM Router error: ${error}`,
        details: {
          status: response.status,
          model,
          provider
        }
      });
    }

    if (stream && response.body) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const reader = response.body;
      reader.on('data', (chunk: Buffer) => {
        try {
          const text = chunk.toString();
          const lines = text.split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              // Parse Amplify format and convert to OpenAI format
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                try {
                  if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                  } else {
                    // Extract content and send in OpenAI format
                    const parsed = JSON.parse(data);
                    const content = parsed.content || parsed.chunk || parsed.message || '';
                    if (content) {
                      // Escape quotes in content
                      const escapedContent = content.replace(/"/g, '\\"');
                      res.write(`data: {"choices":[{"delta":{"content":"${escapedContent}"}}]}\n\n`);
                    }
                  }
                } catch (e) {
                  // If not JSON, treat as plain text and escape quotes
                  const escapedData = data.replace(/"/g, '\\"');
                  res.write(`data: {"choices":[{"delta":{"content":"${escapedData}"}}]}\n\n`);
                }
              } else {
                // If line doesn't start with 'data: ', forward as is
                res.write(line + '\n');
              }
            }
          }
        } catch (error) {
          console.error('Error processing stream chunk:', error);
        }
      });

      reader.on('end', () => res.end());
      reader.on('error', (err: Error) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

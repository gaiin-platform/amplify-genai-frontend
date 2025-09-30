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

    // Use LLM Router endpoint - check environment variable first, then use correct default
    const llmRouterEndpoint = process.env.NEXT_PUBLIC_LLM_ROUTER_ENDPOINT || 
      process.env.LLM_ROUTER_ENDPOINT ||
      'https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm';
    
    console.log('[amplify-handler] Using LLM Router endpoint:', llmRouterEndpoint);
    
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
      console.error('[amplify-handler] Backend error:', response.status, error);
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
              // Forward SSE lines with proper JSON escaping
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                try {
                  if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                  } else {
                    // Parse the data to extract content
                    const parsed = JSON.parse(data);
                    const content = parsed.content || parsed.chunk || parsed.message || '';
                    if (content) {
                      // Use JSON.stringify to properly escape the content
                      const escapedContent = JSON.stringify(content);
                      // Remove the outer quotes that JSON.stringify adds
                      const contentValue = escapedContent.slice(1, -1);
                      res.write(`data: {"choices":[{"delta":{"content":"${contentValue}"}}]}\n\n`);
                    }
                  }
                } catch (e) {
                  // If not JSON, treat as plain text and properly escape
                  const escapedData = JSON.stringify(data);
                  const contentValue = escapedData.slice(1, -1);
                  res.write(`data: {"choices":[{"delta":{"content":"${contentValue}"}}]}\n\n`);
                }
              } else {
                // If line doesn't start with 'data: ', forward as is
                res.write(line + '\n');
              }
            }
          }
        }
      } catch (error) {
        console.error('[amplify-handler] Streaming error:', error);
        res.write(`data: {"error":"${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`);
      } finally {
        res.end();
      }
    } else {
      // Non-streaming response
      const data = await response.json();
      res.status(200).json(data);
    }
  } catch (error) {
    console.error('[amplify-handler] Request error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}

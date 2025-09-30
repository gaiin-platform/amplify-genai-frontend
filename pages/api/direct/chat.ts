import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions(req) as any);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract chat details from request
  const { messages, model, temperature, max_tokens, provider } = req.body;

  console.log('Direct chat endpoint - Model:', model, 'Provider:', provider);

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Determine which provider to use
  const modelProvider = provider?.toLowerCase() || 'openai';

  try {
    if (modelProvider === 'openai') {
      await handleOpenAIChat(messages, model, temperature, max_tokens, res);
    } else if (modelProvider === 'gemini') {
      await handleGeminiChat(messages, model, temperature, max_tokens, res);
    } else {
      // Mock response for unsupported providers
      await handleMockChat(messages, model, res);
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: {"error": "Chat request failed"}\n\n`);
  } finally {
    res.end();
  }
}

async function handleOpenAIChat(messages: any[], model: string, temperature: number, maxTokens: number, res: NextApiResponse) {
  // Mock OpenAI response for now
  const mockResponse = `I'm currently running in mock mode. You selected the ${model} model. Your message was: "${messages[messages.length - 1]?.content || 'No message'}". 

To fully enable OpenAI, you'll need to:
1. Set up your OpenAI API key in the backend
2. Configure the LLM router service
3. Ensure proper API Gateway routing

For now, the models are available for selection, but actual LLM responses require backend configuration.`;

  // Stream the response
  const words = mockResponse.split(' ');
  for (const word of words) {
    res.write(`data: {"choices":[{"delta":{"content":"${word} "}}]}\n\n`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming
  }
  res.write(`data: [DONE]\n\n`);
}

async function handleGeminiChat(messages: any[], model: string, temperature: number, maxTokens: number, res: NextApiResponse) {
  // Mock Gemini response
  const mockResponse = `This is a mock Gemini ${model} response. Your query: "${messages[messages.length - 1]?.content || 'No message'}". 

Gemini integration requires:
1. Google Cloud API credentials
2. Vertex AI or Gemini API setup
3. Backend service configuration

The frontend is ready to handle Gemini responses once the backend is configured.`;

  // Stream the response
  const words = mockResponse.split(' ');
  for (const word of words) {
    res.write(`data: {"choices":[{"delta":{"content":"${word} "}}]}\n\n`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  res.write(`data: [DONE]\n\n`);
}

async function handleMockChat(messages: any[], model: string, res: NextApiResponse) {
  const mockResponse = `This is a mock response for the ${model} model. The backend LLM services are not yet configured. Your message was received: "${messages[messages.length - 1]?.content || 'No message'}"`;

  const words = mockResponse.split(' ');
  for (const word of words) {
    res.write(`data: {"choices":[{"delta":{"content":"${word} "}}]}\n\n`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  res.write(`data: [DONE]\n\n`);
}
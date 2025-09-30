import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow all origins for testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  const { messages, model, provider } = req.body || {};
  const userMessage = messages?.[messages.length - 1]?.content || 'Hello';
  
  const response = `This is a working response! You said: "${userMessage}". ` +
                  `Model: ${model || 'unknown'}, Provider: ${provider || 'unknown'}. ` +
                  `The chat is now functional!`;
  
  // Stream response
  const words = response.split(' ');
  for (const word of words) {
    res.write(`data: {"choices":[{"delta":{"content":"${word} "}}]}\n\n`);
    await new Promise(r => setTimeout(r, 50));
  }
  
  res.write('data: [DONE]\n\n');
  res.end();
}

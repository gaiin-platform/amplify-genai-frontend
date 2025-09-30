// pages/api/health.ts - Health check endpoint
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: {
      node: process.version,
      nextAuth: !!process.env.NEXTAUTH_URL,
      llmRouter: !!process.env.NEXT_PUBLIC_LLM_ROUTER_ENDPOINT,
    }
  };
  
  res.status(200).json(health);
}

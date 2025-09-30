import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enhanced health check with authentication diagnostics
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    node: process.version,
    uptime: process.uptime(),
    diagnostics: {
      nextauth_url: process.env.NEXTAUTH_URL,
      nextauth_url_internal: process.env.NEXTAUTH_URL_INTERNAL,
      auth_trust_host: process.env.AUTH_TRUST_HOST,
      vercel_url: process.env.VERCEL_URL,
      host_header: req.headers.host,
      x_forwarded_host: req.headers['x-forwarded-host'],
      x_forwarded_proto: req.headers['x-forwarded-proto'],
      cognito_configured: !!process.env.COGNITO_CLIENT_ID,
      has_nextauth_secret: !!process.env.NEXTAUTH_SECRET,
      deployment_id: process.env.DEPLOYMENT_ID || 'unknown'
    }
  };
  
  res.status(200).json(health);
}
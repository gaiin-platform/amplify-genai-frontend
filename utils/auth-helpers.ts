import { NextApiRequest } from 'next';

/**
 * Helper function to construct the correct URL for NextAuth when behind an ALB
 * ALB forwards headers that we need to use to construct the correct URL
 */
export function getAuthUrl(req: NextApiRequest): string {
  // Check for X-Forwarded headers from ALB
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'hfu-amplify.org';
  
  // Construct the URL
  const url = `${proto}://${host}`;
  
  // Log for debugging
  console.log('Auth URL Construction:', {
    proto,
    host,
    constructedUrl: url,
    headers: {
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'host': req.headers.host
    }
  });
  
  return url;
}

/**
 * Middleware to ensure NextAuth gets the correct URL when behind ALB
 */
export function withALBHeaders(handler: any) {
  return async (req: NextApiRequest, res: any) => {
    // Set the NEXTAUTH_URL dynamically based on forwarded headers
    if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes('localhost')) {
      const authUrl = getAuthUrl(req);
      process.env.NEXTAUTH_URL = authUrl;
    }
    
    return handler(req, res);
  };
}
// Test endpoint to verify environment variables
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Authentication check - only authenticated users can view environment config
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only return NEXT_PUBLIC_* environment variables (these are safe to expose to client)
  res.status(200).json({
    NEXT_PUBLIC_CUSTOM_LOGO: process.env.NEXT_PUBLIC_CUSTOM_LOGO || 'not set',
    NEXT_PUBLIC_DEFAULT_THEME: process.env.NEXT_PUBLIC_DEFAULT_THEME || 'not set',
    NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME || 'not set',
  });
}

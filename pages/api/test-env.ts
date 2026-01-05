// Test endpoint to verify environment variables
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    NEXT_PUBLIC_CUSTOM_LOGO: process.env.NEXT_PUBLIC_CUSTOM_LOGO || 'not set',
    NEXT_PUBLIC_DEFAULT_THEME: process.env.NEXT_PUBLIC_DEFAULT_THEME || 'not set',
    NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME || 'not set',
  });
}

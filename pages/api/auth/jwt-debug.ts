import { getToken } from "next-auth/jwt";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[JWT-DEBUG] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('[JWT-DEBUG] Cookies:', req.cookies);
  
  try {
    const token = await getToken({ req });
    console.log('[JWT-DEBUG] Token retrieved:', !!token);
    
    if (token) {
      res.status(200).json({ 
        accessToken: token.accessToken,
        sub: token.sub,
        email: token.email,
        provider: token.provider
      });
    } else {
      console.log('[JWT-DEBUG] No token found');
      res.status(401).json({ error: "No valid session" });
    }
  } catch (error) {
    console.error('[JWT-DEBUG] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Internal error", details: errorMessage });
  }
}

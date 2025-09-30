import { getToken } from "next-auth/jwt";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  console.log("[DEBUG SESSION] Request headers:", {
    host: req.headers.host,
    cookie: req.headers.cookie,
    authorization: req.headers.authorization,
  });
  
  // Try to get JWT token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  console.log("[DEBUG SESSION] getToken result:", token ? {
    hasToken: true,
    tokenKeys: Object.keys(token),
    hasAccessToken: !!token.accessToken,
    accessTokenType: typeof token.accessToken,
    email: token.email,
  } : "No token found");
  
  // Also try to get session
  const session = await getSession({ req });
  console.log("[DEBUG SESSION] getSession result:", session ? {
    hasSession: true,
    sessionKeys: Object.keys(session),
    hasAccessToken: !!session.accessToken,
    user: session.user,
  } : "No session found");
  
  if (token) {
    console.log("[DEBUG SESSION] Token successfully retrieved");
    res.status(200).json({ 
      message: "Session is valid.", 
      token: {
        email: token.email,
        hasAccessToken: !!token.accessToken,
        accessTokenType: typeof token.accessToken,
        tokenKeys: Object.keys(token)
      },
      session: session ? {
        hasAccessToken: !!session.accessToken,
        user: session.user
      } : null
    });
  } else {
    console.log("[DEBUG SESSION] No session token found!");
    res.status(401).json({ message: "Not authenticated" });
  }
}
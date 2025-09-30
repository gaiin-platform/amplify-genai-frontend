import type { NextApiRequest, NextApiResponse } from "next";
import fs from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[GROUND-TRUTH] ===== OPERATION GROUND TRUTH DIAGNOSTICS =====');
  
  // 1. Environment Variables
  console.log('[GROUND-TRUTH] Environment Variables:');
  const envVars = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET (length: ' + process.env.NEXTAUTH_SECRET.length + ')' : 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_URL_INTERNAL: process.env.NEXTAUTH_URL_INTERNAL,
    NODE_ENV: process.env.NODE_ENV,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID ? 'SET' : 'NOT SET',
    COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET ? 'SET (length: ' + process.env.COGNITO_CLIENT_SECRET.length + ')' : 'NOT SET',
    COGNITO_ISSUER: process.env.COGNITO_ISSUER,
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    console.log(`[GROUND-TRUTH]   ${key}: ${value}`);
  });
  
  // 2. Check NextAuth config file
  console.log('[GROUND-TRUTH] Checking NextAuth configuration...');
  try {
    const nextAuthPath = path.join(process.cwd(), 'pages/api/auth/[...nextauth].js');
    const nextAuthContent = fs.readFileSync(nextAuthPath, 'utf8');
    
    // Check for cookie domain configuration
    const hasCookieDomain = nextAuthContent.includes('domain:');
    const cookieDomainMatch = nextAuthContent.match(/domain:\s*['"]([^'"]+)['"]/);
    
    console.log('[GROUND-TRUTH] NextAuth file exists: YES');
    console.log('[GROUND-TRUTH] Has cookie domain config: ' + (hasCookieDomain ? 'YES' : 'NO'));
    if (cookieDomainMatch) {
      console.log('[GROUND-TRUTH] Cookie domain value: ' + cookieDomainMatch[1]);
    }
    
    // Check if our fix was applied
    const hasCommentedDomain = nextAuthContent.includes('// domain removed - let NextAuth handle it');
    console.log('[GROUND-TRUTH] Cookie domain fix applied: ' + (hasCommentedDomain ? 'YES' : 'NO'));
    
  } catch (error) {
    console.log('[GROUND-TRUTH] ERROR reading NextAuth file:', error instanceof Error ? error.message : String(error));
  }
  
  // 3. Check request headers
  console.log('[GROUND-TRUTH] Request headers:');
  console.log('[GROUND-TRUTH]   Host:', req.headers.host);
  console.log('[GROUND-TRUTH]   X-Forwarded-Host:', req.headers['x-forwarded-host']);
  console.log('[GROUND-TRUTH]   X-Forwarded-Proto:', req.headers['x-forwarded-proto']);
  console.log('[GROUND-TRUTH]   Cookie:', req.headers.cookie ? 'Present' : 'None');
  
  // 4. Return summary
  res.status(200).json({
    status: 'Ground Truth Diagnostics Complete',
    environment: {
      NEXTAUTH_SECRET: envVars.NEXTAUTH_SECRET,
      NEXTAUTH_URL: envVars.NEXTAUTH_URL,
      NEXTAUTH_URL_INTERNAL: envVars.NEXTAUTH_URL_INTERNAL,
      NODE_ENV: envVars.NODE_ENV,
    },
    cognito: {
      CLIENT_ID: envVars.COGNITO_CLIENT_ID,
      CLIENT_SECRET: envVars.COGNITO_CLIENT_SECRET,
      ISSUER: envVars.COGNITO_ISSUER,
    },
    headers: {
      host: req.headers.host,
      xForwardedHost: req.headers['x-forwarded-host'],
      xForwardedProto: req.headers['x-forwarded-proto'],
      hasCookie: !!req.headers.cookie,
    },
    timestamp: new Date().toISOString()
  });
}
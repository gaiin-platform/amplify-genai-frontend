import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // This endpoint will help us understand what exactly is being sent
    
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    let tokenAnalysis = null;
    if (bearerToken) {
        tokenAnalysis = {
            length: bearerToken.length,
            preview: bearerToken.substring(0, 50) + '...',
            looksLikeJWT: bearerToken.split('.').length === 3,
            looksLikeBase64Hash: /^[A-Za-z0-9+/]+=*$/.test(bearerToken),
            parts: bearerToken.split('.').length,
            // Check if it matches the error pattern
            matchesErrorPattern: bearerToken === 'qmG0Jv8HamsDyV/hL6vjCz9AacybxSu47dB0rTekO4o=' ||
                                 bearerToken === 'KSj29x5x7tyrTOUOMoA1YTXHzi2vOM1r2hZPM2AmZLg=' ||
                                 bearerToken === 's/0TRwDRhuEPVJRxPn9ooc8tssi+vGdyWKaLlnb6NHM=' ||
                                 bearerToken === 'xi38gYBgoiu+sPtxOI2TMI9ltnjtsRwpxF3raetLHZw='
        };
    }
    
    res.status(200).json({
        message: 'JWT Test Endpoint',
        authHeader: {
            exists: !!authHeader,
            value: authHeader || null,
            format: authHeader?.startsWith('Bearer ') ? 'Bearer token' : 'Other format'
        },
        bearerToken: {
            exists: !!bearerToken,
            analysis: tokenAnalysis
        },
        diagnosis: bearerToken && tokenAnalysis?.matchesErrorPattern ? 
            'This is a NextAuth session token hash, not a Cognito JWT!' : 
            'Token format analysis complete'
    });
}
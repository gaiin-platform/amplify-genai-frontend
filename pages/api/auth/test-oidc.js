// Debug endpoint to test OIDC connectivity from within the container
export default async function handler(req, res) {
  const issuer = process.env.COGNITO_ISSUER;
  const oidcUrl = `${issuer}/.well-known/openid-configuration`;

  console.log('[OIDC Test] Testing connectivity to:', oidcUrl);

  try {
    const startTime = Date.now();
    const response = await fetch(oidcUrl);
    const elapsed = Date.now() - startTime;

    console.log('[OIDC Test] Response status:', response.status, 'in', elapsed, 'ms');

    if (!response.ok) {
      const text = await response.text();
      console.error('[OIDC Test] Error response:', text);
      return res.status(500).json({
        success: false,
        error: 'OIDC fetch failed',
        status: response.status,
        body: text,
        elapsed
      });
    }

    const oidcConfig = await response.json();
    console.log('[OIDC Test] Success! Issuer:', oidcConfig.issuer);

    return res.status(200).json({
      success: true,
      elapsed,
      issuer: oidcConfig.issuer,
      authorization_endpoint: oidcConfig.authorization_endpoint,
      token_endpoint: oidcConfig.token_endpoint,
      env: {
        hasClientId: !!process.env.COGNITO_CLIENT_ID,
        hasClientSecret: !!process.env.COGNITO_CLIENT_SECRET,
        hasIssuer: !!process.env.COGNITO_ISSUER,
        hasSecret: !!process.env.NEXTAUTH_SECRET,
        hasDomain: !!process.env.COGNITO_DOMAIN,
      }
    });
  } catch (error) {
    console.error('[OIDC Test] Fetch error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

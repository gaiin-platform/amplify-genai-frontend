/**
 * Cognito Provider Detection and Selection Utility
 *
 * This module handles the logic for detecting available identity providers
 * in Cognito and selecting the appropriate one based on priority:
 * 1. SAML provider (if available and not bypassed)
 * 2. Cognito native authentication (fallback or admin backdoor)
 */

export interface ProviderInfo {
  id: string;
  name: string;
  type: 'SAML' | 'COGNITO';
  isSaml: boolean;
}

/**
 * Fetches available identity providers from Cognito
 * This uses the Cognito hosted UI's metadata endpoint
 */
export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (!cognitoDomain || !clientId) {
    console.warn('Cognito domain or client ID not configured');
    return [];
  }

  try {
    // Attempt to parse provider info from environment or fetch from Cognito
    // Note: Cognito doesn't expose a direct API for this, so we'll use env vars
    const providers: ProviderInfo[] = [];

    // Check if SAML provider is configured
    const samlProviderName = process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME;
    if (samlProviderName) {
      providers.push({
        id: samlProviderName,
        name: samlProviderName,
        type: 'SAML',
        isSaml: true,
      });
    }

    // Always add Cognito as a fallback
    providers.push({
      id: 'COGNITO',
      name: 'COGNITO',
      type: 'COGNITO',
      isSaml: false,
    });

    return providers;
  } catch (error) {
    console.error('Error fetching providers:', error);
    return [{
      id: 'COGNITO',
      name: 'COGNITO',
      type: 'COGNITO',
      isSaml: false,
    }];
  }
}

/**
 * Determines which provider to use based on availability and user preference
 *
 * @param forcecognito - If true, bypass SAML and use Cognito directly (admin backdoor)
 * @returns The provider identifier to use for authentication
 */
export async function selectProvider(forceCognito: boolean = false): Promise<string> {
  if (forceCognito) {
    console.log('Admin backdoor: Forcing Cognito authentication');
    return 'cognito'; // NextAuth provider ID
  }

  const providers = await getAvailableProviders();

  // Priority 1: SAML provider (if available)
  const samlProvider = providers.find(p => p.isSaml);
  if (samlProvider) {
    console.log(`Using SAML provider: ${samlProvider.name}`);
    return 'cognito'; // Still uses NextAuth CognitoProvider, but Cognito will redirect to SAML
  }

  // Priority 2: Cognito native auth (fallback)
  console.log('Using Cognito native authentication');
  return 'cognito';
}

/**
 * Checks if SAML provider contains "amplify" in its name
 * This is used to identify managed SAML configurations
 */
export function isManagedSamlProvider(providerName: string): boolean {
  return providerName.toLowerCase().includes('amplify');
}

/**
 * Gets the authorization URL with the appropriate identity provider
 *
 * @param forceCognito - If true, force Cognito authentication
 * @returns Authorization URL with idp_identifier parameter if needed
 */
export function buildAuthorizationUrl(forceCognito: boolean = false): string {
  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_CALLBACK_URL;

  if (!cognitoDomain || !clientId || !redirectUri) {
    throw new Error('Missing required Cognito configuration');
  }

  const baseUrl = `${cognitoDomain}/oauth2/authorize`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'email openid',
    redirect_uri: redirectUri,
  });

  // If not forcing Cognito, and SAML is available, set identity provider
  if (!forceCognito) {
    const samlProviderName = process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME;
    if (samlProviderName) {
      params.append('identity_provider', samlProviderName);
    }
  }

  return `${baseUrl}?${params.toString()}`;
}

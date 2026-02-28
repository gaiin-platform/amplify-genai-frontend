/**
 * Custom Sign-In Handler with SAML Priority and Admin Backdoor
 *
 * This module provides a wrapper around NextAuth's signIn that:
 * 1. Detects available providers
 * 2. Prefers SAML provider when available
 * 3. Supports forceCognito parameter for admin backdoor access
 */

import { signIn as nextAuthSignIn } from 'next-auth/react';

export interface SignInOptions {
  /** Force Cognito authentication, bypassing SAML (admin backdoor) */
  forceCognito?: boolean;
  /** Redirect URL after successful sign-in */
  callbackUrl?: string;
  /** Additional query parameters to pass to the auth provider */
  [key: string]: any;
}

/**
 * Enhanced sign-in function that handles SAML-first authentication
 * with Cognito backdoor support
 *
 * Usage:
 * - Normal user login: signInWithProvider()
 * - Admin backdoor: signInWithProvider({ forceCognito: true })
 * - Via URL: /?forceCognito=true
 *
 * @param options Sign-in options
 * @returns Promise from NextAuth signIn
 */
export async function signInWithProvider(options: SignInOptions = {}) {
  const { forceCognito = false, callbackUrl = '/', ...rest } = options;

  // Check URL parameters for admin backdoor
  const urlParams = new URLSearchParams(window.location.search);
  const forceFromUrl = urlParams.get('forceCognito') === 'true';
  const shouldForceCognito = forceCognito || forceFromUrl;

  // Build authorization URL with identity provider parameter
  const authorizationParams: Record<string, string> = {};

  if (!shouldForceCognito) {
    // Check if SAML provider is configured via environment variable
    const samlProviderName = process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME;

    if (samlProviderName) {
      // Cognito will automatically redirect to SAML IdP
      authorizationParams.identity_provider = samlProviderName;
      console.log(`Using SAML provider: ${samlProviderName}`);
    } else {
      console.log('No SAML provider configured, using Cognito');
    }
  } else {
    // Admin backdoor: explicitly use Cognito native auth
    console.log('Admin backdoor activated: Using Cognito native authentication');
    // Don't set identity_provider parameter - Cognito will show native login
  }

  // Call NextAuth signIn with the appropriate provider
  return nextAuthSignIn('cognito', {
    callbackUrl,
    ...authorizationParams,
    ...rest,
  });
}

/**
 * Check if currently in admin backdoor mode
 */
export function isAdminBackdoor(): boolean {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('forceCognito') === 'true';
}

/**
 * Generate a backdoor URL for admin access
 * @param baseUrl The base URL of the application
 * @returns URL with forceCognito parameter
 */
export function getAdminBackdoorUrl(baseUrl: string = ''): string {
  const url = new URL(baseUrl || window.location.origin);
  url.searchParams.set('forceCognito', 'true');
  return url.toString();
}

/**
 * White Label Configuration Module
 * 
 * Centralizes all white labeling environment variables and provides type-safe access.
 * Handles validation and fallback logic for theme configuration.
 */

export interface WhiteLabelConfig {
  customLogoPath: string | null;
  defaultTheme: 'light' | 'dark';
  brandName: string;
}

/**
 * Validates theme value and provides fallback to 'light' for invalid values
 * @param theme - Theme value from environment variable
 * @returns Valid theme value ('light' or 'dark')
 */
function validateTheme(theme: string | undefined): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }
  if (theme && theme !== 'light' && theme !== 'dark') {
    console.warn(`Invalid theme "${theme}", falling back to "light"`);
  }
  return 'light';
}

/**
 * Retrieves white label configuration from environment variables
 * @returns WhiteLabelConfig object with all white labeling settings
 */
export function getWhiteLabelConfig(): WhiteLabelConfig {
  const customLogoPath = process.env.NEXT_PUBLIC_CUSTOM_LOGO || null;
  const defaultTheme = validateTheme(process.env.NEXT_PUBLIC_DEFAULT_THEME);
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'Amplify GenAI';
  
  // Debug logging (can be removed in production)
  if (typeof window !== 'undefined') {
    console.log('[White Label Config]', {
      customLogoPath,
      defaultTheme,
      brandName,
      envVar: process.env.NEXT_PUBLIC_DEFAULT_THEME
    });
  }
  
  return {
    customLogoPath,
    defaultTheme,
    brandName
  };
}

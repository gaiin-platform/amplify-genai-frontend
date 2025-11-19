/**
 * White label branding configuration
 * Provides centralized access to customizable brand assets and colors
 */

export interface BrandConfig {
  logo: string;
  primaryColor: string;
  hoverColor: string;
  darkBackground: string;
}

/**
 * Get the current brand configuration from environment variables
 * Falls back to defaults if not configured
 */
export const getBrandConfig = (): BrandConfig => {
  return {
    logo: process.env.NEXT_PUBLIC_BRAND_LOGO || '/favicon.ico',
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#48bb78',
    hoverColor: process.env.NEXT_PUBLIC_BRAND_HOVER_COLOR || '#38a169',
    darkBackground: process.env.NEXT_PUBLIC_BRAND_DARK_BG || '#343541',
  };
};

/**
 * Client-side hook to get brand configuration
 * Use this in React components
 */
export const useBrandConfig = (): BrandConfig => {
  return {
    logo: process.env.NEXT_PUBLIC_BRAND_LOGO || '/favicon.ico',
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#48bb78',
    hoverColor: process.env.NEXT_PUBLIC_BRAND_HOVER_COLOR || '#38a169',
    darkBackground: process.env.NEXT_PUBLIC_BRAND_DARK_BG || '#343541',
  };
};

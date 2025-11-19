/**
 * White label branding configuration
 * Logo path is configured via environment variable
 * Colors are configured in tailwind.config.js
 */

/**
 * Get the brand logo path
 */
export const getBrandLogo = (): string => {
  return process.env.NEXT_PUBLIC_BRAND_LOGO || '/favicon.ico';
};

/**
 * Client-side hook to get brand logo
 * Use this in React components
 */
export const useBrandConfig = () => {
  return {
    logo: process.env.NEXT_PUBLIC_BRAND_LOGO || '/favicon.ico',
  };
};

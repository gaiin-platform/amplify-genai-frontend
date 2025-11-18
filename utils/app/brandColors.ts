/**
 * Brand color utilities for applying white label colors throughout the application
 */

import { useBrandConfig } from './branding';

/**
 * Get inline styles for a button with brand colors
 */
export const getBrandButtonStyles = (
  primaryColor?: string,
  hoverColor?: string
) => {
  const defaultPrimary = process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#48bb78';
  const defaultHover = process.env.NEXT_PUBLIC_BRAND_HOVER_COLOR || '#38a169';
  
  return {
    base: {
      backgroundColor: 'white',
      border: '2px solid #ccc',
      color: 'black',
      fontWeight: 'bold' as const,
      padding: '10px 20px',
      borderRadius: '5px',
      cursor: 'pointer' as const,
      transition: 'background-color 0.3s ease-in-out',
    },
    onMouseOver: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = primaryColor || defaultPrimary;
    },
    onMouseOut: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = 'white';
    },
  };
};

/**
 * React hook to get brand button styles
 */
export const useBrandButtonStyles = () => {
  const { primaryColor, hoverColor } = useBrandConfig();
  return getBrandButtonStyles(primaryColor, hoverColor);
};

/**
 * Get CSS variable definitions for brand colors
 * Useful for injecting into global styles
 */
export const getBrandColorCSSVars = () => {
  const primaryColor = process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#48bb78';
  const hoverColor = process.env.NEXT_PUBLIC_BRAND_HOVER_COLOR || '#38a169';
  
  return {
    '--brand-primary': primaryColor,
    '--brand-hover': hoverColor,
  };
};

/**
 * Lighten a hex color by a percentage
 * Useful for creating color variations
 */
export const lightenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  
  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
};

/**
 * Darken a hex color by a percentage
 * Useful for creating color variations
 */
export const darkenColor = (hex: string, percent: number): string => {
  return lightenColor(hex, -percent);
};

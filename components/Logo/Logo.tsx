/**
 * Logo Component
 * 
 * Displays the application logo with support for custom overrides via environment variables.
 * Falls back to default logo if custom logo is not configured or fails to load.
 * 
 * Features:
 * - Dynamic logo source based on white label configuration
 * - Automatic fallback to default logo on error
 * - Next.js Image optimization
 * - Accessible with proper alt text
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { getWhiteLabelConfig } from '@/utils/whiteLabel/config';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  width = 150, 
  height = 40 
}) => {
  const config = getWhiteLabelConfig();
  const [hasError, setHasError] = useState(false);
  
  // Determine logo source
  // Priority: Custom logo (if configured and valid) > icon2.png (new default)
  const getLogoSrc = (): string => {
    // If error occurred or no custom logo configured, use new default icon
    if (hasError || !config.customLogoPath) {
      return '/icon2.png';
    }

    // Accept any image extension (PNG, SVG, WEBP, etc.) for custom logos.
    // The old SVG-only guard is removed — white-label logos may be any format.
    // Use custom logo from public/logos directory
    return `/logos/${config.customLogoPath}`;
  };
  
  const logoSrc = getLogoSrc();
  
  const handleError = () => {
    if (!hasError) {
      console.warn(
        `Failed to load custom logo: ${config.customLogoPath}, falling back to default logo`
      );
      setHasError(true);
    }
  };
  
  return (
    <div className={`logo-container ${className}`}>
      <Image
        src={logoSrc}
        alt={`${config.brandName} Logo`}
        width={width}
        height={height}
        priority
        onError={handleError}
      />
    </div>
  );
};

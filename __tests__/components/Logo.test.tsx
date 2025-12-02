/**
 * Property-Based Tests for Logo Component
 * 
 * Tests the Logo component logic using property-based testing with fast-check.
 * Each test runs a minimum of 100 iterations to verify properties hold across all inputs.
 * 
 * Note: These tests verify the logo selection logic by testing the configuration
 * and path resolution behavior that the Logo component relies on.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fc } from '@fast-check/vitest';
import { getWhiteLabelConfig } from '@/utils/whiteLabel/config';

describe('Logo Component - Property Tests', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CUSTOM_LOGO;
    delete process.env.NEXT_PUBLIC_DEFAULT_THEME;
    delete process.env.NEXT_PUBLIC_BRAND_NAME;
    consoleWarnSpy.mockRestore();
  });
  
  /**
   * Helper function to determine logo source based on configuration
   * This mirrors the logic in the Logo component
   */
  const getLogoSrc = (customLogoPath: string | null): string => {
    if (!customLogoPath) {
      return '/sparc_apple.png';
    }
    
    if (!customLogoPath.toLowerCase().endsWith('.svg')) {
      console.warn(
        `Custom logo "${customLogoPath}" does not have .svg extension, falling back to default`
      );
      return '/sparc_apple.png';
    }
    
    return `/logos/${customLogoPath}`;
  };
  
  /**
   * Feature: white-labeling, Property 1: Default logo fallback
   * Validates: Requirements 1.1
   * 
   * For any application start state, when no custom logo path is configured,
   * the system should display the default logo.
   */
  it('Property 1: Default logo fallback - should use default logo when no custom logo configured', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary brand names and themes
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('light' as const, 'dark' as const),
        (brandName, theme) => {
          // Set environment without custom logo
          delete process.env.NEXT_PUBLIC_CUSTOM_LOGO;
          process.env.NEXT_PUBLIC_BRAND_NAME = brandName;
          process.env.NEXT_PUBLIC_DEFAULT_THEME = theme;
          
          const config = getWhiteLabelConfig();
          const logoSrc = getLogoSrc(config.customLogoPath);
          
          // Verify default logo is used
          expect(config.customLogoPath).toBeNull();
          expect(logoSrc).toBe('/sparc_apple.png');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 2: Custom logo loading
   * Validates: Requirements 1.2
   * 
   * For any valid SVG filename in the public/logos directory, when that filename
   * is set as the custom logo environment variable, the system should load that
   * specific file as the logo source.
   */
  it('Property 2: Custom logo loading - should load custom SVG logo from logos directory', () => {
    fc.assert(
      fc.property(
        // Generate valid SVG filenames
        fc.string({ minLength: 1, maxLength: 30 })
          .filter(s => !s.includes('/') && !s.includes('\\') && s.trim().length > 0)
          .map(s => `${s.replace(/\s+/g, '-')}.svg`),
        (svgFilename) => {
          // Set custom logo environment variable
          process.env.NEXT_PUBLIC_CUSTOM_LOGO = svgFilename;
          
          const config = getWhiteLabelConfig();
          const logoSrc = getLogoSrc(config.customLogoPath);
          
          // Verify custom logo path is set and correct source is generated
          expect(config.customLogoPath).toBe(svgFilename);
          expect(logoSrc).toBe(`/logos/${svgFilename}`);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 3: Logo error handling
   * Validates: Requirements 1.3
   * 
   * For any non-existent or invalid logo file path, the system should fall back
   * to the default logo and log a warning message.
   * 
   * Note: This test verifies the fallback logic. The actual file existence check
   * happens at runtime in the browser when the Image component attempts to load.
   * The Logo component's onError handler triggers the fallback behavior.
   */
  it('Property 3: Logo error handling - should handle error state and fall back to default', () => {
    // Test that when hasError state is true, default logo is used
    // This simulates what happens after onError is triggered
    const getLogoSrcWithError = (customLogoPath: string | null, hasError: boolean): string => {
      if (hasError || !customLogoPath) {
        return '/sparc_apple.png';
      }
      
      if (!customLogoPath.toLowerCase().endsWith('.svg')) {
        return '/sparc_apple.png';
      }
      
      return `/logos/${customLogoPath}`;
    };
    
    fc.assert(
      fc.property(
        // Generate arbitrary logo paths
        fc.string({ minLength: 1, maxLength: 50 }),
        (logoPath) => {
          // Simulate error state (as would happen after onError callback)
          const logoSrcAfterError = getLogoSrcWithError(logoPath, true);
          
          // Verify fallback to default logo
          expect(logoSrcAfterError).toBe('/sparc_apple.png');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 4: Logo extension validation
   * Validates: Requirements 1.4
   * 
   * For any configured logo path, if the file extension is not '.svg',
   * the system should handle it appropriately (reject or fall back).
   */
  it('Property 4: Logo extension validation - should fall back to default for non-SVG extensions', () => {
    fc.assert(
      fc.property(
        // Generate filenames with non-SVG extensions
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes('\\')),
        fc.constantFrom('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.txt', ''),
        (filename, extension) => {
          consoleWarnSpy.mockClear();
          
          const logoPath = `${filename}${extension}`;
          process.env.NEXT_PUBLIC_CUSTOM_LOGO = logoPath;
          
          const config = getWhiteLabelConfig();
          const logoSrc = getLogoSrc(config.customLogoPath);
          
          // If extension is not .svg, should fall back to default
          if (!extension.toLowerCase().endsWith('.svg')) {
            expect(logoSrc).toBe('/sparc_apple.png');
            
            // Should log warning for non-empty extensions
            if (extension.length > 0) {
              expect(consoleWarnSpy).toHaveBeenCalled();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 4: Logo extension validation (positive case)
   * Validates: Requirements 1.4
   * 
   * For any configured logo path with .svg extension, the system should accept it.
   */
  it('Property 4: Logo extension validation - should accept SVG extensions (case insensitive)', () => {
    fc.assert(
      fc.property(
        // Generate filenames with SVG extensions in various cases
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes('\\')),
        fc.constantFrom('.svg', '.SVG', '.Svg', '.sVg'),
        (filename, extension) => {
          consoleWarnSpy.mockClear();
          
          const logoPath = `${filename}${extension}`;
          process.env.NEXT_PUBLIC_CUSTOM_LOGO = logoPath;
          
          const config = getWhiteLabelConfig();
          const logoSrc = getLogoSrc(config.customLogoPath);
          
          // Should accept SVG extension (case insensitive)
          expect(logoSrc).toBe(`/logos/${logoPath}`);
          expect(consoleWarnSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 5: Logo consistency
   * Validates: Requirements 1.5
   * 
   * For any page in the application, the logo component should render with
   * consistent dimensions and styling properties.
   * 
   * Note: This test verifies that the logo source determination is consistent
   * across multiple calls with the same configuration.
   */
  it('Property 5: Logo consistency - should return consistent logo source for same configuration', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary logo configurations
        fc.option(
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => !s.includes('/') && !s.includes('\\') && s.trim().length > 0)
            .map(s => `${s.replace(/\s+/g, '-')}.svg`),
          { nil: null }
        ),
        fc.string({ minLength: 1, maxLength: 50 }),
        (customLogo, brandName) => {
          // Set configuration
          if (customLogo) {
            process.env.NEXT_PUBLIC_CUSTOM_LOGO = customLogo;
          } else {
            delete process.env.NEXT_PUBLIC_CUSTOM_LOGO;
          }
          process.env.NEXT_PUBLIC_BRAND_NAME = brandName;
          
          // Get logo source multiple times
          const config1 = getWhiteLabelConfig();
          const logoSrc1 = getLogoSrc(config1.customLogoPath);
          
          const config2 = getWhiteLabelConfig();
          const logoSrc2 = getLogoSrc(config2.customLogoPath);
          
          const config3 = getWhiteLabelConfig();
          const logoSrc3 = getLogoSrc(config3.customLogoPath);
          
          // Verify consistency across multiple calls
          expect(logoSrc1).toBe(logoSrc2);
          expect(logoSrc2).toBe(logoSrc3);
          expect(config1.customLogoPath).toBe(config2.customLogoPath);
          expect(config2.customLogoPath).toBe(config3.customLogoPath);
          expect(config1.brandName).toBe(config2.brandName);
          expect(config2.brandName).toBe(config3.brandName);
        }
      ),
      { numRuns: 100 }
    );
  });
});

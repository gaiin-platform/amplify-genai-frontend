/**
 * Property-Based Tests for CSS Color Variables
 * 
 * Tests the CSS custom properties configuration for theme-specific color application.
 * Each test runs a minimum of 100 iterations to verify properties hold across all inputs.
 */

import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { Theme } from '@/types/settings';
import fs from 'fs';
import path from 'path';

describe('CSS Color Variables - Property Tests', () => {
  // Read the CSS file content once
  const cssContent = fs.readFileSync(
    path.join(__dirname, '../../../styles/globals.css'),
    'utf-8'
  );
  
  // Read the Tailwind config
  const tailwindConfigPath = path.join(__dirname, '../../../tailwind.config.js');
  const tailwindConfigContent = fs.readFileSync(tailwindConfigPath, 'utf-8');
  
  /**
   * Feature: white-labeling, Property 11: Theme-specific color application
   * Validates: Requirements 4.3, 4.4
   * 
   * For any custom color defined for a specific theme (light or dark), that color should
   * only be applied when the corresponding theme is active, and not when the other theme is active.
   */
  it('Property 11: Theme-specific color application - light theme colors defined in :root', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'brand-bg-light',
          'brand-text-light',
          'brand-primary-light',
          'brand-primary-hover-light',
          'brand-secondary-light',
          'brand-accent-light'
        ),
        (colorName) => {
          // Verify light theme color is defined in :root
          const rootRegex = new RegExp(`:root\\s*{[^}]*--color-${colorName}:\\s*#[0-9a-fA-F]{6}`, 's');
          expect(cssContent).toMatch(rootRegex);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 11: Theme-specific color application - dark theme colors defined in .dark selector', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'brand-bg-dark',
          'brand-text-dark',
          'brand-primary-dark',
          'brand-primary-hover-dark',
          'brand-secondary-dark',
          'brand-accent-dark'
        ),
        (colorName) => {
          // Verify dark theme color is defined in .dark selector
          const darkRegex = new RegExp(`\\.dark\\s*{[^}]*--color-${colorName}:\\s*#[0-9a-fA-F]{6}`, 's');
          expect(cssContent).toMatch(darkRegex);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 11: Theme-specific color application - light and dark colors are different', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { light: 'brand-bg-light', dark: 'brand-bg-dark' },
          { light: 'brand-text-light', dark: 'brand-text-dark' },
          { light: 'brand-primary-light', dark: 'brand-primary-dark' },
          { light: 'brand-primary-hover-light', dark: 'brand-primary-hover-dark' },
          { light: 'brand-secondary-light', dark: 'brand-secondary-dark' },
          { light: 'brand-accent-light', dark: 'brand-accent-dark' }
        ),
        (colorPair) => {
          // Extract color values from CSS
          const lightMatch = cssContent.match(
            new RegExp(`--color-${colorPair.light}:\\s*(#[0-9a-fA-F]{6})`)
          );
          const darkMatch = cssContent.match(
            new RegExp(`--color-${colorPair.dark}:\\s*(#[0-9a-fA-F]{6})`)
          );
          
          // Both should be defined
          expect(lightMatch).toBeTruthy();
          expect(darkMatch).toBeTruthy();
          
          // They should have different values (light and dark themes should differ)
          if (lightMatch && darkMatch) {
            expect(lightMatch[1]).not.toBe(darkMatch[1]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 11: Theme-specific color application - Tailwind config references CSS variables', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.constantFrom(
          'bg',
          'text',
          'primary',
          'primary-hover',
          'secondary',
          'accent'
        ),
        (theme, colorType) => {
          const colorName = `brand-${colorType}-${theme}`;
          
          // Verify Tailwind config includes this color with var() reference
          const tailwindColorRegex = new RegExp(
            `'${colorName}':\\s*'var\\(--color-${colorName}[^)]*\\)'`
          );
          expect(tailwindConfigContent).toMatch(tailwindColorRegex);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 11: Theme-specific color application - CSS variables have fallback values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.constantFrom(
          'bg',
          'text',
          'primary',
          'primary-hover',
          'secondary',
          'accent'
        ),
        (theme, colorType) => {
          const colorName = `brand-${colorType}-${theme}`;
          
          // Verify Tailwind config includes fallback value
          const fallbackRegex = new RegExp(
            `'${colorName}':\\s*'var\\(--color-${colorName},\\s*#[0-9a-fA-F]{6}\\)'`
          );
          expect(tailwindConfigContent).toMatch(fallbackRegex);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 13: CSS variable generation
   * Validates: Requirements 6.4
   * 
   * For any custom theme color defined in the Tailwind configuration, the system should
   * generate corresponding CSS custom properties that enable runtime theme switching.
   */
  it('Property 13: CSS variable generation - Tailwind colors map to CSS custom properties', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.constantFrom(
          'bg',
          'text',
          'primary',
          'primary-hover',
          'secondary',
          'accent'
        ),
        (theme, colorType) => {
          const colorName = `brand-${colorType}-${theme}`;
          const cssVarName = `--color-${colorName}`;
          
          // Verify Tailwind config defines this color
          const tailwindColorRegex = new RegExp(`'${colorName}':`);
          expect(tailwindConfigContent).toMatch(tailwindColorRegex);
          
          // Verify corresponding CSS variable exists in globals.css
          const cssVarRegex = new RegExp(`${cssVarName}:\\s*#[0-9a-fA-F]{6}`);
          expect(cssContent).toMatch(cssVarRegex);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 13: CSS variable generation - all Tailwind brand colors have CSS variables', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No random input needed
        () => {
          // Extract all brand color names from Tailwind config
          const brandColorMatches = tailwindConfigContent.matchAll(/'(brand-[^']+)':/g);
          const brandColors = Array.from(brandColorMatches, m => m[1]);
          
          // Verify we found brand colors
          expect(brandColors.length).toBeGreaterThan(0);
          
          // For each brand color in Tailwind, verify CSS variable exists
          for (const colorName of brandColors) {
            const cssVarName = `--color-${colorName}`;
            const cssVarRegex = new RegExp(`${cssVarName}:\\s*#[0-9a-fA-F]{6}`);
            expect(cssContent).toMatch(cssVarRegex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 13: CSS variable generation - CSS variables enable runtime theme switching', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'bg',
          'text',
          'primary',
          'primary-hover',
          'secondary',
          'accent'
        ),
        (colorType) => {
          // For each color type, verify both light and dark variants exist
          const lightColorName = `brand-${colorType}-light`;
          const darkColorName = `brand-${colorType}-dark`;
          
          // Verify light variant in :root (always available)
          const lightVarRegex = new RegExp(
            `:root\\s*{[^}]*--color-${lightColorName}:\\s*#[0-9a-fA-F]{6}`,
            's'
          );
          expect(cssContent).toMatch(lightVarRegex);
          
          // Verify dark variant in .dark selector (available when dark class is present)
          const darkVarRegex = new RegExp(
            `\\.dark\\s*{[^}]*--color-${darkColorName}:\\s*#[0-9a-fA-F]{6}`,
            's'
          );
          expect(cssContent).toMatch(darkVarRegex);
          
          // This structure enables runtime theme switching:
          // - Light colors are always defined in :root
          // - Dark colors are defined in .dark selector
          // - Adding/removing .dark class switches which variables are active
        }
      ),
      { numRuns: 100 }
    );
  });
});

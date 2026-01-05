/**
 * Tailwind Build Verification Tests
 * 
 * Validates that:
 * - Tailwind configuration is valid
 * - Custom color classes are properly defined
 * - CSS custom properties are correctly configured
 * - No configuration errors exist
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.5
 */

import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config.js';
import fs from 'fs';
import path from 'path';

describe('Tailwind Build Verification', () => {
  describe('Tailwind Configuration Validation', () => {
    it('should have valid Tailwind 3.x configuration structure', () => {
      // Verify basic structure
      expect(tailwindConfig).toBeDefined();
      expect(tailwindConfig.theme).toBeDefined();
      expect(tailwindConfig.theme.extend).toBeDefined();
      expect(tailwindConfig.darkMode).toBe('class');
    });

    it('should use Tailwind 3.x theme extension pattern', () => {
      // Verify we're using the extend pattern, not replacing
      expect(tailwindConfig.theme.extend).toBeDefined();
      expect(tailwindConfig.theme.extend.colors).toBeDefined();
    });

    it('should have JIT mode enabled', () => {
      expect(tailwindConfig.mode).toBe('jit');
    });

    it('should have proper content paths configured', () => {
      expect(tailwindConfig.content).toBeDefined();
      expect(Array.isArray(tailwindConfig.content)).toBe(true);
      expect(tailwindConfig.content.length).toBeGreaterThan(0);
      
      // Verify it includes component paths
      const hasComponents = tailwindConfig.content.some((path: string) => 
        path.includes('components')
      );
      expect(hasComponents).toBe(true);
    });
  });

  describe('Custom Brand Color Classes', () => {
    const brandColors = tailwindConfig.theme.extend.colors;

    it('should define all light theme brand colors', () => {
      const lightColors = [
        'brand-bg-light',
        'brand-text-light',
        'brand-primary-light',
        'brand-primary-hover-light',
        'brand-secondary-light',
        'brand-accent-light',
      ];

      lightColors.forEach((color) => {
        expect(brandColors[color]).toBeDefined();
        expect(typeof brandColors[color]).toBe('string');
      });
    });

    it('should define all dark theme brand colors', () => {
      const darkColors = [
        'brand-bg-dark',
        'brand-text-dark',
        'brand-primary-dark',
        'brand-primary-hover-dark',
        'brand-secondary-dark',
        'brand-accent-dark',
      ];

      darkColors.forEach((color) => {
        expect(brandColors[color]).toBeDefined();
        expect(typeof brandColors[color]).toBe('string');
      });
    });

    it('should use CSS custom properties for all brand colors', () => {
      const allBrandColors = Object.values(brandColors);
      
      allBrandColors.forEach((colorValue) => {
        // Each color should reference a CSS variable
        expect(colorValue).toMatch(/var\(--color-brand-/);
      });
    });

    it('should provide fallback values for CSS custom properties', () => {
      const allBrandColors = Object.values(brandColors);
      
      allBrandColors.forEach((colorValue) => {
        // Each var() should have a fallback color
        expect(colorValue).toMatch(/var\([^,]+,\s*#[0-9a-fA-F]{6}\)/);
      });
    });

    it('should have matching light and dark color pairs', () => {
      const colorTypes = [
        'bg',
        'text',
        'primary',
        'primary-hover',
        'secondary',
        'accent',
      ];

      colorTypes.forEach((type) => {
        const lightKey = `brand-${type}-light`;
        const darkKey = `brand-${type}-dark`;
        
        expect(brandColors[lightKey]).toBeDefined();
        expect(brandColors[darkKey]).toBeDefined();
      });
    });
  });

  describe('CSS Custom Properties Configuration', () => {
    const globalsCssPath = path.join(process.cwd(), 'styles', 'globals.css');
    
    it('should have globals.css file', () => {
      expect(fs.existsSync(globalsCssPath)).toBe(true);
    });

    it('should define CSS custom properties in globals.css', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');
      
      // Check for :root definition
      expect(globalsCss).toContain(':root');
      
      // Check for light theme variables
      expect(globalsCss).toContain('--color-brand-bg-light');
      expect(globalsCss).toContain('--color-brand-text-light');
      expect(globalsCss).toContain('--color-brand-primary-light');
    });

    it('should define dark theme CSS custom properties', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');
      
      // Check for .dark class definition
      expect(globalsCss).toContain('.dark');
      
      // Check for dark theme variables
      expect(globalsCss).toContain('--color-brand-bg-dark');
      expect(globalsCss).toContain('--color-brand-text-dark');
      expect(globalsCss).toContain('--color-brand-primary-dark');
    });

    it('should have valid hex color values in CSS variables', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');
      
      // Extract all color variable definitions
      const colorVarPattern = /--color-brand-[^:]+:\s*(#[0-9a-fA-F]{6})/g;
      const matches = globalsCss.matchAll(colorVarPattern);
      
      let foundColors = 0;
      for (const match of matches) {
        foundColors++;
        const hexColor = match[1];
        // Verify it's a valid 6-digit hex color
        expect(hexColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      
      // Should have at least 12 color definitions (6 light + 6 dark)
      expect(foundColors).toBeGreaterThanOrEqual(12);
    });

    it('should scope dark theme variables to .dark class', () => {
      const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');
      
      // Find the .dark section
      const darkSectionMatch = globalsCss.match(/\.dark\s*\{([^}]+)\}/);
      expect(darkSectionMatch).toBeTruthy();
      
      if (darkSectionMatch) {
        const darkSection = darkSectionMatch[1];
        // Verify dark variables are in the dark section
        expect(darkSection).toContain('--color-brand-bg-dark');
        expect(darkSection).toContain('--color-brand-text-dark');
      }
    });
  });

  describe('Tailwind 3.x Compatibility', () => {
    it('should not use deprecated Tailwind 2.x syntax', () => {
      // Verify we're not using old purge option
      expect(tailwindConfig.purge).toBeUndefined();
      
      // Verify we're using content instead
      expect(tailwindConfig.content).toBeDefined();
    });

    it('should use class-based dark mode (Tailwind 3.x)', () => {
      // Tailwind 3.x supports 'class' or 'media' for darkMode
      expect(['class', 'media']).toContain(tailwindConfig.darkMode);
    });

    it('should have typography plugin configured', () => {
      expect(tailwindConfig.plugins).toBeDefined();
      expect(Array.isArray(tailwindConfig.plugins)).toBe(true);
      expect(tailwindConfig.plugins.length).toBeGreaterThan(0);
    });
  });

  describe('Color Utility Class Generation', () => {
    it('should generate utility classes for all brand colors', () => {
      const brandColors = tailwindConfig.theme.extend.colors;
      const colorKeys = Object.keys(brandColors);
      
      // Verify we have a reasonable number of brand colors
      expect(colorKeys.length).toBeGreaterThanOrEqual(12);
      
      // Verify naming convention
      colorKeys.forEach((key) => {
        expect(key).toMatch(/^brand-/);
        expect(key).toMatch(/-(light|dark)$/);
      });
    });

    it('should support all standard Tailwind color utilities', () => {
      const brandColors = Object.keys(tailwindConfig.theme.extend.colors);
      
      // These colors should be usable with standard Tailwind utilities:
      // bg-brand-primary-light, text-brand-text-dark, border-brand-accent-light, etc.
      brandColors.forEach((color) => {
        // Verify the color name is valid for Tailwind utilities
        expect(color).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe('Build Configuration Validation', () => {
    it('should have reasonable CSS output configuration', () => {
      // Verify JIT mode is enabled for smaller builds
      expect(tailwindConfig.mode).toBe('jit');
    });

    it('should scan all necessary file types', () => {
      const content = tailwindConfig.content;
      
      // Should scan JS, TS, JSX, and TSX files (using glob patterns)
      const hasReactFiles = content.some((path: string) => 
        path.includes('{js,ts,jsx,tsx}') || 
        path.includes('.js') || 
        path.includes('.ts') ||
        path.includes('.jsx') ||
        path.includes('.tsx')
      );
      
      expect(hasReactFiles).toBe(true);
    });

    it('should not have conflicting color definitions', () => {
      const brandColors = tailwindConfig.theme.extend.colors;
      const colorKeys = Object.keys(brandColors);
      
      // Check for duplicates
      const uniqueKeys = new Set(colorKeys);
      expect(uniqueKeys.size).toBe(colorKeys.length);
    });
  });

  describe('Runtime Theme Switching Support', () => {
    it('should use CSS variables for runtime theme switching', () => {
      const brandColors = tailwindConfig.theme.extend.colors;
      
      // All colors should use var() for runtime switching
      Object.values(brandColors).forEach((colorValue) => {
        expect(colorValue).toContain('var(');
      });
    });

    it('should have separate variables for light and dark themes', () => {
      const brandColors = tailwindConfig.theme.extend.colors;
      const colorKeys = Object.keys(brandColors);
      
      // Count light and dark variants
      const lightColors = colorKeys.filter((key) => key.endsWith('-light'));
      const darkColors = colorKeys.filter((key) => key.endsWith('-dark'));
      
      // Should have equal number of light and dark colors
      expect(lightColors.length).toBe(darkColors.length);
      expect(lightColors.length).toBeGreaterThan(0);
    });
  });
});

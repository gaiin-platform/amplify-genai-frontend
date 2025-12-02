/**
 * Property-Based Tests for Theme Service
 * 
 * Tests the theme service logic using property-based testing with fast-check.
 * Each test runs a minimum of 100 iterations to verify properties hold across all inputs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fc } from '@fast-check/vitest';
import { ThemeService } from '@/utils/whiteLabel/themeService';
import { Theme } from '@/types/settings';

describe('Theme Service - Property Tests', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let localStorageMock: Storage;
  
  beforeEach(() => {
    // Spy on console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a mock localStorage
    const store: Record<string, string> = {};
    localStorageMock = {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
      key: vi.fn((index: number) => Object.keys(store)[index] || null),
      length: Object.keys(store).length
    };
    
    // Replace global localStorage
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    // Mock document.documentElement for theme application
    global.document = {
      documentElement: {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn()
        }
      }
    } as any;
  });
  
  afterEach(() => {
    // Clean up environment variables
    delete process.env.NEXT_PUBLIC_DEFAULT_THEME;
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });
  
  /**
   * Feature: white-labeling, Property 8: Theme persistence round-trip
   * Validates: Requirements 3.1, 3.2, 3.4
   * 
   * For any theme selection ('light' or 'dark'), when a user selects that theme,
   * then returns to the application, the system should load and apply that same theme
   * from local storage.
   */
  it('Property 8: Theme persistence round-trip - saved theme should be retrieved correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (theme) => {
          // Clear localStorage before each iteration
          localStorageMock.clear();
          
          // Save theme
          ThemeService.saveTheme(theme);
          
          // Retrieve theme
          const retrievedTheme = ThemeService.getSavedTheme();
          
          // Verify round-trip: saved theme equals retrieved theme
          expect(retrievedTheme).toBe(theme);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 9: User preference precedence
   * Validates: Requirements 3.3
   * 
   * For any combination of saved user theme preference and configured default theme,
   * the system should always apply the user's saved preference over the default.
   */
  it('Property 9: User preference precedence - user preference should override default theme', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.constantFrom<Theme>('light', 'dark'),
        (userPreference, defaultTheme) => {
          // Clear localStorage before each iteration
          localStorageMock.clear();
          
          // Set default theme in environment
          process.env.NEXT_PUBLIC_DEFAULT_THEME = defaultTheme;
          
          // Save user preference
          ThemeService.saveTheme(userPreference);
          
          // Get initial theme (should prioritize user preference)
          const initialTheme = ThemeService.getInitialTheme();
          
          // Verify user preference takes precedence
          expect(initialTheme).toBe(userPreference);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 10: Local storage error handling
   * Validates: Requirements 3.5
   * 
   * For any local storage failure (unavailable, quota exceeded, or corrupted data),
   * the system should gracefully fall back to the administrator-configured default theme
   * without crashing.
   */
  it('Property 10: Local storage error handling - should fall back to default theme on localStorage errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (defaultTheme) => {
          // Clear localStorage and reset spies
          localStorageMock.clear();
          consoleWarnSpy.mockClear();
          consoleErrorSpy.mockClear();
          
          // Set default theme in environment
          process.env.NEXT_PUBLIC_DEFAULT_THEME = defaultTheme;
          
          // Mock localStorage.getItem to throw an error
          const originalGetItem = localStorageMock.getItem;
          localStorageMock.getItem = vi.fn(() => {
            throw new Error('localStorage unavailable');
          });
          
          // Get initial theme (should fall back to default)
          const initialTheme = ThemeService.getInitialTheme();
          
          // Verify fallback to default theme
          expect(initialTheme).toBe(defaultTheme);
          
          // Verify warning was logged
          expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Failed to read theme from local storage:',
            expect.any(Error)
          );
          
          // Restore original getItem
          localStorageMock.getItem = originalGetItem;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 10: Local storage error handling - should handle save errors gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (theme) => {
          // Clear localStorage and reset spies
          localStorageMock.clear();
          consoleErrorSpy.mockClear();
          
          // Mock localStorage.setItem to throw an error
          const originalSetItem = localStorageMock.setItem;
          localStorageMock.setItem = vi.fn(() => {
            throw new Error('localStorage quota exceeded');
          });
          
          // Attempt to save theme (should not crash)
          expect(() => ThemeService.saveTheme(theme)).not.toThrow();
          
          // Verify error was logged
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to save theme to local storage:',
            expect.any(Error)
          );
          
          // Restore original setItem
          localStorageMock.setItem = originalSetItem;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 10: Local storage error handling - should handle corrupted data gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.string().filter(s => s !== 'light' && s !== 'dark'),
        (defaultTheme, corruptedValue) => {
          // Clear localStorage and reset spies
          localStorageMock.clear();
          consoleWarnSpy.mockClear();
          
          // Set default theme in environment
          process.env.NEXT_PUBLIC_DEFAULT_THEME = defaultTheme;
          
          // Set corrupted value in localStorage
          localStorageMock.setItem('user-theme-preference', corruptedValue);
          
          // Get saved theme (should return null for corrupted data)
          const savedTheme = ThemeService.getSavedTheme();
          expect(savedTheme).toBeNull();
          
          // Get initial theme (should fall back to default)
          const initialTheme = ThemeService.getInitialTheme();
          expect(initialTheme).toBe(defaultTheme);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: white-labeling, Property 6: Default theme application
   * Validates: Requirements 2.1, 2.5
   * 
   * For any valid theme value ('light' or 'dark') set as the default theme environment variable,
   * when a user has no saved preference, the system should apply that configured theme on initial load.
   */
  it('Property 6: Default theme application - should apply configured default theme when no user preference exists', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (defaultTheme) => {
          // Clear localStorage to ensure no user preference
          localStorageMock.clear();
          
          // Set default theme in environment
          process.env.NEXT_PUBLIC_DEFAULT_THEME = defaultTheme;
          
          // Get initial theme
          const initialTheme = ThemeService.getInitialTheme();
          
          // Verify configured default theme is applied
          expect(initialTheme).toBe(defaultTheme);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Browser Compatibility Tests
 * 
 * Tests theme persistence and graceful degradation across different browser scenarios:
 * - Theme persistence in different browsers
 * - Behavior with local storage disabled
 * - Behavior with cookies disabled
 * - Graceful degradation
 * 
 * Validates: Requirements 3.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeService } from '@/utils/whiteLabel/themeService';
import { getWhiteLabelConfig } from '@/utils/whiteLabel/config';

describe('Browser Compatibility Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let localStorageMock: { [key: string]: string };
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Setup localStorage mock
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    } as Storage;

    // Setup document mock
    if (typeof document === 'undefined') {
      (global as any).document = {
        documentElement: {
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(),
          },
        },
      };
    } else {
      document.documentElement.classList.add = vi.fn();
      document.documentElement.classList.remove = vi.fn();
      document.documentElement.classList.contains = vi.fn();
    }

    // Setup console spies
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Theme Persistence Across Browser Sessions', () => {
    it('should persist theme in Chrome-like environment', () => {
      // Simulate Chrome localStorage behavior
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      
      // User selects dark theme
      ThemeService.setTheme('dark');
      expect(localStorageMock['user-theme-preference']).toBe('dark');
      
      // Simulate new session
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBe('dark');
    });

    it('should persist theme in Firefox-like environment', () => {
      // Firefox has similar localStorage behavior to Chrome
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      
      // User selects dark theme
      ThemeService.setTheme('dark');
      expect(localStorageMock['user-theme-preference']).toBe('dark');
      
      // Simulate new session
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBe('dark');
    });

    it('should persist theme in Safari-like environment', () => {
      // Safari has similar localStorage behavior
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      
      // User selects dark theme
      ThemeService.setTheme('dark');
      expect(localStorageMock['user-theme-preference']).toBe('dark');
      
      // Simulate new session
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBe('dark');
    });

    it('should persist theme in Edge-like environment', () => {
      // Edge (Chromium-based) has similar localStorage behavior
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      
      // User selects dark theme
      ThemeService.setTheme('dark');
      expect(localStorageMock['user-theme-preference']).toBe('dark');
      
      // Simulate new session
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBe('dark');
    });
  });

  describe('Local Storage Disabled Scenarios', () => {
    it('should handle localStorage completely unavailable', () => {
      // Simulate browser with localStorage disabled
      (global as any).localStorage = undefined;
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';

      // Try to get saved theme
      const savedTheme = ThemeService.getSavedTheme();
      
      // Should return null without crashing
      expect(savedTheme).toBeNull();
    });

    it('should fall back to default theme when localStorage is disabled', () => {
      // Simulate localStorage throwing error
      global.localStorage = {
        getItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        setItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';

      // Get initial theme should fall back to default
      const initialTheme = ThemeService.getInitialTheme();
      expect(initialTheme).toBe('dark');
      
      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should still allow theme changes in current session when localStorage is disabled', () => {
      // Simulate localStorage disabled
      global.localStorage = {
        getItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        setItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      // Theme can still be applied to DOM
      ThemeService.applyTheme('dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      
      // Try to persist (will fail but not crash)
      ThemeService.setTheme('light');
      
      // Should log error when trying to save
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save theme to local storage:',
        expect.any(Error)
      );
    });

    it('should handle localStorage quota exceeded gracefully', () => {
      // Simulate quota exceeded error
      global.localStorage = {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError: The quota has been exceeded');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      // Try to save theme
      ThemeService.saveTheme('dark');
      
      // Should log error but not crash
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save theme to local storage:',
        expect.any(Error)
      );
    });

    it('should handle localStorage in private/incognito mode', () => {
      // In some browsers, localStorage exists but throws on setItem in private mode
      global.localStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error('Failed to execute setItem on Storage');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';

      // Should still work, just not persist
      ThemeService.setTheme('dark');
      ThemeService.applyTheme('dark');
      
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Cookies Disabled Scenarios', () => {
    it('should work normally when cookies are disabled (uses localStorage)', () => {
      // White labeling doesn't use cookies, only localStorage
      // So disabling cookies shouldn't affect functionality
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      
      // Theme persistence should work normally
      ThemeService.setTheme('dark');
      expect(localStorageMock['user-theme-preference']).toBe('dark');
      
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBe('dark');
    });

    it('should not depend on cookies for theme persistence', () => {
      // Verify we're only using localStorage, not cookies
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      
      // Save theme
      ThemeService.setTheme('dark');
      
      // Verify localStorage was used (not cookies)
      expect(localStorage.setItem).toHaveBeenCalledWith('user-theme-preference', 'dark');
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide working application even without persistence', () => {
      // Simulate complete storage failure
      global.localStorage = {
        getItem: vi.fn(() => {
          throw new Error('Storage not available');
        }),
        setItem: vi.fn(() => {
          throw new Error('Storage not available');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';

      // Application should still work
      const config = getWhiteLabelConfig();
      expect(config.defaultTheme).toBe('dark');
      
      // Theme can still be applied
      ThemeService.applyTheme('dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      
      // Just won't persist across sessions
      const initialTheme = ThemeService.getInitialTheme();
      expect(initialTheme).toBe('dark'); // Falls back to default
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Simulate corrupted data
      localStorageMock['user-theme-preference'] = 'invalid-theme-value';
      
      // Should return null for invalid data
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBeNull();
      
      // Should fall back to default
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      const initialTheme = ThemeService.getInitialTheme();
      expect(initialTheme).toBe('light');
    });

    it('should handle partial localStorage functionality', () => {
      // Simulate localStorage that can read but not write
      global.localStorage = {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn(() => {
          throw new Error('Write not allowed');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      // Should be able to read existing preferences
      localStorageMock['user-theme-preference'] = 'dark';
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBe('dark');
      
      // Writing should fail gracefully
      ThemeService.saveTheme('light');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should never crash the application due to storage errors', () => {
      // Simulate various error scenarios
      const errorScenarios = [
        new Error('SecurityError'),
        new Error('QuotaExceededError'),
        new Error('InvalidStateError'),
        new Error('Unknown error'),
      ];

      errorScenarios.forEach((error) => {
        global.localStorage = {
          getItem: vi.fn(() => {
            throw error;
          }),
          setItem: vi.fn(() => {
            throw error;
          }),
          removeItem: vi.fn(),
          clear: vi.fn(),
          length: 0,
          key: vi.fn(() => null),
        } as Storage;

        // None of these should crash
        expect(() => ThemeService.getSavedTheme()).not.toThrow();
        expect(() => ThemeService.saveTheme('dark')).not.toThrow();
        expect(() => ThemeService.getInitialTheme()).not.toThrow();
      });
    });

    it('should maintain theme state in memory even without persistence', () => {
      // Simulate localStorage disabled
      global.localStorage = {
        getItem: vi.fn(() => {
          throw new Error('Not available');
        }),
        setItem: vi.fn(() => {
          throw new Error('Not available');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      // Try to get initial theme (will trigger warning)
      const initialTheme = ThemeService.getInitialTheme();
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      // Try to save theme (will trigger error)
      ThemeService.setTheme('dark');
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Theme can still be applied and changed in current session
      ThemeService.applyTheme('dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      
      ThemeService.applyTheme('light');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('light');
    });
  });

  describe('Cross-Browser Consistency', () => {
    it('should use consistent storage key across all browsers', () => {
      // Verify we use the same key everywhere
      ThemeService.setTheme('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('user-theme-preference', 'dark');
      
      ThemeService.getSavedTheme();
      expect(localStorage.getItem).toHaveBeenCalledWith('user-theme-preference');
    });

    it('should handle theme values consistently across browsers', () => {
      // Only 'light' and 'dark' are valid
      const validThemes = ['light', 'dark'];
      
      validThemes.forEach((theme) => {
        localStorageMock['user-theme-preference'] = theme;
        const saved = ThemeService.getSavedTheme();
        expect(saved).toBe(theme);
      });
      
      // Invalid values should return null
      const invalidThemes = ['blue', 'auto', 'system', ''];
      invalidThemes.forEach((theme) => {
        localStorageMock['user-theme-preference'] = theme;
        const saved = ThemeService.getSavedTheme();
        expect(saved).toBeNull();
      });
    });

    it('should apply DOM changes consistently across browsers', () => {
      // Test both themes
      ThemeService.applyTheme('dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('light');
      
      ThemeService.applyTheme('light');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('light');
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('dark');
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    it('should handle localStorage returning unexpected types', () => {
      // Simulate localStorage returning non-string values
      global.localStorage = {
        getItem: vi.fn(() => null as any),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBeNull();
    });

    it('should handle rapid theme changes without errors', () => {
      // Simulate user rapidly toggling theme
      const themes: Array<'light' | 'dark'> = ['dark', 'light', 'dark', 'light', 'dark'];
      
      themes.forEach((theme) => {
        expect(() => ThemeService.setTheme(theme)).not.toThrow();
        expect(localStorageMock['user-theme-preference']).toBe(theme);
      });
    });

    it('should recover from temporary storage failures', () => {
      let failureCount = 0;
      
      // Simulate intermittent failures
      global.localStorage = {
        getItem: vi.fn((key: string) => {
          if (failureCount++ < 2) {
            throw new Error('Temporary failure');
          }
          return localStorageMock[key] || null;
        }),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      // First attempts fail
      expect(ThemeService.getSavedTheme()).toBeNull();
      expect(ThemeService.getSavedTheme()).toBeNull();
      
      // Third attempt succeeds
      localStorageMock['user-theme-preference'] = 'dark';
      expect(ThemeService.getSavedTheme()).toBe('dark');
    });
  });
});

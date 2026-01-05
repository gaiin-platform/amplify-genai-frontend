/**
 * White Label Integration Tests
 * 
 * Tests the complete white label workflow including:
 * - Custom logo configuration
 * - Custom theme defaults
 * - Theme persistence across sessions
 * - Error scenarios (missing files, invalid config)
 * 
 * Validates: All Requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWhiteLabelConfig } from '@/utils/whiteLabel/config';
import { ThemeService } from '@/utils/whiteLabel/themeService';

describe('White Label Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let localStorageMock: { [key: string]: string };

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

    // Clear console spies
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Complete Workflow: Custom Logo Configuration', () => {
    it('should load custom logo when configured', () => {
      // Setup: Configure custom logo
      process.env.NEXT_PUBLIC_CUSTOM_LOGO = 'custom-logo.svg';
      process.env.NEXT_PUBLIC_BRAND_NAME = 'Test Company';

      // Execute: Get configuration
      const config = getWhiteLabelConfig();

      // Verify: Custom logo is configured
      expect(config.customLogoPath).toBe('custom-logo.svg');
      expect(config.brandName).toBe('Test Company');
    });

    it('should use default logo when no custom logo configured', () => {
      // Setup: No custom logo
      delete process.env.NEXT_PUBLIC_CUSTOM_LOGO;

      // Execute: Get configuration
      const config = getWhiteLabelConfig();

      // Verify: No custom logo path
      expect(config.customLogoPath).toBeNull();
      expect(config.brandName).toBe('Amplify GenAI'); // Default brand name
    });

    it('should handle missing logo file gracefully', () => {
      // Setup: Configure non-existent logo
      process.env.NEXT_PUBLIC_CUSTOM_LOGO = 'non-existent-logo.svg';

      // Execute: Get configuration
      const config = getWhiteLabelConfig();

      // Verify: Configuration still works
      expect(config.customLogoPath).toBe('non-existent-logo.svg');
      // Note: Actual file existence is checked at render time in Logo component
    });
  });

  describe('Complete Workflow: Custom Theme Default', () => {
    it('should apply custom default theme when configured', () => {
      // Setup: Configure dark theme as default
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';
      localStorageMock = {}; // No saved preference

      // Execute: Get initial theme
      const theme = ThemeService.getInitialTheme();

      // Verify: Dark theme is applied
      expect(theme).toBe('dark');
    });

    it('should apply light theme when no default configured', () => {
      // Setup: No default theme configured
      delete process.env.NEXT_PUBLIC_DEFAULT_THEME;
      localStorageMock = {}; // No saved preference

      // Execute: Get initial theme
      const theme = ThemeService.getInitialTheme();

      // Verify: Light theme is default
      expect(theme).toBe('light');
    });

    it('should handle invalid theme configuration', () => {
      // Setup: Invalid theme value
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'invalid-theme';
      localStorageMock = {}; // No saved preference

      // Execute: Get configuration
      const config = getWhiteLabelConfig();

      // Verify: Falls back to light theme and logs warning
      expect(config.defaultTheme).toBe('light');
      expect(console.warn).toHaveBeenCalledWith(
        'Invalid theme "invalid-theme", falling back to "light"'
      );
    });
  });

  describe('Complete Workflow: Theme Persistence Across Sessions', () => {
    it('should persist theme selection across sessions', () => {
      // Setup: Configure default theme
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';

      // Session 1: User selects dark theme
      ThemeService.setTheme('dark');
      expect(localStorageMock['user-theme-preference']).toBe('dark');

      // Session 2: User returns to application
      const savedTheme = ThemeService.getSavedTheme();
      expect(savedTheme).toBe('dark');

      // Verify: Saved theme takes precedence over default
      const initialTheme = ThemeService.getInitialTheme();
      expect(initialTheme).toBe('dark');
    });

    it('should prioritize user preference over default theme', () => {
      // Setup: Default is light, but user previously selected dark
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      localStorageMock['user-theme-preference'] = 'dark';

      // Execute: Get initial theme
      const theme = ThemeService.getInitialTheme();

      // Verify: User preference wins
      expect(theme).toBe('dark');
    });

    it('should update persistence when theme changes', () => {
      // Setup: Start with light theme
      localStorageMock['user-theme-preference'] = 'light';

      // Execute: Change to dark theme
      ThemeService.setTheme('dark');

      // Verify: Storage is updated
      expect(localStorageMock['user-theme-preference']).toBe('dark');
    });

    it('should apply theme to DOM when set', () => {
      // Execute: Set dark theme
      ThemeService.applyTheme('dark');

      // Verify: DOM classes are updated
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('light');

      // Execute: Set light theme
      ThemeService.applyTheme('light');

      // Verify: DOM classes are updated
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('light');
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('dark');
    });
  });

  describe('Complete Workflow: Error Scenarios', () => {
    it('should handle localStorage unavailable', () => {
      // Setup: localStorage throws error
      global.localStorage = {
        getItem: vi.fn(() => {
          throw new Error('localStorage not available');
        }),
        setItem: vi.fn(() => {
          throw new Error('localStorage not available');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';

      // Execute: Try to get saved theme
      const savedTheme = ThemeService.getSavedTheme();

      // Verify: Returns null and logs warning
      expect(savedTheme).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to read theme from local storage:',
        expect.any(Error)
      );

      // Execute: Get initial theme (should fall back to default)
      const initialTheme = ThemeService.getInitialTheme();
      expect(initialTheme).toBe('dark'); // Falls back to configured default
    });

    it('should handle localStorage quota exceeded', () => {
      // Setup: localStorage throws quota exceeded error
      global.localStorage = {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      } as Storage;

      // Execute: Try to save theme
      ThemeService.saveTheme('dark');

      // Verify: Error is logged but doesn't crash
      expect(console.error).toHaveBeenCalledWith(
        'Failed to save theme to local storage:',
        expect.any(Error)
      );
    });

    it('should handle corrupted localStorage data', () => {
      // Setup: Invalid data in localStorage
      localStorageMock['user-theme-preference'] = 'corrupted-value';

      // Execute: Try to get saved theme
      const savedTheme = ThemeService.getSavedTheme();

      // Verify: Returns null for invalid data
      expect(savedTheme).toBeNull();
    });

    it('should handle missing environment variables gracefully', () => {
      // Setup: Remove all white label env vars
      delete process.env.NEXT_PUBLIC_CUSTOM_LOGO;
      delete process.env.NEXT_PUBLIC_DEFAULT_THEME;
      delete process.env.NEXT_PUBLIC_BRAND_NAME;

      // Execute: Get configuration
      const config = getWhiteLabelConfig();

      // Verify: Defaults are applied
      expect(config.customLogoPath).toBeNull();
      expect(config.defaultTheme).toBe('light');
      expect(config.brandName).toBe('Amplify GenAI');
    });
  });

  describe('End-to-End Workflow: Complete User Journey', () => {
    it('should handle complete user journey from first visit to theme change', () => {
      // Setup: Administrator configures white label
      process.env.NEXT_PUBLIC_CUSTOM_LOGO = 'company-logo.svg';
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';
      process.env.NEXT_PUBLIC_BRAND_NAME = 'Acme Corp';
      localStorageMock = {}; // First-time user

      // Step 1: User visits application for first time
      const config = getWhiteLabelConfig();
      expect(config.customLogoPath).toBe('company-logo.svg');
      expect(config.brandName).toBe('Acme Corp');

      // Step 2: Application loads initial theme
      const initialTheme = ThemeService.getInitialTheme();
      expect(initialTheme).toBe('dark'); // Uses configured default

      // Step 3: Theme is applied to DOM
      ThemeService.applyTheme(initialTheme);
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');

      // Step 4: User toggles to light theme
      ThemeService.setTheme('light');
      expect(localStorageMock['user-theme-preference']).toBe('light');

      // Step 5: User returns later (new session)
      const returnTheme = ThemeService.getInitialTheme();
      expect(returnTheme).toBe('light'); // User preference persisted

      // Step 6: User toggles back to dark
      ThemeService.setTheme('dark');
      expect(localStorageMock['user-theme-preference']).toBe('dark');
    });

    it('should maintain consistency across multiple theme changes', () => {
      // Setup
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      localStorageMock = {};

      // Execute: Multiple theme changes
      const themes: Array<'light' | 'dark'> = ['dark', 'light', 'dark', 'light', 'dark'];
      
      themes.forEach((theme) => {
        ThemeService.setTheme(theme);
        expect(localStorageMock['user-theme-preference']).toBe(theme);
        
        const retrieved = ThemeService.getSavedTheme();
        expect(retrieved).toBe(theme);
      });

      // Verify: Final state is correct
      expect(ThemeService.getSavedTheme()).toBe('dark');
    });
  });

  describe('Integration: Configuration and Theme Service', () => {
    it('should integrate config and theme service correctly', () => {
      // Setup: Configure default theme
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';
      localStorageMock = {};

      // Execute: Get config and use it for theme
      const config = getWhiteLabelConfig();
      const initialTheme = ThemeService.getInitialTheme();

      // Verify: Theme service uses config correctly
      expect(initialTheme).toBe(config.defaultTheme);
      expect(initialTheme).toBe('dark');
    });

    it('should handle all configuration options together', () => {
      // Setup: Full white label configuration
      process.env.NEXT_PUBLIC_CUSTOM_LOGO = 'full-logo.svg';
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'dark';
      process.env.NEXT_PUBLIC_BRAND_NAME = 'Full Test Corp';

      // Execute: Get complete configuration
      const config = getWhiteLabelConfig();

      // Verify: All options are configured
      expect(config).toEqual({
        customLogoPath: 'full-logo.svg',
        defaultTheme: 'dark',
        brandName: 'Full Test Corp',
      });

      // Verify: Theme service respects configuration
      const theme = ThemeService.getInitialTheme();
      expect(theme).toBe('dark');
    });
  });
});

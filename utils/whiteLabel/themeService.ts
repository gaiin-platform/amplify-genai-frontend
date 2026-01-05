/**
 * Theme Service Module
 * 
 * Manages theme state, persistence, and application across the application.
 * Handles local storage integration with proper error handling and fallback logic.
 */

import { Theme } from '@/types/settings';
import { getWhiteLabelConfig } from './config';

const THEME_STORAGE_KEY = 'user-theme-preference';

export class ThemeService {
  /**
   * Get the theme to apply on initial load
   * Priority: User preference > Default theme from config
   * @returns Theme to apply ('light' or 'dark')
   */
  static getInitialTheme(): Theme {
    // Check for user preference in local storage
    const savedTheme = this.getSavedTheme();
    if (savedTheme) {
      console.log('[ThemeService] Using saved theme:', savedTheme);
      return savedTheme;
    }
    
    // Fall back to configured default
    const config = getWhiteLabelConfig();
    console.log('[ThemeService] No saved theme, using default:', config.defaultTheme);
    return config.defaultTheme;
  }
  
  /**
   * Get saved theme from local storage
   * @returns Saved theme or null if not found/invalid
   */
  static getSavedTheme(): Theme | null {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (error) {
      console.warn('Failed to read theme from local storage:', error);
    }
    return null;
  }
  
  /**
   * Save theme preference to local storage
   * @param theme - Theme to save ('light' or 'dark')
   */
  static saveTheme(theme: Theme): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      console.log('[ThemeService] Saved theme to localStorage:', theme);
    } catch (error) {
      console.error('Failed to save theme to local storage:', error);
    }
  }
  
  /**
   * Apply theme to the document
   * @param theme - Theme to apply ('light' or 'dark')
   */
  static applyTheme(theme: Theme): void {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }
  
  /**
   * Change theme and persist the preference
   * @param theme - Theme to set ('light' or 'dark')
   */
  static setTheme(theme: Theme): void {
    this.applyTheme(theme);
    this.saveTheme(theme);
  }
}

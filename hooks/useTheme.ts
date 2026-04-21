/**
 * useTheme Hook
 * 
 * Provides theme state management with ThemeService integration.
 * Handles theme initialization, toggling, and persistence.
 */

import { useState, useEffect } from 'react';
import { Theme } from '@/types/settings';
import { ThemeService } from '@/utils/whiteLabel/themeService';

export interface UseThemeReturn {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (newTheme: Theme) => void;
  isLoading: boolean;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('light');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Initialize theme on mount
    const initialTheme = ThemeService.getInitialTheme();
    setThemeState(initialTheme);
    ThemeService.applyTheme(initialTheme);
    setIsLoading(false);
  }, []);
  
  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    ThemeService.setTheme(newTheme);
  };
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    ThemeService.setTheme(newTheme);
  };
  
  return {
    theme,
    toggleTheme,
    setTheme,
    isLoading
  };
}

export interface ProcessEnv {
  OPENAI_API_HOST?: string;
  OPENAI_API_TYPE?: 'openai' | 'azure';
  OPENAI_API_VERSION?: string;
  OPENAI_ORGANIZATION?: string;
  
  // White Label Configuration
  // These environment variables allow customization of branding elements at build time
  
  /**
   * Custom logo filename (must be an SVG file in public/logos directory)
   * Example: 'my-company-logo.svg'
   * If not set or file doesn't exist, falls back to default logo
   */
  NEXT_PUBLIC_CUSTOM_LOGO?: string;
  
  /**
   * Default theme to apply on initial page load
   * Valid values: 'light' | 'dark'
   * Default: 'light'
   * User preferences in local storage will override this setting
   */
  NEXT_PUBLIC_DEFAULT_THEME?: 'light' | 'dark';
  
  /**
   * Brand name to display in the application
   * Default: 'Amplify GenAI'
   * Used in logo alt text and other branding contexts
   */
  NEXT_PUBLIC_BRAND_NAME?: string;
}

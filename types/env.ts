export interface ProcessEnv {
  OPENAI_API_HOST?: string;
  OPENAI_API_TYPE?: 'openai' | 'azure';
  OPENAI_API_VERSION?: string;
  OPENAI_ORGANIZATION?: string;
  
  // White Label Configuration
  // These environment variables allow customization of branding elements at build time
  
  /**
   * Custom logo filename (an image file in the public/logos directory; a bare filename)
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
   * Default: 'Amplify GenAI' (classic UI) / 'Amplify' (New UI)
   * Used in logo alt text and other branding contexts. The New UI also shows it in the
   * sidebar, login heading, loading message and iOS home-screen title.
   */
  NEXT_PUBLIC_BRAND_NAME?: string;

  /**
   * Organization deploying this build (New UI). Optional; used to name the organization in
   * the Amplify Helper prompt and the Amplify Expert assistant.
   */
  NEXT_PUBLIC_ORGANIZATION_NAME?: string;

  /** Support email (Amplify Helper, Amplify Expert, Market feedback links). Hidden when unset. */
  NEXT_PUBLIC_SUPPORT_EMAIL?: string;

  /** Documentation / training resources URL (account menu, API keys, Amplify Helper). Hidden when unset. */
  NEXT_PUBLIC_RESOURCES_URL?: string;

  /** Data-classification / data-handling policy URL shown in the Amplify Helper. Hidden when unset. */
  NEXT_PUBLIC_DATA_POLICY_URL?: string;
}

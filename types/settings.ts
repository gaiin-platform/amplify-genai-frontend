export interface Settings {
  theme: Theme;
  hiddenModelIds: string[];
  featureOptions: { [key: string]: boolean };
  chatColorPalette?: string;
  avatarColorTone?: 'userPrimary' | 'userSecondary' | 'assistantPrimary' | 'assistantSecondary';
  /**
   * User's UI layout preference — persisted server-side so it roams across
   * devices and browsers.  Falls back to localStorage on first load.
   */
  uiPreference?: 'new' | 'classic';
}


export type Theme = 'light' | 'dark';




export interface Settings {
  theme: Theme;
  hiddenModelIds: string[];
  featureOptions: { [key: string]: boolean };
  chatColorPalette?: string;
  avatarColorTone?: 'userPrimary' | 'userSecondary' | 'assistantPrimary' | 'assistantSecondary';
  largeTextPastePreferences?: { [key: string]: 'file' | 'block' | 'plain' };
}


export type Theme = 'light' | 'dark';




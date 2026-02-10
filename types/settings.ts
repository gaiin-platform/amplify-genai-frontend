export interface Settings {
  theme: Theme;
  hiddenModelIds: string[];
  featureOptions: { [key: string]: boolean };
  chatColorPalette?: string;
  avatarColorTone?: 'userPrimary' | 'userSecondary' | 'assistantPrimary' | 'assistantSecondary';
}


export type Theme = 'light' | 'dark';




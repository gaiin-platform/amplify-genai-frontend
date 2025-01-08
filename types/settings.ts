export interface Settings {
  theme: Theme;
  hiddenModelIds: string[];
  featureOptions: { [key: string]: boolean };
}


export type Theme = 'light' | 'dark';




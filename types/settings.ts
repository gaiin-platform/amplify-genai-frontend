export interface Settings {
  theme: Theme;
  modelOptions: { [key: string]: boolean };
  featureOptions: { [key: string]: boolean };

}


export type Theme = 'light' | 'dark';




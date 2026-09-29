import { Settings } from '@/types/settings';
import {Workspace} from "@/types/workspace";
import { ThemeService } from '@/utils/whiteLabel/themeService';

const STORAGE_KEY = 'settings';

export const getSettings = (featureFlags:any): Settings => {
  // filter settings to ensure all models are still available 
  let settings: Settings = {
    theme: ThemeService.getInitialTheme(), // Use ThemeService instead of hardcoded 'dark'
    featureOptions: featureOptionDefaults(featureFlags),
    hiddenModelIds: [],
    chatColorPalette: 'warm-browns',
    avatarColorTone: 'userPrimary'
  };
  const settingsJson = localStorage.getItem(STORAGE_KEY);
  if (settingsJson) {
    try {
      const savedSettings = JSON.parse(settingsJson) as Settings;
      const allowedFeatureOptions = settings.featureOptions;
      const savedOptions = savedSettings.featureOptions && typeof savedSettings.featureOptions === 'object'
        ? savedSettings.featureOptions
        : {};

      // Keep only current user-controlled settings. Stale deployment-managed and
      // permanently disabled options are intentionally discarded on read.
      for (const key of Object.keys(savedOptions)) {
        if (!Object.prototype.hasOwnProperty.call(allowedFeatureOptions, key)) delete savedOptions[key];
      }
      for (const key of FORCED_OFF_FEATURE_OPTIONS) delete (savedOptions as Record<string, boolean>)[key];
      for (const key of Object.keys(allowedFeatureOptions)) {
        if (!Object.prototype.hasOwnProperty.call(savedOptions, key)) savedOptions[key] = allowedFeatureOptions[key];
      }

      settings = { ...settings, ...savedSettings, featureOptions: savedOptions };
    } catch (e) {
      console.error(e);
    }
  }
  return settings;
};

export const saveWorkspaceMetadata = (workspaceMetadata: Workspace) => {
  localStorage.setItem('workspaceMetadata', JSON.stringify(workspaceMetadata));
};

export const saveSettings = (settings: Settings) => {
  // Sync theme with ThemeService when saving settings
  ThemeService.setTheme(settings.theme);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};


// Deployment-managed features and permanently disabled controls are not user
// preferences. Stale persisted values are discarded by getSettings above.
export const featureOptionFlags: Array<{
  label: string;
  key: string;
  defaultValue: boolean;
  description: string;
}> = [];

export const FORCED_OFF_FEATURE_OPTIONS = [
  'includeFocusedMessages',
  'includePluginSelector',
] as const;

const featureOptionDefaults = (_featureFlags: any): Record<string, boolean> => ({});






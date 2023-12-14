import { Settings } from '@/types/settings';
import {Workspace} from "@/types/workspace";

const STORAGE_KEY = 'settings';

export const getSettings = (): Settings => {
  let settings: Settings = {
    theme: 'dark',
  };
  const settingsJson = localStorage.getItem(STORAGE_KEY);
  if (settingsJson) {
    try {
      let savedSettings = JSON.parse(settingsJson) as Settings;
      settings = Object.assign(settings, savedSettings);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

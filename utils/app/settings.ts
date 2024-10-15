import { Settings } from '@/types/settings';
import {Workspace} from "@/types/workspace";

const STORAGE_KEY = 'settings';

export const getSettings = (featureFlags:any): Settings => {
  let settings: Settings = {
    theme: 'dark',
    featureOptions: featureOptionDefaults(featureFlags),
    modelOptions: modelOptionDefaults
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


export const featureOptionFlags = [
  {
      "label": "Artifacts",
      "key": "includeArtifacts",
      "defaultValue": false
  },
  {
      "label": "Smart Focused Messages",
      "key": "includeFocusedMessages",
      "defaultValue": false
  },
  {
    "label": "Plugin Selector",
    "key": "includePluginSelector",
    "defaultValue": true
  }, 
  {
    "label": "Prompt Highlighter",
    "key": "includeHighlighter",
    "defaultValue": false
  },
 
];


const featureOptionDefaults = (featureFlags:any) =>  featureOptionFlags.reduce((acc:{[key:string]:boolean}, x) => {
  if (x.key === 'includeArtifacts') {
    if (featureFlags.artifacts) acc[x.key] = x.defaultValue;
  } else if (x.key === 'includePluginSelector') {
      if (featureFlags.pluginsOnInput) acc[x.key] = x.defaultValue;
  } else if (x.key === "includeHighlighter") {
    if (featureFlags.highlighter) acc[x.key] = x.defaultValue;
  } else {
      acc[x.key] = x.defaultValue;
  }
  return acc;
}, {});


export const modelOptionFlags = [
{
  "label": "Include All OpenAI Models",
  "key": "allOpenAI",
  "defaultValue": false
},
{
    "label": "Include All Claude Models",
    "key": "allClaude",
    "defaultValue": false
},
{
    "label": "Include All Mistral Models",
    "key": "allMistral",
    "defaultValue": false
},
];

const modelOptionDefaults = modelOptionFlags.reduce((acc:{[key:string]:boolean}, x) => {
  acc[x.key] = x.defaultValue;
  return acc;
}, {});



import { Settings } from '@/types/settings';
import {Workspace} from "@/types/workspace";

const STORAGE_KEY = 'settings';

export const getSettings = (featureFlags:any): Settings => {
  // filter settings to ensure all models are still available 
  let settings: Settings = {
    theme: 'dark',
    featureOptions: featureOptionDefaults(featureFlags),
    hiddenModelIds: []
  };
  
  // Check if we're on the client side
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return settings;
  }
  
  try {
    const settingsJson = localStorage.getItem(STORAGE_KEY);
    if (settingsJson) {
      let savedSettings = JSON.parse(settingsJson) as Settings;
      const allowedFeatureOptions = settings.featureOptions || {};

      // Initialize featureOptions if it doesn't exist
      if (!savedSettings.featureOptions || typeof savedSettings.featureOptions !== 'object') {
        savedSettings.featureOptions = {};
      }

      // Remove keys from savedSettings.featureOptions that are not in allowedFeatureOptions
      for (const key in savedSettings.featureOptions) {
        if (!Object.prototype.hasOwnProperty.call(allowedFeatureOptions, key)) {
          delete savedSettings.featureOptions[key];
        }
      }
      // Add keys to savedSettings.featureOptions that are in allowedFeatureOptions but missing in savedSettings.featureOptions
      for (const key in allowedFeatureOptions) {
        if (!Object.prototype.hasOwnProperty.call(savedSettings.featureOptions, key)) {
          savedSettings.featureOptions[key] = allowedFeatureOptions[key];
        }
      }

      settings = Object.assign(settings, savedSettings);
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  
  return settings;
};

export const saveWorkspaceMetadata = (workspaceMetadata: Workspace) => {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem('workspaceMetadata', JSON.stringify(workspaceMetadata));
  }
};

export const saveSettings = (settings: Settings) => {  
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
};


export const featureOptionFlags = [
  {
      "label": "Artifacts",
      "key": "includeArtifacts",
      "defaultValue": false, 
      "description": "Artifacts allow the creation of viewable content, such as code project, documents, or papers. This feature supports the rendering of various formats, including SVG graphics, HTML, and React components."
  },
  {
      "label": "Smart Focused Messages",
      "key": "includeFocusedMessages",
      "defaultValue": true,
      "description" : "Automatically filter and send only the most relevant messages from the conversation based on the current user prompt. Instead of sending the entire conversation history, this feature ensures that only the messages closely related to your request are shared, making responses more efficient."
  },
  {
    "label": "Plugin Selector",
    "key": "includePluginSelector",
    "defaultValue": true,
    "description": "The Plugin Selector allows customization of the experience by enabling or disabling specific tools. For example, you can disable the retrieval-augmented generation (RAG) feature, enable Code Interpreter, or turn on and off enabled settings."
  }, 
  {
    "label": "Prompt Highlighter",
    "key": "includeHighlighter",
    "defaultValue": false,
    "description" : "Highlight text in assistant messages or artifact content for two key purposes: prompt against selected content or prompt for fast inline edits. \nThis feature streamlines the process of interacting with and revising text, making it easy to generate responses, modify content, or draft new sections based on your selections."
    // "description" : "Highlight text in assistant messages or artifact content for three key purposes: prompt against selected content, prompt for fast inline edits, or create and insert new compositions by combining multiple highlighted sections. \nThis feature streamlines the process of interacting with and revising text, making it easy to generate responses, modify content, or draft new sections based on your selections."
  },
  {
    "label": "Memory",
    "key": "includeMemory",
    "defaultValue": false,
    "description": "Enable long-term memory for users and assistants, storing key information from past conversations. This feature enhances contextual understanding, delivering more personalized and coherent responses over time. Users have full control, approving all memories before they're saved."
  }
];


const featureOptionDefaults = (featureFlags:any) =>  featureOptionFlags.reduce((acc:{[key:string]:boolean}, x) => {
  if (x.key === 'includeArtifacts') {
    if (featureFlags.artifacts) acc[x.key] = x.defaultValue;
  } else if (x.key === 'includePluginSelector') {
      if (featureFlags.pluginsOnInput) acc[x.key] = x.defaultValue;
  } else if (x.key === "includeHighlighter") {
    if (featureFlags.highlighter) acc[x.key] = x.defaultValue;
  } else if (x.key === "includeMemory") {
    if (featureFlags.memory) acc[x.key] = x.defaultValue;
  } else {
      acc[x.key] = x.defaultValue;
  }
  return acc;
}, {});






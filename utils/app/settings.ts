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
      "defaultValue": false, 
      "description": "Artifacts allow the creation of viewable content, such as code project, documents, or papers. This feature supports the rendering of various formats, including SVG graphics, HTML, and React components."
  },
  {
      "label": "Smart Focused Messages",
      "key": "includeFocusedMessages",
      "defaultValue": false,
      "description" : "Automatically filter and send only the most relevant messages from the conversation based on the current user prompt. Instead of sending the entire conversation history, this feature ensures that only the messages closely related to your request are shared, making responses more efficient."
  },
  {
    "label": "Plugin Selector",
    "key": "includePluginSelector",
    "defaultValue": true,
    "description": "The Plugin Selector allows customization of the experience by enabling or disabling specific tools. For example, you can disable the retrieval-augmented generation (RAG) feature or enable Code Interpreter."
  }, 
  {
    "label": "Prompt Highlighter",
    "key": "includeHighlighter",
    "defaultValue": false,
    "description" : "Highlight text in assistant messages or artifacts for three key purposes: prompt against selected content, prompt for fast inline edits, or create and insert new compositions by combining multiple highlighted sections. \nThis feature streamlines the process of interacting with and revising text, making it easy to generate responses, modify content, or draft new sections based on your selections."
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
  "label": "OpenAI",
  "key": "allOpenAI",
  "defaultValue": false
},
{
    "label": "Claude",
    "key": "allClaude",
    "defaultValue": false
},
{
    "label": "Mistral",
    "key": "allMistral",
    "defaultValue": false
},
];

const modelOptionDefaults = modelOptionFlags.reduce((acc:{[key:string]:boolean}, x) => {
  acc[x.key] = x.defaultValue;
  return acc;
}, {});



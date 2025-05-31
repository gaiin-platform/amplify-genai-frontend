import { IconRobot, IconChartBar, IconFileSearch, IconLibrary, IconMessageBolt, IconDeviceSdCard } from '@tabler/icons-react';
import React from 'react';

// Plugina are on and off features during the conversation chat requests

export interface Plugin {
  id: PluginID;
  name: string;
  title: string;
  // those without a default will need to be taken care of in the getDefaults function found in Components/Chat/PluginSelect.tsx 
  default?: boolean; 
  iconComponent:  React.ComponentType;
};

export enum PluginID {
  // GOOGLE_SEARCH = 'google-search',
  CODE_INTERPRETER = 'code-interpreter', 
  RAG = 'rag',
  ARTIFACTS = 'artifacts',
  SMART_MESSAGES = 'smart-focused-messages',
  RAG_EVAL = 'rag-eval',
  MEMORY = 'memory'
}

export const Plugins: Record<PluginID, Plugin> = {
  [PluginID.CODE_INTERPRETER]: {
    id: PluginID.CODE_INTERPRETER,
    name: "Code Interpreter",
    title: "Code Interpreter will be enabled for every message. Note: You will not be able to use Code Interpreter simultaneously with a selected Assistant, Artifacts, or Rag Evaluation.",
    default: false,
    iconComponent: IconRobot
  },
  [PluginID.RAG]: {
    id: PluginID.RAG,
    name: "Rag",
    title: "Perform Retrieval-Augmented Generation (RAG) on documents by analyzing only the most relevant portions of the document to provide more accurate responses. If turned off, the entire document contents will be provided to the model.",
    iconComponent: IconFileSearch,
    default: false
  },
  [PluginID.RAG_EVAL]: {
    id: PluginID.RAG_EVAL,
    name: "Rag Evaluation",
    default: false,
    title: "Perform comprehensive RAG Quality Assessment including Linguistic, Semantic, Factual, and Fairness metrics. Depends on Rag being enabled.",
    iconComponent: IconChartBar
  },
  [PluginID.ARTIFACTS]: {
    id: PluginID.ARTIFACTS,
    name: "Artifacts",
    title: "Allow Artifact Creation.",
    iconComponent: IconLibrary
  },
  [PluginID.SMART_MESSAGES]: {
    id: PluginID.SMART_MESSAGES,
    name: "Smart Focused Messages",
    title: "Filters and sends only the most relevant messages from the conversation based on the current user prompt.",
    iconComponent: IconMessageBolt
  },
  [PluginID.MEMORY]: {
    id: PluginID.MEMORY,
    name: "Memory",
    title: "Allows auto-extraction of new memories from the conversation.",
    iconComponent: IconDeviceSdCard
  }
};

export const PluginList = Object.values(Plugins);

// console.log(PluginList);

export interface PluginLocation{
  x: number,
  y: number
}

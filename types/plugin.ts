import { IconRobot, IconPencilOff, IconChartBar } from '@tabler/icons-react';
import React from 'react';


export interface Plugin {
  id: PluginID;
  name: string;
  title: string;
  iconComponent:  React.ComponentType
}

export enum PluginID {
  // GOOGLE_SEARCH = 'google-search',
  CODE_INTERPRETER = 'code-interpreter', 
  NO_RAG = 'no-rag',
  // RAG_EVAL = 'rag-eval'
}


export const Plugins: Record<PluginID, Plugin> = {
  // [PluginID.GOOGLE_SEARCH]: {
  //   id: PluginID.GOOGLE_SEARCH,
  //   name: PluginName.GOOGLE_SEARCH,
  // },
  [PluginID.CODE_INTERPRETER]: {
    id: PluginID.CODE_INTERPRETER,
    name: "Code Interpreter",
    title: "Code Interpreter will be used for every message.",
    iconComponent: IconRobot
  },
  [PluginID.NO_RAG]: {
    id: PluginID.NO_RAG,
    name: "No Rag",
    title: "No Retrieval-Augmented Generation will be performed on the files. This means the entire file will be given to the model.",
    iconComponent: IconPencilOff
  },
  // [PluginID.RAG_EVAL]: {
  //   id: PluginID.RAG_EVAL,
  //   name: "Rag Evaluation",
  //   title: "",
  //   iconComponent: IconChartBar
  // }
};

export const PluginList = Object.values(Plugins);

// console.log(PluginList);

export interface PluginLocation{
  x: number,
  y: number
}

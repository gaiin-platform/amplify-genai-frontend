import { IconRobot, IconBrandOpenai } from '@tabler/icons-react';

export interface Plugin {
  id: PluginID;
  name: string;
  title: string;
  // icon: JSX.Element
}

export enum PluginID {
  // GOOGLE_SEARCH = 'google-search',
  CODE_INTERPRETER = 'code-interpreter', 
  NO_RAG = 'no-rag',
  RAG_EVAL = 'rag-eval;'
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
    // icon: <IconRobot size={20} />
  },
  [PluginID.NO_RAG]: {
    id: PluginID.NO_RAG,
    name: "No Rag",
    title: "No Retrieval-Augmented Generation will be performed on the files. This means the entire file will be given to the model.",
    // icon: <IconBrandOpenai size={20} />
  },
  [PluginID.RAG_EVAL]: {
    id: PluginID.RAG_EVAL,
    name: "Rag Evaluation",
    title: "",
    // icon: <IconBrandOpenai size={20} /> // change icon 
  },
};

export const PluginList = Object.values(Plugins);

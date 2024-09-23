import { OpenAIModel } from './openai';

export interface Prompt {
  id: string;
  name: string;
  description: string;
  content: string;
  folderId: string | null;
  type: string | undefined;
  data?:{
    [key:string]:any,
    rootPromptId?:string,
    code?:string | null,
  }
  groupId? : string;
}

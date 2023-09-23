import { OpenAIModel } from './openai';
import {Prompt} from "@/types/prompt";
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  role: Role;
  content: string;
  id: string
}

export const newMessage = (data: any) => {
  return {
    role: "user",
    content: "",
    ...data,
    id: uuidv4()
  }
}

export type Role = 'assistant' | 'user';

export interface ChatBody {
  model: OpenAIModel;
  messages: Message[];
  key: string;
  prompt: string;
  temperature: number;
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  model: OpenAIModel;
  prompt: string;
  temperature: number;
  folderId: string | null;
  promptTemplate: Prompt | null;
}

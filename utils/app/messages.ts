import { Message } from "@/types/chat";
import { lzwCompress, lzwUncompress } from "./lzwCompression";
import cloneDeep from 'lodash/cloneDeep';

export const compressMessages = (messages: Message[]) => {
    if (messages.length === 0) return [];
    try {
      const data = JSON.stringify(messages);
      return lzwCompress(data);
    } catch {
      console.log("Failed to compress messages")
      return [];
    }
  }
  
  export const uncompressMessages = (compressedData: number[]) => {
    if (compressedData.length === 0) return [];
    try {
      const messages: string = lzwUncompress(compressedData);
      return JSON.parse(messages) as Message[];
    } catch {
      console.log("Failed to uncompress messages")
      return [];
    } 
  }

export const scrubMessages = (messages: Message[], removeDS: boolean = true) => {
  return (cloneDeep(messages)).map((m:Message) => {// remove any extra configuration data from the messages
    if (m.data && removeDS) {
        if (m.data.dataSources) m.data.dataSources = null;
        if (m.data.state && m.data.state.sources) m.data.state.sources = null;
    }
    return {role: m.role, content: m.content, data: m.data, id: m.id, type: m.type} as Message;
  });

}
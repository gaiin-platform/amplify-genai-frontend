import { Message } from "@/types/chat";
import { lzwCompress, lzwUncompress } from "./lzwCompression";


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
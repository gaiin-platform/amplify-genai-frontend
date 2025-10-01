import { Conversation } from '@/types/chat';
import {
  ExportFormatV1,
  ExportFormatV2,
  ExportFormatV3,
  ExportFormatV4,
  LatestExportFormat,
  SupportedExportFormats,
} from '@/types/export';
import { FolderInterface } from '@/types/folder';
import { Prompt } from '@/types/prompt';

import { cleanConversationHistory } from './clean';
import { isAssistant } from './assistants';
import { includeRemoteConversationData } from './conversationStorage';
import { saveConversations } from './conversation';
import { savePrompts } from './prompts';
import { saveFolders } from './folders';
import { getDate } from './date';
import { Model } from '@/types/model';
import { storageSet } from './storage';
export function isExportFormatV1(obj: any): obj is ExportFormatV1 {
  return Array.isArray(obj);
}

export function isExportFormatV2(obj: any): obj is ExportFormatV2 {
  return !('version' in obj) && 'folders' in obj && 'history' in obj;
}

export function isExportFormatV3(obj: any): obj is ExportFormatV3 {
  return obj.version === 3;
}

export function isExportFormatV4(obj: any): obj is ExportFormatV4 {
  return obj.version === 4;
}

export const isLatestExportFormat = isExportFormatV4;

export function cleanData(data: SupportedExportFormats, defaultModel: Model): LatestExportFormat {
  if (isExportFormatV1(data)) {
    return {
      version: 4,
      history: cleanConversationHistory(data, defaultModel),
      folders: [],
      prompts: [],
    };
  }

  if (isExportFormatV2(data)) {
    return {
      version: 4,
      history: cleanConversationHistory(data.history || [], defaultModel),
      folders: (data.folders || []).map((chatFolder) => ({
        id: chatFolder.id.toString(),
        date: getDate(),
        name: chatFolder.name,
        type: 'chat',
      })),
      prompts: [],
    };
  }

  if (isExportFormatV3(data)) {
    return { ...data, version: 4, prompts: [] };
  }

  if (isExportFormatV4(data)) {
    return data;
  }

  throw new Error('Unsupported data format');
}

function currentDate() {
  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}-${day}`;
}
                                                                                        // useMessage is used in includeRemoteConversationData failed to ${useMessage}
export async function createExport(history: Conversation[], folders: FolderInterface[], prompts: Prompt[], useMessage:string, uncompressLocal:boolean = true) {  

  const data = {
    version: 4,
    history: await includeRemoteConversationData(history, useMessage, uncompressLocal) || [],
    folders: folders || [],
    prompts: prompts ? prepAnyAssistantPrompts(prompts) : [],

  } as LatestExportFormat;
  return data;
}

const prepAnyAssistantPrompts = (prompts: Prompt[]) => {
  return prompts.map((prompt: Prompt) => {

      if (isAssistant(prompt) && prompt.data) {
        let updatedPrompt = { ...prompt};
        updatedPrompt.data = { ...prompt.data, access: { read: true, write: false },
                              noCopy: true, noEdit: true, noShare: true, noDelete: true};
        return updatedPrompt;
      }
      return prompt;
    })

}

export const exportData = async (conversations: Conversation[], prompts: Prompt[], folders: FolderInterface[]) => {
  const data = await createExport(conversations, folders, prompts, "export");

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `chatbot_ui_history_${currentDate()}.json`;
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importData = ( data: SupportedExportFormats, oldConversations: Conversation[], oldPrompts: Prompt[], oldFolders: FolderInterface[], defaultModel: Model): LatestExportFormat => {
  const { history, folders, prompts } = cleanData(data, defaultModel);

  const newHistory: Conversation[] = [
    ...oldConversations,
    ...history,
  ].filter(
    (conversation, index, self) =>
      index === self.findIndex((c) => c.id === conversation.id),
  );
  saveConversations(newHistory);
  if (newHistory.length > 0) {
    storageSet(
      'selectedConversation',
      JSON.stringify(newHistory[newHistory.length - 1]),
    );
  } else {
    localStorage.removeItem('selectedConversation');
  }
  const newFolders: FolderInterface[] = [
    ...oldFolders,
    ...folders,
  ].filter(
    (folder, index, self) =>
      index === self.findIndex((f) => f.id === folder.id),
  );
  saveFolders(newFolders);
  
  const newPrompts: Prompt[] = [...oldPrompts, ...prompts].filter(
    (prompt, index, self) =>
      index === self.findIndex((p) => p.id === prompt.id),
  );
  savePrompts(newPrompts);

  return {
    version: 4,
    history: newHistory,
    folders: newFolders,
    prompts: newPrompts,
  };
};

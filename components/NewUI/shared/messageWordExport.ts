/**
 * Export a single assistant reply as a Word (.docx) file — the one-click path behind
 * "Download as Word" in the message details (⋯) popover.
 *
 * Reuses the same converter endpoint and polling as the legacy DownloadModal
 * (services/downloadService), with the options that modal sends for a single message.
 */
import { Conversation, Message } from '@/types/chat';
import { LatestExportFormat } from '@/types/export';
import {
  ConversionOptions,
  ConvertedFileOutcome,
  convert,
  waitForConvertedFile,
} from '@/services/downloadService';

export type WordExportResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/** Only replies that actually have text can be exported. */
export const canExportAsWord = (message: Message | undefined): boolean =>
  !!message && message.role === 'assistant' && typeof message.content === 'string' && message.content.trim().length > 0;

/** Same defaults the legacy modal sends for a single message (headers hidden, name excluded). */
export const buildWordExportOptions = (): ConversionOptions => ({
  format: 'docx',
  assistantHeader: '',
  userHeader: '',
  messageHeader: '',
  conversationHeader: '# \n\n',
  includeConversationName: false,
});

/** The converter requires folderId on every conversation, and JSON drops undefined. */
export const buildWordExportPayload = (conversation: Conversation, message: Message): LatestExportFormat =>
  ({
    version: 4,
    history: [{ ...conversation, folderId: conversation.folderId ?? null, messages: [message] }],
    folders: [],
    prompts: [],
  }) as LatestExportFormat;

export const outcomeMessage = (outcome: ConvertedFileOutcome): string => {
  switch (outcome.status) {
    case 'failed':
      return `Unable to create the Word file. ${outcome.reason}`.trim();
    case 'timeout':
      return 'The Word file is taking too long to prepare. Please try again.';
    case 'unreachable':
      return 'Failed to reach the download service. Please check your internet connection and try again.';
    default:
      return 'Unable to create the Word file.';
  }
};

export async function exportMessageAsWord(args: {
  conversation: Conversation;
  message: Message;
  /** Optional analytics hook (statsService.downloadItemEvent). */
  onConverted?: (options: ConversionOptions, payload: LatestExportFormat) => void;
}): Promise<WordExportResult> {
  const { conversation, message, onConverted } = args;
  const options = buildWordExportOptions();
  const payload = buildWordExportPayload(conversation, message);

  try {
    const result = await convert(options, payload);
    if (!result.success) return { ok: false, message: outcomeMessage({ status: 'unreachable' }) };
    try {
      onConverted?.(options, payload);
    } catch {
      // analytics must never block a download
    }
    const url: string = result.data.url;
    const outcome = await waitForConvertedFile(url, result.data.errorUrl);
    return outcome.status === 'ready' ? { ok: true, url } : { ok: false, message: outcomeMessage(outcome) };
  } catch {
    return { ok: false, message: outcomeMessage({ status: 'unreachable' }) };
  }
}

/** Trigger a browser download for a ready file URL. */
export function triggerFileDownload(url: string, filename = 'response.docx'): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

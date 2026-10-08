import type { AttachedDocument } from '@/types/attacheddocument';
import { conversationWithUncompressedMessages } from '@/utils/app/conversation';

interface DataSourceLike {
  id?: unknown;
  key?: unknown;
  name?: unknown;
  type?: unknown;
  metadata?: unknown;
}

interface MessageLike {
  role?: unknown;
  data?: {
    dataSources?: unknown;
  } | null;
}

export interface PriorDataSourceResult {
  /** Sources extracted from the transcript, deduplicated by canonical S3 key. */
  sources: AttachedDocument[];
  /** False when the record has no transcript yet and must not clear cached sources. */
  known: boolean;
}

/** Keep bare keys and s3:// keys equivalent without changing S3 key casing. */
export function canonicalDataSourceKey(value: string): string {
  return value.trim().replace(/^s3:\/\//i, '');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sourceToDocument(source: DataSourceLike): AttachedDocument | null {
  const rawKey = asString(source.key) || asString(source.id);
  const key = canonicalDataSourceKey(rawKey);
  if (!key) return null;

  const id = asString(source.id) || `s3://${key}`;
  return {
    id,
    key: rawKey || `s3://${key}`,
    name: asString(source.name),
    type: asString(source.type),
    data: null,
    metadata: (source.metadata && typeof source.metadata === 'object'
      ? source.metadata
      : {}) as AttachedDocument['metadata'],
  } as AttachedDocument;
}

/**
 * Extract the file sources from a conversation record without treating an
 * unhydrated cloud metadata record as an empty transcript.
 */
export function extractPriorDataSources(conversation: unknown): PriorDataSourceResult {
  if (!conversation || typeof conversation !== 'object') {
    return { sources: [], known: false };
  }

  const record = conversation as {
    messages?: unknown;
    compressedMessages?: unknown;
  };

  let messages: unknown;
  const compressed = record.compressedMessages;
  if (Array.isArray(compressed) && compressed.length > 0) {
    messages = conversationWithUncompressedMessages(record as never).messages;
  } else if (Array.isArray(record.messages)) {
    messages = record.messages;
  } else {
    return { sources: [], known: false };
  }

  const seen = new Set<string>();
  const sources: AttachedDocument[] = [];
  for (const message of (messages as MessageLike[]) ?? []) {
    if (message?.role !== 'user') continue;
    const dataSources = message.data?.dataSources;
    if (!Array.isArray(dataSources)) continue;
    for (const candidate of dataSources) {
      if (!candidate || typeof candidate !== 'object') continue;
      const document = sourceToDocument(candidate as DataSourceLike);
      if (!document || !document.key) continue;
      const canonical = canonicalDataSourceKey(document.key);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      sources.push(document);
    }
  }

  return { sources, known: true };
}

import { describe, expect, it } from 'vitest';
import { compressMessages } from '@/utils/app/messages';
import {
  canonicalDataSourceKey,
  extractPriorDataSources,
} from '../conversationDataSources';

const source = (id: string, name = 'file.pdf') => ({
  id,
  type: 'application/pdf',
  name,
  metadata: { totalItems: 1 },
});

const conversation = (messages: unknown[], extra: Record<string, unknown> = {}) => ({
  id: 'conversation-1',
  messages,
  ...extra,
});

describe('conversation data source extraction', () => {
  it('extracts and deduplicates sources from user messages', () => {
    const result = extractPriorDataSources(conversation([
      { role: 'assistant', data: { dataSources: [source('s3://ignored')] } },
      { role: 'user', data: { dataSources: [source('s3://docs/a.pdf'), source('docs/a.pdf')] } },
    ]));

    expect(result.known).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].key).toBe('s3://docs/a.pdf');
  });

  it('reads compressed local conversation messages', () => {
    const messages = [{ role: 'user', data: { dataSources: [source('docs/a.pdf')] } }];
    const result = extractPriorDataSources({
      id: 'conversation-1',
      messages: [],
      compressedMessages: compressMessages(messages as never),
    });

    expect(result.known).toBe(true);
    expect(result.sources[0].key).toBe('docs/a.pdf');
  });

  it('treats missing messages as unknown', () => {
    expect(extractPriorDataSources({ id: 'cloud-conversation' })).toEqual({
      sources: [],
      known: false,
    });
  });

  it('distinguishes a known empty transcript from an unknown one', () => {
    expect(extractPriorDataSources(conversation([]))).toEqual({ sources: [], known: true });
  });

  it('canonicalizes bare and s3 keys', () => {
    expect(canonicalDataSourceKey('s3://Docs/A.pdf')).toBe('Docs/A.pdf');
  });
});

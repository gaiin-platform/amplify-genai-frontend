import { describe, expect, it } from 'vitest';

import { getContinuationCarryOver } from '@/utils/app/mcpContinuation';
import { ChatBody } from '@/types/chat';

const baseBody = (extra: Record<string, any> = {}): ChatBody => ({
  model: { id: 'm' } as any,
  messages: [],
  prompt: '',
  temperature: 0.5,
  ...extra,
});

describe('getContinuationCarryOver', () => {
  it('carries the selected assistant and data sources', () => {
    const dataSources = [{ id: 's3://global/x.json', type: 'application/pdf', name: 'x', metadata: {} }] as any;
    const result = getContinuationCarryOver(
      baseBody({
        assistantId: 'astp/abc',
        assistantName: 'Ben.bennett',
        skipDocumentCache: true,
        reasoningLevel: 'high',
        dataSources,
      }),
    );

    expect(result).toEqual({
      assistantId: 'astp/abc',
      assistantName: 'Ben.bennett',
      skipDocumentCache: true,
      reasoningLevel: 'high',
      dataSources,
    });
  });

  it('carries group assistant identity', () => {
    expect(getContinuationCarryOver(baseBody({ groupId: 'g1', groupType: 'astgp' }))).toEqual({
      groupId: 'g1',
      groupType: 'astgp',
    });
  });

  it('returns nothing for a plain chat and does not leak other fields', () => {
    const result = getContinuationCarryOver(
      baseBody({ tools: [{}], mcpEnabled: true, skipRag: false, dataSources: [] }),
    );
    expect(result).toEqual({});
  });

  it('keeps an explicit disableReasoning=false', () => {
    expect(getContinuationCarryOver(baseBody({ disableReasoning: false }))).toEqual({ disableReasoning: false });
  });
});

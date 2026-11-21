import { fetchRemoteConversation } from '@/services/remoteConversationService';

import { resolveContextString } from '@/utils/app/contextConversations';
import { lzwCompress } from '@/utils/app/lzwCompression';
import { loadContextCache, saveContextCache } from '@/utils/app/storage';

import { type Conversation, newMessage } from '@/types/chat';

import { buildArtifactLibraryItems } from '../artifactLibraryModel';
import {
  type SavedChatContext,
  addAttachedArtifactDetails,
  attachSavedArtifact,
  buildAttachedArtifactContext,
  getAttachedArtifacts,
  removeSavedArtifact,
} from '../savedChatContext';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/remoteConversationService', () => ({
  fetchRemoteConversation: vi.fn(),
}));
vi.mock('@/utils/app/storage', () => ({
  loadContextCache: vi.fn(),
  saveContextCache: vi.fn(),
}));

const sourceItem = (key: string, contents: string | number[]) =>
  buildArtifactLibraryItems([
    {
      key,
      artifactId: 'report:v1',
      name: 'Quarterly report',
      version: 1,
      type: 'text',
      contents,
    },
  ])[0];

describe('saved artifact attachments', () => {
  it('keeps different saved records with the same legacy ID and version', () => {
    const first = attachSavedArtifact(
      {} as SavedChatContext,
      sourceItem('one', lzwCompress('Revenue grew by 14%.')),
    );
    const both = attachSavedArtifact(
      first,
      sourceItem('two', 'The forecast assumes no rate change.'),
    );
    expect(
      getAttachedArtifacts(both).map(({ artifactId, version }) => [
        artifactId,
        version,
      ]),
    ).toEqual([
      ['report', 1],
      ['report', 2],
    ]);
    const message = newMessage({
      role: 'user',
      content: 'Explain the results.',
      data: { keep: true },
    });
    const annotated = addAttachedArtifactDetails(message, both);
    expect(annotated.data).toMatchObject({
      keep: true,
      artifacts: [
        { artifactId: 'report', version: 1 },
        { artifactId: 'report', version: 2 },
      ],
    });
    expect(message.data.artifacts).toBeUndefined();
    expect(buildAttachedArtifactContext(both)).toContain(
      'Revenue grew by 14%.',
    );
    expect(buildAttachedArtifactContext(both)).toContain('no rate change.');
  });

  it('stops injecting a removed attachment and preserves the referenced version', () => {
    const item = sourceItem('one', 'The notes were removed.');
    const saved = attachSavedArtifact({} as SavedChatContext, item);
    const removed = removeSavedArtifact(saved, 'one');
    expect(getAttachedArtifacts(removed)).toEqual([]);
    expect(buildAttachedArtifactContext(removed)).toBe('');
    expect(removed.artifacts).toBe(saved.artifacts);
    expect(attachSavedArtifact(removed, item).artifacts).toBe(saved.artifacts);
  });

  it('caps the entire context including escaped contents and keeps each excerpt quoted', () => {
    const longText = 'key: "value"\n'.repeat(3000);
    const first = attachSavedArtifact(
      {} as SavedChatContext,
      sourceItem('one', longText),
    );
    const both = attachSavedArtifact(
      first,
      sourceItem('two', 'A second artifact.'),
    );
    const context = buildAttachedArtifactContext(both, 2048);
    expect(context.length).toBeLessThanOrEqual(1024);
    expect(context).toContain('A second artifact.');
    const excerpts = context.split('\n').filter((line) => line.startsWith('"'));
    expect(excerpts.map((line) => JSON.parse(line))).toEqual([
      expect.stringMatching(/key: [\s\S]*…$/),
      'A second artifact.',
    ]);
  });
});

describe('previous chat context', () => {
  const messages = [
    {
      ...newMessage({ role: 'user', content: 'Include this turn.' }),
      id: 'include',
    },
    {
      ...newMessage({ role: 'assistant', content: 'Leave this out.' }),
      id: 'exclude',
    },
  ];
  const source = {
    id: 'prior',
    name: 'Prior conversation',
    messages,
    isLocal: true,
  } as Conversation;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadContextCache).mockResolvedValue(null);
  });

  it('injects only selected messages from a local conversation', async () => {
    expect(
      await resolveContextString(
        [
          {
            conversationId: source.id,
            mode: 'selected',
            selectedMessageIds: ['include'],
          },
        ],
        [source],
      ),
    ).toBe('user: Include this turn.');
    expect(
      await resolveContextString(
        [
          {
            conversationId: source.id,
            mode: 'selected',
            selectedMessageIds: [],
          },
        ],
        [source],
      ),
    ).toBe('');
    expect(fetchRemoteConversation).not.toHaveBeenCalled();
  });

  it('fetches a cloud conversation on a cold cache and caches its text turns', async () => {
    vi.mocked(fetchRemoteConversation).mockResolvedValue({
      ...source,
      isLocal: false,
    });
    const context = await resolveContextString(
      [{ conversationId: source.id, mode: 'all' }],
      [{ ...source, isLocal: false, messages: [] }],
    );
    expect(context).toBe(
      'user: Include this turn.\n\nassistant: Leave this out.',
    );
    expect(saveContextCache).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: source.id,
        messages: [
          { id: 'include', role: 'user', content: 'Include this turn.' },
          { id: 'exclude', role: 'assistant', content: 'Leave this out.' },
        ],
      }),
    );
  });
});

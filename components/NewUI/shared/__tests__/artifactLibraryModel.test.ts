import { describe, expect, it } from 'vitest';
import { lzwCompress } from '@/utils/app/lzwCompression';
import {
  artifactDisplayName,
  artifactStableKey,
  buildArtifactLibraryItems,
  decodeArtifactContents,
  findArtifactSource,
  hydrateArtifactLibraryItem,
  normalizeArtifactRecords,
  renameArtifactInConversation,
  buildArtifactSavePayload,
  isArtifactFallbackContent,
  resolveArtifactName,
} from '@/components/NewUI/shared/artifactLibraryModel';

const conversation = (over: any = {}) => ({
  id: 'conversation-1',
  name: 'Generated chat',
  messages: [],
  model: {} as any,
  folderId: null,
  ...over,
});

const artifact = (over: any = {}) => ({
  artifactId: 'artifact-1',
  version: 1,
  name: 'Report',
  type: 'document',
  description: 'A report',
  contents: lzwCompress('# Hello'),
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('artifactLibraryModel', () => {
  it('uses a deterministic non-empty display name', () => {
    expect(artifactDisplayName({ name: '  Named  ' })).toBe('Named');
    expect(artifactDisplayName({ name: '', description: 'A useful description' })).toBe('A useful description');
    expect(artifactDisplayName({ name: '', type: 'spreadsheet' })).toBe('Spreadsheet Artifact');
    expect(artifactDisplayName({})).toBe('Artifact');
  });

  it('resolves generated names from explicit name, document H1, description, then type', () => {
    expect(resolveArtifactName({ name: '  Explicit ', description: 'ignored' }, '# Heading')).toBe('Explicit');
    expect(resolveArtifactName({ name: '', description: 'A description', type: 'document' }, '# Heading')).toBe('Heading');
    expect(resolveArtifactName({ name: '', description: 'A description', type: 'code' }, 'print(1)')).toBe('A description');
    expect(resolveArtifactName({ name: '', type: 'spreadsheet' }, 'a,b\\n1,2')).toBe('Spreadsheet Artifact');
    expect(resolveArtifactName({}, 'plain content')).toBe('Artifact');
  });

  it('decodes compressed content safely', () => {
    expect(decodeArtifactContents(lzwCompress('hello'))).toBe('hello');
    expect(decodeArtifactContents('plain text')).toBe('plain text');
    expect(decodeArtifactContents([])).toBe('');
    expect(decodeArtifactContents(['bad'])).toBe('');
  });

  it('flags fallback prose as unusable without dropping the record from the list', () => {
    // The /artifacts/get_all list endpoint returns metadata only (no
    // `contents`), the same shape the classic ArtifactsSaved.tsx dropdown
    // already consumes — so a record must stay listable regardless of what
    // (if anything) `contents` decodes to. Fallback/empty content should
    // only affect `hasContent`, never list inclusion.
    expect(isArtifactFallbackContent('Please provide the content or task you’d like me to create.')).toBe(true);

    const fallbackRecords = normalizeArtifactRecords([{ artifactId: 'bad', version: 1, contents: lzwCompress('No artifact was requested.') }]);
    expect(fallbackRecords).toHaveLength(1);
    expect(buildArtifactLibraryItems([fallbackRecords[0]])[0].hasContent).toBe(false);

    const emptyRecords = normalizeArtifactRecords([{ artifactId: 'empty', version: 1, contents: [] }]);
    expect(emptyRecords).toHaveLength(1);
    expect(buildArtifactLibraryItems([emptyRecords[0]])[0].hasContent).toBe(false);
  });

  it('lists metadata-only records (no contents field at all) as returned by the server list endpoint', () => {
    const listRecord = { key: '20260101/report-key', artifactId: 'report-key', name: 'Q1 Report', description: 'desc', createdAt: '2026-01-01T00:00:00.000Z' };
    const items = buildArtifactLibraryItems([listRecord]);
    expect(items).toHaveLength(1);
    expect(items[0].hasContent).toBe(false);
    expect(items[0].name).toBe('Q1 Report');
  });

  it('hydrates a metadata-only item with full content fetched via getArtifact', () => {
    const listRecord = { key: 'report-key', artifactId: 'report-key', name: 'Q1 Report', createdAt: '2026-01-01T00:00:00.000Z' };
    const [item] = buildArtifactLibraryItems([listRecord]);
    expect(item.hasContent).toBe(false);

    const fullArtifact = artifact({ artifactId: 'report-key', name: 'Q1 Report' });
    const hydrated = hydrateArtifactLibraryItem(item, fullArtifact);
    expect(hydrated.hasContent).toBe(true);
    expect(hydrated.content).toBe('# Hello');
  });

  it('builds a backend-safe save payload without conversation-only fields', () => {
    const payload = buildArtifactSavePayload({
      ...artifact(),
      conversationId: 'conversation-1',
      metadata: { language: 'python', conversationId: 'conversation-1' },
    });
    expect(payload).not.toBeNull();
    expect(payload).not.toHaveProperty('conversationId');
    expect(payload?.metadata).toEqual({ language: 'python', conversationId: 'conversation-1' });
    expect(payload?.artifactId).toBe('artifact-1');
    expect(buildArtifactSavePayload({ ...artifact(), contents: lzwCompress('Please provide the content or task') })).toBeNull();
  });

  it('accepts server envelopes and keyed artifact maps', () => {
    const record = artifact();
    expect(normalizeArtifactRecords({ data: { artifacts: [record] } })).toHaveLength(1);
    expect(normalizeArtifactRecords({ [record.artifactId]: [record] })).toHaveLength(1);
    expect(buildArtifactLibraryItems({ artifacts: [record] })[0].name).toBe('Report');
  });

  it('deduplicates records by artifact family and version', () => {
    const records = normalizeArtifactRecords([artifact(), artifact({ name: 'Updated' }), artifact({ version: 2 })]);
    expect(records).toHaveLength(2);
    expect(records.find((record) => record.version === 1)?.name).toBe('Updated');
    expect(artifactStableKey(artifact({ version: 2 }))).toBe('artifact-1::2');
  });

  it('prefers explicit conversation ids and falls back to conversation artifact maps', () => {
    const source = conversation({ artifacts: { 'artifact-1': [artifact()] } });
    expect(findArtifactSource(artifact({ conversationId: source.id }), [source]).confidence).toBe('explicit');
    expect(findArtifactSource(artifact(), [source]).conversationId).toBe(source.id);
    expect(findArtifactSource(artifact({ version: 2 }), [source]).confidence).toBe('none');
  });

  it('keeps an explicit source id when the remote conversation is metadata-only or unloaded', () => {
    const source = conversation({ id: 'remote-conversation', messages: [], isLocal: false });
    const fromMetadata = findArtifactSource(artifact({ metadata: { conversationId: source.id } }), [source]);
    expect(fromMetadata).toMatchObject({ conversationId: source.id, conversation: source, confidence: 'explicit' });
    const unloaded = findArtifactSource(artifact({ conversationId: source.id }), []);
    expect(unloaded).toMatchObject({ conversationId: source.id, confidence: 'explicit' });
    expect(unloaded.conversation).toBeUndefined();
  });

  it('matches source chats through message artifact references', () => {
    const source = conversation({ messages: [{ data: { artifacts: [{ artifactId: 'artifact-1', version: 1 }] } }] });
    expect(findArtifactSource(artifact(), [source]).confidence).toBe('message');
  });

  it('resolves type and preserves the raw decoded content', () => {
    const [item] = buildArtifactLibraryItems([artifact({ type: '', contents: lzwCompress('a,b\n1,2') })], []);
    expect(item.nuiType).toBe('spreadsheet');
    expect(item.content).toBe('a,b\n1,2');
  });

  it('propagates a rename to conversation versions and message details', () => {
    const source = conversation({
      artifacts: { 'artifact-1': [artifact()] },
      messages: [{ data: { artifacts: [{ artifactId: 'artifact-1', version: 1, name: 'Report' }] } }],
    });
    const updated = renameArtifactInConversation(source, 'artifact-1', 1, 'Renamed');
    expect(updated.artifacts?.['artifact-1'][0].name).toBe('Renamed');
    expect(updated.messages[0].data.artifacts[0].name).toBe('Renamed');
  });
});

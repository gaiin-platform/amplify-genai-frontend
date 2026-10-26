import { describe, expect, it } from 'vitest';
import { lzwCompress } from '@/utils/app/lzwCompression';
import {
  artifactCreated,
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

  it('resolves the source from detail-only metadata during hydration', () => {
    const source = conversation({ id: 'detail-source' });
    const listRecord = { key: 'report-key', artifactId: 'report-key', name: 'Q1 Report' };
    const [item] = buildArtifactLibraryItems([listRecord], []);
    const hydrated = hydrateArtifactLibraryItem(
      item,
      artifact({ artifactId: 'report-key', metadata: { conversationId: source.id } }),
      [source],
    );

    expect(hydrated.source).toMatchObject({
      conversationId: source.id,
      conversation: source,
      confidence: 'explicit',
    });
  });

  it('preserves source identity when an artifact is renamed', () => {
    const source = conversation({ id: 'rename-source', artifacts: { 'artifact-1': [artifact()] } });
    const renamedConversation = renameArtifactInConversation(source, 'artifact-1', 1, 'Renamed report');
    const [item] = buildArtifactLibraryItems([
      artifact({ name: 'Renamed report', metadata: { conversationId: source.id } }),
    ], [renamedConversation]);

    expect(item.stableKey).toBe('artifact-1::1');
    expect(item.source).toMatchObject({ conversationId: source.id, confidence: 'explicit' });
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
    const normalized = normalizeArtifactRecords([{ ...artifact(), sourceConversationId: source.id }])[0];
    expect(normalized?.conversationId).toBe(source.id);
    expect(normalized?.metadata?.conversationId).toBe(source.id);
    expect(normalizeArtifactRecords([{ ...artifact(), conversation_id: source.id }])[0]?.conversationId).toBe(source.id);
  });

  it('finds a newly-created artifact through the selected conversation artifact map', () => {
    const source = conversation({ artifacts: { 'artifact-1': [artifact()] } });
    const [item] = buildArtifactLibraryItems([{ ...artifact(), metadata: undefined }], [source]);
    expect(item.source).toMatchObject({
      conversationId: source.id,
      conversation: source,
      confidence: 'artifact',
      versionIndex: 0,
    });
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

  describe('creation date', () => {
    // Shape of GET /artifacts/get_all: date-only createdAt, optional server savedAt.
    const listed = (name: string, key: string, createdAt: string, over: any = {}) => ({
      key, artifactId: key, name, createdAt, ...over,
    });

    it('reads the exact time from savedAt, and only a date from the legacy createdAt', () => {
      const withTime = artifactCreated({ createdAt: 'Oct 26, 2026', savedAt: '2026-10-26T15:42:10Z' });
      expect(withTime).toEqual({ ms: Date.parse('2026-10-26T15:42:10Z'), hasTime: true });

      const dateOnly = artifactCreated({ createdAt: 'Oct 26, 2026' });
      expect(dateOnly?.hasTime).toBe(false);
      expect(new Date(dateOnly!.ms).getDate()).toBe(26);
    });

    it('falls back to the key date prefix and gives up cleanly', () => {
      const fromKey = artifactCreated({ key: '20261026/Plan:v1', createdAt: 'not a date', savedAt: 'nope' });
      expect(fromKey?.hasTime).toBe(false);
      expect(new Date(fromKey!.ms).getMonth()).toBe(9);
      expect(artifactCreated({ createdAt: '' })).toBeUndefined();
      expect(artifactCreated({})).toBeUndefined();
    });

    it('lists newest first, regardless of the order the server returned', () => {
      const items = buildArtifactLibraryItems([
        listed('Oldest', '20260105/Oldest:v1', 'Jan 5, 2026'),
        listed('Newest', '20261026/Newest:v1', 'Oct 26, 2026'),
        listed('Middle', '20260601/Middle:v1', 'Jun 1, 2026'),
      ]);
      expect(items.map((item) => item.name)).toEqual(['Newest', 'Middle', 'Oldest']);
    });

    it('breaks same-day ties by save order (later in the list is newer), and by savedAt when present', () => {
      const sameDay = buildArtifactLibraryItems([
        listed('First', '20261026/First:v1', 'Oct 26, 2026'),
        listed('Second', '20261026/Second:v1', 'Oct 26, 2026'),
        listed('Third', '20261026/Third:v1', 'Oct 26, 2026'),
      ]);
      expect(sameDay.map((item) => item.name)).toEqual(['Third', 'Second', 'First']);

      const stamped = buildArtifactLibraryItems([
        listed('Later', '20261026/Later:v1', 'Oct 26, 2026', { savedAt: '2026-10-26T18:00:00Z' }),
        listed('Earlier', '20261026/Earlier:v1', 'Oct 26, 2026', { savedAt: '2026-10-26T09:00:00Z' }),
      ]);
      expect(stamped.map((item) => item.name)).toEqual(['Later', 'Earlier']);
    });

    it('puts timestamped artifacts above date-only ones, even when the date-only one has a later calendar day', () => {
      const items = buildArtifactLibraryItems([
        listed('Legacy newest', '20261231/Legacy_newest:v1', 'Dec 31, 2026'),
        listed('Legacy old', '20260105/Legacy_old:v1', 'Jan 5, 2026'),
        listed('Stamped', '20261026/Stamped:v1', 'Oct 26, 2026', { savedAt: '2026-10-26T09:00:00Z' }),
        listed('Stamped later', '20261026/Stamped_later:v1', 'Oct 26, 2026', { savedAt: '2026-10-26T18:00:00Z' }),
        { key: 'mystery', artifactId: 'mystery', name: 'Mystery' },
      ]);
      expect(items.map((item) => item.name)).toEqual(['Stamped later', 'Stamped', 'Legacy newest', 'Legacy old', 'Mystery']);
    });

    it('puts records with no readable date last, and keeps the date after hydration', () => {
      const items = buildArtifactLibraryItems([
        { key: 'mystery', artifactId: 'mystery', name: 'Mystery' },
        listed('Dated', '20260601/Dated:v1', 'Jun 1, 2026', { savedAt: '2026-06-01T10:00:00Z' }),
      ]);
      expect(items.map((item) => item.name)).toEqual(['Dated', 'Mystery']);

      const hydrated = hydrateArtifactLibraryItem(items[0], artifact({ artifactId: items[0].artifact.artifactId, createdAt: 'Jun 1, 2026' }));
      expect(hydrated.created).toEqual({ ms: Date.parse('2026-06-01T10:00:00Z'), hasTime: true });
    });
  });
});

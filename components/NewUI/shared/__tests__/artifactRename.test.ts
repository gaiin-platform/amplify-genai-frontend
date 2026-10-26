import { beforeEach, describe, expect, it, vi } from 'vitest';

const doRequestOp = vi.fn();
vi.mock('@/services/doRequestOp', () => ({ doRequestOp: (...args: unknown[]) => doRequestOp(...args) }));

import { lzwCompress } from '@/utils/app/lzwCompression';
import {
  buildArtifactLibraryItems,
  renameArtifactInConversation,
} from '@/components/NewUI/shared/artifactLibraryModel';
import {
  MAX_ARTIFACT_NAME_LENGTH,
  applyRenameToSavedArtifacts,
  findConversationArtifactGroup,
  findSavedArtifactKey,
  normalizeArtifactName,
  renameArtifactsRemote,
  resolveArtifactRenameKeys,
} from '@/components/NewUI/shared/artifactRename';

const DATE = 'Oct 26, 2026';
// What GET /artifacts/get_all returns: no `version`, ids derived from name + version.
const saved = (name: string, version: number, over: any = {}) => ({
  key: `20261026/${name.replace(/ /g, '_')}:v${version}`,
  artifactId: `${name.replace(/ /g, '_')}:v${version}-20261026`,
  name,
  type: 'document',
  description: '',
  createdAt: DATE,
  tags: [],
  ...over,
});
const version = (name: string, v: number, over: any = {}) => ({
  artifactId: 'chat-uuid',
  version: v,
  name,
  type: 'document',
  description: '',
  contents: lzwCompress(`# ${name} ${v}`),
  tags: [],
  createdAt: DATE,
  ...over,
});
const chat = (over: any = {}) => ({
  id: 'chat-1',
  name: 'Chat',
  messages: [],
  model: {} as any,
  folderId: null,
  artifacts: { 'chat-uuid': [version('Plan', 1), version('Plan', 2)] },
  ...over,
});

describe('normalizeArtifactName', () => {
  it('trims, drops control characters and caps the length', () => {
    expect(normalizeArtifactName('  Q3 plan \n')).toBe('Q3 plan');
    expect(normalizeArtifactName('a\tb')).toBe('a b');
    expect(normalizeArtifactName('   ')).toBe('');
    expect(normalizeArtifactName('x'.repeat(500))).toHaveLength(MAX_ARTIFACT_NAME_LENGTH);
  });
});

describe('matching chat versions to saved records', () => {
  const list = [saved('Plan', 1), saved('Plan', 2), saved('Other', 1)];

  it('finds a version by name + createdAt + version parsed from the key', () => {
    expect(findSavedArtifactKey(list, version('Plan', 2))).toBe('20261026/Plan:v2');
    expect(findSavedArtifactKey(list, version('Plan', 3))).toBeUndefined();
    expect(findSavedArtifactKey(list, version('Plan', 1, { createdAt: 'Oct 27, 2026' }))).toBeUndefined();
    expect(findSavedArtifactKey(list, version('Missing', 1))).toBeUndefined();
    expect(findSavedArtifactKey(undefined, version('Plan', 1))).toBeUndefined();
  });

  it('resolves every saved version once and skips unsaved ones', () => {
    const keys = resolveArtifactRenameKeys(list, [version('Plan', 1), version('Plan', 2), version('Plan', 3), version('Plan', 2)]);
    expect(keys).toEqual(['20261026/Plan:v1', '20261026/Plan:v2']);
  });

  it('finds the chat version list a saved record belongs to', () => {
    const group = findConversationArtifactGroup(chat(), { name: 'Plan', createdAt: DATE, version: 2 });
    expect(group?.artifactId).toBe('chat-uuid');
    expect(group?.versions).toHaveLength(2);
    expect(findConversationArtifactGroup(chat(), { name: 'Nope', createdAt: DATE, version: 1 })).toBeNull();
    expect(findConversationArtifactGroup(null, { name: 'Plan', createdAt: DATE, version: 1 })).toBeNull();
  });
});

describe('applying a rename locally', () => {
  it('renames only the given keys in the saved list', () => {
    const next = applyRenameToSavedArtifacts([saved('Plan', 1), saved('Other', 1)], ['20261026/Plan:v1'], 'Roadmap');
    expect(next.map((entry) => entry.name)).toEqual(['Roadmap', 'Other']);
    expect(applyRenameToSavedArtifacts(undefined, [], 'x')).toEqual([]);
  });

  it('keeps the match working for the next rename (saved list and chat stay in step)', () => {
    const list = applyRenameToSavedArtifacts([saved('Plan', 1), saved('Plan', 2)], ['20261026/Plan:v1', '20261026/Plan:v2'], 'Roadmap');
    const renamed = renameArtifactInConversation(chat(), 'chat-uuid', undefined, 'Roadmap');
    const versions = renamed.artifacts!['chat-uuid'];
    expect(versions.map((v) => v.name)).toEqual(['Roadmap', 'Roadmap']);
    expect(resolveArtifactRenameKeys(list, versions)).toEqual(['20261026/Plan:v1', '20261026/Plan:v2']);
  });

  it('the Library resolves the right versions from a record the server listed', () => {
    const [item] = buildArtifactLibraryItems([saved('Plan', 2)], [chat({ messages: [] })]);
    expect(item.artifact.version).toBe(2); // parsed from the key, not defaulted to 1
    const group = findConversationArtifactGroup(chat(), {
      name: item.artifact.name, createdAt: item.artifact.createdAt, version: item.artifact.version,
    });
    expect(group?.versions.map((v) => v.version)).toEqual([1, 2]);
  });
});

describe('renameArtifactsRemote', () => {
  beforeEach(() => {
    doRequestOp.mockReset();
  });

  it('posts the keys and name to /artifacts/rename and reports what was renamed', async () => {
    doRequestOp.mockResolvedValue({ success: true, data: { renamed: [{ key: 'a/b:v1' }], notFound: ['c/d:v1'] } });
    const result = await renameArtifactsRemote(['a/b:v1', 'c/d:v1'], 'New');
    expect(doRequestOp).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST', path: '/artifacts', op: '/rename', service: 'artifacts',
      data: { keys: ['a/b:v1', 'c/d:v1'], name: 'New' },
    }));
    expect(result).toEqual({ success: true, renamed: ['a/b:v1'] });
  });

  it('surfaces a server failure without throwing', async () => {
    doRequestOp.mockResolvedValue({ success: false, message: 'Artifact not found.' });
    expect(await renameArtifactsRemote(['a/b:v1'], 'New')).toEqual({ success: false, renamed: [], message: 'Artifact not found.' });
    doRequestOp.mockImplementation(async () => { throw new Error('offline'); });
    expect((await renameArtifactsRemote(['a/b:v1'], 'New')).success).toBe(false);
  });

  it('does not call the server when there is nothing saved to rename', async () => {
    expect((await renameArtifactsRemote([], 'New')).success).toBe(false);
    expect(doRequestOp).not.toHaveBeenCalled();
  });
});

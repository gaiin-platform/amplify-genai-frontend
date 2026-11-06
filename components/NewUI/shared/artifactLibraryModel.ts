import type { Artifact } from '@/types/artifacts';
import { resolveNUIType, sniffContentType } from '@/types/artifacts';
import type { Conversation } from '@/types/chat';
import { lzwUncompress } from '@/utils/app/lzwCompression';

export type ArtifactLibraryRecord = Omit<Artifact, 'contents'> & {
  contents: number[] | string;
  key?: string;
  conversationId?: string;
  sharedBy?: string;
  /** Server-stamped ISO save time (UTC). Absent on artifacts saved before it existed. */
  savedAt?: string;
  /** The chat's artifactId, shared by every version of one artifact. Absent on older saves. */
  lineageId?: string;
};

export type ArtifactSourceMatch = {
  conversation?: Conversation;
  conversationId?: string;
  versionIndex?: number;
  confidence: 'explicit' | 'artifact' | 'message' | 'none';
};

export type ArtifactLibraryItem = {
  artifact: ArtifactLibraryRecord;
  stableKey: string;
  name: string;
  content: string;
  /**
   * True when `content` is real, decoded, non-fallback text. List responses
   * from the server (`/artifacts/get_all`) return metadata only — no
   * `contents` — so most items start with `hasContent: false` until the full
   * record is fetched on demand (see `getArtifact` in services/artifactsService).
   */
  hasContent: boolean;
  nuiType: ReturnType<typeof resolveNUIType>;
  source: ArtifactSourceMatch;
  /** When it was generated, for sorting and display. Undefined if no date can be read. */
  created?: ArtifactCreated;
  /**
   * Every saved version of this artifact, oldest first — this item is the latest one.
   * The Library shows one row per artifact; older versions are reached from the viewer.
   */
  versions: ArtifactLibraryItem[];
  /**
   * What tied `versions` together: a lineage (saved or from a loaded chat) is proof they
   * are one artifact; a shared name is only a guess, so callers should not act on the
   * whole stack (e.g. rename it) on the strength of it.
   */
  groupedBy?: 'lineage' | 'name' | 'record';
};

export type ArtifactCreated = {
  /** Epoch ms. Midnight local time when `hasTime` is false. */
  ms: number;
  /** False for date-only records (everything saved before `savedAt` existed). */
  hasTime: boolean;
};

const ARTIFACT_FALLBACK_PATTERNS = [
  /no artifact was requested/i,
  /please provide the (content|task|instructions)/i,
];

export function isArtifactFallbackContent(content: string): boolean {
  const normalized = content.trim();
  return Boolean(normalized) && ARTIFACT_FALLBACK_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isUsableArtifactContent(content: string): boolean {
  return Boolean(content.trim()) && !isArtifactFallbackContent(content);
}

export function buildArtifactSavePayload(artifact: Partial<ArtifactLibraryRecord>): Artifact | null {
  const artifactId = artifactIdOf(artifact);
  const contents = artifact.contents;
  const decoded = decodeArtifactContents(contents);
  if (!artifactId || !isUsableArtifactContent(decoded)) return null;
  if (!Array.isArray(contents) || !contents.length || !contents.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) {
    return null;
  }

  const sourceConversationId = artifact.conversationId
    ?? (artifact.metadata as any)?.conversationId
    ?? (artifact.metadata as any)?.conversation_id;
  const metadata = artifact.metadata && typeof artifact.metadata === 'object'
    ? { ...artifact.metadata }
    : {};
  if (typeof sourceConversationId === 'string' && sourceConversationId.trim()) {
    metadata.conversationId = sourceConversationId.trim();
  }

  return {
    artifactId,
    version: versionOf(artifact) ?? 1,
    name: resolveArtifactName(artifact, decoded),
    type: typeof artifact.type === 'string' ? artifact.type : '',
    description: typeof artifact.description === 'string' ? artifact.description : '',
    contents: contents as number[],
    tags: Array.isArray(artifact.tags) ? artifact.tags : [],
    createdAt: typeof artifact.createdAt === 'string' ? artifact.createdAt : new Date().toISOString(),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

function unwrapArtifacts(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ['data', 'artifacts', 'items', 'results']) {
    if (Array.isArray(value[key])) return value[key];
    if (isRecord(value[key])) return unwrapArtifacts(value[key]);
  }
  if (artifactIdOf(value)) return [value];
  return Object.values(value).flatMap((entry) => {
    if (Array.isArray(entry)) return entry;
    return isRecord(entry) ? unwrapArtifacts(entry) : [];
  });
}

function artifactIdOf(artifact: Partial<ArtifactLibraryRecord>): string {
  const raw = artifact.artifactId || artifact.key || (artifact as any).id;
  return typeof raw === 'string' ? raw : '';
}

/**
 * The server derives both ids from the name and version — key `20261026/Plan:v2`,
 * artifactId `Plan:v2-20261026` — and its list endpoint returns no `version` field.
 */
export function versionFromArtifactKey(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/:v(\d+)(?:-\d{8})?$/);
  const version = match ? Number(match[1]) : NaN;
  return Number.isFinite(version) && version > 0 ? version : undefined;
}

function versionOf(artifact: Partial<ArtifactLibraryRecord>): number | undefined {
  const version = Number(artifact.version);
  if (Number.isFinite(version) && version > 0) return version;
  return versionFromArtifactKey(artifact.key) ?? versionFromArtifactKey(artifact.artifactId);
}

export function artifactStableKey(artifact: Partial<ArtifactLibraryRecord>): string {
  return `${artifactIdOf(artifact)}::${versionOf(artifact) ?? 1}`;
}

export function artifactDisplayName(artifact: Partial<ArtifactLibraryRecord>): string {
  const explicit = typeof artifact.name === 'string' ? artifact.name.trim() : '';
  if (explicit) return explicit;

  const description = typeof artifact.description === 'string' ? artifact.description.trim() : '';
  if (description) return description.slice(0, 80).trim();

  const type = typeof artifact.type === 'string' ? artifact.type.trim() : '';
  if (type) return `${type.charAt(0).toUpperCase()}${type.slice(1)} Artifact`;

  return 'Artifact';
}

export function extractArtifactTitle(content: string, nuiType: ReturnType<typeof resolveNUIType>): string {
  if (nuiType !== 'document') return '';
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim().slice(0, 120) ?? '';
}

export function resolveArtifactName(
  artifact: Partial<ArtifactLibraryRecord>,
  decodedContent = decodeArtifactContents(artifact.contents),
): string {
  const explicit = typeof artifact.name === 'string' ? artifact.name.trim() : '';
  if (explicit) return explicit;

  const declaredType = typeof artifact.type === 'string' ? artifact.type.trim() : '';
  const nuiType = declaredType ? resolveNUIType(declaredType) : sniffContentType(decodedContent);
  const title = extractArtifactTitle(decodedContent, nuiType);
  if (title) return title;

  const description = typeof artifact.description === 'string' ? artifact.description.trim() : '';
  if (description) return description.slice(0, 80).trim();

  if (declaredType) {
    return `${declaredType.charAt(0).toUpperCase()}${declaredType.slice(1)} Artifact`;
  }
  return 'Artifact';
}

export function decodeArtifactContents(contents: unknown): string {
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents) || contents.length === 0) return '';
  if (!contents.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return '';
  try {
    return lzwUncompress(contents as number[]);
  } catch {
    return '';
  }
}

export function normalizeArtifactRecord(value: unknown): ArtifactLibraryRecord | null {
  if (!isRecord(value)) return null;
  const artifactId = artifactIdOf(value);
  if (!artifactId) return null;
  // Content is deliberately NOT required here: the server's list endpoint
  // returns lightweight metadata (id/key, name, description, createdAt) and
  // omits the compressed `contents` blob entirely — the same shape the
  // existing ArtifactsSaved.tsx dropdown already relies on, fetching full
  // content lazily via getArtifact(key) only when a record is opened.
  // Rejecting records without usable content here would silently drop every
  // real saved artifact from the list.
  const rawContents = Array.isArray(value.contents) || typeof value.contents === 'string' ? value.contents : [];

  const record = {
    ...value,
    artifactId,
    version: versionOf(value) ?? 1,
    name: typeof value.name === 'string' ? value.name : '',
    description: typeof value.description === 'string' ? value.description : '',
    type: typeof value.type === 'string' ? value.type : '',
    tags: Array.isArray(value.tags) ? value.tags : [],
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    contents: rawContents,
  } as ArtifactLibraryRecord;

  const explicitConversationId = value.conversationId
    ?? value.conversation_id
    ?? value.metadata?.conversationId
    ?? value.metadata?.conversation_id
    ?? value.sourceConversationId
    ?? value.source?.conversationId;
  if (typeof explicitConversationId === 'string' && explicitConversationId.trim()) {
    record.conversationId = explicitConversationId.trim();
    record.metadata = {
      ...(record.metadata ?? {}),
      conversationId: explicitConversationId.trim(),
    };
  }
  return record;
}

export function normalizeArtifactRecords(value: unknown): ArtifactLibraryRecord[] {
  const byKey = new Map<string, ArtifactLibraryRecord>();
  for (const entry of unwrapArtifacts(value)) {
    const normalized = normalizeArtifactRecord(entry);
    if (normalized) byKey.set(artifactStableKey(normalized), normalized);
  }
  return Array.from(byKey.values());
}

function findVersionIndex(list: Artifact[], version?: number): number {
  if (!list.length) return -1;
  if (version !== undefined) {
    const exact = list.findIndex((entry) => entry.version === version);
    if (exact >= 0) return exact;
  }
  return list.length - 1;
}

function messageReferencesArtifact(conversation: Conversation, artifactId: string, version?: number): boolean {
  return (conversation.messages ?? []).some((message) =>
    Array.isArray(message.data?.artifacts) && message.data.artifacts.some((detail: any) =>
      detail?.artifactId === artifactId && (version === undefined || detail.version === undefined || detail.version === version),
    ),
  );
}

export function findArtifactSource(
  artifact: Partial<ArtifactLibraryRecord>,
  conversations: Conversation[] = [],
): ArtifactSourceMatch {
  const artifactId = artifactIdOf(artifact);
  if (!artifactId) return { confidence: 'none' };
  const version = versionOf(artifact);
  const explicitId = artifact.conversationId || (artifact.metadata as any)?.conversationId;

  if (explicitId) {
    const conversation = conversations.find((entry) => entry.id === explicitId);
    return {
      conversation,
      conversationId: explicitId,
      versionIndex: conversation ? findVersionIndex(conversation.artifacts?.[artifactId] ?? [], version) : undefined,
      confidence: 'explicit',
    };
  }

  for (const conversation of conversations) {
    const versions = conversation.artifacts?.[artifactId] ?? [];
    const versionIndex = findVersionIndex(versions, version);
    if (versionIndex >= 0) {
      const matched = version === undefined || versions[versionIndex]?.version === version;
      if (matched) return { conversation, conversationId: conversation.id, versionIndex, confidence: 'artifact' };
    }
  }

  for (const conversation of conversations) {
    if (messageReferencesArtifact(conversation, artifactId, version)) {
      return { conversation, conversationId: conversation.id, confidence: 'message' };
    }
  }

  return { confidence: 'none' };
}

/**
 * When an artifact was generated. The server's `createdAt` is date-only
 * ("Oct 26, 2026"), so the exact time comes from `savedAt` where it exists; the
 * date prefix of the storage key (`20261026/…`) is the last resort.
 */
export function artifactCreated(artifact: Partial<ArtifactLibraryRecord>): ArtifactCreated | undefined {
  if (typeof artifact.savedAt === 'string') {
    const ms = Date.parse(artifact.savedAt);
    if (Number.isFinite(ms)) return { ms, hasTime: true };
  }
  if (typeof artifact.createdAt === 'string' && artifact.createdAt.trim()) {
    const ms = Date.parse(artifact.createdAt);
    if (Number.isFinite(ms)) return { ms, hasTime: /\d{1,2}:\d{2}/.test(artifact.createdAt) };
  }
  const keyDate = typeof artifact.key === 'string' ? artifact.key.match(/(?:^|\/)(\d{4})(\d{2})(\d{2})\//) : null;
  if (keyDate) {
    const ms = new Date(Number(keyDate[1]), Number(keyDate[2]) - 1, Number(keyDate[3])).getTime();
    if (Number.isFinite(ms)) return { ms, hasTime: false };
  }
  return undefined;
}

/** Date (and time, when the record has one) an artifact was generated. */
export function formatArtifactCreated(created?: ArtifactCreated): { date: string; time: string; iso: string; title: string } | null {
  if (!created) return null;
  const when = new Date(created.ms);
  if (Number.isNaN(when.getTime())) return null;
  const date = when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = created.hasTime ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  return { date, time, iso: when.toISOString(), title: 'Generated ' + date + (time ? ' at ' + time : '') };
}

/** 2 = has an exact time, 1 = date only, 0 = no readable date. */
const artifactDateTier = (item: ArtifactLibraryItem): number =>
  item.created ? (item.created.hasTime ? 2 : 1) : 0;

/**
 * Newest first, in three tiers: artifacts with an exact time (saved after the server
 * began stamping `savedAt`) come before date-only ones (older), which come before
 * records with no readable date. Within a tier, newest first; most date-only records
 * share a day, so ties fall back to the server list's order, which is the order they
 * were saved in (later = newer).
 */
export function sortArtifactLibraryItemsNewestFirst(items: ArtifactLibraryItem[]): ArtifactLibraryItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const tierDiff = artifactDateTier(b.item) - artifactDateTier(a.item);
      if (tierDiff) return tierDiff;
      const aMs = a.item.created?.ms ?? 0;
      const bMs = b.item.created?.ms ?? 0;
      if (aMs !== bMs) return aMs > bMs ? -1 : 1;
      return b.index - a.index;
    })
    .map(({ item }) => item);
}

const versionRefKey = (name: unknown, createdAt: unknown, version: unknown) =>
  `${String(name ?? '')}|${String(createdAt ?? '')}|${Number(version)}`;

/**
 * Saved records from before the server stored `lineageId` can still be tied to their
 * artifact through any loaded chat that holds it: a chat lists every version under the
 * artifact's id, and each version matches its saved record by name + createdAt + version
 * (see artifactRename). Refs that point at more than one artifact are left out.
 */
function lineageIndexFromConversations(conversations: Conversation[]): Map<string, string> {
  const index = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const conversation of conversations) {
    for (const [artifactId, versions] of Object.entries(conversation.artifacts ?? {})) {
      if (!Array.isArray(versions)) continue;
      for (const version of versions) {
        const ref = versionRefKey(version.name, version.createdAt, version.version);
        const existing = index.get(ref);
        if (existing === undefined) index.set(ref, artifactId);
        else if (existing !== artifactId) ambiguous.add(ref);
      }
    }
  }
  ambiguous.forEach((ref) => index.delete(ref));
  return index;
}

/**
 * What ties the saved versions of one artifact together — the chat's artifact id, which
 * every version shares even when an edit gives it a new title. Newer saves carry it as
 * `lineageId`; older ones get it from a loaded chat when possible, else fall back to the
 * name (the Rename button renames every version, so it stays shared). A copy someone
 * shared is kept apart from your own.
 */
export function artifactGroupKey(artifact: Partial<ArtifactLibraryRecord>, chatLineage?: string): string {
  const owner = typeof artifact.sharedBy === 'string' ? artifact.sharedBy : '';
  const lineage = typeof artifact.lineageId === 'string' && artifact.lineageId ? artifact.lineageId : chatLineage;
  if (lineage) return `lineage:${owner}:${lineage}`;
  const name = typeof artifact.name === 'string' ? artifact.name.trim().toLowerCase() : '';
  if (name) return `name:${owner}:${name}`;
  return `record:${artifactStableKey(artifact)}`;
}

const versionNumber = (item: ArtifactLibraryItem): number => Number(item.artifact.version) || 0;
/**
 * One item per artifact: its highest version, with every version attached. Newest first.
 *
 * Saves without a lineage are tied together by name, which can also catch unrelated
 * artifacts that share a title. One artifact never has two records of the same version,
 * so a repeated version number starts a separate stack.
 */
export function groupArtifactLibraryItems(
  items: ArtifactLibraryItem[],
  conversations: Conversation[] = [],
): ArtifactLibraryItem[] {
  const chatLineage = lineageIndexFromConversations(conversations);
  // Map insertion order follows the newest-first sort, so each group sits where its
  // most recently saved version would.
  const groups = new Map<string, ArtifactLibraryItem[]>();
  for (const item of sortArtifactLibraryItemsNewestFirst(items)) {
    const { name, createdAt, version } = item.artifact;
    const baseKey = artifactGroupKey(item.artifact, chatLineage.get(versionRefKey(name, createdAt, version)));
    let key = baseKey;
    if (baseKey.startsWith('name:')) {
      for (let n = 2; groups.get(key)?.some((other) => versionNumber(other) === versionNumber(item)); n++) {
        key = `${baseKey}#${n}`;
      }
    }
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const groupedBy = key.startsWith('lineage:') ? 'lineage' : key.startsWith('name:') ? 'name' : 'record';
    // Equal versions (should not happen) fall back to save time so the newest is last.
    const versions = group
      .map((item) => ({ ...item, versions: [] }))
      .sort((a, b) => versionNumber(a) - versionNumber(b) || (a.created?.ms ?? 0) - (b.created?.ms ?? 0));
    return { ...versions[versions.length - 1], versions, groupedBy };
  });
}

export function buildArtifactLibraryItems(
  rawArtifacts: unknown,
  conversations: Conversation[] = [],
): ArtifactLibraryItem[] {
  const items = normalizeArtifactRecords(rawArtifacts).map((artifact): ArtifactLibraryItem => {
    const content = decodeArtifactContents(artifact.contents);
    const hasContent = isUsableArtifactContent(content);
    const declared = resolveNUIType(artifact.type);
    const nuiType = !artifact.type && hasContent ? sniffContentType(content) : declared;
    return {
      artifact,
      stableKey: artifactStableKey(artifact),
      name: artifactDisplayName(artifact),
      content,
      hasContent,
      nuiType,
      source: findArtifactSource(artifact, conversations),
      created: artifactCreated(artifact),
      versions: [],
    };
  });
  return groupArtifactLibraryItems(items, conversations);
}

/**
 * Merge a fully-loaded artifact (e.g. from `getArtifact(key)`) into a
 * previously metadata-only library item, decoding its content and
 * recomputing `hasContent`/`nuiType`. Used by the Library view to lazily
 * hydrate a row when the user opens it.
 */
export function hydrateArtifactLibraryItem(
  item: ArtifactLibraryItem,
  fullArtifact: Partial<ArtifactLibraryRecord>,
  conversations: Conversation[] = [],
): ArtifactLibraryItem {
  const artifact: ArtifactLibraryRecord = {
    ...item.artifact,
    ...fullArtifact,
    metadata: {
      ...(item.artifact.metadata ?? {}),
      ...(fullArtifact.metadata ?? {}),
    },
  } as ArtifactLibraryRecord;
  const normalized = normalizeArtifactRecord(artifact) ?? artifact;
  const content = decodeArtifactContents(normalized.contents);
  const hasContent = isUsableArtifactContent(content);
  const declared = resolveNUIType(normalized.type);
  const nuiType = !normalized.type && hasContent ? sniffContentType(content) : declared;
  const hydratedSource = findArtifactSource(normalized, conversations);
  const source = hydratedSource.confidence === 'none' && item.source.confidence !== 'none'
    ? item.source
    : hydratedSource;
  return {
    ...item,
    artifact: normalized,
    content,
    hasContent,
    nuiType,
    name: artifactDisplayName(normalized) || item.name,
    source,
    created: artifactCreated(normalized) ?? item.created,
  };
}

export function renameArtifactInConversation(
  conversation: Conversation,
  artifactId: string,
  version: number | undefined,
  name: string,
  replacementVersions?: Artifact[],
): Conversation {
  const artifacts = { ...(conversation.artifacts ?? {}) };
  const existing = replacementVersions ?? artifacts[artifactId] ?? [];
  artifacts[artifactId] = existing.map((entry) =>
    entry.artifactId === artifactId && (version === undefined || entry.version === version)
      ? { ...entry, name }
      : entry,
  );

  const messages = (conversation.messages ?? []).map((message) => {
    const details = message.data?.artifacts;
    if (!Array.isArray(details)) return message;
    const nextDetails = details.map((detail: any) =>
      detail?.artifactId === artifactId && (version === undefined || detail.version === undefined || detail.version === version)
        ? { ...detail, name }
        : detail,
    );
    return { ...message, data: { ...(message.data ?? {}), artifacts: nextDetails } };
  });

  return { ...conversation, artifacts, messages };
}

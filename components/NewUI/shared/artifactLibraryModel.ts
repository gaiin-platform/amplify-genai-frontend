import type { Artifact } from '@/types/artifacts';
import { resolveNUIType, sniffContentType } from '@/types/artifacts';
import type { Conversation } from '@/types/chat';
import { lzwUncompress } from '@/utils/app/lzwCompression';

export type ArtifactLibraryRecord = Omit<Artifact, 'contents'> & {
  contents: number[] | string;
  key?: string;
  conversationId?: string;
  sharedBy?: string;
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

  return {
    artifactId,
    version: versionOf(artifact) ?? 1,
    name: resolveArtifactName(artifact, decoded),
    type: typeof artifact.type === 'string' ? artifact.type : '',
    description: typeof artifact.description === 'string' ? artifact.description : '',
    contents: contents as number[],
    tags: Array.isArray(artifact.tags) ? artifact.tags : [],
    createdAt: typeof artifact.createdAt === 'string' ? artifact.createdAt : new Date().toISOString(),
    ...(artifact.metadata && typeof artifact.metadata === 'object' ? { metadata: artifact.metadata } : {}),
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

function versionOf(artifact: Partial<ArtifactLibraryRecord>): number | undefined {
  const version = Number(artifact.version);
  return Number.isFinite(version) && version > 0 ? version : undefined;
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

  const explicitConversationId = value.conversationId ?? value.metadata?.conversationId;
  if (typeof explicitConversationId === 'string' && explicitConversationId.trim()) {
    record.conversationId = explicitConversationId.trim();
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

export function buildArtifactLibraryItems(
  rawArtifacts: unknown,
  conversations: Conversation[] = [],
): ArtifactLibraryItem[] {
  return normalizeArtifactRecords(rawArtifacts).map((artifact) => {
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
    };
  });
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
): ArtifactLibraryItem {
  const artifact: ArtifactLibraryRecord = { ...item.artifact, ...fullArtifact } as ArtifactLibraryRecord;
  const content = decodeArtifactContents(artifact.contents);
  const hasContent = isUsableArtifactContent(content);
  const declared = resolveNUIType(artifact.type);
  const nuiType = !artifact.type && hasContent ? sniffContentType(content) : declared;
  return {
    ...item,
    artifact,
    content,
    hasContent,
    nuiType,
    name: artifactDisplayName(artifact) || item.name,
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

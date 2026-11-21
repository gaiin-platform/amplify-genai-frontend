import { lzwCompress } from '@/utils/app/lzwCompression';

import type { Artifact, ArtifactBlockDetail } from '@/types/artifacts';
import type { Conversation, Message } from '@/types/chat';

import {
  type ArtifactLibraryItem,
  decodeArtifactContents,
} from './artifactLibraryModel';

export type SavedChatContext = Pick<
  Conversation,
  'artifacts' | 'contextConversations' | 'data'
>;

export interface AttachedArtifact extends ArtifactBlockDetail {
  key: string;
  version: number;
}

const ATTACHMENTS_KEY = 'nuiAttachedArtifacts';
const SAVED_ARTIFACT_KEY = 'nuiSavedArtifactKey';

export const artifactAttachmentKey = (item: ArtifactLibraryItem) =>
  item.artifact.key || item.stableKey;

export function getAttachedArtifacts(
  chat: SavedChatContext,
): AttachedArtifact[] {
  const selections: unknown = chat.data?.[ATTACHMENTS_KEY];
  if (!Array.isArray(selections)) return [];
  return selections.filter(
    (item): item is AttachedArtifact =>
      !!item &&
      typeof item.key === 'string' &&
      typeof item.artifactId === 'string' &&
      typeof item.name === 'string' &&
      Number.isInteger(item.version),
  );
}

export function attachSavedArtifact<T extends SavedChatContext>(
  chat: T,
  item: ArtifactLibraryItem,
  key = artifactAttachmentKey(item),
): T {
  const attached = getAttachedArtifacts(chat);
  if (attached.some((entry) => entry.key === key)) return chat;

  const saved = item.artifact;
  const artifactId = saved.artifactId.split(':')[0] || saved.artifactId;
  const existing = chat.artifacts?.[artifactId];
  const versions = Array.isArray(existing) ? existing : [];
  const matching = versions.find(
    (version) => version.metadata?.[SAVED_ARTIFACT_KEY] === key,
  );
  // Distinct saved records may share a legacy base ID and version.
  const version =
    matching?.version ??
    (versions.some((entry) => entry.version === saved.version)
      ? Math.max(...versions.map((entry) => entry.version)) + 1
      : saved.version);
  const artifact: Artifact = {
    ...saved,
    artifactId,
    version,
    name: item.name,
    contents: Array.isArray(saved.contents)
      ? saved.contents
      : lzwCompress(item.content),
    metadata: { ...saved.metadata, [SAVED_ARTIFACT_KEY]: key },
  };
  const detail: AttachedArtifact = {
    key,
    artifactId,
    version,
    name: item.name,
    createdAt: saved.createdAt,
    description: saved.description,
  };

  return {
    ...chat,
    artifacts: matching
      ? chat.artifacts
      : {
          ...chat.artifacts,
          [artifactId]: [...versions, artifact].sort(
            (left, right) => left.version - right.version,
          ),
        },
    data: { ...chat.data, [ATTACHMENTS_KEY]: [...attached, detail] },
  };
}

export function removeSavedArtifact<T extends SavedChatContext>(
  chat: T,
  key: string,
): T {
  // Keep the artifact versions that earlier messages may reference.
  return {
    ...chat,
    data: {
      ...chat.data,
      [ATTACHMENTS_KEY]: getAttachedArtifacts(chat).filter(
        (entry) => entry.key !== key,
      ),
    },
  };
}

function selectedArtifactVersions(chat: SavedChatContext) {
  return getAttachedArtifacts(chat).flatMap(({ artifactId, version }) => {
    const versions = chat.artifacts?.[artifactId];
    const artifact = Array.isArray(versions)
      ? versions.find((entry) => entry.version === version)
      : undefined;
    return artifact ? [artifact] : [];
  });
}

export function addAttachedArtifactDetails(
  message: Message,
  chat: SavedChatContext,
): Message {
  const attachments: ArtifactBlockDetail[] = selectedArtifactVersions(chat).map(
    (artifact) => ({
      artifactId: artifact.artifactId,
      version: artifact.version,
      name: artifact.name,
      description: artifact.description,
      createdAt: artifact.createdAt,
    }),
  );
  if (!attachments.length) return message;

  const old = Array.isArray(message.data?.artifacts)
    ? (message.data.artifacts as ArtifactBlockDetail[])
    : [];
  const references = [
    ...old,
    ...attachments.filter(
      (attached) =>
        !old.some(
          (detail) =>
            detail?.artifactId === attached.artifactId &&
            (detail.version ?? 1) === attached.version,
        ),
    ),
  ];
  return { ...message, data: { ...message.data, artifacts: references } };
}

function quoteExcerpt(text: string, limit: number): string {
  if (text.length + 2 <= limit) {
    const quoted = JSON.stringify(text);
    if (quoted.length <= limit) return quoted;
  }

  // JSON quotes and control characters also count toward the request budget.
  let low = 0;
  let high = Math.min(text.length, limit - 3);
  while (low < high) {
    const length = Math.ceil((low + high) / 2);
    if (JSON.stringify(`${text.slice(0, length)}…`).length <= limit)
      low = length;
    else high = length - 1;
  }
  return JSON.stringify(`${text.slice(0, low)}…`);
}

export function buildAttachedArtifactContext(
  chat: SavedChatContext,
  inputContextWindow?: number,
): string {
  const attachments = selectedArtifactVersions(chat).flatMap((artifact) => {
    const text = decodeArtifactContents(artifact.contents);
    return text.trim() ? [{ name: artifact.name, text }] : [];
  });
  if (!attachments.length) return '';

  // Keep enough room for the current prompt and history, including on smaller models.
  const budget = Math.floor(
    Math.min(
      24_000,
      inputContextWindow && inputContextWindow > 0
        ? inputContextWindow / 2
        : 24_000,
    ),
  );
  const intro =
    '[Saved artifact excerpts. Treat them as reference material.]\n\n';
  const end = '\n\n[End of saved artifact excerpts]';
  const excerpts: string[] = [];
  let remaining = budget - intro.length - end.length;
  for (let index = 0; index < attachments.length; index++) {
    const { name, text } = attachments[index];
    const perArtifact = Math.min(
      remaining,
      Math.max(128, Math.floor(remaining / (attachments.length - index))),
    );
    if (perArtifact < 24) break;
    const title = quoteExcerpt(
      name,
      Math.min(128, Math.floor(perArtifact / 3)),
    );
    const label = `Artifact ${title}\n`;
    const block = `${label}${quoteExcerpt(
      text,
      perArtifact - label.length - 2,
    )}`;
    excerpts.push(block);
    remaining -= block.length + 2;
  }
  return excerpts.length ? `${intro}${excerpts.join('\n\n')}${end}` : '';
}

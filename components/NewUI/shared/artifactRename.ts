/**
 * Renaming saved artifacts — the pieces the chat panel and the Library share.
 *
 * Why this isn't just `saveArtifact`: the server derives an artifact's storage key
 * from its name, so saving under a new name creates a second artifact instead of
 * renaming. `POST /artifacts/rename` changes only the display name (keys stay put),
 * and takes every version's key at once so all versions of an artifact are renamed
 * together.
 *
 * The chat's own artifact ids (uuids) are never sent to the server, which makes up
 * its own. A chat version is therefore matched to its saved record by what both
 * sides share: name + createdAt + version. Pure helpers only, apart from
 * `renameArtifactsRemote`.
 */
import type { Artifact } from '@/types/artifacts';
import type { Conversation } from '@/types/chat';
import { doRequestOp } from '@/services/doRequestOp';

import { versionFromArtifactKey } from './artifactLibraryModel';

/** Mirrors the backend's limit (`MAX_ARTIFACT_NAME_LENGTH`). */
export const MAX_ARTIFACT_NAME_LENGTH = 200;

/** What identifies one version of an artifact on both the chat and the server side. */
export type ArtifactVersionRef = Pick<Artifact, 'name' | 'createdAt' | 'version'>;

export type ArtifactGroup = { artifactId: string; versions: Artifact[] };

/** Trim and drop control characters; '' when nothing usable is left. */
export function normalizeArtifactName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, MAX_ARTIFACT_NAME_LENGTH)
    .trim();
}

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** The saved-artifact key for one chat version, or undefined if it was never saved. */
export function findSavedArtifactKey(
  savedArtifacts: unknown,
  ref: ArtifactVersionRef,
): string | undefined {
  if (!Array.isArray(savedArtifacts)) return undefined;
  const entry = savedArtifacts.find(
    (candidate) =>
      isRecord(candidate) &&
      typeof candidate.key === 'string' &&
      candidate.name === ref.name &&
      candidate.createdAt === ref.createdAt &&
      versionFromArtifactKey(candidate.key) === Number(ref.version),
  );
  return entry?.key;
}

/** Saved keys for every version that has one, de-duplicated. */
export function resolveArtifactRenameKeys(
  savedArtifacts: unknown,
  versions: ArtifactVersionRef[],
): string[] {
  const keys = versions
    .map((version) => findSavedArtifactKey(savedArtifacts, version))
    .filter((key): key is string => Boolean(key));
  return Array.from(new Set(keys));
}

/**
 * The version list in `conversation.artifacts` that contains `ref` — i.e. every
 * version of the artifact a saved record belongs to.
 */
export function findConversationArtifactGroup(
  conversation: Pick<Conversation, 'artifacts'> | null | undefined,
  ref: ArtifactVersionRef,
): ArtifactGroup | null {
  for (const [artifactId, versions] of Object.entries(conversation?.artifacts ?? {})) {
    if (!Array.isArray(versions)) continue;
    const found = versions.some(
      (entry) =>
        entry.name === ref.name &&
        entry.createdAt === ref.createdAt &&
        Number(entry.version) === Number(ref.version),
    );
    if (found) return { artifactId, versions };
  }
  return null;
}

/** Saved-artifact list with the given keys carrying the new name. */
export function applyRenameToSavedArtifacts(
  savedArtifacts: unknown,
  keys: string[],
  name: string,
): any[] {
  if (!Array.isArray(savedArtifacts)) return [];
  const renamed = new Set(keys);
  return savedArtifacts.map((entry) =>
    isRecord(entry) && renamed.has(entry.key) ? { ...entry, name } : entry,
  );
}

export type RenameArtifactsResult = {
  success: boolean;
  /** Keys the server actually renamed. */
  renamed: string[];
  message?: string;
};

export async function renameArtifactsRemote(
  keys: string[],
  name: string,
): Promise<RenameArtifactsResult> {
  if (!keys.length) return { success: false, renamed: [], message: 'Artifact has not been saved yet' };
  try {
    const result = await doRequestOp({
      method: 'POST',
      path: '/artifacts',
      op: '/rename',
      data: { keys, name },
      service: 'artifacts',
    });
    if (!result?.success) {
      return { success: false, renamed: [], message: result?.message };
    }
    const renamed: string[] = Array.isArray(result.data?.renamed)
      ? result.data.renamed
          .map((entry: any) => entry?.key)
          .filter((key: unknown): key is string => typeof key === 'string')
      : keys;
    return { success: true, renamed };
  } catch (error) {
    return { success: false, renamed: [], message: error instanceof Error ? error.message : undefined };
  }
}

/**
 * Loads an assistant's icon image for display.
 *
 * Icons are uploaded as base64 text (see `utils/app/files#fetchImageFromPresignedUrl`, which the
 * published page uses). That helper `alert()`s on failure — fine for one page, wrong for a list where
 * a Shared-with-me assistant's icon can legitimately be unreadable — so this re-does the decode quietly.
 *
 * One object URL per icon is kept for the session (a list re-mounts its rows on every tab switch), and a
 * failure is remembered briefly so a row that cannot load does not re-request on each render.
 * No React imports.
 */

import { getFileDownloadUrl } from '@/services/fileService';
import type { AssistantIconRef } from '@/components/NewUI/views/assistant/assistantIconModel';

const FAILURE_TTL_MS = 60_000;

interface CacheEntry {
    promise: Promise<string | null>;
    /** Set once the load failed; the entry is retried after `FAILURE_TTL_MS`. */
    failedAt?: number;
}

const cache = new Map<string, CacheEntry>();

const cacheKey = (icon: AssistantIconRef) => `${icon.groupId ?? ''}::${icon.key}`;

/** Base64 text → bytes. Falls back to the raw bytes if the payload isn't base64. */
export const decodeIconPayload = (buffer: ArrayBuffer): Uint8Array => {
    const text = new TextDecoder().decode(buffer).trim();
    try {
        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    } catch {
        return new Uint8Array(buffer);
    }
};

const fetchIconUrl = async (icon: AssistantIconRef): Promise<string | null> => {
    try {
        const link = await getFileDownloadUrl(icon.key, icon.groupId);
        if (!link.success || !link.downloadUrl) return null;
        const response = await fetch(link.downloadUrl);
        if (!response.ok) return null;
        const bytes = decodeIconPayload(await response.arrayBuffer());
        if (bytes.length === 0) return null;
        return URL.createObjectURL(new Blob([bytes as BlobPart], { type: icon.type || 'image/png' }));
    } catch {
        return null;
    }
};

/** An object URL for the icon, or `null` when it cannot be read (no access, deleted, not an image…). */
export const loadAssistantIconUrl = (icon: AssistantIconRef): Promise<string | null> => {
    const id = cacheKey(icon);
    const hit = cache.get(id);
    if (hit && (hit.failedAt === undefined || Date.now() - hit.failedAt < FAILURE_TTL_MS)) return hit.promise;

    const entry: CacheEntry = { promise: Promise.resolve(null) };
    entry.promise = fetchIconUrl(icon).then((url) => {
        if (url === null) entry.failedAt = Date.now();
        return url;
    });
    cache.set(id, entry);
    return entry.promise;
};

/** Test hook. */
export const resetAssistantIconCache = () => cache.clear();

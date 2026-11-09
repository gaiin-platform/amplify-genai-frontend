/**
 * sharedItemClassifier.ts — pure TS (no React) module.
 *
 * Classifies incoming share bundles by content type so that each "Shared with Me"
 * section only renders items of the correct type:
 *   conversation    → ChatsListView "Shared with Me"
 *   assistant       → NewAssistantsView "Shared with Me"
 *   prompt-template → PromptTemplatesSection "Shared with Me"
 *
 * Performance:
 *   - Module-level promise cache per user: only the first section to mount pays the
 *     O(n) cost of classifying all items; subsequent sections receive the same promise.
 *   - localStorage persistence: keys already classified on a previous visit are not
 *     re-loaded (their type is read from the cache instead).
 *
 * Usage:
 *   import { getClassifiedSharedItems, invalidateSharedItemsCache } from './sharedItemClassifier';
 *
 *   // After a successful share or import:
 *   invalidateSharedItemsCache();
 *
 *   // In a component (call once, all sections share the same promise):
 *   const { conversations, assistants, promptTemplates } = await getClassifiedSharedItems(user);
 */

import { ShareItem, ExportFormatV4 } from '@/types/export';
import { getSharedItems, loadSharedItem } from '@/services/shareService';
import { isAssistant } from '@/utils/app/assistants';

/** ShareItem extended with the optional `contentType` field the backend now includes. */
interface ShareItemEnriched extends ShareItem {
  contentType?: string;
}

// ── Public types ──────────────────────────────────────────────────────────────

export type ShareBundleType = 'conversation' | 'assistant' | 'prompt-template' | 'unknown';

/**
 * A ShareItem enriched with its classified content type and, when freshly loaded,
 * the full bundle.  `bundle` is `null` when the type was read from the localStorage
 * cache (the caller must call `loadSharedItem` before importing the content).
 */
export interface ClassifiedShareItem {
  item: ShareItem;
  bundleType: ShareBundleType;
  /** Non-null for freshly loaded items; null for items whose type was cached. */
  bundle: ExportFormatV4 | null;
}

export interface ClassifiedShareItems {
  conversations: ClassifiedShareItem[];
  assistants: ClassifiedShareItem[];
  promptTemplates: ClassifiedShareItem[];
}

// ── Module-level cache ────────────────────────────────────────────────────────

const LS_CACHE_KEY = 'amplify_share_type_cache';

/** Current in-flight (or already resolved) classification promise. */
let pending: Promise<ClassifiedShareItems> | null = null;
/** The `user` identifier the current `pending` promise was created for. */
let pendingUser: string | null = null;

// ── localStorage helpers ──────────────────────────────────────────────────────

function readLSCache(): Record<string, ShareBundleType> {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ShareBundleType>;
  } catch {
    return {};
  }
}

function writeLSCache(cache: Record<string, ShareBundleType>): void {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable (quota exceeded, private browsing, etc.) — not fatal.
  }
}

// ── Classification logic ──────────────────────────────────────────────────────

function classifyBundle(bundle: ExportFormatV4): ShareBundleType {
  // Conversations take priority — a bundle with both history and prompts is a chat.
  if (bundle.history && bundle.history.length > 0) return 'conversation';
  if (bundle.prompts && bundle.prompts.some(isAssistant)) return 'assistant';
  if (bundle.prompts && bundle.prompts.some((p) => !isAssistant(p))) return 'prompt-template';
  return 'unknown';
}

// ── Core async fetch ──────────────────────────────────────────────────────────

async function doFetch(user: string): Promise<ClassifiedShareItems> {
  const empty: ClassifiedShareItems = { conversations: [], assistants: [], promptTemplates: [] };

  const result = await getSharedItems();
  if (!result.success) {
    throw new Error('getSharedItems returned success:false');
  }

  // Only show items the current user received (not items they sent).
  const items = (result.items as ShareItemEnriched[]).filter((item) => item.sharedBy !== user);

  const lsCache = readLSCache();
  const updatedCache: Record<string, ShareBundleType> = { ...lsCache };

  const needsLoad: ShareItemEnriched[] = [];
  const alreadyCached: Array<{ item: ShareItemEnriched; bundleType: ShareBundleType }> = [];

  for (const item of items) {
    // If the backend already told us the type, use it — no bundle load needed.
    if (item.contentType && item.contentType !== 'unknown') {
      const bundleType = item.contentType as ShareBundleType;
      alreadyCached.push({ item, bundleType });
      // Also update localStorage cache so future sessions benefit
      updatedCache[item.key] = bundleType;
    } else if (updatedCache[item.key]) {
      alreadyCached.push({ item, bundleType: updatedCache[item.key] });
    } else {
      needsLoad.push(item);
    }
  }

  // Load uncached bundles in parallel.
  type LoadResult =
    | { item: ShareItemEnriched; bundleType: ShareBundleType; bundle: ExportFormatV4; persist: true }
    | { item: ShareItemEnriched; bundleType: 'unknown'; bundle: null; persist: false };

  const loadedResults = await Promise.allSettled<LoadResult>(
    needsLoad.map(async (item): Promise<LoadResult> => {
      try {
        const res = await loadSharedItem(item.key);
        if (!res.success) {
          return { item, bundleType: 'unknown', bundle: null, persist: false };
        }
        const bundle = JSON.parse(res.item) as ExportFormatV4;
        const bundleType = classifyBundle(bundle);
        return { item, bundleType, bundle, persist: true };
      } catch {
        return { item, bundleType: 'unknown', bundle: null, persist: false };
      }
    }),
  );

  const allClassified: ClassifiedShareItem[] = [];

  // Cached items — bundle is null (will be loaded on-demand by the consumer).
  for (const { item, bundleType } of alreadyCached) {
    allClassified.push({ item, bundleType, bundle: null });
  }

  // Freshly loaded items — update localStorage cache for successfully typed items.
  for (const settled of loadedResults) {
    if (settled.status !== 'fulfilled') continue;
    const { item, bundleType, bundle, persist } = settled.value;
    allClassified.push({ item, bundleType, bundle });
    if (persist) {
      updatedCache[item.key] = bundleType;
    }
  }

  writeLSCache(updatedCache);

  // Sort newest first.
  allClassified.sort(
    (a, b) => new Date(b.item.sharedAt).getTime() - new Date(a.item.sharedAt).getTime(),
  );

  return {
    conversations: allClassified.filter((c) => c.bundleType === 'conversation'),
    assistants: allClassified.filter((c) => c.bundleType === 'assistant'),
    promptTemplates: allClassified.filter((c) => c.bundleType === 'prompt-template'),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Clears the module-level promise cache so the next `getClassifiedSharedItems` call
 * re-fetches and re-classifies everything.  Call this after a successful share or import.
 */
export function invalidateSharedItemsCache(): void {
  pending = null;
  pendingUser = null;
}

/**
 * Returns all shared items received by `user`, split into `conversations`,
 * `assistants`, and `promptTemplates` subsets.
 *
 * The result is cached at the module level: concurrent calls for the same user
 * all receive the same promise (only one network round-trip).  On error the cache
 * is cleared automatically so the next call can retry.
 */
export async function getClassifiedSharedItems(user: string): Promise<ClassifiedShareItems> {
  if (!user) {
    return { conversations: [], assistants: [], promptTemplates: [] };
  }

  if (pending !== null && pendingUser === user) {
    return pending;
  }

  pendingUser = user;
  const p = doFetch(user);
  pending = p;

  // Clear the cache on failure so the next call can retry.
  p.catch(() => {
    if (pending === p) {
      pending = null;
      pendingUser = null;
    }
  });

  return p;
}

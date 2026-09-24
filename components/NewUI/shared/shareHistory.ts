/**
 * shareHistory.ts — pure TS (no React) module.
 *
 * localStorage-backed, user-scoped record of outgoing shares.
 * Used by NewUIShareModal to show "Previously shared with" history on items
 * the current user has shared before.
 *
 * Storage layout:
 *   Key:   `amplify_share_history__<user>`
 *   Value: JSON array of ShareHistoryRecord[]
 *
 * All functions are synchronous (localStorage is synchronous).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShareHistoryItemType = 'assistant' | 'conversation' | 'prompt-template';

export interface ShareHistoryRecord {
  /** Unique identifier for this history entry. */
  id: string;
  /** Content type of the shared item. */
  type: ShareHistoryItemType;
  /** Stable identifier for the source item (assistantId | conversationId | promptId). */
  sourceId: string;
  /** Human-readable name of the source item at the time of sharing. */
  sourceName: string;
  /** Display emails of the recipients. */
  sharedWith: string[];
  /** The personal message / note included in the share. */
  note: string;
  /** Unix timestamp (ms) when the share was sent. */
  sharedAt: number;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function storageKey(user: string): string {
  return `amplify_share_history__${user}`;
}

function generateId(): string {
  return `sh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all share history records for `user`, newest first.
 * Returns an empty array if nothing is stored or parsing fails.
 */
export function loadShareHistory(user: string): ShareHistoryRecord[] {
  if (!user) return [];
  try {
    const raw = localStorage.getItem(storageKey(user));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ShareHistoryRecord[];
  } catch {
    return [];
  }
}

/**
 * Appends a new share record for `user`.
 * The `id` and `sharedAt` fields are generated automatically.
 * Call this ONLY after the share API call resolves successfully.
 */
export function recordShare(
  user: string,
  record: Omit<ShareHistoryRecord, 'id' | 'sharedAt'>,
): void {
  if (!user || !record.sourceId) return;
  try {
    const existing = loadShareHistory(user);
    const newRecord: ShareHistoryRecord = {
      ...record,
      id: generateId(),
      sharedAt: Date.now(),
    };
    // Prepend so the list is newest-first.
    const updated = [newRecord, ...existing];
    localStorage.setItem(storageKey(user), JSON.stringify(updated));
  } catch {
    // Storage unavailable — not fatal; history is best-effort.
  }
}

/**
 * Returns all share history records for `user` where `sourceId` matches,
 * sorted newest first.
 */
export function getSharesForSource(user: string, sourceId: string): ShareHistoryRecord[] {
  if (!user || !sourceId) return [];
  return loadShareHistory(user)
    .filter((r) => r.sourceId === sourceId)
    .sort((a, b) => b.sharedAt - a.sharedAt);
}

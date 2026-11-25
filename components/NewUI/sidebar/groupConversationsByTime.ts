import { Conversation } from '@/types/chat';

/**
 * Parse a date for bucketing, handling three cases:
 *
 * 1. Full ISO timestamp (conversation.date) — e.g. "2026-08-06T18:23:00.000Z"
 *    → parse normally, compare as local-midnight boundaries
 *
 * 2. ISO date-only string (folder.date from addDateAttribute) — e.g. "2026-08-06"
 *    → MUST be parsed as LOCAL midnight, NOT UTC midnight.
 *    new Date("2026-08-06") gives UTC midnight which is "yesterday" in UTC-5.
 *    Fix: split into parts and use new Date(year, month-1, day).
 *
 * 3. Human-readable folder name — e.g. "Aug 6, 2026"
 *    → new Date("Aug 6, 2026") parses as local time, which is correct.
 */
export function parseDateForBucket(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Case 2: YYYY-MM-DD only (no time component)
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch.map(Number);
    return new Date(y, m - 1, d); // local midnight — correct
  }

  // Case 1 & 3: full ISO or human-readable — let the browser parse
  const p = new Date(dateStr);
  return isNaN(p.getTime()) ? null : p;
}

/** Returns today's local-midnight Date */
export function localMidnight(offsetDays = 0): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + offsetDays);
  return d;
}

// Group conversations by time bucket.
// Priority for date: conversation.date (ISO) → folder.date (YYYY-MM-DD) → folder.name parse
// archiveDays: conversations older than this many days are excluded (0 = show all)
export function groupConversationsByTime(
  conversations: Conversation[],
  folders: { id: string; name: string; date?: string }[],
  archiveDays: number = 0,
): {
  today: Conversation[];
  yesterday: Conversation[];
  previous: Conversation[];
} {
  const todayStart = localMidnight(0);
  const yesterdayStart = localMidnight(-1);
  // Archive cutoff: anything before this date is hidden (unless archiveDays === 0)
  const archiveCutoff = archiveDays > 0 ? localMidnight(-archiveDays) : null;

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const previous: Conversation[] = [];

  // Folder lookup by id. If several folders share an id, the first one wins.
  const folderById = new Map<string, { id: string; name: string; date?: string }>();
  for (const f of folders) {
    if (!folderById.has(f.id)) folderById.set(f.id, f);
  }

  // Sort newest first before grouping — use best available date for sort too
  const getConvTimestamp = (c: Conversation): number => {
    if (c.date) {
      const p = new Date(c.date);
      if (!isNaN(p.getTime())) return p.getTime();
    }
    if (c.folderId) {
      const folder = folderById.get(c.folderId);
      if (folder) {
        const dateStr = folder.date || folder.name;
        const p = parseDateForBucket(dateStr);
        if (p) return p.getTime();
      }
    }
    return 0;
  };

  // Each timestamp is computed once, not on every comparison. The sort is stable,
  // so conversations with equal timestamps keep their input order.
  const sorted = conversations
    .map((c) => ({ c, ts: getConvTimestamp(c) }))
    .sort((a, b) => b.ts - a.ts)
    .map(({ c }) => c);

  for (const c of sorted) {
    let ts: Date | null = null;

    // 1. Conversation's own ISO timestamp (newest conversations always have this)
    if (c.date) {
      ts = parseDateForBucket(c.date);
    }

    // 2. Folder date (older conversations — folder.date set by addDateAttribute or folder.name)
    if (!ts && c.folderId) {
      const folder = folderById.get(c.folderId);
      if (folder) {
        // Prefer folder.date (already normalized YYYY-MM-DD by addDateAttribute)
        // Fall back to folder.name ("Aug 6, 2026" format)
        const dateStr = folder.date || folder.name;
        ts = parseDateForBucket(dateStr);
      }
    }

    if (!ts) {
      // No date at all — always show (can't determine age, don't hide)
      previous.push(c);
      continue;
    }

    // Apply archive cutoff — skip conversations older than N days
    if (archiveCutoff && ts < archiveCutoff) continue;

    if (ts >= todayStart) today.push(c);
    else if (ts >= yesterdayStart) yesterday.push(c);
    else previous.push(c);
  }

  return { today, yesterday, previous };
}

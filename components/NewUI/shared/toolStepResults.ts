/**
 * toolStepResults — pure helpers for showing what a tool returned, and what a run cost.
 *
 * Presentation only: everything here reads data the agent log already holds and never
 * writes or reshapes what is recorded.
 *
 *   describeItem   one list item -> a single line: "Subject — From — time"
 *   resultRows     an object result -> key / value rows for the parameters-style grid
 *
 * No React imports.
 */

import { formatParamRows } from './toolSteps';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

// ─── One list item, one line ─────────────────────────────────────────────────

const TITLE_KEYS = ['subject', 'title', 'name', 'displayName', 'summary', 'filename', 'fileName', 'file_name', 'label'];
const PERSON_KEYS = ['from', 'sender', 'organizer', 'author', 'owner', 'createdBy', 'email', 'emailAddress'];
const TIME_KEYS = [
  'receivedDateTime',
  'sentDateTime',
  'start',
  'startDateTime',
  'createdDateTime',
  'lastModifiedDateTime',
  'modifiedTime',
  'updated_at',
  'created_at',
  'date',
  'timestamp',
];

/** A person / address field in any of its usual shapes: "Ann", {name,address}, {emailAddress:{name,address}}. */
const personLabel = (value: unknown, depth = 0): string | undefined => {
  const direct = str(value);
  if (direct) return direct;
  if (!isRecord(value) || depth > 2) return undefined;
  return (
    str(value.name) ??
    str(value.displayName) ??
    str(value.address) ??
    str(value.email) ??
    personLabel(value.emailAddress, depth + 1) ??
    personLabel(value.user, depth + 1)
  );
};

const rawTime = (value: unknown): string | undefined => {
  const direct = str(value);
  if (direct) return direct;
  return isRecord(value) ? str(value.dateTime) : undefined;
};

/** "3:41 PM" for today, "Oct 14, 3:41 PM" otherwise; anything unparseable is shown as it came. */
export const formatItemTime = (
  value: string,
  opts: { now?: Date; locale?: string; timeZone?: string } = {},
): string => {
  // Graph returns zone-less UTC timestamps ("2026-10-15T14:02:11.0000000"); treat them as UTC.
  const iso = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(value) ? `${value}Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  const { now = new Date(), locale, timeZone } = opts;
  const dayKey = (x: Date) => x.toLocaleDateString(locale, { timeZone });
  const sameDay = dayKey(d) === dayKey(now);
  return d.toLocaleString(
    locale,
    sameDay
      ? { hour: 'numeric', minute: '2-digit', timeZone }
      : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone },
  );
};

export interface ItemLine {
  title: string;
  /** Who / where it came from, when the item says. */
  meta?: string;
  /** When, already formatted. */
  time?: string;
}

/**
 * One item of a list result as a single line. Never throws and never returns an empty title:
 * an item with no recognisable fields falls back to its first plain values.
 */
export const describeItem = (
  item: unknown,
  opts: { now?: Date; locale?: string; timeZone?: string } = {},
): ItemLine => {
  if (!isRecord(item)) {
    const text = item === null || item === undefined ? '' : typeof item === 'string' ? item : (JSON.stringify(item) ?? String(item));
    return { title: text || 'Item' };
  }

  let title: string | undefined;
  for (const k of TITLE_KEYS) {
    title = str(item[k]);
    if (title) break;
  }
  let meta: string | undefined;
  for (const k of PERSON_KEYS) {
    meta = personLabel(item[k]);
    if (meta) break;
  }
  let time: string | undefined;
  for (const k of TIME_KEYS) {
    const raw = rawTime(item[k]);
    if (raw) {
      time = formatItemTime(raw, opts);
      break;
    }
  }

  if (!title) {
    // Nothing recognisable: lead with the first couple of plain string / number values.
    const plain = Object.values(item)
      .filter((v): v is string | number => (typeof v === 'string' && v.trim() !== '') || typeof v === 'number')
      .slice(0, 2)
      .map(String);
    title = plain.join(' · ') || 'Item';
  }
  return { title, meta, time };
};

// ─── Full field grid ─────────────────────────────────────────────────────────

/** Rows for the parameters-style grid; empty values are left out, as the old panel did. */
export const resultRows = (value: Record<string, unknown>): Array<{ key: string; value: string }> =>
  formatParamRows(
    Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '')),
  );

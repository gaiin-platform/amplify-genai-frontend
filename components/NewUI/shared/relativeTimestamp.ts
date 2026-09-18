/**
 * relativeTimestamp.ts — REUSABLE relative-time formatting + live-updating hook.
 *
 * Implements the ladder from chat-pane-migration-spec.md §2.4:
 *   < 60s    "just now"
 *   < 60m    "{n}m"                    (short form)
 *   < 24h    "{n} hours ago"           (long form)
 *   < 7d     weekday name, e.g. "Tuesday"
 *   >= 7d    "Jul 17"
 *   >= 1yr   "Jul 17, 2025"
 *
 * `useRelativeTime(iso)` re-renders its consumer every 30s while the value is
 * under an hour old (per spec: "Live-update sub-hour values on a 30s
 * interval"); it does not schedule an interval for older values since their
 * day/weekday-granularity text won't change on that cadence.
 */
import { useEffect, useRef, useState } from 'react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format an ISO timestamp relative to `now` per the spec's ladder. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Math.max(0, now - then);
  const diffSec = diffMs / 1000;
  const diffMin = diffSec / 60;
  const diffHr = diffMin / 60;
  const diffDay = diffHr / 24;

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${Math.floor(diffMin)}m`;
  if (diffHr < 24) {
    const hrs = Math.floor(diffHr);
    return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  }

  const d = new Date(then);
  if (diffDay < 7) return WEEKDAYS[d.getDay()];

  const nowDate = new Date(now);
  const sameYear = d.getFullYear() === nowDate.getFullYear();
  const monthDay = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (sameYear) return monthDay;
  return `${monthDay}, ${d.getFullYear()}`;
}

/** Full absolute timestamp for use in a `title=` attribute. */
export function formatAbsoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Returns a live relative-time string for `iso`, re-rendering every 30s while
 * under an hour old (per spec §2.4). Returns '' for missing/invalid input —
 * callers should render nothing rather than a fabricated timestamp when a
 * message predates the `Message.timestamp` field (older persisted history).
 */
export function useRelativeTime(iso: string | undefined): string {
  const [, forceTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!iso) return;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return;

    const scheduleIfNeeded = () => {
      const ageMs = Date.now() - then;
      if (ageMs < 3600_000) {
        timerRef.current = setTimeout(() => {
          forceTick((n) => n + 1);
          scheduleIfNeeded();
        }, 30_000);
      }
    };
    scheduleIfNeeded();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [iso]);

  if (!iso) return '';
  return formatRelativeTime(iso);
}

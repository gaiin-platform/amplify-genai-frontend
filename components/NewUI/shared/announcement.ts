/**
 * Admin announcement banner — the React-free vocabulary shared by the admin editor
 * (`settings/admin/AnnouncementCard`) and the user-facing `AnnouncementBanner`.
 *
 * Transport: the announcement rides inside the deployment-features config
 * (`deploymentFeatures.announcement`), which the backend already returns to every user from
 * `/feature_flags`. No new endpoint, no new admin config type.
 *
 * Expiry is a single absolute timestamp. "For N hours" is converted to `expiresAt` by the
 * editor, so the banner only ever has to compare one date with the clock.
 *
 * Dismissal is per tab session and keyed by the announcement `id`, so a closed banner stays
 * closed across a refresh, comes back after the next login, and a re-published announcement
 * (new `id`) is shown again.
 */
import type { DeploymentFeaturesConfig } from '@/types/admin';

export const ANNOUNCEMENT_MAX_LENGTH = 500;
export const ANNOUNCEMENT_DISMISSED_KEY = 'amplify_announcement_dismissed';

export interface Announcement {
  enabled: boolean;
  message: string;
  /** Changes whenever the admin publishes new text or re-enables it; keys the dismissal. */
  id: string;
  /** ISO-8601 UTC instant the banner stops showing, or `null` to run until disabled. */
  expiresAt: string | null;
}

/** `DeploymentFeaturesConfig` plus the optional announcement (types/ is read-only). */
export type DeploymentConfigWithAnnouncement = DeploymentFeaturesConfig & {
  announcement?: Announcement;
};

export type ExpiryMode = 'indefinite' | 'duration' | 'date';
export type DurationUnit = 'hours' | 'days';

const UNIT_MS: Record<DurationUnit, number> = { hours: 3_600_000, days: 86_400_000 };
/** setTimeout stores its delay as a signed 32-bit int; larger values fire immediately. */
const MAX_TIMER_MS = 2_147_483_647;

export const EMPTY_ANNOUNCEMENT: Announcement = { enabled: false, message: '', id: '', expiresAt: null };

/** Narrow an untrusted payload (the `/feature_flags` response) to an `Announcement`. */
export function readAnnouncement(deploymentFeatures: unknown): Announcement | null {
  if (!deploymentFeatures || typeof deploymentFeatures !== 'object') return null;
  const raw = (deploymentFeatures as { announcement?: unknown }).announcement;
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.message !== 'string') return null;
  return {
    enabled: a.enabled === true,
    message: a.message,
    id: typeof a.id === 'string' ? a.id : '',
    expiresAt: typeof a.expiresAt === 'string' && a.expiresAt ? a.expiresAt : null,
  };
}

/**
 * True when the announcement has passed `expiresAt`. An unparseable date is treated as
 * "no expiry" — hiding an incident notice on corrupt data is the worse failure.
 */
export function isAnnouncementExpired(a: Announcement, now: number = Date.now()): boolean {
  if (!a.expiresAt) return false;
  const at = Date.parse(a.expiresAt);
  return Number.isFinite(at) && at <= now;
}

/** Should users see it right now (ignoring any per-user dismissal)? */
export function isAnnouncementActive(a: Announcement | null | undefined, now: number = Date.now()): a is Announcement {
  return !!a && a.enabled && a.message.trim().length > 0 && !isAnnouncementExpired(a, now);
}

/** Milliseconds until the banner expires (clamped for `setTimeout`), or `null` if it never does. */
export function msUntilExpiry(a: Announcement, now: number = Date.now()): number | null {
  if (!a.expiresAt) return null;
  const at = Date.parse(a.expiresAt);
  if (!Number.isFinite(at)) return null;
  return Math.min(Math.max(at - now, 0), MAX_TIMER_MS);
}

/** Resolve the editor's expiry controls to the stored `expiresAt`. `null` = never / invalid input. */
export function computeExpiresAt(
  mode: ExpiryMode,
  input: { amount: number; unit: DurationUnit; dateLocal: string },
  now: number = Date.now(),
): string | null {
  if (mode === 'duration') {
    if (!Number.isFinite(input.amount) || input.amount <= 0) return null;
    return new Date(now + input.amount * UNIT_MS[input.unit]).toISOString();
  }
  if (mode === 'date') return fromLocalInputValue(input.dateLocal);
  return null;
}

/** ISO instant → value for `<input type="datetime-local">` (browser-local wall time). */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `<input type="datetime-local">` value → ISO instant, or `null` when empty/invalid. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Apply an editor change. A new message, or turning the banner back on, mints a fresh `id`
 * so users who dismissed the previous text see the update.
 */
export function patchAnnouncement(
  prev: Announcement | undefined,
  patch: Partial<Omit<Announcement, 'id'>>,
  now: number = Date.now(),
): Announcement {
  const base = prev ?? EMPTY_ANNOUNCEMENT;
  const next = { ...base, ...patch };
  const republished =
    (patch.message !== undefined && patch.message !== base.message) ||
    (patch.enabled === true && !base.enabled);
  return { ...next, id: republished || !next.id ? String(now) : next.id };
}

// ── Per-session dismissal ────────────────────────────────────────────────────

export function getDismissedAnnouncementId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function dismissAnnouncement(id: string): void {
  try {
    window.sessionStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, id);
  } catch {
    // Storage blocked — the banner is still hidden for this mount via component state.
  }
}

/** Forget dismissals (on sign-out) so the next login shows the banner again. */
export function clearDismissedAnnouncement(): void {
  try {
    window.sessionStorage.removeItem(ANNOUNCEMENT_DISMISSED_KEY);
  } catch {
    // ignore
  }
}

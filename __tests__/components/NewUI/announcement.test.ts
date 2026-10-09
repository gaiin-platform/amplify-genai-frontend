import { describe, expect, it } from 'vitest';
import {
  Announcement,
  computeExpiresAt,
  fromLocalInputValue,
  isAnnouncementActive,
  isAnnouncementExpired,
  msUntilExpiry,
  patchAnnouncement,
  readAnnouncement,
  toLocalInputValue,
} from '@/components/NewUI/shared/announcement';

const NOW = Date.parse('2026-10-09T12:00:00.000Z');
const base: Announcement = { enabled: true, message: 'Investigating an issue', id: '1', expiresAt: null };

describe('readAnnouncement', () => {
  it('returns null for missing / malformed payloads', () => {
    expect(readAnnouncement(undefined)).toBeNull();
    expect(readAnnouncement({})).toBeNull();
    expect(readAnnouncement({ announcement: 'x' })).toBeNull();
    expect(readAnnouncement({ announcement: { enabled: true } })).toBeNull();
  });
  it('normalizes a stored announcement', () => {
    expect(readAnnouncement({ announcement: { enabled: true, message: 'hi', id: 'a', expiresAt: '' } })).toEqual({
      enabled: true, message: 'hi', id: 'a', expiresAt: null,
    });
    expect(readAnnouncement({ announcement: { enabled: 'yes', message: 'hi' } })?.enabled).toBe(false);
  });
});

describe('isAnnouncementActive', () => {
  it('is active when enabled with a message and no expiry', () => {
    expect(isAnnouncementActive(base, NOW)).toBe(true);
  });
  it('is inactive when disabled, blank, or absent', () => {
    expect(isAnnouncementActive({ ...base, enabled: false }, NOW)).toBe(false);
    expect(isAnnouncementActive({ ...base, message: '   ' }, NOW)).toBe(false);
    expect(isAnnouncementActive(null, NOW)).toBe(false);
  });
  it('honours expiresAt', () => {
    const future = new Date(NOW + 1000).toISOString();
    const past = new Date(NOW - 1000).toISOString();
    expect(isAnnouncementActive({ ...base, expiresAt: future }, NOW)).toBe(true);
    expect(isAnnouncementActive({ ...base, expiresAt: past }, NOW)).toBe(false);
    expect(isAnnouncementExpired({ ...base, expiresAt: new Date(NOW).toISOString() }, NOW)).toBe(true);
  });
  it('treats an unparseable expiry as no expiry', () => {
    expect(isAnnouncementActive({ ...base, expiresAt: 'garbage' }, NOW)).toBe(true);
    expect(msUntilExpiry({ ...base, expiresAt: 'garbage' }, NOW)).toBeNull();
  });
});

describe('msUntilExpiry', () => {
  it('is null without expiry, 0 once past, and clamped for setTimeout', () => {
    expect(msUntilExpiry(base, NOW)).toBeNull();
    expect(msUntilExpiry({ ...base, expiresAt: new Date(NOW - 5).toISOString() }, NOW)).toBe(0);
    expect(msUntilExpiry({ ...base, expiresAt: new Date(NOW + 5000).toISOString() }, NOW)).toBe(5000);
    expect(msUntilExpiry({ ...base, expiresAt: '2099-01-01T00:00:00.000Z' }, NOW)).toBe(2_147_483_647);
  });
});

describe('computeExpiresAt', () => {
  const input = { amount: 2, unit: 'hours' as const, dateLocal: '' };
  it('indefinite → null', () => {
    expect(computeExpiresAt('indefinite', input, NOW)).toBeNull();
  });
  it('duration → now + amount', () => {
    expect(computeExpiresAt('duration', input, NOW)).toBe(new Date(NOW + 2 * 3_600_000).toISOString());
    expect(computeExpiresAt('duration', { ...input, amount: 3, unit: 'days' }, NOW)).toBe(
      new Date(NOW + 3 * 86_400_000).toISOString(),
    );
    expect(computeExpiresAt('duration', { ...input, amount: 0 }, NOW)).toBeNull();
  });
  it('date → parsed local value', () => {
    expect(computeExpiresAt('date', { ...input, dateLocal: '2026-10-10T09:30' }, NOW)).toBe(
      new Date('2026-10-10T09:30').toISOString(),
    );
    expect(computeExpiresAt('date', { ...input, dateLocal: '' }, NOW)).toBeNull();
  });
});

describe('local datetime round-trip', () => {
  it('survives ISO → input → ISO', () => {
    const iso = new Date('2026-10-10T09:30').toISOString();
    expect(toLocalInputValue(iso)).toBe('2026-10-10T09:30');
    expect(fromLocalInputValue(toLocalInputValue(iso))).toBe(iso);
    expect(toLocalInputValue(null)).toBe('');
    expect(fromLocalInputValue('')).toBeNull();
  });
});

describe('patchAnnouncement', () => {
  it('mints an id for the first edit', () => {
    expect(patchAnnouncement(undefined, { message: 'a' }, 100).id).toBe('100');
  });
  it('mints a new id when the message changes or the banner is re-enabled', () => {
    expect(patchAnnouncement(base, { message: 'new text' }, 200).id).toBe('200');
    expect(patchAnnouncement({ ...base, enabled: false }, { enabled: true }, 300).id).toBe('300');
  });
  it('keeps the id for changes that should not resurface a dismissed banner', () => {
    expect(patchAnnouncement(base, { expiresAt: '2030-01-01T00:00:00.000Z' }, 400).id).toBe('1');
    expect(patchAnnouncement(base, { enabled: false }, 400).id).toBe('1');
    expect(patchAnnouncement(base, { message: base.message }, 400).id).toBe('1');
  });
});

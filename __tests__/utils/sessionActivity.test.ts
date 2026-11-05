import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_EVENTS,
  ACTIVITY_STORAGE_KEY,
  INACTIVITY_TIMEOUT_MS,
  clearLastActivity,
  isInactive,
  latestActivity,
  readLastActivity,
  writeLastActivity,
} from '@/utils/app/sessionActivity';

const makeStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

const throwingStorage = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
  removeItem: () => { throw new Error('denied'); },
};

describe('isInactive', () => {
  it('is false just under one hour and true at one hour', () => {
    const last = 1_000_000;
    expect(isInactive(last, last + INACTIVITY_TIMEOUT_MS - 1)).toBe(false);
    expect(isInactive(last, last + INACTIVITY_TIMEOUT_MS)).toBe(true);
  });

  it('does not sign out 5 minutes after activity', () => {
    expect(isInactive(0, 5 * 60 * 1000)).toBe(false);
  });
});

describe('shared last-activity storage', () => {
  it('round-trips and clears', () => {
    const s = makeStorage();
    expect(readLastActivity(s)).toBeNull();
    writeLastActivity(s, 1234);
    expect(readLastActivity(s)).toBe(1234);
    clearLastActivity(s);
    expect(readLastActivity(s)).toBeNull();
  });

  it('ignores corrupt values', () => {
    const s = makeStorage();
    s.setItem(ACTIVITY_STORAGE_KEY, 'not-a-number');
    expect(readLastActivity(s)).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    expect(readLastActivity(throwingStorage)).toBeNull();
    expect(() => writeLastActivity(throwingStorage, 1)).not.toThrow();
    expect(() => clearLastActivity(throwingStorage)).not.toThrow();
    expect(readLastActivity(null)).toBeNull();
  });

  it("an idle tab sees activity from another tab (the stale-tab sign-out bug)", () => {
    const s = makeStorage();
    const idleTabLastActivity = 0; // this tab last saw input an hour+ ago
    writeLastActivity(s, 90 * 60 * 1000); // another tab was used 'just now'
    const now = 90 * 60 * 1000 + 1000;
    expect(isInactive(idleTabLastActivity, now)).toBe(true);
    expect(isInactive(latestActivity(idleTabLastActivity, s), now)).toBe(false);
  });

  it('falls back to in-memory activity when storage is unavailable', () => {
    expect(latestActivity(500, throwingStorage)).toBe(500);
  });
});

describe('ACTIVITY_EVENTS', () => {
  it('covers non-click interaction such as scrolling, wheel and mouse movement', () => {
    for (const e of ['scroll', 'wheel', 'mousemove', 'keydown', 'pointerdown']) {
      expect(ACTIVITY_EVENTS).toContain(e);
    }
  });
});

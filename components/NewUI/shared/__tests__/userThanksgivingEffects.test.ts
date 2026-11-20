import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getThanksgivingPartEnabled,
  setThanksgivingPartEnabled,
  USER_THANKSGIVING_EFFECTS_CHANGED_EVENT,
} from '@/components/NewUI/shared/userThanksgivingEffects';

function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('userThanksgivingEffects', () => {
  const dispatched: string[] = [];
  beforeEach(() => {
    dispatched.length = 0;
    vi.stubGlobal('localStorage', makeStorage());
    vi.stubGlobal('window', { dispatchEvent: (e: Event) => void dispatched.push(e.type) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults both parts to on', () => {
    expect(getThanksgivingPartEnabled('theme')).toBe(true);
    expect(getThanksgivingPartEnabled('gust')).toBe(true);
  });

  it('opts out per part and restores on re-enable', () => {
    setThanksgivingPartEnabled('gust', false);
    expect(getThanksgivingPartEnabled('gust')).toBe(false);
    expect(getThanksgivingPartEnabled('theme')).toBe(true);
    setThanksgivingPartEnabled('gust', true);
    expect(getThanksgivingPartEnabled('gust')).toBe(true);
  });

  it('notifies listeners on every change', () => {
    setThanksgivingPartEnabled('theme', false);
    setThanksgivingPartEnabled('theme', true);
    expect(dispatched).toEqual([USER_THANKSGIVING_EFFECTS_CHANGED_EVENT, USER_THANKSGIVING_EFFECTS_CHANGED_EVENT]);
  });

  it('falls back to on when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(getThanksgivingPartEnabled('theme')).toBe(true);
    expect(() => setThanksgivingPartEnabled('theme', false)).not.toThrow();
  });
});

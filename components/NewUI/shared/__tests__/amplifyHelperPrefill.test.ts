import { beforeEach, describe, expect, it } from 'vitest';
import {
  AMPLIFY_HELPER_PREFILL_KEY,
  consumeAmplifyHelperPrefill,
  writeAmplifyHelperPrefill,
} from '@/components/NewUI/shared/amplifyHelperPrefill';

describe('Amplify Helper prefill handoff', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
  });

  it('writes and consumes a question once', () => {
    writeAmplifyHelperPrefill('  How do I use Library?  ');
    expect(sessionStorage.getItem(AMPLIFY_HELPER_PREFILL_KEY)).toBe('How do I use Library?');
    expect(consumeAmplifyHelperPrefill()).toBe('How do I use Library?');
    expect(consumeAmplifyHelperPrefill()).toBeNull();
  });

  it('clears stale questions for the header CTA', () => {
    writeAmplifyHelperPrefill('stale');
    writeAmplifyHelperPrefill();
    expect(consumeAmplifyHelperPrefill()).toBeNull();
  });
});

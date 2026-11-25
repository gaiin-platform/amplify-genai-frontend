// @vitest-environment jsdom
/**
 * useLatestThrottle keeps one throttle across renders (#361, item 6). A throttle created in
 * the render body is new on every render, so it calls through at once each time and
 * throttles nothing; the first test shows that, and the others cover the hook.
 */
import React from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';

import { useLatestThrottle } from '@/hooks/useLatestThrottle';
import { throttle } from '@/utils/data/throttle';

const LIMIT = 250;

/** Calls the throttled function after every render, as Chat's streaming effect does. */
const Follower: React.FC<{ scroll: () => void; seen: Array<() => void>; fresh?: boolean }> = ({ scroll, seen, fresh }) => {
  const stable = useLatestThrottle(scroll, LIMIT);
  // `fresh` reproduces the old code: a new throttle on each render.
  const throttled = fresh ? throttle(scroll, LIMIT) : stable;
  seen.push(throttled);
  React.useEffect(() => {
    throttled();
  });
  return null;
};

let host: HTMLElement;
let root: Root;

const render = async (scroll: () => void, seen: Array<() => void>, fresh = false) => {
  await act(async () => {
    root.render(<Follower scroll={scroll} seen={seen} fresh={fresh} />);
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('a throttle created in the render body', () => {
  it('scrolls on every render, so it throttles nothing', async () => {
    const scroll = vi.fn();
    const seen: Array<() => void> = [];
    for (let i = 0; i < 20; i++) {
      await render(scroll, seen, true);
      vi.advanceTimersByTime(10);
    }

    expect(scroll).toHaveBeenCalledTimes(20);
  });
});

describe('useLatestThrottle', () => {
  it('returns the same function on every render', async () => {
    const seen: Array<() => void> = [];
    for (let i = 0; i < 5; i++) await render(() => {}, seen);

    expect(new Set(seen).size).toBe(1);
  });

  it('scrolls once at the start of a burst of renders and once after it', async () => {
    const scroll = vi.fn();
    const seen: Array<() => void> = [];
    // 20 renders, 10 ms apart: all inside one 250 ms window.
    for (let i = 0; i < 20; i++) {
      await render(scroll, seen);
      vi.advanceTimersByTime(10);
    }
    expect(scroll).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(LIMIT);
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('runs the function from the latest render when the delayed call fires', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const seen: Array<() => void> = [];

    await render(first, seen); // scrolls at once with `first`
    vi.advanceTimersByTime(10);
    await render(first, seen); // queues a delayed call
    vi.advanceTimersByTime(10);
    await render(second, seen); // the user scrolled up meanwhile: a new function arrives
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LIMIT);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

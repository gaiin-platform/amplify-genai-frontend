import { useRef } from 'react';
import { throttle } from '@/utils/data/throttle';

/**
 * A throttled version of `fn` that keeps one throttle for the life of the component.
 *
 * Calling `throttle(fn, limit)` in a component body makes a new throttle on every render.
 * A new throttle has no memory of the last call, so nothing is ever throttled, and anything
 * that depends on the function's identity sees it change each time. This hook creates the
 * throttle once and has it call whatever `fn` the latest render passed, so the call still
 * sees current props and state. `limit` is read on the first render only.
 */
export function useLatestThrottle<T extends (...args: any[]) => void>(fn: T, limit: number): T {
  const latest = useRef(fn);
  latest.current = fn;

  const throttled = useRef<T | null>(null);
  if (!throttled.current) {
    throttled.current = throttle(((...args: Parameters<T>) => latest.current(...args)) as T, limit);
  }
  return throttled.current;
}

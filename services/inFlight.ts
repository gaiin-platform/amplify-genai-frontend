/**
 * Collapses concurrent identical requests into one network call.
 *
 * Only calls that overlap in time share a request; once it settles, the next call
 * goes to the network again, so read-modify-write flows never see stale data.
 * Each caller receives its own deep copy of the result, since callers mutate it.
 */
export const dedupeInFlight = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
    let pending: Promise<T> | null = null;
    return () => {
        if (!pending) {
            pending = fn().finally(() => { pending = null; });
        }
        return pending.then((result) =>
            result !== null && typeof result === 'object' ? structuredClone(result) : result);
    };
};

/**
 * A short-lived cache for read endpoints whose result is shared by several components.
 *
 * - Only successful responses (`success: true`) are kept, so a failure is retried next time.
 * - Concurrent callers share one request, like `dedupeInFlight`.
 * - Each caller receives its own deep copy, since callers mutate results.
 * - `invalidate()` drops the stored value and orphans any request still in flight, so a
 *   response that started before the invalidation can never repopulate the cache.
 * - `set()` lets a fresh, uncached read prime the cache for the next cached caller.
 */
export const createTtlCache = <T extends { success?: boolean } | null | undefined>(ttlMs: number) => {
    let value: T | null = null;
    let storedAt = 0;
    let pending: Promise<T> | null = null;
    let epoch = 0;

    const copy = (result: T): T =>
        result !== null && typeof result === 'object' ? structuredClone(result) : result;

    const store = (result: T) => {
        if (result && result.success) {
            value = result;
            storedAt = Date.now();
        }
    };

    return {
        async get(fetcher: () => Promise<T>): Promise<T> {
            if (value !== null && Date.now() - storedAt < ttlMs) return copy(value);
            if (!pending) {
                const startedEpoch = epoch;
                const request: Promise<T> = fetcher()
                    .then((result) => {
                        if (startedEpoch === epoch) store(result);
                        return result;
                    })
                    .finally(() => {
                        if (pending === request) pending = null;
                    });
                pending = request;
            }
            return copy(await pending);
        },
        set(result: T) {
            store(result);
        },
        invalidate() {
            value = null;
            pending = null;
            epoch++;
        },
    };
};

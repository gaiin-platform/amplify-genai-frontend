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

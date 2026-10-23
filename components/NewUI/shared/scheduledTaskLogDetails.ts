/**
 * Scheduled-task run details — what `/get-task-execution-details` hands back, made safe to render.
 *
 * The endpoint returns the whole execution record (`executionId`, `executedAt`, `status`, …) with the
 * run's payload under `details`. That payload is not always the `{ result, startTime, … }` object the
 * view expects:
 *   - A run archived out of the active log store is currently written to the archive bucket still
 *     LZW-compressed (a JSON array of integers), so `details` arrives as `number[]`.
 *   - A payload can arrive as a JSON string, or as the bare list of agent messages.
 *   - When the backend cannot find / read the payload it sets `detailsError` and omits `details`.
 *
 * `normalizeExecutionRecord` folds all of those into `{ details: object | null, detailsError? }` so the
 * view never has to guess. No React imports.
 */

import { isLzwCompressed, lzwUncompress } from '@/utils/app/lzwCompression';

// User-facing copy. The backend's `detailsError` names storage internals (tables, buckets, ids), so it is
// logged for debugging but never shown.
export const UNREADABLE_DETAILS_MESSAGE = 'The saved details for this run could not be read.';
export const UNAVAILABLE_DETAILS_MESSAGE = 'The details for this run are no longer available.';
export const LOAD_FAILED_DETAILS_MESSAGE = 'The details for this run could not be loaded. Please try again.';

const isPlainObject = (value: unknown): value is Record<string, any> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
// (A type predicate would narrow arrays out of `unknown` as `never`, so keep arrays checked first below.)

/** Best-effort conversion of a stored payload to an object; `null` when it cannot be recovered. */
export function parseDetailsPayload(raw: unknown): Record<string, any> | null {
    if (raw === null || raw === undefined) return null;
    if (!Array.isArray(raw) && isPlainObject(raw)) return raw;

    if (typeof raw === 'string') {
        try {
            return parseDetailsPayload(JSON.parse(raw));
        } catch {
            return null;
        }
    }

    if (Array.isArray(raw)) {
        if (raw.length === 0) return null;
        // An all-number array is the compressed form; anything else is the agent message list itself.
        if (isLzwCompressed(raw)) {
            try {
                return parseDetailsPayload(JSON.parse(lzwUncompress(raw)));
            } catch {
                return null;
            }
        }
        return { result: raw };
    }

    return null;
}

export interface NormalizedExecutionRecord {
    [key: string]: any;
    details: Record<string, any> | null;
    detailsError?: string;
}

/** Normalise a `/get-task-execution-details` record. Never throws. */
export function normalizeExecutionRecord(record: unknown): NormalizedExecutionRecord | null {
    if (!isPlainObject(record)) return null;

    const rawDetails = record.details;
    const details = parseDetailsPayload(rawDetails);

    let detailsError: string | undefined;
    if (!details) {
        if (typeof record.detailsError === 'string' && record.detailsError) {
            console.warn('Scheduled task run details unavailable:', record.detailsError);
            detailsError = UNAVAILABLE_DETAILS_MESSAGE;
        } else if (rawDetails !== undefined && rawDetails !== null) {
            // A payload was present but we could not make sense of it.
            detailsError = UNREADABLE_DETAILS_MESSAGE;
        }
    }

    return { ...record, details, detailsError };
}

/** Capitalised status for display; tolerant of records that carry no status. */
export function formatRunStatus(status: unknown): string {
    if (typeof status !== 'string' || !status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

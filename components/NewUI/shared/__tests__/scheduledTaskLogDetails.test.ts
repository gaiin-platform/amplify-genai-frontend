import { describe, expect, it, vi } from 'vitest';
import { lzwCompress } from '@/utils/app/lzwCompression';
import {
    formatRunStatus,
    normalizeExecutionRecord,
    parseDetailsPayload,
    UNAVAILABLE_DETAILS_MESSAGE,
    UNREADABLE_DETAILS_MESSAGE,
} from '../scheduledTaskLogDetails';

const payload = { result: [{ role: 'user', content: 'hi' }], startTime: '2025-01-01T00:00:00', sessionId: 's1' };

describe('parseDetailsPayload', () => {
    it('passes an object through', () => {
        expect(parseDetailsPayload(payload)).toBe(payload);
    });

    it('decompresses an LZW integer array (archived run)', () => {
        expect(parseDetailsPayload(lzwCompress(JSON.stringify(payload)))).toEqual(payload);
    });

    it('parses a JSON string', () => {
        expect(parseDetailsPayload(JSON.stringify(payload))).toEqual(payload);
    });

    it('treats a bare message list as the result', () => {
        const list = [{ role: 'assistant', content: {} }];
        expect(parseDetailsPayload(list)).toEqual({ result: list });
    });

    it('returns null for garbage rather than throwing', () => {
        expect(parseDetailsPayload('not json')).toBeNull();
        expect(parseDetailsPayload([999999, 3, 4])).toBeNull();
        expect(parseDetailsPayload([])).toBeNull();
        expect(parseDetailsPayload(undefined)).toBeNull();
        expect(parseDetailsPayload(42)).toBeNull();
    });
});

describe('normalizeExecutionRecord', () => {
    it('keeps record fields and normalises compressed details', () => {
        const out = normalizeExecutionRecord({ executionId: 'e1', status: 'success', details: lzwCompress(JSON.stringify(payload)) });
        expect(out?.executionId).toBe('e1');
        expect(out?.details).toEqual(payload);
        expect(out?.detailsError).toBeUndefined();
    });

    it('shows friendly copy, never the backend detailsError, when no payload exists', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const out = normalizeExecutionRecord({
            executionId: 'e2',
            status: 'success',
            detailsError: 'Execution e2 not found in USER_STORAGE_TABLE or consolidation bucket archive',
        });
        expect(out?.details).toBeNull();
        expect(out?.detailsError).toBe(UNAVAILABLE_DETAILS_MESSAGE);
        expect(out?.detailsError).not.toMatch(/USER_STORAGE_TABLE|bucket/i);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('flags an unreadable payload', () => {
        const out = normalizeExecutionRecord({ executionId: 'e3', status: 'failure', details: 'not json' });
        expect(out?.details).toBeNull();
        expect(out?.detailsError).toBe(UNREADABLE_DETAILS_MESSAGE);
    });

    it('returns null for a non-object record', () => {
        expect(normalizeExecutionRecord(null)).toBeNull();
        expect(normalizeExecutionRecord([])).toBeNull();
    });
});

describe('formatRunStatus', () => {
    it('capitalises and tolerates a missing status', () => {
        expect(formatRunStatus('success')).toBe('Success');
        expect(formatRunStatus(undefined)).toBe('Unknown');
    });
});

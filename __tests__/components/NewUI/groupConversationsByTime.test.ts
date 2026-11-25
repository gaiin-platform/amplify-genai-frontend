/**
 * Tests for sidebar/groupConversationsByTime — the Today / Yesterday / Previous
 * bucketing of the sidebar Recents list.
 *
 * The function sorts with timestamps worked out once per conversation and looks
 * folders up through a Map. `referenceGroup` below is the straightforward version
 * (dates parsed inside the comparator, folders.find for every lookup); the outputs
 * of the two are compared over fixed and seeded-random inputs, including ties,
 * missing or unparseable dates, folder dates, folder names and duplicate folder ids.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Conversation } from '@/types/chat';
import {
    groupConversationsByTime,
    parseDateForBucket,
    localMidnight,
} from '@/components/NewUI/sidebar/groupConversationsByTime';

type FolderLike = { id: string; name: string; date?: string };

/** The slow, obviously-correct grouping the sidebar's output is pinned to. */
function referenceGroup(conversations: Conversation[], folders: FolderLike[], archiveDays: number = 0) {
    const todayStart = localMidnight(0);
    const yesterdayStart = localMidnight(-1);
    const archiveCutoff = archiveDays > 0 ? localMidnight(-archiveDays) : null;

    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const previous: Conversation[] = [];

    const getConvTimestamp = (c: Conversation): number => {
        if (c.date) {
            const p = new Date(c.date);
            if (!isNaN(p.getTime())) return p.getTime();
        }
        if (c.folderId) {
            const folder = folders.find((f) => f.id === c.folderId);
            if (folder) {
                const p = parseDateForBucket(folder.date || folder.name);
                if (p) return p.getTime();
            }
        }
        return 0;
    };

    const sorted = [...conversations].sort((a, b) => getConvTimestamp(b) - getConvTimestamp(a));

    for (const c of sorted) {
        let ts: Date | null = null;
        if (c.date) ts = parseDateForBucket(c.date);
        if (!ts && c.folderId) {
            const folder = folders.find((f) => f.id === c.folderId);
            if (folder) ts = parseDateForBucket(folder.date || folder.name);
        }
        if (!ts) {
            previous.push(c);
            continue;
        }
        if (archiveCutoff && ts < archiveCutoff) continue;
        if (ts >= todayStart) today.push(c);
        else if (ts >= yesterdayStart) yesterday.push(c);
        else previous.push(c);
    }

    return { today, yesterday, previous };
}

const conv = (id: string, over: Partial<Conversation> = {}): Conversation =>
    ({
        id,
        name: id,
        messages: [],
        model: {} as any,
        folderId: null,
        ...over,
    }) as Conversation;

const ids = (g: { today: Conversation[]; yesterday: Conversation[]; previous: Conversation[] }) => ({
    today: g.today.map((c) => c.id),
    yesterday: g.yesterday.map((c) => c.id),
    previous: g.previous.map((c) => c.id),
});

/** mulberry32: a small deterministic PRNG so the generated inputs are the same on every run. */
function seeded(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const humanName = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

/** A date `days` days from the fixed "now", snapped to one of a few hours so ties are common. */
function dayOffset(rand: () => number, days: number): Date {
    const d = localMidnight(days);
    d.setHours([0, 0, 9, 13, 23][Math.floor(rand() * 5)]);
    return d;
}

function generateInput(seed: number) {
    const rand = seeded(seed);
    const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
    const offsets = [2, 1, 0, 0, -1, -1, -2, -3, -6, -7, -8, -13, -14, -29, -30, -31, -45];

    const folders: FolderLike[] = [];
    const folderCount = 2 + Math.floor(rand() * 8);
    for (let i = 0; i < folderCount; i++) {
        const d = dayOffset(rand, pick(offsets));
        // Few distinct ids, so some folders share an id with an earlier one.
        const id = `f${Math.floor(rand() * 6)}`;
        const kind = pick(['date', 'name', 'both', 'plain', 'empty']);
        if (kind === 'date') folders.push({ id, name: 'Folder ' + i, date: ymd(d) });
        else if (kind === 'name') folders.push({ id, name: humanName(d) });
        else if (kind === 'both') folders.push({ id, name: humanName(dayOffset(rand, pick(offsets))), date: ymd(d) });
        else if (kind === 'plain') folders.push({ id, name: 'Work stuff' });
        else folders.push({ id, name: '', date: '' });
    }

    const conversations: Conversation[] = [];
    const count = Math.floor(rand() * 60);
    for (let i = 0; i < count; i++) {
        const d = dayOffset(rand, pick(offsets));
        const dateKind = pick(['iso', 'iso', 'ymd', 'human', 'garbage', 'empty', 'none']);
        const date =
            dateKind === 'iso' ? d.toISOString()
            : dateKind === 'ymd' ? ymd(d)
            : dateKind === 'human' ? humanName(d)
            : dateKind === 'garbage' ? 'not a date'
            : dateKind === 'empty' ? ''
            : undefined;
        const folderId = pick([null, 'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'missing']);
        conversations.push(conv(`c${i}`, { date, folderId }));
    }

    const archiveDays = pick([0, 0, 1, 2, 7, 14, 30]);
    return { conversations, folders, archiveDays };
}

describe('groupConversationsByTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 10, 24, 15, 30, 0));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('buckets by the conversation date, newest first', () => {
        const now = new Date();
        const c1 = conv('today-late', { date: new Date(2026, 10, 24, 14, 0).toISOString() });
        const c2 = conv('today-early', { date: new Date(2026, 10, 24, 1, 0).toISOString() });
        const c3 = conv('yesterday', { date: new Date(2026, 10, 23, 12, 0).toISOString() });
        const c4 = conv('older', { date: new Date(2026, 10, 10, 12, 0).toISOString() });
        expect(now.getDate()).toBe(24);

        const result = groupConversationsByTime([c4, c2, c3, c1], []);
        expect(ids(result)).toEqual({
            today: ['today-late', 'today-early'],
            yesterday: ['yesterday'],
            previous: ['older'],
        });
    });

    it('keeps input order for equal timestamps', () => {
        const date = new Date(2026, 10, 24, 9, 0).toISOString();
        const convs = ['a', 'b', 'c', 'd', 'e'].map((id) => conv(id, { date }));
        expect(groupConversationsByTime(convs, []).today.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('puts conversations with no usable date in Previous, in input order after dated ones', () => {
        const convs = [
            conv('none'),
            conv('garbage', { date: 'not a date' }),
            conv('dated', { date: new Date(2026, 10, 1).toISOString() }),
            conv('unknown-folder', { folderId: 'missing' }),
        ];
        const result = groupConversationsByTime(convs, [], 0);
        expect(ids(result)).toEqual({ today: [], yesterday: [], previous: ['dated', 'none', 'garbage', 'unknown-folder'] });
    });

    it('falls back to folder.date, then to a folder name such as "Aug 6, 2026"', () => {
        const folders = [
            { id: 'by-date', name: 'Ignored name', date: '2026-11-23' },
            { id: 'by-name', name: 'Nov 24, 2026' },
            { id: 'old-name', name: 'Aug 6, 2026' },
        ];
        const convs = [
            conv('old', { folderId: 'old-name' }),
            conv('yday', { folderId: 'by-date' }),
            conv('today', { folderId: 'by-name' }),
        ];
        expect(ids(groupConversationsByTime(convs, folders))).toEqual({
            today: ['today'],
            yesterday: ['yday'],
            previous: ['old'],
        });
    });

    it('uses the first folder when two share an id', () => {
        const folders = [
            { id: 'dup', name: 'First', date: '2026-11-24' },
            { id: 'dup', name: 'Second', date: '2026-11-23' },
        ];
        const result = groupConversationsByTime([conv('x', { folderId: 'dup' })], folders);
        expect(ids(result).today).toEqual(['x']);
    });

    it('drops conversations older than archiveDays and keeps undated ones', () => {
        const convs = [
            conv('in', { date: new Date(2026, 10, 20, 12).toISOString() }),
            conv('edge', { date: new Date(2026, 10, 17, 0, 0).toISOString() }),
            conv('out', { date: new Date(2026, 10, 16, 23, 59).toISOString() }),
            conv('undated'),
        ];
        expect(ids(groupConversationsByTime(convs, [], 7)).previous).toEqual(['in', 'edge', 'undated']);
        expect(ids(groupConversationsByTime(convs, [], 0)).previous).toEqual(['in', 'edge', 'out', 'undated']);
    });

    it('looks folders up without calling folders.find', () => {
        const folders: FolderLike[] = [{ id: 'f', name: 'Nov 24, 2026' }];
        folders.find = () => {
            throw new Error('folders.find called');
        };
        const result = groupConversationsByTime([conv('a', { folderId: 'f' }), conv('b', { folderId: 'f' })], folders);
        expect(ids(result).today).toEqual(['a', 'b']);
    });

    it("reads each conversation's date a fixed number of times, not once per comparison", () => {
        const reads = new Map<string, number>();
        const convs = Array.from({ length: 200 }, (_, i) => {
            const c = conv(`c${i}`);
            const date = new Date(2026, 10, 24 - (i % 40), i % 24).toISOString();
            Object.defineProperty(c, 'date', {
                get: () => {
                    reads.set(c.id, (reads.get(c.id) ?? 0) + 1);
                    return date;
                },
            });
            return c;
        });
        groupConversationsByTime(convs, []);
        expect(Math.max(...Array.from(reads.values()))).toBeLessThanOrEqual(4);
    });

    it('does not reorder or mutate its input', () => {
        const convs = [conv('old', { date: '2026-01-01T00:00:00.000Z' }), conv('new', { date: new Date().toISOString() })];
        const before = [...convs];
        groupConversationsByTime(convs, []);
        expect(convs).toEqual(before);
    });

    it('matches the reference implementation on generated inputs', () => {
        for (let seed = 1; seed <= 500; seed++) {
            const { conversations, folders, archiveDays } = generateInput(seed);
            const actual = groupConversationsByTime(conversations, folders, archiveDays);
            const expected = referenceGroup(conversations, folders, archiveDays);
            expect(ids(actual), `seed ${seed}`).toEqual(ids(expected));
        }
    });
});

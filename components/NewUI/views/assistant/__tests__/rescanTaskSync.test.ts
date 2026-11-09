import { describe, it, expect, vi } from 'vitest';
import { hasRescanWork, rescanSignature, rescanSignatureChanged, sameTaskIds, syncRescanTasks, withScheduledTaskIds, RescanSyncInput, RescanTaskDeps } from '../rescanTaskSync';

const baseInput = (over: Partial<RescanSyncInput> = {}): RescanSyncInput => ({
    existing: undefined,
    dataSources: [],
    websiteUrls: [{ url: 'https://a.test' }],
    driveSchedule: { enabled: false, frequency: 'none' },
    hasDriveFiles: true,
    driveAllowed: true,
    assistantInfo: { name: 'Ast', assistantId: 'ast-1' },
    ...over,
});

const deps = (over: Partial<RescanTaskDeps> = {}): RescanTaskDeps & { manageTask: ReturnType<typeof vi.fn> } => {
    const manageTask = vi.fn(async (p: any) => (p.needsScheduledTask ? p.currentTaskId ?? `new-${p.scheduledUse}` : null));
    return { manageTask, websiteCron: () => '0 2 * * *', driveCron: (s: any) => (s.enabled && s.frequency !== 'none' ? '0 9 * * 1' : null), ...over } as any;
};

describe('syncRescanTasks', () => {
    it('creates a website task when a website has a frequency', async () => {
        const d = deps();
        const out = await syncRescanTasks(baseInput(), d);
        expect(out).toEqual({ ids: { websites: 'new-websites' }, failed: [] });
        expect(d.manageTask).toHaveBeenCalledWith(expect.objectContaining({ scheduledUse: 'websites', needsScheduledTask: true, cronExpression: '0 2 * * *', currentTaskId: undefined }));
    });

    it('asks for deletion when no website has a frequency any more', async () => {
        const d = deps({ websiteCron: () => null });
        const out = await syncRescanTasks(baseInput({ existing: { websites: 'old' } }), d);
        expect(d.manageTask).toHaveBeenCalledWith(expect.objectContaining({ scheduledUse: 'websites', needsScheduledTask: false, currentTaskId: 'old' }));
        expect(out.ids).toEqual({});
        expect(out.failed).toEqual([]);
    });

    it('needs a website entry, not just a cron', async () => {
        const d = deps();
        await syncRescanTasks(baseInput({ websiteUrls: [] }), d);
        expect(d.manageTask).toHaveBeenCalledWith(expect.objectContaining({ scheduledUse: 'websites', needsScheduledTask: false }));
    });

    it('creates the drive task from an enabled schedule with drive files', async () => {
        const d = deps({ websiteCron: () => null });
        const out = await syncRescanTasks(baseInput({ driveSchedule: { enabled: true, frequency: 'weekly' } }), d);
        expect(out.ids).toEqual({ driveFiles: 'new-driveFiles' });
    });

    it('drops the drive task when no drive files remain', async () => {
        const d = deps({ websiteCron: () => null });
        const out = await syncRescanTasks(
            baseInput({ existing: { driveFiles: 'dt' }, driveSchedule: { enabled: true, frequency: 'weekly' }, hasDriveFiles: false }),
            d,
        );
        expect(d.manageTask).toHaveBeenCalledWith(expect.objectContaining({ scheduledUse: 'driveFiles', needsScheduledTask: false, currentTaskId: 'dt' }));
        expect(out.ids).toEqual({});
    });

    it('leaves the drive task alone while its schedule has not loaded', async () => {
        const d = deps({ websiteCron: () => null });
        const out = await syncRescanTasks(baseInput({ existing: { driveFiles: 'dt' }, driveSchedule: null }), d);
        expect(d.manageTask.mock.calls.some(([p]) => p.scheduledUse === 'driveFiles')).toBe(false);
        expect(out.ids).toEqual({ driveFiles: 'dt' });
    });

    it('leaves the drive task alone where drive refresh is not offered', async () => {
        const d = deps({ websiteCron: () => null });
        const out = await syncRescanTasks(baseInput({ existing: { driveFiles: 'dt' }, driveAllowed: false }), d);
        expect(d.manageTask.mock.calls.some(([p]) => p.scheduledUse === 'driveFiles')).toBe(false);
        expect(out.ids).toEqual({ driveFiles: 'dt' });
    });

    it('reports a wanted task that could not be created', async () => {
        const d = deps();
        d.manageTask.mockResolvedValue(null);
        const out = await syncRescanTasks(baseInput({ driveSchedule: { enabled: true, frequency: 'daily' } }), d);
        expect(out.failed).toEqual(['websites', 'driveFiles']);
        expect(out.ids).toEqual({});
    });

    it('keeps the previous id and reports failure when the task call throws', async () => {
        const d = deps();
        d.manageTask.mockRejectedValue(new Error('boom'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const out = await syncRescanTasks(baseInput({ existing: { websites: 'old' }, driveSchedule: null }), d);
        expect(out).toEqual({ ids: { websites: 'old' }, failed: ['websites'] });
        spy.mockRestore();
    });
});

describe('task id helpers', () => {
    it('compares ids with absent equal to empty', () => {
        expect(sameTaskIds(undefined, {})).toBe(true);
        expect(sameTaskIds({ websites: 'a' }, { websites: 'a' })).toBe(true);
        expect(sameTaskIds({ websites: 'a' }, { websites: 'b' })).toBe(false);
        expect(sameTaskIds({ driveFiles: 'a' }, undefined)).toBe(false);
    });

    it('sets, replaces and removes scheduledTaskIds without mutating', () => {
        const data = { k: 1, scheduledTaskIds: { websites: 'old', driveFiles: 'd' } };
        expect(withScheduledTaskIds(data, { websites: 'new' })).toEqual({ k: 1, scheduledTaskIds: { websites: 'new' } });
        expect(withScheduledTaskIds(data, {})).toEqual({ k: 1 });
        expect(withScheduledTaskIds({ k: 1 }, { driveFiles: 'x' })).toEqual({ k: 1, scheduledTaskIds: { driveFiles: 'x' } });
        expect(data.scheduledTaskIds.websites).toBe('old');
    });

    it('keeps task kinds it does not manage', () => {
        expect(withScheduledTaskIds({ scheduledTaskIds: { other: 'o', websites: 'w' } }, {})).toEqual({ scheduledTaskIds: { other: 'o' } });
    });
});

describe('schedule change detection', () => {
    const base = { websiteUrls: [] as any[], driveSchedule: null, hasDriveFiles: false, driveAllowed: true };
    const weekly = { enabled: true, frequency: 'weekly' as const, time: '09:00', dayOfWeek: 1, dayOfMonth: 1 };

    it('sees no change when nothing about the schedules was touched', () => {
        const urls = [{ sourceUrl: 'https://a.test', scanFrequency: 7 }, { sourceUrl: 'https://b.test' }];
        expect(rescanSignatureChanged(rescanSignature({ ...base, websiteUrls: urls }), rescanSignature({ ...base, websiteUrls: [...urls].reverse() }))).toBe(false);
    });

    it('sees a website schedule attached, changed and removed', () => {
        const none = rescanSignature({ ...base, websiteUrls: [{ sourceUrl: 'https://a.test' }] });
        const w7 = rescanSignature({ ...base, websiteUrls: [{ sourceUrl: 'https://a.test', scanFrequency: 7 }] });
        const w30 = rescanSignature({ ...base, websiteUrls: [{ sourceUrl: 'https://a.test', scanFrequency: 30 }] });
        expect(rescanSignatureChanged(none, w7)).toBe(true);
        expect(rescanSignatureChanged(w7, w30)).toBe(true);
        expect(rescanSignatureChanged(w7, none)).toBe(true);
    });

    it('sees a drive schedule change only with drive files', () => {
        const off = rescanSignature({ ...base, driveSchedule: { enabled: false, frequency: 'none' }, hasDriveFiles: true });
        const on = rescanSignature({ ...base, driveSchedule: weekly, hasDriveFiles: true });
        const noFiles = rescanSignature({ ...base, driveSchedule: weekly, hasDriveFiles: false });
        expect(rescanSignatureChanged(off, on)).toBe(true);
        expect(rescanSignatureChanged(off, noFiles)).toBe(false);
    });

    it('ignores a drive schedule that has not loaded', () => {
        const saved = rescanSignature({ ...base, driveSchedule: weekly, hasDriveFiles: true });
        const unloaded = rescanSignature({ ...base, driveSchedule: null, hasDriveFiles: true });
        expect(rescanSignatureChanged(saved, unloaded)).toBe(false);
    });

    it('has no work only when nothing is wanted and no task exists', () => {
        const none = rescanSignature(base);
        expect(hasRescanWork(none, undefined)).toBe(false);
        expect(hasRescanWork(none, { websites: 'w' })).toBe(true);
        expect(hasRescanWork(none, { driveFiles: 'd' })).toBe(false); // drive not loaded: left alone
        expect(hasRescanWork(rescanSignature({ ...base, driveSchedule: { enabled: false, frequency: 'none' } }), { driveFiles: 'd' })).toBe(true);
        expect(hasRescanWork(rescanSignature({ ...base, websiteUrls: [{ sourceUrl: 'https://a.test', scanFrequency: 1 }] }), undefined)).toBe(true);
    });
});

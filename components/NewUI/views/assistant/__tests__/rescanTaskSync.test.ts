import { describe, it, expect, vi } from 'vitest';
import { sameTaskIds, syncRescanTasks, withScheduledTaskIds, RescanSyncInput, RescanTaskDeps } from '../rescanTaskSync';

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

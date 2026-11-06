/**
 * Brings an assistant's two rescan tasks (websites, drive files) in line with what the editor shows.
 *
 * The task plumbing (`utils/app/scheduledTasks`) is injected: it pulls in classic-UI components, and
 * the decisions here — when to create, update or delete, and when to leave a task alone — are the part
 * worth testing without them.
 *
 * Differences from the old modal worth knowing:
 *   - A drive schedule that was never loaded (`null`) leaves the existing task alone. The old code read
 *     "not loaded" as "off" and deleted the task.
 *   - A schedule that couldn't be created is reported in `failed` rather than vanishing; the assistant
 *     itself is already saved, so the caller warns instead of failing the save.
 * No React imports.
 */

import type { AttachedDocument } from '@/types/attacheddocument';
import { websiteScheduleRows } from './refreshScheduleModel';
import type { DriveRescanSchedule } from '@/components/Promptbar/components/AssistantModalComponents/AssistantDriveDataSources';

export type RescanTaskKind = 'websites' | 'driveFiles';
export type RescanTaskIds = Partial<Record<RescanTaskKind, string>>;

export interface RescanTaskDeps {
    manageTask: (params: {
        currentTaskId?: string | null;
        needsScheduledTask: boolean;
        cronExpression?: string | null;
        scheduledUse: RescanTaskKind;
        assistantInfo: { name: string; assistantId: string };
        dataSources?: AttachedDocument[];
    }) => Promise<string | null>;
    websiteCron: (dataSources: AttachedDocument[]) => string | null;
    driveCron: (schedule: DriveRescanSchedule) => string | null;
}

export interface RescanSyncInput {
    /** `data.scheduledTaskIds` as last saved. */
    existing: RescanTaskIds | undefined;
    dataSources: AttachedDocument[];
    websiteUrls: unknown[];
    /** `null` = never loaded; leave the drive task alone. */
    driveSchedule: DriveRescanSchedule | null;
    /** The assistant has drive files to refresh. */
    hasDriveFiles: boolean;
    /** Drive refresh is offered for this kind of assistant (not a group one). */
    driveAllowed: boolean;
    assistantInfo: { name: string; assistantId: string };
}

export interface RescanSyncResult {
    ids: RescanTaskIds;
    /** Tasks that were wanted but couldn't be set up. */
    failed: RescanTaskKind[];
}

const compact = (ids: Record<string, string | null | undefined>): RescanTaskIds => {
    const out: RescanTaskIds = {};
    if (ids.websites) out.websites = ids.websites;
    if (ids.driveFiles) out.driveFiles = ids.driveFiles;
    return out;
};

export const syncRescanTasks = async (input: RescanSyncInput, deps: RescanTaskDeps): Promise<RescanSyncResult> => {
    const { existing, dataSources, websiteUrls, driveSchedule, hasDriveFiles, driveAllowed, assistantInfo } = input;
    const failed: RescanTaskKind[] = [];

    // Websites
    const websiteCron = deps.websiteCron(dataSources);
    const needsWebsiteTask = websiteCron !== null && websiteUrls.length > 0;
    let websites: string | null | undefined = existing?.websites;
    try {
        websites = await deps.manageTask({
            currentTaskId: existing?.websites,
            needsScheduledTask: needsWebsiteTask,
            cronExpression: websiteCron,
            scheduledUse: 'websites',
            assistantInfo,
            dataSources,
        });
        if (needsWebsiteTask && !websites) failed.push('websites');
    } catch (error) {
        console.error('Error managing website refresh task:', error);
        failed.push('websites');
    }

    // Drive files
    let driveFiles: string | null | undefined = existing?.driveFiles;
    if (driveAllowed && driveSchedule !== null) {
        const driveCron = deps.driveCron(driveSchedule);
        const needsDriveTask = driveCron !== null && hasDriveFiles;
        try {
            driveFiles = await deps.manageTask({
                currentTaskId: existing?.driveFiles,
                needsScheduledTask: needsDriveTask,
                cronExpression: driveCron,
                scheduledUse: 'driveFiles',
                assistantInfo,
                dataSources,
            });
            if (needsDriveTask && !driveFiles) failed.push('driveFiles');
        } catch (error) {
            console.error('Error managing drive refresh task:', error);
            failed.push('driveFiles');
        }
    }

    return { ids: compact({ websites, driveFiles }), failed };
};

/**
 * What the user has asked to be refreshed, as comparable text. Cron strings are not compared: the website
 * one depends on the current time, so it differs between two reads of the same settings.
 *   - `websites`: each scheduled website and its frequency; `''` when none is scheduled.
 *   - `driveFiles`: the drive schedule when it is on and there are drive files, else `''`;
 *     `null` when it cannot be compared (not loaded, or drive refresh is not offered).
 */
export interface RescanSignature { websites: string; driveFiles: string | null }

export const rescanSignature = (input: {
    websiteUrls: unknown[];
    driveSchedule: DriveRescanSchedule | null;
    hasDriveFiles: boolean;
    driveAllowed: boolean;
}): RescanSignature => {
    const websites = websiteScheduleRows(input.websiteUrls)
        .filter((row) => row.scanFrequency !== null)
        .map((row) => `${row.sourceUrl}|${row.scanFrequency}`)
        .sort()
        .join('\n');
    const schedule = input.driveSchedule;
    const driveFiles = !input.driveAllowed || schedule === null
        ? null
        : schedule.enabled && schedule.frequency !== 'none' && input.hasDriveFiles
            ? [schedule.frequency, schedule.time, schedule.dayOfWeek, schedule.dayOfMonth].join('|')
            : '';
    return { websites, driveFiles };
};

/** A schedule was attached, removed or changed. A drive schedule that cannot be compared never counts. */
export const rescanSignatureChanged = (before: RescanSignature, after: RescanSignature): boolean =>
    before.websites !== after.websites || (after.driveFiles !== null && before.driveFiles !== after.driveFiles);

/** Nothing is wanted and no task exists, so there is nothing to create, update or delete. */
export const hasRescanWork = (sig: RescanSignature, existing: RescanTaskIds | undefined): boolean =>
    !!sig.websites || !!existing?.websites || (sig.driveFiles !== null && (!!sig.driveFiles || !!existing?.driveFiles));

export const sameTaskIds = (a: RescanTaskIds | undefined, b: RescanTaskIds | undefined): boolean =>
    (a?.websites ?? '') === (b?.websites ?? '') && (a?.driveFiles ?? '') === (b?.driveFiles ?? '');

/**
 * `data` with `scheduledTaskIds` set to `ids`, or removed when there are none. Returns a copy.
 * Other ids in the stored object (none today) are kept, so a future task kind isn't dropped here.
 */
export const withScheduledTaskIds = (data: Record<string, any>, ids: RescanTaskIds): Record<string, any> => {
    const { scheduledTaskIds: previous, ...rest } = data;
    const { websites: _w, driveFiles: _d, ...other } = (previous && typeof previous === 'object' ? previous : {}) as Record<string, any>;
    const next = { ...other, ...ids };
    return Object.keys(next).length > 0 ? { ...rest, scheduledTaskIds: next } : rest;
};

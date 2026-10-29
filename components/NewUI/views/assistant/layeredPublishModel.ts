/**
 * Publishing a layered assistant at `/assistants/<path>` — the decisions around it, separated from the
 * panel that collects the input.
 *
 * The old builder silently skipped publishing when the typed path hadn't been validated, so a user
 * could type a path, press Save and end up unpublished with no message. `publishBlocker` turns that
 * into a reason the builder shows before saving.
 *
 * No React imports.
 */

import type { AstPathData } from '@/components/Promptbar/components/AssistantModalComponents/AssistantPathEditor';

export interface PublishState {
    /** What the user has typed (may be empty = not published). */
    path: string;
    /** The path already saved for this assistant, '' if none. */
    savedPath: string;
    /** The typed path passed every check (shape, reserved words, appropriateness, not taken). */
    available: boolean;
    checking: boolean;
    /** Why the typed path was rejected, '' when fine. */
    error: string;
    accessData: AstPathData;
    originalAccessData: AstPathData;
}

export const PUBLIC_ACCESS: AstPathData = { isPublic: true, accessTo: { amplifyGroups: [], users: [] } };

const same = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x) => b.includes(x));

/** True when who-can-open-it differs from what was saved. */
export function isAccessChanged(a: AstPathData | null | undefined, b: AstPathData | null | undefined): boolean {
    if (!a && !b) return false;
    if (!a || !b) return true;
    return a.isPublic !== b.isPublic || !same(a.accessTo?.amplifyGroups, b.accessTo?.amplifyGroups) || !same(a.accessTo?.users, b.accessTo?.users);
}

const norm = (path: string) => path.trim().toLowerCase();

/** The typed path is the one already saved: valid by definition, no checks or calls needed. */
export function isCurrentPath(state: Pick<PublishState, 'path' | 'savedPath'>): boolean {
    return !!norm(state.path) && norm(state.path) === norm(state.savedPath);
}

/**
 * A reason publishing can't go ahead as typed, or null when saving is fine (including "no path at
 * all", which simply means not published). `isGroup` layered assistants are always public.
 */
export function publishBlocker(state: PublishState, { isGroup }: { isGroup: boolean }): string | null {
    if (!norm(state.path)) return null;
    if (!isCurrentPath(state)) {
        if (state.checking) return 'Still checking the link — try again in a moment.';
        if (state.error) return state.error;
        if (!state.available) return 'Choose an available link, or clear it to save without publishing.';
    }
    if (!isGroup && !state.accessData.isPublic) {
        const { users = [], amplifyGroups = [] } = state.accessData.accessTo ?? {};
        if (users.length === 0 && amplifyGroups.length === 0) {
            return 'Add at least one person or group who can open it, or make it open to anyone with the link.';
        }
    }
    return null;
}

/** Whether `addAssistantPath` must be called on this save: a new/changed path, or changed access. */
export function shouldCallAddPath(state: PublishState): boolean {
    if (!norm(state.path)) return false;
    if (!isCurrentPath(state) && !state.available) return false;
    return !isCurrentPath(state) || isAccessChanged(state.accessData, state.originalAccessData);
}

/**
 * Publishing an assistant at `/assistants/<path>` — what a save has to send, separated from the editor
 * that collects the input. Every access type offers the same "Publish at a link" switch:
 *
 *   • Just for me ('private'): published, the link opens for anyone — or, restricted, only for you; the
 *     assistant stays 'Just for me' (see ACCESS_KIND_KEY — a path alone would make it read back as
 *     'I manage it').
 *   • I manage it, others can use it ('managed'): a list of people it is shared with, plus the switch.
 *     Published, the link opens for anyone — or, restricted, only for those people (and you).
 *     Switched off, the assistant still needs a path for those people to open it by, so it gets an
 *     internal restricted one (a generated `a-<hex>` key, never shown to the user).
 *   • Group ('collaborative'): published = members of the group can open it (the backend decides that
 *     from group membership, so there is no audience to pick).
 *
 * The backend ties the save and the path together in a way that is easy to get wrong:
 *   • A save whose `data.astPath` is missing is read as "unpublish" and releases the stored path. So an
 *     edit that merely forgets the path takes the assistant's link down.
 *   • A path is registered with a separate `add_path` call made *after* the save; it moves the assistant
 *     onto the new path and releases its old ones.
 *
 * `planAssistantPath` turns the editor's state into the `data` keys the save carries and the one
 * `add_path` call (if any) to make afterwards. If registration then fails, the assistant must end up
 * somewhere safe:
 *   • moving to (or staying on) an OPEN link, or any change that opens it up: the save keeps the old
 *     path, so a failure leaves it published exactly as before;
 *   • narrowing an open link (to a restricted one, or to none): the save omits the old path, so the
 *     backend releases it and a failure leaves the assistant closed — never still open to everyone
 *     after the user asked for it to be restricted.
 *
 * No React imports.
 */

import type { AstPathData } from '@/components/Promptbar/components/AssistantModalComponents/AssistantPathEditor';
import { isAccessChanged } from './layeredPublishModel';

export type AccessKind = 'private' | 'managed' | 'collaborative';

/**
 * `definition.data` key recording that a 'Just for me' assistant has a published link. Without it any
 * assistant with a path is read back as 'I manage it'.
 */
export const ACCESS_KIND_KEY = 'accessKind';

/** The internal path key given to a managed assistant that isn't published (see file header). */
export const GENERATED_PATH_PATTERN = /^a-[0-9a-f]{32}$/;

export const GROUP_PUBLIC_ACCESS: AstPathData = { isPublic: true, accessTo: { amplifyGroups: [], users: [] } };

/** The access type to open an assistant with. */
export function deriveAccessKind(def: { groupId?: string; astPath?: string; accessKind?: string }): AccessKind {
    if (def.groupId) return 'collaborative';
    if (def.accessKind === 'private') return 'private';
    return def.astPath ? 'managed' : 'private';
}

/**
 * Is the stored path a link people can open (as opposed to an internal key)? A group's path always is;
 * otherwise anything but a generated key is — whether it opens for anyone or only for those with access
 * (`astPathData.isPublic === false`; see `isRestrictedLink`).
 */
export function isPublishedLink(kind: AccessKind, path: string | undefined): boolean {
    if (!path) return false;
    if (kind === 'collaborative') return true;
    return !GENERATED_PATH_PATTERN.test(path);
}

/** A published link that only people with access can open. */
export function isRestrictedLink(kind: AccessKind, astPathData?: AstPathData | null): boolean {
    return kind !== 'collaborative' && astPathData?.isPublic === false;
}

export interface AssistantPathInput {
    kind: AccessKind;
    /** The "Publish at a link" switch. */
    publish: boolean;
    /** Published, but only people with access can open it ('private': just you; 'managed': the shared people). */
    linkRestricted?: boolean;
    /** The path typed in the editor (already cleaned). */
    slug: string;
    /** 'managed': the people it is shared with. */
    emails?: string[];
    /** 'managed' & unpublished: the internal key to use when the assistant has none yet. */
    generatedPath?: string;
    /** What is stored today, if anything. */
    existingPath?: string;
    existingAstPathData?: AstPathData;
}

export interface AssistantPathPlan {
    /** Keys to spread into the saved `definition.data`. Empty = no path (unpublished). */
    data: { astPath?: string; astPathData?: AstPathData };
    /** The `add_path` call to make once the save succeeded; null when the stored path already stands. */
    register: { path: string; astPathData: AstPathData } | null;
    /** The assistant ends up with a path (published or an internal key). */
    hasPath: boolean;
}

const norm = (p: string | undefined) => (p ?? '').trim().toLowerCase();

const NONE: AssistantPathPlan = { data: {}, register: null, hasPath: false };

export function planAssistantPath(input: AssistantPathInput): AssistantPathPlan {
    const { kind, publish, linkRestricted = false, emails = [], existingAstPathData } = input;
    const slug = norm(input.slug);
    const existing = norm(input.existingPath);

    // What the assistant should end up with.
    let target: { path: string; access: AstPathData } | null = null;
    if (publish && slug) {
        const access: AstPathData =
            kind === 'collaborative'
                ? existingAstPathData ?? GROUP_PUBLIC_ACCESS
                : { isPublic: !linkRestricted, accessTo: { amplifyGroups: [], users: kind === 'managed' ? emails : [] } };
        target = { path: slug, access };
    } else if (kind === 'managed' && !publish) {
        const key = GENERATED_PATH_PATTERN.test(existing) ? existing : norm(input.generatedPath);
        if (key) target = { path: key, access: { isPublic: false, accessTo: { amplifyGroups: [], users: emails } } };
    }

    // Nothing to publish (or switched on with nothing typed — the editor blocks saving that): omit the
    // path so the backend releases it.
    if (!target) return NONE;

    // A group's legacy path stored without access data stands as it is; elsewhere missing data is a change.
    const accessChanged = existingAstPathData
        ? isAccessChanged(existingAstPathData, target.access)
        : kind !== 'collaborative';

    if (target.path === existing && !accessChanged) {
        return {
            data: { astPath: existing, ...(existingAstPathData ? { astPathData: existingAstPathData } : {}) },
            register: null,
            hasPath: true,
        };
    }

    // New path, or new audience: register the new state afterwards. Keep the old path in the save unless
    // that would leave an open link standing after a failed attempt to restrict it (see file header).
    const wasOpen = !!existing && existingAstPathData?.isPublic !== false && !GENERATED_PATH_PATTERN.test(existing);
    const keepOld = !!existing && !(wasOpen && !target.access.isPublic);
    return {
        data: { ...(keepOld ? { astPath: existing } : {}), astPathData: target.access },
        register: { path: target.path, astPathData: target.access },
        hasPath: true,
    };
}

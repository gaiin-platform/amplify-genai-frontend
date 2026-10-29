/**
 * Assistant type-switch vocabulary for the assistant editor.
 *
 * A group assistant is owned by the group principal (`astgp/…`, created with the group's system
 * key), a private/shared one by the user. The backend cannot move an assistant between the two, so
 * crossing that line from the edit modal means "make a copy as the other kind" — never a save that
 * pretends to have converted it. Private <-> Shared is the same owner and stays an ordinary edit.
 *
 * No React imports.
 */

export type AssistantAccessType = 'private' | 'managed' | 'collaborative';

/** True when switching `source` -> `target` would change the assistant's owner (user <-> group). */
export function crossesGroupBoundary(sourceIsGroup: boolean, target: AssistantAccessType): boolean {
    return sourceIsGroup !== (target === 'collaborative');
}

/** Lower-case kind used in copy: "Group copy", "Private copy", "Shared copy". */
export function copyKindLabel(target: AssistantAccessType): string {
    switch (target) {
        case 'collaborative': return 'Group';
        case 'managed': return 'Shared';
        default: return 'Private';
    }
}

/** Default name for a copy made as `target`: "My helper (Group copy)". */
export function copyName(name: string | undefined, target: AssistantAccessType): string {
    return `${name?.trim() || 'Untitled assistant'} (${copyKindLabel(target)} copy)`;
}

/** Modal header for a copy made as `target`. */
export function copyModalTitle(target: AssistantAccessType): string {
    return `Make a ${copyKindLabel(target)} Copy`;
}

/** Wording for the "this can't be converted" confirmation. */
export function conversionDialogCopy(
    sourceIsGroup: boolean,
    target: AssistantAccessType,
): { title: string; message: string; confirmLabel: string } {
    const kind = copyKindLabel(target).toLowerCase();
    const confirmLabel = 'Create copy';
    const carried = 'with the same instructions and attachments';
    const note = ' It opens as a new assistant; changes you haven’t saved here won’t be included.';
    if (sourceIsGroup) {
        return {
            title: 'Group assistants can’t be converted',
            message:
                `This assistant is a group assistant and can’t be converted to a regular assistant. ` +
                `Would you like to create a ${kind} assistant ${carried}?${note}`,
            confirmLabel,
        };
    }
    return {
        title: 'Can’t convert to a group assistant',
        message:
            `A private or shared assistant can’t be converted to a group assistant. ` +
            `Would you like to create a group assistant ${carried}?${note}`,
        confirmLabel,
    };
}

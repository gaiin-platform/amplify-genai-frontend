/**
 * Assistant icon vocabulary — the React-free half of the "assistant icon" feature.
 *
 * An assistant's icon is an uploaded image stored on the definition as `data.astIcon`
 * (an `AttachedDocument` with an S3 `key`). The published page (`/assistants/<path>`)
 * already reads it from there; these helpers read and write the same field for the New UI
 * editor and the assistants list.
 */

export interface AssistantIconRef {
    /** S3 key of the uploaded image. */
    key: string;
    type?: string;
    /** Set for a group assistant — downloads need it. */
    groupId?: string;
    name?: string;
}

const asRecord = (value: unknown): Record<string, any> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : undefined;

const nonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value : undefined;

/**
 * Narrow a stored icon to something we can download, or `undefined`.
 * Stored data is untrusted (a share, an old record), so nothing is assumed: the backend's own
 * delete path accepts `key` or `metadata.contentKey` (`core.py`), so this does too.
 */
export const readIconRef = (value: unknown): AssistantIconRef | undefined => {
    const doc = asRecord(value);
    if (!doc) return undefined;
    const key = nonEmptyString(doc.key) ?? nonEmptyString(asRecord(doc.metadata)?.contentKey);
    if (!key) return undefined;
    return {
        key,
        type: nonEmptyString(doc.type),
        groupId: nonEmptyString(doc.groupId),
        name: nonEmptyString(doc.name),
    };
};

/** The icon of a stored assistant `Prompt` (the list row's data shape). */
export const promptIconRef = (prompt: { data?: unknown } | null | undefined): AssistantIconRef | undefined => {
    const data = asRecord(prompt?.data);
    if (!data) return undefined;
    return (
        readIconRef(data.astIcon) ??
        readIconRef(asRecord(asRecord(asRecord(data.assistant)?.definition)?.data)?.astIcon)
    );
};

/** The icon of a layered assistant — its settings sit on the object and, from the list endpoint, in `data` too. */
export const layeredIconRef = (la: unknown): AssistantIconRef | undefined => {
    const record = asRecord(la);
    if (!record) return undefined;
    return readIconRef(record.astIcon) ?? readIconRef(asRecord(record.data)?.astIcon);
};

/**
 * What gets stored: the identifying fields only. The upload handler's document can still carry
 * the `File` (`raw`) and its bytes (`data`); neither belongs on an assistant record.
 */
export const toStoredIcon = (doc: Record<string, any>, groupId?: string): Record<string, any> => {
    const stored: Record<string, any> = {
        id: doc.id,
        name: doc.name,
        type: doc.type,
        key: doc.key,
        raw: null,
        data: null,
    };
    if (doc.metadata) stored.metadata = doc.metadata;
    const group = groupId ?? doc.groupId;
    if (group) stored.groupId = group;
    return stored;
};

/**
 * `data` with its icon set to `icon`, or with `astIcon` removed when there is none. Returns a copy.
 * The editor rebuilds `data` from scratch (§5 rule 42), so a cleared icon must be *absent*, not
 * carried forward from the preserved keys.
 */
export const withAstIcon = (
    data: Record<string, any>,
    icon: Record<string, any> | undefined,
): Record<string, any> => {
    const { astIcon: _previous, ...rest } = data;
    return icon ? { ...rest, astIcon: icon } : rest;
};

/**
 * The uploaded icon files to delete once a save succeeded: every queued key, once, except the one
 * the assistant now uses (a user can replace an icon and change their mind).
 */
export const iconKeysToDelete = (queued: readonly string[], savedKey: string | undefined): string[] =>
    Array.from(new Set(queued.filter((key) => !!key && key !== savedKey)));

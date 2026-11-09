/**
 * Tag-list vocabulary behind `TagChipsInput` — add tags from free text ("a, b ,c"), trimming,
 * dropping blanks and case-insensitive duplicates, and cap the total.
 *
 * No React imports.
 */

export const DEFAULT_MAX_TAGS = 50;
export const DEFAULT_MAX_TAG_LENGTH = 60;

export function addTags(
    current: string[],
    raw: string,
    { maxTags = DEFAULT_MAX_TAGS, maxLength = DEFAULT_MAX_TAG_LENGTH }: { maxTags?: number; maxLength?: number } = {},
): string[] {
    const next = [...current];
    raw.split(',').forEach((piece) => {
        const tag = piece.trim().slice(0, maxLength);
        if (!tag || next.length >= maxTags) return;
        if (next.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
        next.push(tag);
    });
    return next;
}

export function removeTag(current: string[], tag: string): string[] {
    return current.filter((t) => t !== tag);
}

/**
 * skillReferenceModel — keeping a skill's display name on the reference an assistant stores.
 *
 * An assistant stores `{ skillId, isRequired }` per skill. Someone the assistant is shared with often
 * cannot read the skill itself, so without a stored `name` they could only be shown an id. The editor
 * stamps the name when a skill is attached and backfills it for references saved before that.
 * No React imports.
 */

import type { SkillReference } from '@/types/skill';

/** A new reference to `skillId`, carrying its name when it is known. */
export const newSkillReference = (skillId: string, name?: string): SkillReference => ({
    skillId,
    isRequired: true,
    ...(name ? { name } : {}),
});

/**
 * Fills in the missing names that `namesById` knows. Returns the SAME array when nothing changed, so a
 * caller can use `result !== refs` to decide whether to update state (an effect built on this cannot loop).
 */
export const backfillSkillNames = (
    refs: SkillReference[],
    namesById: ReadonlyMap<string, string | undefined>,
): SkillReference[] => {
    let changed = false;
    const next = refs.map((ref) => {
        const name = namesById.get(ref.skillId);
        if (ref.name || !name) return ref;
        changed = true;
        return { ...ref, name };
    });
    return changed ? next : refs;
};

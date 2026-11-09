/**
 * An assistant that enforces a model can also enforce a reasoning level (`data.enforceThinkingLevel` +
 * `data.thinkingLevel`; consumed by `useChatSendService` and `shared/outputTokenBudget`).
 *
 * The editor used to neither show nor save these, and later carried them forward blindly — so an
 * assistant could keep enforcing a level the editor displayed as "off" and could not clear. They are
 * now a managed pair: read when the editor opens, written on every save, and dropped whenever the model
 * is no longer enforced (the old `AssistantModal` did the same).
 *
 * In the New UI picker "off" means *no enforced level*. A legacy assistant that enforced the level
 * "off" (reasoning disabled) is kept as it was unless the user picks another level.
 *
 * No React imports.
 */

export type EnforcedEffort = 'low' | 'medium' | 'high' | 'off';

const LEVELS: readonly string[] = ['low', 'medium', 'high', 'off'];

const isLevel = (value: unknown): value is EnforcedEffort => typeof value === 'string' && LEVELS.includes(value);

/** What the effort picker should show for a stored definition's `data`. */
export function readEnforcedEffort(data: Record<string, any> | undefined | null): EnforcedEffort {
    return data?.enforceThinkingLevel && isLevel(data.thinkingLevel) ? data.thinkingLevel : 'off';
}

export interface ThinkingFields {
    enforceThinkingLevel: boolean;
    thinkingLevel?: EnforcedEffort;
}

/** The two `data` keys to write for the current editor state. */
export function buildThinkingFields({
    enforceModel,
    effort,
    existing,
}: {
    enforceModel: boolean;
    effort: EnforcedEffort;
    existing?: Record<string, any> | null;
}): ThinkingFields {
    if (!enforceModel) return { enforceThinkingLevel: false };
    if (effort !== 'off') return { enforceThinkingLevel: true, thinkingLevel: effort };
    // "off" in the picker: not enforced — unless the stored definition deliberately enforced reasoning off.
    if (existing?.enforceThinkingLevel && existing.thinkingLevel === 'off') {
        return { enforceThinkingLevel: true, thinkingLevel: 'off' };
    }
    return { enforceThinkingLevel: false };
}

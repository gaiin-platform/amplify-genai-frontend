/**
 * emailSuggestions — the shared "who can I send this to?" vocabulary.
 *
 * `state.amplifyUsers` is a map of **username/systemId → email address** that
 * `home.tsx` fills once on load from `fetchEmailSuggestions("*")`. The pickers
 * built on it (`EmailChipsInput`, `NewUIShareModal`) need the same three things,
 * and each used to re-derive them inline:
 *
 *   1. the suggestion pool           → buildEmailPool() / normalizeEmailPool()
 *   2. prefix-then-substring ranking → rankEmailSuggestions()
 *   3. email → username on submit    → resolveUsernameForEmail()
 *
 * The map's values can be raw UUIDs — `home.tsx` falls back to the key when a
 * user has no mapped email — and those must never reach a dropdown.
 *
 * No React imports — this module is unit-testable under the `node` test
 * environment in vitest.config.ts.
 *
 * Location: components/NewUI/shared/emailSuggestions.ts
 */

/** Map shape of `state.amplifyUsers`: username/systemId → email address. */
export type AmplifyUsers = Record<string, string> | null | undefined;

export const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a bare UUID. These are internal ids and must never be displayed. */
export const isRawUUID = (value: unknown): boolean =>
    typeof value === 'string' && UUID_PATTERN.test(value.trim());

/** Default number of rows the dropdown shows. */
export const EMAIL_SUGGESTION_LIMIT = 8;

/**
 * Every address in `emails` that is a legitimate suggestion: minus raw UUIDs,
 * minus anything already chosen (`exclude`), de-duplicated case-insensitively
 * and sorted so the dropdown order is stable.
 */
export function normalizeEmailPool(
    emails: readonly unknown[],
    exclude: string[] = [],
): string[] {
    const excluded = new Set(
        exclude
            .filter((e): e is string => typeof e === 'string')
            .map((e) => e.trim().toLowerCase()),
    );

    const seen = new Set<string>();
    const pool: string[] = [];

    for (const value of emails) {
        if (typeof value !== 'string') continue;
        const email = value.trim();
        if (!email || isRawUUID(email)) continue;

        const lower = email.toLowerCase();
        if (seen.has(lower) || excluded.has(lower)) continue;

        seen.add(lower);
        pool.push(email);
    }

    return pool.sort((a, b) => a.localeCompare(b));
}

/** `normalizeEmailPool` over the values of `state.amplifyUsers`. */
export function buildEmailPool(
    amplifyUsers: AmplifyUsers,
    exclude: string[] = [],
): string[] {
    if (!amplifyUsers) return [];
    return normalizeEmailPool(Object.values(amplifyUsers), exclude);
}

/**
 * Rank a pool against what the user has typed: addresses that *start with* the
 * query come first (that is what people expect from an address field), then
 * addresses that merely contain it — so typing a last name still finds
 * `first.last@…`. An empty query returns the head of the pool.
 */
export function rankEmailSuggestions(
    pool: string[],
    query: string,
    limit: number = EMAIL_SUGGESTION_LIMIT,
): string[] {
    if (limit <= 0) return [];

    const q = (query ?? '').trim().toLowerCase();
    if (!q) return pool.slice(0, limit);

    const prefix: string[] = [];
    const contains: string[] = [];

    for (const email of pool) {
        const lower = email.toLowerCase();
        if (lower.startsWith(q)) prefix.push(email);
        else if (lower.includes(q)) contains.push(email);
    }

    return [...prefix, ...contains].slice(0, limit);
}

/**
 * The value the share/permission APIs actually want: the username keyed to this
 * address. Falls back to the address when the map has no entry, which is what
 * the old share modal did — an unmapped address is still worth attempting.
 */
export function resolveUsernameForEmail(
    email: string,
    amplifyUsers: AmplifyUsers,
): string {
    if (!amplifyUsers || !email) return email;

    const target = email.trim().toLowerCase();
    const match = Object.keys(amplifyUsers).find(
        (key) =>
            typeof amplifyUsers[key] === 'string' &&
            amplifyUsers[key].trim().toLowerCase() === target,
    );

    return match ?? email;
}

/**
 * Split pasted text (or a typed run of addresses) on commas, semicolons and
 * whitespace. Pasting a mail-client recipient list is the common case.
 */
export function splitEmailList(text: string): string[] {
    if (!text) return [];
    return text
        .split(/[,;\s]+/)
        .map((part) => part.trim())
        .filter(Boolean);
}

/** Loose address check — the backend owns the real validation. */
export const looksLikeEmail = (value: string): boolean =>
    typeof value === 'string' && /^[^@\s]+@[^@\s]+$/.test(value.trim());

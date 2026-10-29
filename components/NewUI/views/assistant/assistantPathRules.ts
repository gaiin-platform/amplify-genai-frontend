/**
 * Rules for the public URL path of a published assistant (`/assistants/<path>`): the shape a path
 * must have and the system words it may not use. Shared by the assistant creation modal and the
 * layered-assistant publish panel so the two can never disagree about what is a valid path.
 * (Availability and appropriateness are checked against the backend / an LLM by the caller.)
 *
 * No React imports.
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/** System-reserved path terms that users cannot use. */
export const SLUG_SYSTEM_TERMS = [
    'admin', 'system', 'login', 'signin', 'signup', 'register',
    'auth', 'authenticate', 'reset', 'password', 'billing', 'payment',
];

/** Lower-cases and strips everything but a-z, 0-9 and hyphens, capped at the maximum length. */
export function cleanSlug(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, SLUG_MAX_LENGTH);
}

/** Returns an error message for an invalid path, or '' when it is well-formed. */
export function validateSlug(value: string): string {
    if (!value.trim()) return 'URL path is required';
    if (!/^[a-z0-9-]+$/.test(value)) return 'Only lowercase letters, numbers, and hyphens allowed';
    if (value.length < SLUG_MIN_LENGTH) return `Minimum ${SLUG_MIN_LENGTH} characters`;
    if (value.length > SLUG_MAX_LENGTH) return `Maximum ${SLUG_MAX_LENGTH} characters`;
    return '';
}

/** Returns an error message if the path is (or starts/ends with) a restricted system term, else ''. */
export function checkSlugSystemTerms(value: string): string {
    const lower = value.toLowerCase();
    for (const term of SLUG_SYSTEM_TERMS) {
        if (lower === term || lower.startsWith(term + '-') || lower.endsWith('-' + term)) {
            return `Path contains a restricted system term: "${term}"`;
        }
    }
    return '';
}

/**
 * shareOutcome — what a `shareItems()` response means for the people typed in.
 *
 * The backend only delivers to users already in the Amplify user table (anyone who
 * has signed in once). Everyone else comes back in `invalidUsers`:
 *   - none valid  → `{ success: false, message: 'No valid users…', invalidUsers }`
 *   - some valid  → `{ success: true, items, invalidUsers }` — a PARTIAL share that used
 *                   to be indistinguishable from a full one.
 *
 * `invalidUsers` holds the strings we sent (usernames, or the email when no username
 * was known), so each is matched back to the address the user typed — case-insensitively,
 * against both forms. An older backend sends no `invalidUsers`; then a failure with the
 * "No valid users" message is read as "nobody could be reached", and a success as full.
 *
 * No React imports.
 *
 * Location: components/NewUI/shared/shareOutcome.ts
 */

export interface ShareOutcome {
    /** 'failed' = failure for some other reason (generic message). */
    status: 'all' | 'partial' | 'none' | 'failed';
    /** Typed addresses that were shared with. */
    reached: string[];
    /** Typed addresses that never signed in, so were NOT shared with. */
    notSignedIn: string[];
}

const norm = (s: unknown): string => (typeof s === 'string' ? s.trim().toLowerCase() : '');

export function interpretShareResult(
    result: { success?: boolean; message?: string; invalidUsers?: unknown } | null | undefined,
    /** Typed addresses, index-aligned with `sentAs`. */
    emails: string[],
    /** What was actually sent as `sharedWith` for each address. */
    sentAs: string[],
): ShareOutcome {
    const invalid = new Set(
        Array.isArray(result?.invalidUsers) ? (result!.invalidUsers as unknown[]).map(norm).filter(Boolean) : [],
    );
    const notSignedIn = emails.filter(
        (email, i) => invalid.has(norm(sentAs[i])) || invalid.has(norm(email)),
    );
    const reached = emails.filter((e) => !notSignedIn.includes(e));

    if (result?.success) {
        return { status: notSignedIn.length > 0 ? 'partial' : 'all', reached, notSignedIn };
    }
    const nobodyValid =
        (emails.length > 0 && notSignedIn.length === emails.length) ||
        /no valid users/i.test(result?.message ?? '');
    if (nobodyValid) return { status: 'none', reached: [], notSignedIn: emails };
    return { status: 'failed', reached: [], notSignedIn: [] };
}

/** "a@x.com", "a@x.com and b@x.com", "a@x.com, b@x.com and c@x.com". */
export function joinEmails(emails: string[]): string {
    if (emails.length <= 1) return emails[0] ?? '';
    return `${emails.slice(0, -1).join(', ')} and ${emails[emails.length - 1]}`;
}

/** Shown when nobody on the list has signed in. */
export function noneSignedInMessage(emails: string[]): string {
    return emails.length === 1
        ? `${emails[0]} hasn’t signed in to Amplify yet. They need to sign in at least once before you can share with them.`
        : `${joinEmails(emails)} haven’t signed in to Amplify yet. They need to sign in at least once before you can share with them.`;
}

/** Shown beside a partial success. */
export function partialSignedInMessage(emails: string[]): string {
    return emails.length === 1
        ? `Not shared with ${emails[0]} — they haven’t signed in to Amplify yet.`
        : `Not shared with ${joinEmails(emails)} — they haven’t signed in to Amplify yet.`;
}

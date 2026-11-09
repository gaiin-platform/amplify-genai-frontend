/**
 * shareAssistantWithEmails — deliver an assistant to people's "Shared with me".
 *
 * The creation modal's "Specific people" access only registers a path allow-list
 * (`addAssistantPath`); that never reaches a recipient's Shared-with-me list. This runs the
 * same share the Share modal does (strip → `createExport` → `shareItems` → history + cache
 * invalidation) so both entry points behave identically. No React imports.
 */

import { Prompt } from '@/types/prompt';
import { createExport } from '@/utils/app/importExport';
import { shareItems } from '@/services/shareService';
import { resolveUsernameForEmail } from '@/components/NewUI/shared/emailSuggestions';
import { recordShare, resolveShareNote } from '@/components/NewUI/shared/shareHistory';
import { invalidateSharedItemsCache } from '@/components/NewUI/shared/sharedItemClassifier';
import { interpretShareResult } from '@/components/NewUI/shared/shareOutcome';

export interface AssistantShareResult {
    /** At least one person received it (or there was no one to share with). */
    ok: boolean;
    /** Addresses skipped because they have never signed in to Amplify. */
    notSignedIn: string[];
}

export async function shareAssistantWithEmails(opts: {
    prompt: Prompt;
    emails: string[];
    sharedBy: string;
    amplifyUsers: Record<string, string>;
}): Promise<AssistantShareResult> {
    const { prompt, emails, sharedBy, amplifyUsers } = opts;
    if (emails.length === 0) return { ok: true, notSignedIn: [] };

    // Deep copy so the caller's prompt is never mutated; drop sender-owned fields (as NewUIShareModal does).
    const toExport = JSON.parse(JSON.stringify(prompt));
    if (toExport.data) {
        delete toExport.data.workflowTemplateId;
        if (toExport.data.emailEvents) delete toExport.data.emailEvents.tag;
    }

    const sharedData = await createExport([], [], [toExport], 'share', false);
    const sharedWith = emails.map((email) => resolveUsernameForEmail(email, amplifyUsers));
    const result = await shareItems(
        sharedBy,
        sharedWith,
        resolveShareNote('', 'assistant', prompt.name),
        sharedData,
    );
    const outcome = interpretShareResult(result, emails, sharedWith);
    if (!result?.success) return { ok: false, notSignedIn: outcome.notSignedIn };

    recordShare(sharedBy, {
        type: 'assistant',
        sourceId: (prompt.data?.assistant?.definition as any)?.assistantId ?? prompt.id,
        sourceName: prompt.name,
        sharedWith: outcome.reached,
        note: '',
    });
    invalidateSharedItemsCache();
    return { ok: true, notSignedIn: outcome.notSignedIn };
}

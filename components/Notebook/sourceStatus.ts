import type { SourceListItem } from '@/services/notebookService';

/**
 * Helpers for showing a source's processing state.
 *
 * Open Notebook never returns raw job error text (it is sanitised to a generic
 * message server-side). Failed sources instead carry a fixed-vocabulary
 * `processing_info.error_code`, which we turn into an actionable message here so
 * the user can tell *why* a source failed (e.g. a site that blocks automated
 * access) instead of watching a "Processing..." row that never finishes.
 */

type StatusFields = Pick<SourceListItem, 'status' | 'processing_info'>;

const IN_FLIGHT_STATUSES = new Set(['new', 'queued', 'running']);

export type SourceActivity = 'processing' | 'failed' | 'idle';

export const getSourceActivity = (source: StatusFields): SourceActivity => {
    const status = source.status;
    if (status === 'failed' || status === 'error') return 'failed';
    if (status && IN_FLIGHT_STATUSES.has(status)) return 'processing';
    return 'idle';
};

export const isSourceInFlight = (source: StatusFields): boolean =>
    getSourceActivity(source) === 'processing';

export const getSourceFailureCode = (source: StatusFields): string | undefined => {
    const code = source.processing_info?.error_code;
    return typeof code === 'string' ? code : undefined;
};

const FAILURE_MESSAGES: Record<string, string> = {
    blocked:
        "This site blocks automated access, so it can't be imported. Copy the text and add it as a Text source, or upload a PDF.",
    not_found: 'This page was not found or is no longer available. Check the link and try again.',
    unreachable: 'The site could not be reached. Try again later.',
    empty: 'No readable text was found at this link.',
    unknown: 'Processing failed. Try again, or add the content as a Text source.',
};

// Own-property check so an unexpected code from the API (e.g. "constructor")
// can't resolve to something on Object.prototype instead of a message.
export const getSourceFailureMessage = (code?: string): string =>
    code && Object.prototype.hasOwnProperty.call(FAILURE_MESSAGES, code)
        ? FAILURE_MESSAGES[code]
        : FAILURE_MESSAGES.unknown;

/**
 * Turn a failed podcast episode's fixed-vocabulary `error_code` into an
 * actionable message. Open Notebook sanitises raw job errors to a generic string
 * server-side, so without this a failed episode only ever says "Processing
 * failed", even when the cause (e.g. content larger than the model's context
 * window) is something the user can fix.
 */

const MESSAGES: Record<string, string> = {
    content_too_long:
        "The selected content is larger than the AI model can process in one request. Delete this episode and generate it again using summaries instead of full content for large sources, or select fewer sources. (Retrying with the same content will fail again.)",
    rate_limited:
        'The AI provider is limiting requests right now. Wait a minute, then retry.',
    unavailable:
        'The AI provider was temporarily unavailable or timed out. Retry in a few minutes.',
};

const DEFAULT_MESSAGE = 'Podcast generation failed. Try again.';

// Own-property check so an unexpected code (e.g. "constructor") can never
// resolve to something on Object.prototype.
export const getPodcastFailureMessage = (
    code?: string | null,
    fallback?: string | null,
): string => {
    if (code && Object.prototype.hasOwnProperty.call(MESSAGES, code)) {
        return MESSAGES[code];
    }
    return fallback || DEFAULT_MESSAGE;
};

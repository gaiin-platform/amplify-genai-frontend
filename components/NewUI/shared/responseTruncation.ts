/**
 * responseTruncation — did this assistant reply stop because it hit the token limit?
 *
 * ── What the client can actually know ────────────────────────────────────────
 * `services/chatService` closes the stream at the first `finish_reason` and drops
 * it, and the backend's Bedrock / Responses / Gemini translators do not forward
 * `max_tokens` / `length` / `incomplete` either. The only channel that reaches a
 * message is backend `state` events, merged into `message.data.state`
 * (useChatSendService `metaHandler.state`). So there are two evidence levels:
 *
 *   reported — `data.state` carries a length stop reason (the backend emits it).
 *              Definitive.
 *   inferred — no text at all, but the model streamed reasoning. That is what a
 *              reasoning-eats-the-budget failure looks like, but it also looks like
 *              the user pressing Stop, so wording for it must stay hedged.
 *
 * Partial answers that merely end abruptly are NOT guessed at: without a reported
 * reason there is no reliable way to tell "cut off" from "finished".
 *
 * No React imports.
 */

import type { Message } from '@/types/chat';

/** Every provider's spelling of "stopped at the output-token ceiling". */
const LENGTH_STOP_REASONS = new Set([
  'length', // OpenAI chat completions
  'max_tokens', // Anthropic / Bedrock Converse
  'max_output_tokens', // OpenAI Responses (incomplete_details.reason)
  'max_completion_tokens',
  'model_context_window_exceeded', // Anthropic
  'max_tokens_reached',
]);

/** State keys a backend event may use for the stop reason. */
const STOP_REASON_KEYS = ['stopReason', 'finishReason', 'stop_reason', 'finish_reason'] as const;

export type TruncationKind =
  /** Some answer text was produced, then the limit was hit. */
  | 'cut-off'
  /** The limit was hit (or reasoning is all there is) and there is no answer text. */
  | 'no-answer';

export interface Truncation {
  kind: TruncationKind;
  /** True when the backend reported the stop reason; false when inferred. */
  reported: boolean;
  /** Reasoning was streamed for this reply. */
  reasoned: boolean;
}

export function isLengthStopReason(value: unknown): boolean {
  return typeof value === 'string' && LENGTH_STOP_REASONS.has(value.trim().toLowerCase());
}

/** Does `message.data.state` say the reply stopped at the token limit? */
export function reportsLengthStop(message: Pick<Message, 'data'>): boolean {
  const state = message.data?.state;
  if (!state || typeof state !== 'object') return false;
  if (state.truncated === true || state.hitTokenLimit === true) return true;
  return STOP_REASON_KEYS.some((k) => isLengthStopReason((state as Record<string, unknown>)[k]));
}

/**
 * @param isLast       only the newest reply can be continued or retried meaningfully
 * @param isStreaming  never classify a reply that is still arriving
 */
export function getTruncation(
  message: Pick<Message, 'role' | 'content' | 'data'> | undefined,
  opts: { isLast: boolean; isStreaming: boolean },
): Truncation | null {
  if (!message || message.role !== 'assistant' || opts.isStreaming) return null;

  const hasText = typeof message.content === 'string' && message.content.trim().length > 0;
  const reasoned = !!message.data?.state?.reasoning;
  const reported = reportsLengthStop(message);

  if (reported) return { kind: hasText ? 'cut-off' : 'no-answer', reported: true, reasoned };

  // Inferred: reasoning streamed, nothing else did. Only the latest reply — an older
  // empty one is history, not a live failure the user can act on.
  if (opts.isLast && !hasText && reasoned) {
    return { kind: 'no-answer', reported: false, reasoned: true };
  }
  return null;
}

export interface TruncationCopy {
  message: string;
  /** Present when sending a follow-up can finish the thought. */
  continueLabel?: string;
}

export function truncationCopy(t: Truncation): TruncationCopy {
  if (t.kind === 'cut-off') {
    return {
      message: 'Response was cut off because it reached the length limit.',
      continueLabel: 'Continue',
    };
  }
  if (t.reported) {
    return {
      message: t.reasoned
        ? 'No answer was produced: reasoning used up the whole length limit. Try a lower reasoning effort.'
        : 'No answer was produced because the response reached the length limit.',
    };
  }
  return {
    message:
      'No answer was produced. If the response was not stopped manually, reasoning may have used up the whole length limit — try a lower reasoning effort.',
  };
}

/** The follow-up a "Continue" click sends. Plain text, so it works with any model or assistant. */
export const CONTINUE_PROMPT =
  'Continue from exactly where your last message stopped. Do not repeat anything already written.';

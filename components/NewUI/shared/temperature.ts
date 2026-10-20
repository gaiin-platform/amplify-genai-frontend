/**
 * temperature — the one rule for a conversation's sampling temperature in the new UI.
 *
 * There is no temperature control in the new UI, so every new chat starts at the
 * default instead of inheriting the previous chat's value (home.tsx's
 * `handleNewConversation` copies `lastConversation.temperature`).
 *
 * The range is 0–1: the intersection of every provider we route to (Anthropic,
 * Bedrock Mistral/Llama/Nova accept 0–1; OpenAI and Gemini accept 0–2). Models that
 * take no temperature at all (gpt-5 / o-series, GPT-5.6 on Bedrock) have it dropped
 * server-side, and reasoning calls on Bedrock Claude force 1.0 there. No React imports.
 */

import { DEFAULT_TEMPERATURE } from '@/utils/app/const';

export { DEFAULT_TEMPERATURE };
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 1;

/** A finite number clamped to 0–1; anything else becomes the default. */
export function clampTemperature(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TEMPERATURE;
  return Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, value));
}

/**
 * The temperature a conversation should carry: the default for a new, empty chat
 * (so nothing leaks from the last one), otherwise its own value clamped to 0–1.
 * "Empty" means no messages in ANY of the three shapes (§36), so a compressed or
 * unhydrated record is never mistaken for a new chat.
 */
export function resolveConversationTemperature(conversation: {
  temperature?: unknown;
  messages?: unknown;
  compressedMessages?: unknown;
}): number {
  const isEmpty =
    Array.isArray(conversation.messages) &&
    conversation.messages.length === 0 &&
    !(Array.isArray(conversation.compressedMessages) && conversation.compressedMessages.length > 0);
  return isEmpty ? DEFAULT_TEMPERATURE : clampTemperature(conversation.temperature);
}

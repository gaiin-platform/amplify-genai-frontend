/**
 * outputTokenBudget — how many output tokens a request is allowed, derived from
 * the model and the reasoning effort. The ONE place this is decided.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * `max_tokens` is a single ceiling shared by the model's hidden reasoning and its
 * visible answer (OpenAI `max_completion_tokens`, Claude extended/adaptive
 * thinking, Gemini thinking). A ceiling that ignores effort lets high effort burn
 * the whole budget on reasoning and leave a clipped answer — or none.
 *
 *   maxTokens = min(modelLimit, max(modelLimit / 2, reasoningReserve + responseAllowance))
 *
 *   • reasoningReserve  — per effort level (`off` and non-reasoning models: 0)
 *   • responseAllowance — room for a full answer
 *   • modelLimit        — `model.outputTokenLimit` (admin-configured per model)
 *   • modelLimit / 2    — the previous default, kept as a floor so nothing that
 *                         used to fit now gets a smaller ceiling
 *
 * When the model limit is too small for both, the answer wins: the reasoning
 * reserve is shrunk so at least half of the limit (or the whole allowance, if
 * smaller) is still left for the answer.
 *
 * The ceiling is only a cap — the provider bills tokens actually produced.
 *
 * Tune the numbers in `DEFAULT_PROFILE` / `MODEL_PROFILE_OVERRIDES`; nothing else
 * in the app hard-codes them. No React imports.
 */

import type { Model } from '@/types/model';

export type EffortLevel = 'low' | 'medium' | 'high' | 'off';

export interface TokenProfile {
  /** Tokens set aside for reasoning at each effort level. */
  reasoning: Record<EffortLevel, number>;
  /** Tokens reserved for the visible answer, on top of the reasoning reserve. */
  response: number;
  /** Hard ceiling for this model. Omit to use the model's own `outputTokenLimit`. */
  maxOutput?: number;
}

export const DEFAULT_PROFILE: TokenProfile = {
  reasoning: { off: 0, low: 4_096, medium: 8_192, high: 16_384 },
  response: 16_384,
};

/**
 * Per-model tuning, matched case-insensitively against the model id then name
 * (first match wins). `maxOutput` here caps a model whose catalog limit is
 * higher than what it can really emit. Empty until a model needs it.
 *
 *   { match: 'sonnet-4', profile: { response: 24_000 } }
 */
export const MODEL_PROFILE_OVERRIDES: { match: string; profile: Partial<TokenProfile> }[] = [];

/** Used when a model reports no usable `outputTokenLimit`. Matches the old fallback. */
export const FALLBACK_OUTPUT_LIMIT = 4_096;

/** What the effort control shows when a conversation has not chosen one. */
export const DEFAULT_EFFORT: EffortLevel = 'medium';

export function isEffortLevel(value: unknown): value is EffortLevel {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'off';
}

export function resolveProfile(model: Pick<Model, 'id' | 'name'>): TokenProfile {
  const id = (model.id ?? '').toLowerCase();
  const name = (model.name ?? '').toLowerCase();
  const hit = MODEL_PROFILE_OVERRIDES.find((o) => {
    const m = o.match.toLowerCase();
    return id.includes(m) || name.includes(m);
  });
  if (!hit) return DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...hit.profile,
    reasoning: { ...DEFAULT_PROFILE.reasoning, ...(hit.profile.reasoning ?? {}) },
  };
}

/** The hard ceiling for a model: its configured limit, optionally lowered by its profile. */
export function resolveOutputLimit(model: Pick<Model, 'id' | 'name' | 'outputTokenLimit'>): number {
  const configured =
    Number.isFinite(model.outputTokenLimit) && model.outputTokenLimit > 0
      ? Math.floor(model.outputTokenLimit)
      : FALLBACK_OUTPUT_LIMIT;
  const cap = resolveProfile(model).maxOutput;
  return cap && cap > 0 ? Math.min(configured, Math.floor(cap)) : configured;
}

/**
 * Split of one request's ceiling. `total` is what to send as `max_tokens`;
 * `answerFloor` is the least of it that reasoning can never take.
 */
export interface OutputBudget {
  total: number;
  reasoning: number;
  response: number;
  answerFloor: number;
  limit: number;
}

export function computeOutputBudget(
  model: Pick<Model, 'id' | 'name' | 'outputTokenLimit' | 'supportsReasoning'>,
  effort: EffortLevel = DEFAULT_EFFORT,
): OutputBudget {
  const limit = resolveOutputLimit(model);
  const profile = resolveProfile(model);

  const response = Math.min(profile.response, limit);
  const answerFloor = Math.min(response, Math.ceil(limit / 2));

  const wanted = model.supportsReasoning && effort !== 'off' ? profile.reasoning[effort] : 0;
  const reasoning = Math.max(0, Math.min(wanted, limit - answerFloor));

  const total = Math.min(limit, Math.max(Math.floor(limit / 2), reasoning + response));
  return { total, reasoning, response, answerFloor, limit };
}

export function computeMaxOutputTokens(
  model: Pick<Model, 'id' | 'name' | 'outputTokenLimit' | 'supportsReasoning'>,
  effort: EffortLevel = DEFAULT_EFFORT,
): number {
  return computeOutputBudget(model, effort).total;
}

/** The assistant fields that override the conversation's own model/effort at send time. */
export interface AssistantEnforcement {
  model?: unknown;
  enforceThinkingLevel?: unknown;
  thinkingLevel?: unknown;
}

/**
 * The effort a request will really use. Mirrors `useChatSendService`
 * (:789-793): an assistant that enforces a thinking level beats the
 * conversation's `data.reasoningLevel`. Reading only the conversation would size
 * the budget for the wrong level on every enforced assistant.
 */
export function resolveEffectiveEffort(
  conversationEffort: unknown,
  assistantData?: AssistantEnforcement | null,
): EffortLevel {
  if (assistantData?.enforceThinkingLevel) {
    return isEffortLevel(assistantData.thinkingLevel) ? assistantData.thinkingLevel : DEFAULT_EFFORT;
  }
  return isEffortLevel(conversationEffort) ? conversationEffort : DEFAULT_EFFORT;
}

/**
 * The one entry point for callers: the ceiling for `model` under the conversation's
 * effort, honouring an assistant's enforced model and thinking level.
 * Returns `undefined` when there is no model to size against.
 */
export function maxTokensForRequest(args: {
  model: Model | undefined | null;
  conversationEffort?: unknown;
  assistantData?: AssistantEnforcement | null;
  availableModels?: Record<string, Model>;
}): number | undefined {
  const enforcedId =
    typeof args.assistantData?.model === 'string' ? args.assistantData.model : undefined;
  const model = (enforcedId && args.availableModels?.[enforcedId]) || args.model;
  if (!model) return undefined;
  return computeMaxOutputTokens(model, resolveEffectiveEffort(args.conversationEffort, args.assistantData));
}

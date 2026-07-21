// Fallback context-window catalog for registered model names, mirroring the
// name-pattern approach of modelDisplay.ts: registered names are usually raw
// Bedrock model IDs ("us.anthropic.claude-sonnet-4-6-20250514-v1:0") but can
// also be plain names from openai-compatible providers ("gemma-3-27b-it").
//
// The authoritative source is the backend's ModelResponse.context_window
// (open_notebook/ai/context_windows.py in the fork) — prefer that when
// present. This local table covers older backends that don't send the field
// and legacy profile entries that carry only a model name. It's deliberately
// limited to families this deployment can register (Bedrock + OpenAI +
// openai-compatible gemma); unknown models return null and the UI keeps its
// plain "N tokens" display.
//
// First matching pattern wins — keep specific variants above their family
// fallbacks (e.g. "nova-premier" before "nova-").
const CONTEXT_WINDOWS: [RegExp, number][] = [
    [/claude/i, 200_000],
    [/nova-premier/i, 1_000_000],
    [/nova-micro/i, 128_000],
    [/nova-(lite|pro)/i, 300_000],
    [/titan-text-lite/i, 4_000],
    [/titan-text-express/i, 8_000],
    [/titan-text-premier/i, 32_000],
    // Llama 3.1+ (Bedrock spells it llama3-1-…) moved to 128K; original
    // Llama 3 stayed at 8K. Llama 4 listed conservatively at 128K.
    [/llama-?4/i, 128_000],
    [/llama-?3[.-][123]/i, 128_000],
    [/llama-?3/i, 8_000],
    [/mistral-large|pixtral-large/i, 128_000],
    [/mixtral|mistral-7b|mistral-small/i, 32_000],
    [/command-r/i, 128_000],
    [/deepseek/i, 128_000],
    [/gpt-4\.1/i, 1_000_000],
    [/gpt-5/i, 400_000],
    [/gpt-4o|gpt-4-turbo/i, 128_000],
    [/gpt-3\.5/i, 16_000],
    [/gemma-?3/i, 128_000],
];

export const getContextWindow = (modelName: string): number | null => {
    for (const [pattern, window] of CONTEXT_WINDOWS) {
        if (pattern.test(modelName)) return window;
    }
    return null;
};

export type ContextUsageStatus = 'ok' | 'warn' | 'over';

// Thresholds are deliberately conservative: the backend counts tokens with
// tiktoken's o200k_base, which undercounts non-OpenAI tokenizers by ~10-20%,
// and the window must also fit the system prompt, chat history, and the
// model's response.
export const getContextUsageStatus = (
    tokens: number,
    window: number,
): ContextUsageStatus => {
    if (tokens >= window * 0.9) return 'over';
    if (tokens >= window * 0.7) return 'warn';
    return 'ok';
};

export const formatTokenLimit = (window: number): string => {
    if (window >= 1_000_000) return `${window / 1_000_000}M`;
    return `${Math.round(window / 1_000)}K`;
};

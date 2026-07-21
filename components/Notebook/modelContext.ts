import { Models } from '@/types/model';

// Context-window resolution for notebook model names.
//
// The authoritative source is Amplify's own admin model table — every model
// record there carries inputContextWindow, and the map is already in
// HomeContext as availableModels. Notebook model names don't always match
// Amplify ids byte-for-byte (notebook registers "us.anthropic.claude-…" style
// Bedrock IDs; Amplify ids may differ in region prefix / version suffix), so
// both sides are normalized before matching.
//
// The pattern table below is only a fallback for notebook models absent from
// Amplify's table (e.g. TTS-era leftovers or openai-compatible extras).
// Unknown models return null and the UI keeps its plain "N tokens" display.
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

// Canonical key for cross-catalog model-id comparison:
// "us.anthropic.claude-sonnet-4-6-20250514-v1:0" → "claude-sonnet-4-6".
// Mirrors the stripping steps of modelDisplay.formatModelName.
const normalizeModelKey = (id: string): string =>
    id
        .trim()
        .toLowerCase()
        .replace(/^(us|eu|apac|global)\./, '')
        .replace(/^[a-z0-9]+\./, '')
        .replace(/-v\d+(:\d+)?$/, '')
        .replace(/-\d{8}$/, '');

// Preferred entry point: look the model up in Amplify's admin model table
// (HomeContext availableModels — inputContextWindow is maintained there per
// deployment), falling back to the local pattern catalog above.
export const resolveContextWindow = (
    modelName: string,
    availableModels?: Models,
): number | null => {
    if (availableModels) {
        const key = normalizeModelKey(modelName);
        for (const model of Object.values(availableModels)) {
            if (normalizeModelKey(model.id) === key) {
                return model.inputContextWindow > 0 ? model.inputContextWindow : null;
            }
        }
    }
    return getContextWindow(modelName);
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

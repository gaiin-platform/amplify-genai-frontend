import { Models } from '@/types/model';

// Context-window resolution for notebook model names.
//
// The single source of truth is Amplify's admin model table (the model-rates
// DynamoDB table): every row carries InputContextWindow alongside the billing
// rates, is served by the available-models endpoint, and sits in HomeContext
// as availableModels. Notebook model names don't always match Amplify ids
// byte-for-byte (the notebook registers "us.anthropic.claude-…" style Bedrock
// IDs; Amplify ids may differ in region prefix / version suffix), so both
// sides are normalized before matching.
//
// No local fallback on a miss — a model without a table row also bills at $0,
// so the fix is seeding the row, not guessing a limit here. The UI simply
// keeps its plain "N tokens" display.

// Canonical key for model-id comparison:
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

export const resolveContextWindow = (
    modelName: string,
    availableModels?: Models,
): number | null => {
    if (!availableModels) return null;
    const key = normalizeModelKey(modelName);
    for (const model of Object.values(availableModels)) {
        if (normalizeModelKey(model.id) === key) {
            return model.inputContextWindow > 0 ? model.inputContextWindow : null;
        }
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

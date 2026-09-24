import { IconBulb, IconFileText, IconNotes } from '@tabler/icons-react';
import { formatTokenLimit, getContextUsageStatus } from './modelContext';

interface Props {
    sourcesInsights: number;
    sourcesFull: number;
    notesCount: number;
    tokenCount?: number;
    charCount?: number;
    // Context window (tokens) of the model currently answering, when known —
    // turns the plain token count into "used / limit" with a warning once the
    // selection approaches the model's capacity.
    contextWindow?: number | null;
    // Human label for that model, used in the warning message.
    modelLabel?: string | null;
}

const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
};

// Bar shown above the chat composer summarizing what's currently in context.
// Ported from open-notebook's ContextIndicator.
export const ContextIndicator = ({
    sourcesInsights,
    sourcesFull,
    notesCount,
    tokenCount,
    charCount,
    contextWindow,
    modelLabel,
}: Props) => {
    const hasContext = sourcesInsights + sourcesFull > 0 || notesCount > 0;

    const usage =
        contextWindow && tokenCount !== undefined && tokenCount > 0
            ? getContextUsageStatus(tokenCount, contextWindow)
            : null;
    const usageColor =
        usage === 'over'
            ? 'text-[--text-error]'
            : usage === 'warn'
              ? 'text-[--text-secondary]'
              : 'text-[--text-muted]';

    if (!hasContext) {
        return (
            <div className="flex-none border-t border-[--border-subtle] px-6 py-2 text-xs text-[--text-muted]">
                No sources or notes included in context. Toggle icons on cards to include them.
            </div>
        );
    }

    return (
        <div className="flex-none border-t border-[--border-subtle] bg-[--bg-app] px-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[--text-muted]">Context:</span>

                <div className="flex items-center gap-1.5">
                    {sourcesInsights > 0 && (
                        <span
                            title={`Insights for ${sourcesInsights} source${sourcesInsights !== 1 ? 's' : ''}`}
                            className="flex items-center gap-1 rounded-full border border-[--border-subtle] px-1.5 py-0.5 text-[11px] text-[--text-muted]"
                        >
                            <IconBulb size={12} />
                            {sourcesInsights}
                        </span>
                    )}
                    {sourcesFull > 0 && (
                        <span
                            title={`${sourcesFull} full source${sourcesFull !== 1 ? 's' : ''}`}
                            className="flex items-center gap-1 rounded-full border border-[--accent]/40 px-1.5 py-0.5 text-[11px] text-[--accent]"
                        >
                            <IconFileText size={12} />
                            {sourcesFull}
                        </span>
                    )}
                </div>

                {notesCount > 0 && (
                    <>
                        {(sourcesInsights > 0 || sourcesFull > 0) && (
                            <span className="text-[--text-muted]">•</span>
                        )}
                        <span
                            title={`${notesCount} full note${notesCount !== 1 ? 's' : ''}`}
                            className="flex items-center gap-1 rounded-full border border-[--accent]/40 px-1.5 py-0.5 text-[11px] text-[--accent]"
                        >
                            <IconNotes size={12} />
                            {notesCount}
                        </span>
                    </>
                )}
            </div>

            {(tokenCount !== undefined || charCount !== undefined) && (
                <div className={`flex items-center gap-1.5 text-xs ${usageColor}`}>
                    {tokenCount !== undefined && tokenCount > 0 && (
                        <span>
                            {formatNumber(tokenCount)}
                            {contextWindow ? ` / ${formatTokenLimit(contextWindow)}` : ''} tokens
                        </span>
                    )}
                    {tokenCount !== undefined &&
                        charCount !== undefined &&
                        tokenCount > 0 &&
                        charCount > 0 && <span>·</span>}
                    {charCount !== undefined && charCount > 0 && <span>{formatNumber(charCount)} chars</span>}
                </div>
            )}
            </div>

            {usage && usage !== 'ok' && contextWindow && (
                <p className={`mt-1 text-[11px] ${usageColor}`}>
                    {usage === 'over'
                        ? `Selected content likely exceeds the ~${formatTokenLimit(contextWindow)}-token context limit${modelLabel ? ` of ${modelLabel}` : ''} — replies will fail. Switch sources to Insights or deselect some content.`
                        : `Approaching the ~${formatTokenLimit(contextWindow)}-token context limit${modelLabel ? ` of ${modelLabel}` : ''}. Long chats may fail; consider switching sources to Insights.`}
                </p>
            )}
        </div>
    );
};

export default ContextIndicator;

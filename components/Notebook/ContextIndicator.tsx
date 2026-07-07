import { IconBulb, IconFileText, IconNotes } from '@tabler/icons-react';

interface Props {
    sourcesInsights: number;
    sourcesFull: number;
    notesCount: number;
    tokenCount?: number;
    charCount?: number;
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
}: Props) => {
    const hasContext = sourcesInsights + sourcesFull > 0 || notesCount > 0;

    if (!hasContext) {
        return (
            <div className="flex-none border-t border-gray-100 px-6 py-2 text-xs text-gray-500 dark:border-neutral-700/60 dark:text-gray-400">
                No sources or notes included in context. Toggle icons on cards to include them.
            </div>
        );
    }

    return (
        <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-2 dark:border-neutral-700/60 dark:bg-neutral-800/40">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Context:</span>

                <div className="flex items-center gap-1.5">
                    {sourcesInsights > 0 && (
                        <span
                            title={`Insights for ${sourcesInsights} source${sourcesInsights !== 1 ? 's' : ''}`}
                            className="flex items-center gap-1 rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[11px] text-amber-600 dark:border-amber-500/40 dark:text-amber-400"
                        >
                            <IconBulb size={12} />
                            {sourcesInsights}
                        </span>
                    )}
                    {sourcesFull > 0 && (
                        <span
                            title={`${sourcesFull} full source${sourcesFull !== 1 ? 's' : ''}`}
                            className="flex items-center gap-1 rounded-full border border-purple-300/60 px-1.5 py-0.5 text-[11px] text-purple-600 dark:border-purple-500/40 dark:text-purple-400"
                        >
                            <IconFileText size={12} />
                            {sourcesFull}
                        </span>
                    )}
                </div>

                {notesCount > 0 && (
                    <>
                        {(sourcesInsights > 0 || sourcesFull > 0) && (
                            <span className="text-gray-300 dark:text-neutral-600">•</span>
                        )}
                        <span
                            title={`${notesCount} full note${notesCount !== 1 ? 's' : ''}`}
                            className="flex items-center gap-1 rounded-full border border-purple-300/60 px-1.5 py-0.5 text-[11px] text-purple-600 dark:border-purple-500/40 dark:text-purple-400"
                        >
                            <IconNotes size={12} />
                            {notesCount}
                        </span>
                    </>
                )}
            </div>

            {(tokenCount !== undefined || charCount !== undefined) && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {tokenCount !== undefined && tokenCount > 0 && <span>{formatNumber(tokenCount)} tokens</span>}
                    {tokenCount !== undefined &&
                        charCount !== undefined &&
                        tokenCount > 0 &&
                        charCount > 0 && <span>/</span>}
                    {charCount !== undefined && charCount > 0 && <span>{formatNumber(charCount)} chars</span>}
                </div>
            )}
        </div>
    );
};

export default ContextIndicator;

/**
 * EmbeddingStatus — the "has this file actually been indexed?" affordances for a
 * data-source card or sitemap-page row.
 *
 *   <EmbeddingStatusText>   a coloured status word ("Completed", "2 failed")
 *   <EmbeddingReprocessButton>  the regenerate icon button
 *
 * Status is always carried by the word, never by colour alone. The pulse on in-flight
 * states is `.nui-ds-embed--busy`, defined (with its reduced-motion override) in the
 * `<DataSourceCardGrid>` style block, so both must render inside that grid.
 */

import React from 'react';
import { IconReload } from '@tabler/icons-react';

export type EmbeddingTone = 'success' | 'warning' | 'error' | 'neutral';

export interface EmbeddingStatusView {
    label: string;
    tone: EmbeddingTone;
    /** Still working — pulses. */
    busy?: boolean;
    /** Hover text. */
    title?: string;
}

const TONE_COLOR: Record<EmbeddingTone, string> = {
    success: 'var(--success-fg)',
    warning: 'var(--warning-fg)',
    error: 'var(--text-error)',
    neutral: 'var(--text-secondary)',
};

export const EmbeddingStatusText: React.FC<{ status: EmbeddingStatusView }> = ({ status }) => (
    <span
        title={status.title}
        className={status.busy ? 'nui-ds-embed--busy' : undefined}
        style={{ color: TONE_COLOR[status.tone], fontWeight: 500 }}
    >
        {status.label}
    </span>
);

export const EmbeddingReprocessButton: React.FC<{
    /** Name of the source, for the accessible label. */
    name: string;
    onClick: () => void;
}> = ({ name, onClick }) => (
    <button
        type="button"
        className="nui-ds-icon-btn"
        aria-label={`Regenerate text extraction and embeddings for ${name}`}
        title="Regenerate text extraction and embeddings for this file"
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }}
        style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
        }}
    >
        <IconReload size={15} aria-hidden="true" />
    </button>
);

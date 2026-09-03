/**
 * File drag-and-drop primitives for the New UI.
 *
 * Three exports, one behaviour:
 *   useFileDropTarget — handlers + active flag, for a region that already has
 *                       its own root element (the chat pane, the landing pane).
 *                       Nothing new is inserted into the DOM, so no layout risk.
 *   FileDropOverlay   — the "drop it here" affordance, absolutely positioned
 *                       inside the (position:relative) drop target.
 *   FileDropZone      — the two above wired to a wrapper div, for the simple case.
 *
 * Behaviour notes:
 *   • Only file drags activate. `dataTransfer.types` is inspected on
 *     dragenter/dragover, so dragging a conversation row (the sidebar's own
 *     HTML5 drag) never shows the overlay.
 *   • dragenter/dragleave fire for every descendant as the pointer moves, so a
 *     depth counter — not a boolean — decides when the drag has truly left.
 *   • The overlay is pointer-events:none and aria-hidden. Dropping is a
 *     convenience, never the only route (the ⊕ / upload buttons remain).
 *
 * Design rules (NEW_UI_GUIDE.md): tokens only, dark mode via tokens, and the
 * overlay's fade is disabled under prefers-reduced-motion.
 */

import React, { useCallback, useRef, useState } from 'react';
import { IconFilePlus } from '@tabler/icons-react';

/** Where the overlay is painted: 'fill' covers the target, 'inset' insets 4px. */
export type FileDropOverlayVariant = 'fill' | 'inset';

export interface UseFileDropTargetOptions {
    /** Receives the dropped files. Never called with an empty list. */
    onFiles: (files: File[]) => void;
    /** Ignore drags entirely (e.g. uploads disabled by feature flag). */
    disabled?: boolean;
}

export interface FileDropTarget {
    /** True while a file drag is over the target — render the overlay. */
    active: boolean;
    /** Spread onto the element that should accept drops. */
    dropHandlers: {
        onDragEnter: (e: React.DragEvent) => void;
        onDragOver: (e: React.DragEvent) => void;
        onDragLeave: (e: React.DragEvent) => void;
        onDrop: (e: React.DragEvent) => void;
    };
}

/** True when the drag payload actually carries files (not text or an element). */
function isFileDrag(e: React.DragEvent): boolean {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    // DataTransfer.types is a DOMStringList in older browsers — Array.from covers both.
    return Array.from(types as unknown as string[]).includes('Files');
}

export function useFileDropTarget({
    onFiles,
    disabled = false,
}: UseFileDropTargetOptions): FileDropTarget {
    const [active, setActive] = useState(false);
    // dragenter/dragleave bubble from every descendant; count depth instead of
    // toggling a flag, or moving over a child looks like leaving the region.
    const depth = useRef(0);

    const onDragEnter = useCallback(
        (e: React.DragEvent) => {
            if (disabled || !isFileDrag(e)) return;
            e.preventDefault();
            depth.current += 1;
            setActive(true);
        },
        [disabled],
    );

    const onDragOver = useCallback(
        (e: React.DragEvent) => {
            if (disabled || !isFileDrag(e)) return;
            // preventDefault on dragover is what makes the drop event fire at all.
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            // A drag that began outside the window can miss dragenter.
            setActive((prev) => prev || true);
        },
        [disabled],
    );

    const onDragLeave = useCallback(
        (e: React.DragEvent) => {
            if (disabled || !isFileDrag(e)) return;
            e.preventDefault();
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setActive(false);
        },
        [disabled],
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            if (disabled || !isFileDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            depth.current = 0;
            setActive(false);
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length > 0) onFiles(files);
        },
        [disabled, onFiles],
    );

    return { active, dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

export interface FileDropOverlayProps {
    /** Overlay caption. Keep it short — it renders on one line. */
    label?: string;
    /** Extra hint under the label, e.g. "PDF, Word, images…". */
    hint?: string;
    variant?: FileDropOverlayVariant;
}

export const FileDropOverlay: React.FC<FileDropOverlayProps> = ({
    label = 'Drop files to attach',
    hint,
    variant = 'fill',
}) => (
    <div
        aria-hidden="true"
        className="nui-dropzone-overlay"
        style={{
            position: 'absolute',
            inset: variant === 'inset' ? 4 : 0,
            zIndex: 60,
            // Never intercept pointer events: the drop is handled by the target,
            // and an interactive overlay would swallow dragleave.
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: variant === 'inset' ? 12 : 16,
            border: '2px dashed var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 10%, var(--bg-app))',
        }}
    >
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '14px 22px',
                borderRadius: 12,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 32px rgba(0,0,0,0.24)',
                maxWidth: 'min(320px, 90%)',
                textAlign: 'center',
            }}
        >
            <IconFilePlus size={22} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                {label}
            </span>
            {hint && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
        </div>

        <style>{`
            @keyframes nuiDropzoneIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }
            .nui-dropzone-overlay {
                animation: nuiDropzoneIn 120ms ease-out both;
            }
            @media (prefers-reduced-motion: reduce) {
                .nui-dropzone-overlay { animation: none; }
            }
        `}</style>
    </div>
);

export interface FileDropZoneProps
    extends UseFileDropTargetOptions,
        FileDropOverlayProps {
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
    onFiles,
    disabled = false,
    label,
    hint,
    variant = 'fill',
    className,
    style,
    children,
}) => {
    const { active, dropHandlers } = useFileDropTarget({ onFiles, disabled });

    return (
        <div className={className} style={{ position: 'relative', ...style }} {...dropHandlers}>
            {children}
            {active && <FileDropOverlay label={label} hint={hint} variant={variant} />}
        </div>
    );
};

export default FileDropZone;

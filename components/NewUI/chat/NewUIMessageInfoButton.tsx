/**
 * NewUIMessageInfoButton — the "⋯" action on an assistant reply. Opens a small
 * popover answering "what produced this answer?": the send time, the model,
 * the assistant, and any tools / features / connectors involved.
 *
 * Presentational: the host passes `getProvenance`, which is called only while the
 * popover is open (so a transcript of hundreds of replies pays nothing). The data
 * model lives in `shared/messageProvenance.ts`.
 *
 * When the host passes `onDownloadWord`, a footer row offers "Download as Word"; the
 * popover closes first so the host's progress / error toast is not hidden behind it.
 *
 * The panel is portalled to `document.body`, so it opts in to
 * `data-new-ui-shell="true"` (NEW_UI_GUIDE §29) for token-correct scrollbars.
 */
import React, { useId, useState } from 'react';
import { IconDots, IconFileTypeDocx } from '@tabler/icons-react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import {
  attachedLabel,
  capList,
  formatExactTimestamp,
  MessageProvenance,
  modelSummary,
  usedToolsAndFeatures,
} from '@/components/NewUI/shared/messageProvenance';

interface Props {
  getProvenance: () => MessageProvenance;
  /** Lets the host keep its hover-only action row visible while the panel is open. */
  onOpenChange?: (open: boolean) => void;
  /** Present => show "Download as Word". Omit it for replies that can't be exported. */
  onDownloadWord?: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 3,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.4,
  color: 'var(--text-primary)',
  overflowWrap: 'anywhere',
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginTop: 10 }}>
    <div style={labelStyle}>{label}</div>
    <div style={valueStyle}>{children}</div>
  </div>
);

const Chips: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
    {items.map((item) => (
      <span
        key={item}
        style={{
          fontSize: 12,
          padding: '2px 8px',
          borderRadius: 999,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
        }}
      >
        {item}
      </span>
    ))}
  </div>
);

export const NewUIMessageInfoButton: React.FC<Props> = ({ getProvenance, onOpenChange, onDownloadWord }) => {
  const [open, setOpenState] = useState(false);
  const titleId = useId();

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  const { refs, x, y, strategy, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top-start',
    strategy: 'fixed',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ]);

  const info = open ? getProvenance() : null;
  const exact = info ? formatExactTimestamp(info.timestamp) : '';
  const tools = info ? usedToolsAndFeatures(info) : [];

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className="new-ui-action-btn new-ui-action-btn-lg"
        title="Message details"
        aria-label="Message details — time, model, and tools used"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...getReferenceProps()}
      >
        <IconDots size={16} />
      </button>
      {open && info && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            data-new-ui-shell="true"
            aria-labelledby={titleId}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              visibility: x == null ? 'hidden' : 'visible',
              zIndex: 10002,
              width: 'min(320px, calc(100vw - 24px))',
              maxHeight: 'min(420px, calc(100vh - 24px))',
              overflowY: 'auto',
              padding: '12px 14px 14px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              background: 'var(--bg-raised)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
              color: 'var(--text-primary)',
            }}
            {...getFloatingProps()}
          >
            <div id={titleId} style={{ fontSize: 13, fontWeight: 600 }}>
              Response details
            </div>

            <Row label="Sent">{exact || <span style={{ color: 'var(--text-muted)' }}>Not recorded</span>}</Row>

            <Row label="Model">
              {info.model ? (
                modelSummary(info)
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  Not recorded for this response
                </span>
              )}
            </Row>

            {info.assistant && <Row label="Assistant">{info.assistant}</Row>}
            {tools.length > 0 && (
              <Row label="Tools & features used">
                <Chips items={capList(tools)} />
              </Row>
            )}
            {info.connectorActionsAttached.length > 0 && (
              <Row label={attachedLabel(info)}>
                <Chips items={capList(info.connectorActionsAttached)} />
              </Row>
            )}
            {info.files.length > 0 && (
              <Row label="Files attached">
                <Chips items={capList(info.files)} />
              </Row>
            )}

            {onDownloadWord && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  className="new-ui-popover-action"
                  onClick={() => {
                    setOpen(false);
                    onDownloadWord();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 8px',
                    border: 'none',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <IconFileTypeDocx size={16} />
                  Download as Word
                </button>
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};

export default NewUIMessageInfoButton;

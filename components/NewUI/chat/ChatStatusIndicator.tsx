/**
 * ChatStatusIndicator — the one "Sending…" / "Thinking…" status row.
 *
 * A small animated brand mark on the left, a label on the right, vertically centred, 8px
 * apart. Every in-progress status the transcript can show uses this component:
 *
 *   source="sending"   ChatLoader — the request is out, no response yet ("Sending…")
 *   source="status"    the classic PromptStatus card, via a portal host (ConversationViewShell)
 *   source="awaiting"  an empty assistant turn with no visible status (ConversationViewShell)
 *   source="thinking"  ThinkingRow in the tool-step layer
 *
 * WHEN each one shows is decided by its caller and is unchanged — this file is appearance only.
 *
 * Motion (all of it lives in styles/conversation-view.css under `.nui-status`):
 *   - the mark pulses (scale + opacity, transform/opacity only);
 *   - the label has a faint highlight sweeping across it (background-clip:text gradient);
 *   - a label change crossfades (~150ms) while the mark stays where it is;
 *   - prefers-reduced-motion: static mark, plain label, instant changes.
 *
 * Phase continuity: two callers can swap one DOM node for another in a single commit (Sending →
 * Thinking). A fresh CSS animation would restart at frame 0 and visibly "blink", so each
 * instance starts its animations at a NEGATIVE delay equal to the position the shared clock is
 * already at. Every instance therefore reads as one continuous animation.
 *
 * Accessibility: the visible text is not a live region on purpose. Each caller already has a
 * polite announcer (the sr-only region in ConversationViewShell, the PromptStatus aria-live
 * host, the tool-step layer's role="status") and a second region would announce everything
 * twice. The mark is decorative.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AmplifyLogo } from '@/components/NewUI/shared/AmplifyLogo';

/** Must match the durations in styles/conversation-view.css (`.nui-status`). */
export const STATUS_PULSE_MS = 1400;
export const STATUS_SHIMMER_MS = 2000;
/** Label crossfade — keep in sync with `--nui-status-fade` in the CSS. */
export const STATUS_FADE_MS = 150;

export type StatusIndicatorSource = 'sending' | 'status' | 'awaiting' | 'thinking';

interface ChatStatusIndicatorProps {
  /** The visible text, e.g. "Sending…". */
  label: string;
  /** Which caller renders this (lets CSS gate it and the exit layer treat it correctly). */
  source: StatusIndicatorSource;
  /** false → static (no pulse / shimmer): e.g. reasoning finished but its row is still shown. */
  active?: boolean;
}

/** Where the shared clock currently is within a period, as a negative animation-delay (ms). */
const phaseDelay = (period: number): number =>
  typeof performance === 'undefined' ? 0 : -Math.round(performance.now() % period);

export const ChatStatusIndicator: React.FC<ChatStatusIndicatorProps> = ({
  label,
  source,
  active = true,
}) => {
  // Fixed for the life of this instance, so re-renders never restart the animation.
  const [delays] = useState(() => ({
    pulse: phaseDelay(STATUS_PULSE_MS),
    shimmer: phaseDelay(STATUS_SHIMMER_MS),
  }));

  // Crossfade: keep the outgoing label around for one fade so both overlap in the same grid cell.
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const shown = useRef(label);
  useEffect(() => {
    if (shown.current === label) return;
    setOutgoing(shown.current);
    shown.current = label;
    const t = setTimeout(() => setOutgoing(null), STATUS_FADE_MS);
    return () => clearTimeout(t);
  }, [label]);

  return (
    <span
      className="nui-status"
      data-nui-status=""
      data-source={source}
      data-active={active ? 'true' : 'false'}
      style={
        {
          '--nui-status-pulse-delay': `${delays.pulse}ms`,
          '--nui-status-shimmer-delay': `${delays.shimmer}ms`,
        } as React.CSSProperties
      }
    >
      <span className="nui-status-mark" aria-hidden="true">
        <AmplifyLogo size={20} />
      </span>
      <span className="nui-status-labels">
        {outgoing !== null && (
          <span className="nui-status-label nui-status-label--out" aria-hidden="true">
            {outgoing}
          </span>
        )}
        {/* key → a new label is a new node, so its fade-in plays */}
        <span key={label} className="nui-status-label nui-status-label--in">
          {label}
        </span>
      </span>
    </span>
  );
};

export default ChatStatusIndicator;

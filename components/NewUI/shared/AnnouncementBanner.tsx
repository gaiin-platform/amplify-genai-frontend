/**
 * AnnouncementBanner — the admin-published notice pinned to the top of the New UI.
 *
 * Mounted once in `home.tsx`'s New UI layout, above the sidebar + content row. In normal flow
 * (not an overlay), so it pushes the app down instead of covering the header.
 *
 * Reads `state.featureFlags` directly, NOT `useStableFeatureFlags`: that hook falls back to a
 * localStorage cache while `/feature_flags` is in flight, which would flash a notice the admin
 * has already taken down. Showing the banner a beat late is the safer failure.
 *
 * Visible until the user closes it; the close lasts for this tab session only (see
 * `shared/announcement.ts`), so it returns on the next login.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { IconSpeakerphone, IconX } from '@tabler/icons-react';
import HomeContext from '@/components/Home/home.context';
import {
  clearDismissedAnnouncement,
  dismissAnnouncement,
  getDismissedAnnouncementId,
  isAnnouncementActive,
  isAnnouncementExpired,
  msUntilExpiry,
  readAnnouncement,
} from './announcement';

interface AnnouncementBarProps {
  message: string;
  /** Omit for a non-interactive preview (admin editor). */
  onDismiss?: () => void;
}

/** Gap between the end of the text and its repeat in the ticker, and scroll speed. */
const TICKER_GAP_PX = 64;
const TICKER_SPEED_PX_PER_S = 50;

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ message, onDismiss }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [textWidth, setTextWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Single line: newlines become a separator so a multi-line message still reads in one row.
  const oneLine = message.replace(/\s*\n+\s*/g, '  •  ');

  // Measure the text (hidden, nowrap) against the space available; ticker only when it won't fit.
  useEffect(() => {
    const vp = viewportRef.current;
    const m = measureRef.current;
    if (!vp || !m) return;
    const update = () => {
      setTextWidth(m.offsetWidth);
      setViewportWidth(vp.clientWidth);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(vp);
    ro.observe(m);
    return () => ro.disconnect();
  }, [oneLine]);

  const scrolls = textWidth > 0 && textWidth > viewportWidth;
  const duration = Math.max(8, (textWidth + TICKER_GAP_PX) / TICKER_SPEED_PX_PER_S);

  return (
    <div
      role="region"
      aria-label="Announcement"
      data-testid="announcement-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
        width: '100%',
        padding: '8px 14px',
        background: 'var(--accent)',
        color: 'var(--accent-fg)',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      <style>{`
        @keyframes nuiAnnTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .nui-ann-viewport { position: relative; overflow: hidden; }
        .nui-ann-ticker { display: inline-flex; width: max-content; animation: nuiAnnTicker var(--nui-ann-duration, 20s) linear infinite; }
        .nui-ann-viewport:hover .nui-ann-ticker { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .nui-ann-viewport { overflow-x: auto; }
          .nui-ann-ticker { animation: none; }
          .nui-ann-ticker-copy { display: none; }
        }
      `}</style>
      {/* Left/right slots share a width so the text stays truly centered. */}
      <span style={{ width: '24px', flexShrink: 0, display: 'inline-flex', justifyContent: 'flex-start' }}>
        <IconSpeakerphone size={16} aria-hidden="true" />
      </span>
      <div
        ref={viewportRef}
        className="nui-ann-viewport"
        style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
      >
        {/* Hidden measurer — always rendered so overflow is known before choosing a layout. */}
        <span
          ref={measureRef}
          aria-hidden="true"
          style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}
        >
          {oneLine}
        </span>
        {scrolls ? (
          <div
            className="nui-ann-ticker"
            style={{ ['--nui-ann-duration' as any]: `${duration}s` }}
          >
            <span style={{ whiteSpace: 'nowrap', paddingRight: `${TICKER_GAP_PX}px` }}>{oneLine}</span>
            <span
              className="nui-ann-ticker-copy"
              aria-hidden="true"
              style={{ whiteSpace: 'nowrap', paddingRight: `${TICKER_GAP_PX}px` }}
            >
              {oneLine}
            </span>
          </div>
        ) : (
          <span style={{ whiteSpace: 'nowrap' }}>{oneLine}</span>
        )}
      </div>
      <span style={{ width: '24px', flexShrink: 0, display: 'inline-flex', justifyContent: 'flex-end' }}>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss announcement"
            className="hover:bg-black/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[--accent-fg]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              border: 'none',
              borderRadius: '6px',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <IconX size={16} aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  );
};

export const AnnouncementBanner: React.FC = () => {
  const {
    state: { featureFlags },
  } = useContext(HomeContext);
  const { status } = useSession();

  const announcement = readAnnouncement((featureFlags as any)?.deploymentFeatures);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedId, setDismissedId] = useState<string | null>(() => getDismissedAnnouncementId());

  // Signed out (inactivity, expired token, menu) → forget the dismissal so the next login shows it.
  useEffect(() => {
    if (status === 'unauthenticated') {
      clearDismissedAnnouncement();
      setDismissedId(null);
    }
  }, [status]);

  // Take the banner down the moment it expires, without waiting for a reload.
  const expiresAt = announcement?.expiresAt ?? null;
  useEffect(() => {
    if (!announcement || !expiresAt || isAnnouncementExpired(announcement, now)) return;
    const wait = msUntilExpiry(announcement);
    if (wait === null) return;
    const t = setTimeout(() => setNow(Date.now()), wait + 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, now]);

  if (!isAnnouncementActive(announcement, now)) return null;
  if (dismissedId !== null && dismissedId === announcement.id) return null;

  return (
    <AnnouncementBar
      message={announcement.message}
      onDismiss={() => {
        dismissAnnouncement(announcement.id);
        setDismissedId(announcement.id);
      }}
    />
  );
};

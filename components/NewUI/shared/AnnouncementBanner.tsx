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
import React, { useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { IconSpeakerphone, IconX } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
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

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ message, onDismiss }) => (
  <div
    role="region"
    aria-label="Announcement"
    data-testid="announcement-banner"
    style={{
      display: 'flex',
      alignItems: 'flex-start',
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
    <IconSpeakerphone size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
    <p
      style={{
        flex: 1,
        minWidth: 0,
        margin: 0,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        maxHeight: '30vh',
        overflowY: 'auto',
      }}
    >
      {message}
    </p>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss announcement"
        className="hover:bg-black/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[--accent-fg]"
        style={{
          flexShrink: 0,
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
  </div>
);

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

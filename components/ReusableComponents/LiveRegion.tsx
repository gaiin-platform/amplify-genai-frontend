import { FC } from 'react';

interface LiveRegionProps {
  message: string;
  assertive?: boolean;
}

/**
 * Visually hidden live region for screen reader announcements.
 * Use `assertive` for errors/critical updates, default `polite` for status updates.
 */
export const LiveRegion: FC<LiveRegionProps> = ({ message, assertive = false }) => {
  return (
    <div
      role="status"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

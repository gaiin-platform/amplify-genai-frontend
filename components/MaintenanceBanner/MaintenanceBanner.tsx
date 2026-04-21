import { IconAlertTriangle, IconExternalLink } from '@tabler/icons-react';
import { FC } from 'react';

interface Props {
  message?: string;
  statusPageUrl?: string;
}

const DEFAULT_MESSAGE =
  'Chat is temporarily unavailable while we work on a fix. Your conversation history is safe.';

export const MaintenanceBanner: FC<Props> = ({
  message = DEFAULT_MESSAGE,
  statusPageUrl = process.env.NEXT_PUBLIC_STATUS_PAGE_URL,
}) => {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-700 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white shadow-sm"
    >
      <span className="flex items-center gap-2">
        <IconAlertTriangle size={18} aria-hidden="true" />
        {message}
      </span>
      {statusPageUrl && (
        <a
          href={statusPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-amber-100"
        >
          Status page
          <IconExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
};

export default MaintenanceBanner;

import { FC } from 'react';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import {
  DOCUMENT_RETENTION_MAX_DAYS,
  DOCUMENT_RETENTION_MIN_DAYS,
  DocumentRetention,
  documentRetentionDaysAreValid,
} from '@/types/admin';

interface Props {
  value: DocumentRetention;
  onChange: (next: DocumentRetention) => void;
  /** The new admin panel adds extra classes to its card headers; the original panel does not. */
  newUi?: boolean;
}

/**
 * Document retention: on/off and how many days. Shared by both admin panels so they cannot drift apart.
 * What it governs is chat-only attachments (RAG off, not on an assistant or group, not images or videos); nothing an
 * assistant uses is ever deleted by it. The daily sweep re-reads this setting every run.
 */
export const DocumentRetentionCard: FC<Props> = ({ value, onChange, newUi }) => {
  const valid = documentRetentionDaysAreValid(value.days);
  return (
    <div className="admin-style-settings-card">
      <div className={`admin-style-settings-card-header ${newUi ? 'nui-config-card-header' : ''}`}>
        <h3 className={`admin-style-settings-card-title ${newUi ? 'nui-config-title' : ''}`}>Document Retention</h3>
        <p className={`admin-style-settings-card-description ${newUi ? 'nui-config-description' : ''}`}>
          Automatically delete files attached to chats that nobody has opened for a set number of days
        </p>
      </div>

      <div className="px-6 mr-6">
        <Checkbox
          id="documentRetention"
          label="Delete unused chat attachments automatically. Files used by an assistant or group, images and videos, and files whose embeddings still exist are never deleted."
          checked={value.isActive}
          onChange={(isChecked: boolean) => onChange({ ...value, isActive: isChecked })}
        />
        <div className={`ml-6 mt-2 flex flex-col gap-1 ${value.isActive ? '' : 'opacity-30'}`}>
          <div className="flex flex-row items-center gap-3">
            Delete after
            <input
              type="number"
              disabled={!value.isActive}
              className="text-center w-[100px] dark:bg-[#40414F] bg-gray-200"
              id="documentRetentionDays"
              aria-label="Days without use before a chat attachment is deleted"
              aria-invalid={!valid}
              min={DOCUMENT_RETENTION_MIN_DAYS}
              max={DOCUMENT_RETENTION_MAX_DAYS}
              step={1}
              inputMode="numeric"
              value={Number.isFinite(value.days) ? value.days : ''}
              onChange={(e) => onChange({ ...value, days: e.target.value === '' ? NaN : Number(e.target.value) })}
            />
            days without use
          </div>
          {value.isActive && !valid && (
            <span className="text-sm text-red-500" role="alert">
              Enter a whole number of days from {DOCUMENT_RETENTION_MIN_DAYS} to {DOCUMENT_RETENTION_MAX_DAYS}.
            </span>
          )}
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            A file is deleted once it has gone that many days since it was uploaded or last used, whichever is later. The days
            apply to files already uploaded, so a short setting takes effect at the next cleanup. The cleanup runs daily (about
            4 AM UTC) and never removes a file an assistant uses. Deleted files cannot be recovered.
          </span>
        </div>
      </div>
    </div>
  );
};

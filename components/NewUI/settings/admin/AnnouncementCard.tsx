/**
 * AnnouncementCard — Admin → Deployment: publish / take down the site-wide banner.
 *
 * The announcement lives inside the deployment-features config, so edits flow through the
 * Deployment tab's `setConfig` + `updateUnsavedConfigs` and are persisted by the modal's
 * normal Save. Nothing reaches users until the admin saves.
 *
 * Expiry is stored as one absolute `expiresAt`. "For a set time" is resolved to that instant
 * on every edit (the end time is shown, so what you see is what gets saved); "Until a date"
 * edits it directly; "Until I turn it off" clears it.
 */
import React, { FC, useState } from 'react';
import { AdminConfigTypes } from '@/types/admin';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { AnnouncementBar } from '@/components/NewUI/shared/AnnouncementBanner';
import {
  ANNOUNCEMENT_MAX_LENGTH,
  Announcement,
  DeploymentConfigWithAnnouncement,
  DurationUnit,
  ExpiryMode,
  computeExpiresAt,
  fromLocalInputValue,
  isAnnouncementActive,
  isAnnouncementExpired,
  patchAnnouncement,
  toLocalInputValue,
} from '@/components/NewUI/shared/announcement';

interface AnnouncementCardProps {
  config: DeploymentConfigWithAnnouncement;
  setConfig: (c: DeploymentConfigWithAnnouncement) => void;
  updateUnsavedConfigs: (type: AdminConfigTypes) => void;
}

const EXPIRY_ITEMS = [
  { id: 'indefinite', label: 'Until turned off' },
  { id: 'duration', label: 'For a set time' },
  { id: 'date', label: 'Until a date' },
];

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-app)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  padding: '8px 10px',
  fontSize: '13px',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const AnnouncementCard: FC<AnnouncementCardProps> = ({ config, setConfig, updateUnsavedConfigs }) => {
  const announcement: Announcement | undefined = config.announcement;
  const [mode, setMode] = useState<ExpiryMode>(announcement?.expiresAt ? 'date' : 'indefinite');
  const [amount, setAmount] = useState<number>(24);
  const [unit, setUnit] = useState<DurationUnit>('hours');

  const message = announcement?.message ?? '';
  const enabled = announcement?.enabled ?? false;
  const expiresAt = announcement?.expiresAt ?? null;

  const commit = (patch: Partial<Omit<Announcement, 'id'>>) => {
    setConfig({ ...config, announcement: patchAnnouncement(announcement, patch) });
    updateUnsavedConfigs(AdminConfigTypes.DEPLOYMENT_FEATURES);
  };

  const applyDuration = (nextAmount: number, nextUnit: DurationUnit) => {
    setAmount(nextAmount);
    setUnit(nextUnit);
    commit({ expiresAt: computeExpiresAt('duration', { amount: nextAmount, unit: nextUnit, dateLocal: '' }) });
  };

  const changeMode = (next: string) => {
    const m = next as ExpiryMode;
    setMode(m);
    if (m === 'indefinite') commit({ expiresAt: null });
    else if (m === 'duration') applyDuration(amount, unit);
    else if (!expiresAt) commit({ expiresAt: computeExpiresAt('duration', { amount: 24, unit: 'hours', dateLocal: '' }) });
    // 'date': start from tomorrow (or the current end time) so a date is always set.
  };

  const expired = !!announcement && isAnnouncementExpired(announcement);
  const live = isAnnouncementActive(announcement);

  let status = 'Off — users do not see a banner.';
  if (enabled && !message.trim()) status = 'Add a message to publish the banner.';
  else if (enabled && expired) status = `Expired ${formatWhen(expiresAt!)} — users do not see it.`;
  else if (live) status = expiresAt ? `Shown to users until ${formatWhen(expiresAt)}.` : 'Shown to users until you turn it off.';

  return (
    <div
      style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label
            htmlFor="announcement-enabled"
            style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            Announcement Banner
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
            Show a notice across the top of the screen for every user, e.g. to report an issue you are
            investigating. Users can close it, but it returns each time they log in until it is turned off
            here or expires. Takes effect when you save, and reaches users on their next load or login.
          </p>
        </div>
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          <ToggleSwitch
            id="announcement-enabled"
            checked={enabled}
            onChange={(v) => commit({ enabled: v })}
            aria-label="Show announcement banner"
          />
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <label htmlFor="announcement-message" style={labelStyle}>
          Message
        </label>
        <textarea
          id="announcement-message"
          rows={3}
          maxLength={ANNOUNCEMENT_MAX_LENGTH}
          value={message}
          placeholder="We have found an issue affecting file uploads and are investigating."
          onChange={(e) => commit({ message: e.target.value })}
          style={{ ...fieldStyle, width: '100%', resize: 'vertical', lineHeight: 1.5 }}
        />
        <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {message.length} / {ANNOUNCEMENT_MAX_LENGTH}
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <span id="announcement-duration-label" style={labelStyle}>
          How long should it show?
        </span>
        <SegmentedControl
          items={EXPIRY_ITEMS}
          value={mode}
          onChange={changeMode}
          aria-label="How long the announcement should show"
        />

        {mode === 'duration' && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              aria-label="Duration amount"
              onChange={(e) => applyDuration(Math.max(1, Math.floor(Number(e.target.value) || 1)), unit)}
              style={{ ...fieldStyle, width: '90px' }}
            />
            <select
              value={unit}
              aria-label="Duration unit"
              onChange={(e) => applyDuration(amount, e.target.value as DurationUnit)}
              style={fieldStyle}
            >
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        )}

        {mode === 'date' && (
          <input
            type="datetime-local"
            value={toLocalInputValue(expiresAt)}
            aria-label="Hide the banner at"
            onChange={(e) => {
              // A cleared/invalid field would silently turn this into "until turned off".
              const next = fromLocalInputValue(e.target.value);
              if (next) commit({ expiresAt: next });
            }}
            style={{ ...fieldStyle, marginTop: '10px' }}
          />
        )}

        {mode === 'duration' && expiresAt && (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            Will end {formatWhen(expiresAt)} (counted from your last edit).
          </p>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        style={{
          fontSize: '12px',
          margin: '14px 0 0',
          color: enabled && !live ? 'var(--text-error)' : 'var(--text-secondary)',
        }}
      >
        {status}
      </p>

      {message.trim() && (
        <div style={{ marginTop: '12px' }}>
          <span style={labelStyle}>Preview</span>
          <div style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <AnnouncementBar message={message} />
          </div>
        </div>
      )}
    </div>
  );
};

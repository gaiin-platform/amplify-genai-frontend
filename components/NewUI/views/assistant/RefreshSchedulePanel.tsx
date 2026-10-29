/**
 * RefreshSchedulePanel — "keep attachments up to date": choose how often an assistant's website pages
 * and OneDrive/SharePoint files are re-checked and refreshed.
 *
 * Replaces the two alarm-clock popovers of the old editor (`WebsiteScanScheduler` beside the website
 * input, `SchedulerPanel` beside the drive browser) with one card in the Data Sources section. Fully
 * controlled: the editor owns the state and saves it as scheduled tasks (`rescanTaskSync`).
 *
 *   - Websites: one frequency per URL (the backend rescans only the URLs that are due).
 *   - Drive files: one schedule for all of them — frequency, time of day, day of week / month.
 */

import React from 'react';
import { IconClockPlay, IconSitemap, IconWorld, IconCloud } from '@tabler/icons-react';
import { SelectControl, TextControl } from '@/components/NewUI/shared/FormControls';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import type { DriveRescanSchedule } from '@/components/Promptbar/components/AssistantModalComponents/AssistantDriveDataSources';
import { CapabilityCard } from './CapabilityCard';
import {
    DRIVE_FREQUENCIES,
    WEBSITE_FREQUENCIES,
    WEEKDAYS,
    WebsiteScheduleRow,
    describeDriveSchedule,
    describeLastScanned,
    scheduleBadge,
    toggleDriveSchedule,
    websiteFrequencyLabel,
    withDriveDefaults,
} from './refreshScheduleModel';

export interface RefreshSchedulePanelProps {
    websiteRows: WebsiteScheduleRow[];
    onWebsiteFrequencyChange: (sourceUrl: string, days: number | null) => void;
    /** Offer the drive section (drive files are selected, and this kind of assistant supports it). */
    showDrive: boolean;
    /** `null` while the saved schedule is loading (or couldn't be). */
    driveSchedule: DriveRescanSchedule | null;
    driveLoadFailed: boolean;
    onDriveScheduleChange: (schedule: DriveRescanSchedule) => void;
}

const sectionLabel: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '0 0 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', margin: 0 };
const rowCard: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 170px',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card)',
};

export const RefreshSchedulePanel: React.FC<RefreshSchedulePanelProps> = ({
    websiteRows,
    onWebsiteFrequencyChange,
    showDrive,
    driveSchedule,
    driveLoadFailed,
    onDriveScheduleChange,
}) => {
    const [now] = React.useState(() => new Date());
    const drive = driveSchedule ? withDriveDefaults(driveSchedule) : null;
    const badge = scheduleBadge(websiteRows, driveSchedule);
    const driveSummary = describeDriveSchedule(drive);

    return (
        <div style={{ marginBottom: 14 }}>
            <CapabilityCard
                icon={<IconClockPlay size={18} />}
                title="Keep sources up to date"
                badge={badge}
                defaultOpen={!!badge}
            >
                <p style={{ ...muted, marginBottom: 14 }}>
                    Pick how often Amplify re-checks these sources and refreshes anything that changed. Runs as a scheduled
                    task you can also see under Scheduled Tasks.
                </p>

                {websiteRows.length > 0 && (
                    <section aria-labelledby="refresh-websites-heading" style={{ marginBottom: showDrive ? 18 : 0 }}>
                        <h4 id="refresh-websites-heading" style={sectionLabel}>
                            <IconWorld size={13} aria-hidden="true" /> Websites
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {websiteRows.map((row, i) => {
                                const standard = row.scanFrequency === null || WEBSITE_FREQUENCIES.some((f) => f.days === row.scanFrequency);
                                const selectId = `refresh-website-${i}`;
                                return (
                                    <div key={row.sourceUrl} style={rowCard}>
                                        <div style={{ minWidth: 0 }}>
                                            <label
                                                htmlFor={selectId}
                                                title={row.sourceUrl}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', minWidth: 0 }}
                                            >
                                                {row.isSitemap
                                                    ? <IconSitemap size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--file-icon-doc)' }} />
                                                    : <IconWorld size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--file-icon-doc)' }} />}
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sourceUrl}</span>
                                                {row.isSitemap && <span style={{ ...muted, flexShrink: 0 }}>Sitemap</span>}
                                            </label>
                                            <p style={{ ...muted, marginTop: 2 }}>
                                                {row.lastScanned ? describeLastScanned(row.lastScanned, now) : 'Scanned when you save'}
                                            </p>
                                        </div>
                                        <SelectControl
                                            id={selectId}
                                            value={row.scanFrequency === null ? '' : String(row.scanFrequency)}
                                            onChange={(e) => onWebsiteFrequencyChange(row.sourceUrl, e.target.value === '' ? null : Number(e.target.value))}
                                        >
                                            <option value="">Don’t refresh</option>
                                            {WEBSITE_FREQUENCIES.map((f) => (
                                                <option key={f.days} value={f.days}>{f.label}</option>
                                            ))}
                                            {!standard && (
                                                <option value={row.scanFrequency!}>{websiteFrequencyLabel(row.scanFrequency)}</option>
                                            )}
                                        </SelectControl>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {showDrive && (
                    <section aria-labelledby="refresh-drive-heading">
                        <h4 id="refresh-drive-heading" style={sectionLabel}>
                            <IconCloud size={13} aria-hidden="true" /> OneDrive / SharePoint files
                        </h4>

                        {drive === null ? (
                            driveLoadFailed ? (
                                <div style={{ ...rowCard, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                                    <p style={muted}>The current schedule couldn’t be loaded, so it will be left as it is.</p>
                                    <button
                                        type="button"
                                        onClick={() => onDriveScheduleChange(withDriveDefaults({ enabled: false, frequency: 'none' }))}
                                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                        style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12.5, cursor: 'pointer' }}
                                    >
                                        Set a new schedule
                                    </button>
                                </div>
                            ) : (
                                <p style={muted} role="status">Loading the current schedule…</p>
                            )
                        ) : (
                            <div style={{ ...rowCard, gridTemplateColumns: '1fr', gap: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <span id="refresh-drive-toggle-label" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                        Refresh my selected files automatically
                                    </span>
                                    <ToggleSwitch
                                        checked={drive.enabled}
                                        onChange={(on) => onDriveScheduleChange(toggleDriveSchedule(drive, on))}
                                        aria-labelledby="refresh-drive-toggle-label"
                                    />
                                </div>

                                {drive.enabled && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                                            <div>
                                                <label htmlFor="refresh-drive-frequency" style={fieldLabel}>Frequency</label>
                                                <SelectControl
                                                    id="refresh-drive-frequency"
                                                    value={drive.frequency}
                                                    onChange={(e) => onDriveScheduleChange({ ...drive, frequency: e.target.value as DriveRescanSchedule['frequency'] })}
                                                >
                                                    {DRIVE_FREQUENCIES.map((f) => (
                                                        <option key={f.id} value={f.id}>{f.label}</option>
                                                    ))}
                                                </SelectControl>
                                            </div>

                                            {drive.frequency === 'weekly' && (
                                                <div>
                                                    <label htmlFor="refresh-drive-weekday" style={fieldLabel}>Day of week</label>
                                                    <SelectControl
                                                        id="refresh-drive-weekday"
                                                        value={drive.dayOfWeek}
                                                        onChange={(e) => onDriveScheduleChange({ ...drive, dayOfWeek: Number(e.target.value) })}
                                                    >
                                                        {WEEKDAYS.map((day, index) => (
                                                            <option key={day} value={index}>{day}</option>
                                                        ))}
                                                    </SelectControl>
                                                </div>
                                            )}

                                            {(drive.frequency === 'monthly' || drive.frequency === 'quarterly') && (
                                                <div>
                                                    <label htmlFor="refresh-drive-monthday" style={fieldLabel}>Day of month</label>
                                                    <SelectControl
                                                        id="refresh-drive-monthday"
                                                        value={drive.dayOfMonth}
                                                        onChange={(e) => onDriveScheduleChange({ ...drive, dayOfMonth: Number(e.target.value) })}
                                                    >
                                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                                            <option key={day} value={day}>{day}</option>
                                                        ))}
                                                    </SelectControl>
                                                </div>
                                            )}

                                            <div>
                                                <label htmlFor="refresh-drive-time" style={fieldLabel}>Time</label>
                                                <TextControl
                                                    id="refresh-drive-time"
                                                    type="time"
                                                    value={drive.time}
                                                    onChange={(e) => onDriveScheduleChange({ ...drive, time: e.target.value || '09:00' })}
                                                />
                                            </div>
                                        </div>
                                        <p style={muted} role="status">{driveSummary} (your local time)</p>
                                    </>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </CapabilityCard>
        </div>
    );
};

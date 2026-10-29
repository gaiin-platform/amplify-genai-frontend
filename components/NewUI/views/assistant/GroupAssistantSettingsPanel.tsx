/**
 * GroupAssistantSettingsPanel — the group-only settings of a group assistant, rendered inside a
 * `CapabilityCard` in `NewUIAssistantCreationModal` when a group assistant is edited.
 *
 * Replaces the old admin interface's `AssistantModalConfigs` + `GroupTypesAstData`:
 *   • Publish to read-access members
 *   • Track / analyze conversations + analysis categories (only if the group is approved for it)
 *   • Group types: which apply, the question shown to users, and per type either a "disabled"
 *     message or additional instructions + extra files
 *
 * State is owned by the modal (it needs it at save time), so this takes the settings and a
 * `setSettings` dispatcher; upload callbacks use the functional form so a late progress event never
 * overwrites newer state. All rules live in `groupAssistantSettingsModel.ts`.
 */

import React, { useId, useRef, useState } from 'react';
import { IconFiles, IconUpload } from '@tabler/icons-react';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';
import { CheckboxControl, TextAreaControl } from '@/components/NewUI/shared/FormControls';
import { TagChipsInput } from '@/components/NewUI/shared/TagChipsInput';
import {
    DataSourceCard,
    DataSourceCardGrid,
    DataSourceCardStatus,
} from '@/components/NewUI/shared/DataSourceCard';
import {
    DataSourceLibraryPicker,
    PickedLibraryFile,
} from '@/components/NewUI/shared/DataSourceLibraryPicker';
import { AttachFile } from '@/components/Chat/AttachFile';
import { AttachedDocument } from '@/types/attacheddocument';
import { COMMON_DISALLOWED_FILE_EXTENSIONS } from '@/utils/app/const';
import { getFileDownloadUrl } from '@/services/fileService';
import {
    GroupSettings,
    GroupTypeEntry,
    hasPendingGroupTypeUploads,
    setConvAnalysis,
    setTracking,
    toggleType,
} from './groupAssistantSettingsModel';

export interface GroupAssistantSettingsPanelProps {
    settings: GroupSettings;
    setSettings: React.Dispatch<React.SetStateAction<GroupSettings>>;
    group: { id: string; name: string; groupTypes: string[]; supportConvAnalysis: boolean };
}

const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
};
const mutedText: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' };
const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
};
const divider: React.CSSProperties = { height: 1, background: 'var(--border-subtle)', margin: '16px 0' };

/** One label/description on the left, a control on the right. */
const SettingRow: React.FC<{
    id: string;
    label: string;
    description: React.ReactNode;
    info?: string;
    children: React.ReactNode;
}> = ({ id, label, description, info, children }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span id={id} style={sectionTitle}>{label}</span>
                {info && <InfoTooltip text={info} ariaLabel={`About ${label}`} maxWidth={320} />}
            </div>
            <div style={mutedText}>{description}</div>
        </div>
        <div style={{ flexShrink: 0, paddingTop: 2 }}>{children}</div>
    </div>
);

const TRACKING_REQUIRED_NOTE = 'Tracking stays on while Analyze conversations is on.';

export const GroupAssistantSettingsPanel: React.FC<GroupAssistantSettingsPanelProps> = ({
    settings,
    setSettings,
    group,
}) => {
    const baseId = useId();
    const [trackingBlocked, setTrackingBlocked] = useState(false);
    const blockedTimer = useRef<number | undefined>(undefined);

    const flashTrackingBlocked = () => {
        setTrackingBlocked(true);
        window.clearTimeout(blockedTimer.current);
        blockedTimer.current = window.setTimeout(() => setTrackingBlocked(false), 3000);
    };

    const analysisOn = settings.supportConvAnalysis;

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Save is disabled while group-type files upload; say so, or the button just looks broken. */}
            {hasPendingGroupTypeUploads(settings) && (
                <p role="status" style={{ ...mutedText, margin: '0 0 12px', color: 'var(--warning-fg)' }}>
                    Waiting for group-type files to finish uploading — you can save as soon as they’re done.
                </p>
            )}

            {/* ── Publishing ─────────────────────────────────────────── */}
            <SettingRow
                id={`${baseId}-publish`}
                label="Publish to read-access members"
                description="Members who can only read this group can see and use the assistant."
            >
                <ToggleSwitch
                    checked={settings.isPublished}
                    onChange={(isPublished) => setSettings((prev) => ({ ...prev, isPublished }))}
                    aria-labelledby={`${baseId}-publish`}
                />
            </SettingRow>

            <div style={divider} />

            {/* ── Conversation tracking & analysis ───────────────────── */}
            {group.supportConvAnalysis ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SettingRow
                        id={`${baseId}-track`}
                        label="Track conversations"
                        description={
                            trackingBlocked
                                ? <span style={{ color: 'var(--warning-fg)' }} role="status">{TRACKING_REQUIRED_NOTE}</span>
                                : 'Enables the dashboard and conversation history for monitoring and review.'
                        }
                    >
                        <ToggleSwitch
                            checked={settings.trackConversations || analysisOn}
                            onChange={(on) => {
                                const result = setTracking(settings, on);
                                if (result.blocked) flashTrackingBlocked();
                                else setSettings(result.settings);
                            }}
                            aria-labelledby={`${baseId}-track`}
                        />
                    </SettingRow>

                    <SettingRow
                        id={`${baseId}-analyze`}
                        label="Analyze conversations"
                        description="AI-powered categorization of conversations, to evaluate quality, relevance and effectiveness."
                    >
                        <ToggleSwitch
                            checked={analysisOn}
                            onChange={(on) => setSettings((prev) => setConvAnalysis(prev, on))}
                            aria-labelledby={`${baseId}-analyze`}
                        />
                    </SettingRow>

                    <div style={{ opacity: analysisOn ? 1 : 0.5 }}>
                        <span style={fieldLabel} id={`${baseId}-categories`}>Analysis categories</span>
                        <TagChipsInput
                            tags={settings.analysisCategories}
                            onChange={(analysisCategories) => setSettings((prev) => ({ ...prev, analysisCategories }))}
                            ariaLabel="Analysis categories"
                            placeholder="e.g. Billing, Account access"
                            disabled={!analysisOn}
                        />
                    </div>
                </div>
            ) : (
                <p style={{ ...mutedText, margin: 0 }}>
                    Conversation tracking and analysis aren’t enabled for this group. Ask Amplify to approve
                    them to see dashboard metrics and conversation history.
                </p>
            )}

            {/* ── Group types ───────────────────────────────────────── */}
            {group.groupTypes.length > 0 && (
                <>
                    <div style={divider} />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <h4 style={sectionTitle}>Group types</h4>
                            <InfoTooltip
                                text="Users pick one of the selected types before chatting. Each type can add its own instructions and files, or turn chat off with a message."
                                ariaLabel="About group types"
                                maxWidth={320}
                            />
                        </div>
                        <p style={mutedText}>Select the types that apply to this assistant.</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10 }}>
                            {group.groupTypes.map((type, index) => (
                                <CheckboxControl
                                    key={type}
                                    id={`${baseId}-type-${index}`}
                                    label={type}
                                    checked={settings.selectedTypes.includes(type)}
                                    onChange={(on) => setSettings((prev) => toggleType(prev, type, on))}
                                />
                            ))}
                        </div>

                        {settings.selectedTypes.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                                <div>
                                    <label style={fieldLabel} htmlFor={`${baseId}-question`}>
                                        Message shown when choosing a type
                                    </label>
                                    <TextAreaControl
                                        id={`${baseId}-question`}
                                        rows={2}
                                        value={settings.groupUserTypeQuestion}
                                        placeholder="Please select the group you best identify with to start chatting."
                                        onChange={(e) =>
                                            setSettings((prev) => ({ ...prev, groupUserTypeQuestion: e.target.value }))
                                        }
                                    />
                                </div>

                                {settings.selectedTypes.map((type) => {
                                    const index = group.groupTypes.indexOf(type);
                                    const entry = settings.groupTypeData[type];
                                    if (!entry) return null;
                                    return (
                                        <GroupTypeCard
                                            key={type}
                                            type={type}
                                            entry={entry}
                                            idBase={`${baseId}-t${index}`}
                                            groupId={group.id}
                                            setSettings={setSettings}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// ── One selected group type ────────────────────────────────────────────────────

interface GroupTypeCardProps {
    type: string;
    entry: GroupTypeEntry;
    idBase: string;
    groupId: string;
    setSettings: React.Dispatch<React.SetStateAction<GroupSettings>>;
}

const GroupTypeCard: React.FC<GroupTypeCardProps> = ({ type, entry, idBase, groupId, setSettings }) => {
    const attachInputId = `__attachFile_group_${idBase.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const abortRef = useRef<Record<string, (() => void) | undefined>>({});
    const [showLibrary, setShowLibrary] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const patch = (fn: (prev: GroupTypeEntry) => GroupTypeEntry) =>
        setSettings((prev) => {
            const current = prev.groupTypeData[type];
            if (!current) return prev;
            return { ...prev, groupTypeData: { ...prev.groupTypeData, [type]: fn(current) } };
        });

    const status = (ds: AttachedDocument): DataSourceCardStatus => {
        const progress = entry.documentState[ds.id];
        if (progress === 100) return 'ready';
        if (typeof progress === 'number' && progress >= 95) return 'processing';
        return 'uploading';
    };

    const removeSource = (ds: AttachedDocument) => {
        abortRef.current[ds.id]?.();
        delete abortRef.current[ds.id];
        patch((prev) => {
            const documentState = { ...prev.documentState };
            delete documentState[ds.id];
            return { ...prev, dataSources: prev.dataSources.filter((x) => x.id !== ds.id), documentState };
        });
    };

    const download = async (ds: AttachedDocument) => {
        const key = (ds as any).key || ds.id.replace(/^s3:\/\//, '');
        if (!key) return;
        setDownloadingId(ds.id);
        try {
            const result = await getFileDownloadUrl(key, groupId);
            if (result.success && result.downloadUrl) {
                window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            console.error('Failed to get download URL for group type file:', err);
        } finally {
            setDownloadingId(null);
        }
    };

    const addLibraryFiles = (picked: PickedLibraryFile[]) => {
        const fresh = picked.filter((file) => !entry.dataSources.some((ds) => ds.id === file.id));
        if (fresh.length === 0) return;
        patch((prev) => ({
            ...prev,
            dataSources: [
                ...prev.dataSources,
                ...fresh.map((file) => ({
                    id: file.id,
                    name: file.name,
                    raw: null,
                    type: file.type,
                    data: '',
                    metadata: file.metadata,
                })),
            ],
            documentState: fresh.reduce((acc, file) => ({ ...acc, [file.id]: 100 }), prev.documentState),
        }));
    };

    return (
        <section
            aria-label={`${type} settings`}
            style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                background: 'var(--bg-app)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h5 style={{ ...sectionTitle, fontSize: 14 }}>{type}</h5>
                <CheckboxControl
                    id={`${idBase}-disable`}
                    label="Turn chat off for this type"
                    checked={entry.isDisabled}
                    onChange={(isDisabled) => patch((prev) => ({ ...prev, isDisabled }))}
                />
            </div>

            {entry.isDisabled ? (
                <div>
                    <label style={fieldLabel} htmlFor={`${idBase}-disabled-msg`}>Message shown to these users</label>
                    <TextAreaControl
                        id={`${idBase}-disabled-msg`}
                        rows={3}
                        value={entry.disabledMessage}
                        placeholder={`Why chat is unavailable for ${type}`}
                        onChange={(e) => patch((prev) => ({ ...prev, disabledMessage: e.target.value }))}
                    />
                </div>
            ) : (
                <>
                    <div>
                        <label style={fieldLabel} htmlFor={`${idBase}-instructions`}>Additional instructions</label>
                        <TextAreaControl
                            id={`${idBase}-instructions`}
                            rows={3}
                            value={entry.additionalInstructions}
                            placeholder={`Instructions specific to ${type}`}
                            onChange={(e) => patch((prev) => ({ ...prev, additionalInstructions: e.target.value }))}
                        />
                    </div>

                    <div>
                        <span style={fieldLabel}>Additional files</span>
                        {entry.dataSources.length > 0 && (
                            <div style={{ margin: '12px 0' }}>
                                <DataSourceCardGrid label={`${type} files`}>
                                    {entry.dataSources.map((ds: AttachedDocument) => {
                                        const state = status(ds);
                                        const progress = entry.documentState[ds.id];
                                        return (
                                            <DataSourceCard
                                                key={ds.id}
                                                name={ds.name}
                                                type={ds.type}
                                                status={state}
                                                progress={state === 'uploading' && typeof progress === 'number' ? progress : undefined}
                                                onRemove={() => removeSource(ds)}
                                                onCancelUpload={() => removeSource(ds)}
                                                onClick={state === 'ready' && !downloadingId ? () => download(ds) : undefined}
                                                downloading={downloadingId === ds.id}
                                            />
                                        );
                                    })}
                                </DataSourceCardGrid>
                            </div>
                        )}

                        {/* AttachFile draws an old-UI paperclip; only its hidden <input> is wanted,
                            so clip it and drive it from the New UI button below (see the
                            assistant creation modal's upload panel). */}
                        <span
                            style={{
                                position: 'absolute',
                                width: 1,
                                height: 1,
                                overflow: 'hidden',
                                clip: 'rect(0 0 0 0)',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <AttachFile
                                id={attachInputId}
                                groupId={groupId}
                                disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                onAttach={(doc: AttachedDocument) =>
                                    patch((prev) => ({ ...prev, dataSources: [...prev.dataSources, doc] }))
                                }
                                onSetMetadata={(doc: AttachedDocument, metadata: any) =>
                                    patch((prev) => ({
                                        ...prev,
                                        dataSources: prev.dataSources.map((x) => (x.id === doc.id ? { ...x, metadata } : x)),
                                    }))
                                }
                                onSetKey={(doc: AttachedDocument, key: string) =>
                                    patch((prev) => ({
                                        ...prev,
                                        dataSources: prev.dataSources.map((x) => (x.id === doc.id ? { ...x, key } : x)),
                                    }))
                                }
                                onUploadProgress={(doc: AttachedDocument, progress: number) =>
                                    patch((prev) => ({ ...prev, documentState: { ...prev.documentState, [doc.id]: progress } }))
                                }
                                onSetAbortController={(doc: AttachedDocument, abort: any) => {
                                    abortRef.current[doc.id] =
                                        typeof abort === 'function' ? abort : () => abort?.abort?.();
                                }}
                                disableRag={false}
                            />
                        </span>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() =>
                                    (document.getElementById(attachInputId) as HTMLInputElement | null)?.click()
                                }
                                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                style={actionButton}
                            >
                                <IconUpload size={14} aria-hidden="true" /> Upload files
                            </button>
                            <button
                                type="button"
                                aria-expanded={showLibrary}
                                onClick={() => setShowLibrary((v) => !v)}
                                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                                style={actionButton}
                            >
                                <IconFiles size={14} aria-hidden="true" /> Add from library
                            </button>
                        </div>

                        {showLibrary && (
                            <div style={{ marginTop: 10 }}>
                                <DataSourceLibraryPicker
                                    attachedIds={entry.dataSources.map((ds: AttachedDocument) => ds.id)}
                                    onSelect={(picked) => {
                                        addLibraryFiles(picked);
                                        setShowLibrary(false);
                                    }}
                                    onClose={() => setShowLibrary(false)}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
};

const actionButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-raised)',
    color: 'var(--text-primary)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
};

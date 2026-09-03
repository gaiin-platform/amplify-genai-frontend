/**
 * DriveSourcesPanel — Data Sources → OneDrive / SharePoint, in the new UI.
 *
 * Replaces the old-UI stack at this call site (AssistantDriveDataSources →
 * IntegrationTabs → a MantineReactTable browser). Those components are
 * untouched and still serve the old editor and the chat picker; this is a new
 * front end over the same services, in the manner of shared/
 * DataSourceLibraryPicker, which did the same for the library picker.
 *
 * The connector rows ARE the service selector. The old panel stacked three
 * selectors on top of each other — a tab bar with one "Microsoft" tab, a
 * "Select Service" dropdown, and the connector cards themselves — each with its
 * own "Connected" indicator. Here, clicking a row makes it active and the
 * browser below follows it.
 *
 * Disconnect is revealed on hover rather than sitting at rest as a red button,
 * and it never discards that service's selections: this is an editor with a Save
 * button, so losing forty picked files to a stray click would be silent data
 * loss. The selections stay and the row offers Connect again.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { IconLoader2, IconPlugConnected } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { DriveFilesDataSources } from '@/types/integrations';
import { getIntegrationName } from '@/utils/app/integrations';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { integrationIcon } from '@/components/NewUI/shared/integrationIcon';
import { DriveFileBrowser } from './DriveFileBrowser';
import { useDriveIntegrations } from './useDriveIntegrations';
import {
    ApplySelectionInput,
    applySelection,
    asDriveDataSources,
    asDriveSelection,
    clearIntegration,
    selectionCounts,
} from './driveBrowserModel';

export interface DriveSourcesPanelProps {
    /** Current drive selection, as stored on the assistant definition. */
    selection: DriveFilesDataSources;
    /**
     * The editor's state setter. Taken as a setter rather than a plain callback
     * so every mutation can go through the functional form — a select-all writes
     * many rows in one update, and deriving that from a captured prop is how the
     * old implementation lost all but the last row.
     */
    onChange: React.Dispatch<React.SetStateAction<DriveFilesDataSources | undefined>>;
    /**
     * The selection as loaded from a saved assistant. Re-ticking something that
     * was already saved restores its captured files and datasource pointers
     * instead of blanking them.
     */
    initSelection?: DriveFilesDataSources;
    disallowedFileExtensions?: string[];
}

export const DriveSourcesPanel: React.FC<DriveSourcesPanelProps> = ({
    selection,
    onChange,
    initSelection,
    disallowedFileExtensions,
}) => {
    const { supported, connected, loading, busy, connect, disconnect } = useDriveIntegrations();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const current = useMemo(() => asDriveSelection(selection), [selection]);

    /**
     * Default to something the user can actually browse. The old panel picked
     * `supported.sort()[0]`, so a deployment that merely *supports* Google Drive
     * opened on Google Drive even for a user who had only connected SharePoint —
     * which is why a "this integration has been disconnected" banner was the
     * usual first impression.
     */
    useEffect(() => {
        if (supported.length === 0) { setActiveId(null); return; }
        setActiveId((previous) => {
            if (previous && supported.some((entry) => entry.id === previous)) return previous;
            const firstConnected = supported.find((entry) => connected.includes(entry.id));
            return firstConnected?.id ?? supported[0].id;
        });
    }, [supported, connected]);

    const apply = (
        integration: string,
        input: Omit<ApplySelectionInput, 'integration'>,
    ) => {
        const request = { ...input, integration, initSelection: asDriveSelection(initSelection) };

        // Told from the render-time selection, deliberately outside the updater:
        // a state updater must stay pure, and StrictMode calls it twice.
        const skipped = applySelection(current, request).coveredByAncestor.length;
        if (skipped > 0) {
            toast(skipped === 1
                ? 'That file already comes in through the selected folder.'
                : `${skipped} files already come in through the selected folder.`);
        }

        onChange((previous) => asDriveDataSources(
            applySelection(asDriveSelection(previous), request).selection,
        ));
    };

    const clear = (integration: string) => {
        onChange((previous) => asDriveDataSources(clearIntegration(asDriveSelection(previous), integration)));
    };

    // Nothing to show and nothing to connect — the call site only gates on the
    // integrations feature flag, so the panel has to make this call itself.
    if (!loading && supported.length === 0) return null;

    const activeIsConnected = Boolean(activeId && connected.includes(activeId));

    return (
        <div
            data-new-ui-drive="true"
            style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                background: 'var(--bg-app)',
            }}
        >
            {/* ── Connector rows: the service selector ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {loading
                    ? [0, 1].map((n) => (
                        <div
                            key={n}
                            aria-hidden="true"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                height: 48,
                                padding: '0 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle)',
                                opacity: 0.6,
                            }}
                        >
                            <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--bg-active)' }} />
                            <div style={{ width: '35%', height: 12, borderRadius: 4, background: 'var(--bg-active)' }} />
                        </div>
                    ))
                    : supported.map((entry) => {
                        const isActive = entry.id === activeId;
                        const isConnected = connected.includes(entry.id);
                        const isBusy = Boolean(busy[entry.id]);
                        const { total } = selectionCounts(current, entry.id);
                        const hovered = hoveredId === entry.id;

                        return (
                            <div
                                key={entry.id}
                                role="button"
                                tabIndex={0}
                                aria-pressed={isActive}
                                onClick={() => setActiveId(entry.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setActiveId(entry.id);
                                    }
                                }}
                                onMouseEnter={() => setHoveredId(entry.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onFocus={() => setHoveredId(entry.id)}
                                onBlur={() => setHoveredId((prev) => (prev === entry.id ? null : prev))}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    minHeight: 48,
                                    padding: '0 12px',
                                    borderRadius: 8,
                                    // Left accent bar marks the active row; the
                                    // border stays a hairline so the two rows
                                    // never look like two different components.
                                    border: '1px solid var(--border-subtle)',
                                    borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                                    background: isActive
                                        ? 'var(--bg-raised)'
                                        : hovered ? 'var(--bg-hover)' : 'transparent',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    transition: 'background 120ms ease, border-color 120ms ease',
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        display: 'grid',
                                        placeItems: 'center',
                                        width: 26,
                                        height: 26,
                                        flexShrink: 0,
                                    }}
                                >
                                    {integrationIcon(entry.id, 22)}
                                </span>

                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: 13,
                                        fontWeight: isActive ? 500 : 400,
                                        color: 'var(--text-primary)',
                                    }}>
                                        {getIntegrationName(entry.id)}
                                    </span>
                                    {isConnected ? (
                                        total > 0 && (
                                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                                {`${total} selected`}
                                            </span>
                                        )
                                    ) : (
                                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                            Not connected
                                        </span>
                                    )}
                                </span>

                                {isBusy ? (
                                    <IconLoader2
                                        size={14}
                                        className="animate-spin"
                                        style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                                    />
                                ) : isConnected ? (
                                    /* No destructive button at rest: revealed on
                                       row hover or keyboard focus, red only
                                       under its own hover. */
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPendingDisconnect(entry.id);
                                        }}
                                        style={{
                                            flexShrink: 0,
                                            height: 26,
                                            padding: '0 10px',
                                            borderRadius: 6,
                                            border: '1px solid var(--border-subtle)',
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            fontSize: 12,
                                            fontFamily: 'inherit',
                                            cursor: 'pointer',
                                            opacity: hovered ? 1 : 0,
                                            pointerEvents: hovered ? 'auto' : 'none',
                                            transition: 'opacity 120ms ease, color 120ms ease, border-color 120ms ease',
                                        }}
                                        onMouseEnter={(event) => {
                                            event.currentTarget.style.color = 'var(--text-error)';
                                            event.currentTarget.style.borderColor = 'var(--text-error)';
                                        }}
                                        onMouseLeave={(event) => {
                                            event.currentTarget.style.color = 'var(--text-secondary)';
                                            event.currentTarget.style.borderColor = 'var(--border-subtle)';
                                        }}
                                    >
                                        Disconnect
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setActiveId(entry.id);
                                            connect(entry.id);
                                        }}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            flexShrink: 0,
                                            height: 28,
                                            padding: '0 12px',
                                            borderRadius: 6,
                                            border: 'none',
                                            background: 'var(--accent)',
                                            color: 'var(--accent-fg)',
                                            fontSize: 12.5,
                                            fontWeight: 500,
                                            fontFamily: 'inherit',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <IconPlugConnected size={13} />
                                        Connect
                                    </button>
                                )}
                            </div>
                        );
                    })}
            </div>

            {/* ── Browser for the active service ──
                Keyed on the integration so the folder trail, listing cache and
                search all reset together when the user switches. */}
            {activeId && activeIsConnected && (
                <DriveFileBrowser
                    key={activeId}
                    integration={activeId}
                    selection={current}
                    onApply={(input) => apply(activeId, input)}
                    onClear={() => clear(activeId)}
                    onReconnect={() => connect(activeId)}
                    disallowedFileExtensions={disallowedFileExtensions}
                />
            )}

            {activeId && !activeIsConnected && !loading && (
                <p
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        margin: 0,
                        padding: '10px 2px',
                        fontSize: 12.5,
                        color: 'var(--text-secondary)',
                    }}
                >
                    {`Connect ${getIntegrationName(activeId)} to browse and attach its files.`}
                </p>
            )}

            <ConfirmDialog
                isOpen={pendingDisconnect !== null}
                title={pendingDisconnect ? `Disconnect ${getIntegrationName(pendingDisconnect)}?` : ''}
                message={
                    pendingDisconnect
                        ? `Amplify will lose access to your ${getIntegrationName(pendingDisconnect)} files. Anything you have already selected stays selected — reconnect to keep browsing.`
                        : ''
                }
                confirmLabel="Disconnect"
                variant="danger"
                onConfirm={() => {
                    const id = pendingDisconnect;
                    setPendingDisconnect(null);
                    if (id) disconnect(id);
                }}
                onCancel={() => setPendingDisconnect(null)}
            />
        </div>
    );
};

export default DriveSourcesPanel;

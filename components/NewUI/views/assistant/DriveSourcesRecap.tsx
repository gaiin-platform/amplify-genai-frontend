/**
 * DriveSourcesRecap — one provider's attached OneDrive / SharePoint / Google Drive picks,
 * as a full-width row in the attached data-sources grid.
 *
 * The classic editor kept this under "Attach Drive Data Sources" ("SharePoint: 1 Folder" →
 * folders → files with their embedding status). The card grid dropped it: drive picks showed
 * only as "N selected" inside the picker, and only while the picker was open — so after a
 * save there was nowhere to see which files made it in.
 *
 * Read-only on purpose. Picking and un-picking stay in the picker (`onManage` opens it);
 * this is the recap that says what is attached and what became of it:
 *   processed — has a stored copy; shows its embedding status
 *   blocked   — was saved earlier but never produced a copy (sensitivity block / failure)
 *   pending   — picked this session, handled when the assistant is saved
 *
 * Folder contents can run to hundreds of files, so each folder's list scrolls inside a
 * bounded region instead of pushing the rest of the editor down.
 *
 * Must render inside <DataSourceCardGrid> (shares its icon-button and pulse styles).
 */

import React, { useId } from 'react';
import { IconAlertCircle, IconFile, IconFolder } from '@tabler/icons-react';
import { DisclosureChevron } from '@/components/NewUI/shared/DisclosureChevron';
import {
    EmbeddingReprocessButton,
    EmbeddingStatusText,
    EmbeddingStatusView,
} from '@/components/NewUI/shared/EmbeddingStatus';
import { integrationIcon } from '@/components/NewUI/shared/integrationIcon';
import { getIntegrationName } from '@/utils/app/integrations';
import {
    DriveRecapFile,
    DriveRecapFolder,
    DriveRecapProvider,
    describeDriveCounts,
} from './driveRecapModel';

/** Tallest a folder's file list gets before it scrolls. */
const FILE_LIST_MAX_HEIGHT = 280;

const BLOCKED_HINT =
    'Could not be processed. This file may contain sensitive data or be blocked for security compliance.';

export interface DriveSourcesRecapProps {
    provider: DriveRecapProvider;
    expanded: boolean;
    onToggle: () => void;
    isFolderExpanded: (folder: DriveRecapFolder) => boolean;
    onToggleFolder: (folder: DriveRecapFolder) => void;
    /** Roll-up for the header (problems → working → waiting → completed). */
    summary: EmbeddingStatusView | null;
    /** A processed file's embedding status; null when none is known. */
    fileStatus: (file: DriveRecapFile) => EmbeddingStatusView | null;
    canReprocess: (file: DriveRecapFile) => boolean;
    onReprocess: (file: DriveRecapFile) => void;
    /** Opens the picker for this provider. Omit when the picker cannot be opened (feature off). */
    onManage?: () => void;
}

const FileRow: React.FC<{
    file: DriveRecapFile;
    status: EmbeddingStatusView | null;
    canReprocess: boolean;
    onReprocess: () => void;
}> = ({ file, status, canReprocess, onReprocess }) => {
    const blocked = file.state === 'blocked';
    return (
        <li
            title={blocked ? `${file.name}: ${BLOCKED_HINT}` : file.name}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', minWidth: 0 }}
        >
            {blocked
                ? <IconAlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-error)' }} />
                : <IconFile size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
            <span
                style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12.5,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {file.name}
            </span>
            <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {blocked
                    ? <span style={{ color: 'var(--text-error)', fontWeight: 500 }}>Couldn’t be processed</span>
                    : file.state === 'pending'
                        ? 'Processed when you save'
                        : status ? <EmbeddingStatusText status={status} /> : null}
            </span>
            {canReprocess && <EmbeddingReprocessButton name={file.name} onClick={onReprocess} />}
        </li>
    );
};

export const DriveSourcesRecap: React.FC<DriveSourcesRecapProps> = ({
    provider,
    expanded,
    onToggle,
    isFolderExpanded,
    onToggleFolder,
    summary,
    fileStatus,
    canReprocess,
    onReprocess,
    onManage,
}) => {
    const bodyId = useId();
    const name = getIntegrationName(provider.integration);
    const counts = describeDriveCounts(provider);

    const fileRow = (file: DriveRecapFile) => (
        <FileRow
            key={file.id}
            file={file}
            status={fileStatus(file)}
            canReprocess={canReprocess(file)}
            onReprocess={() => onReprocess(file)}
        />
    );

    return (
        <li className="nui-ds-card col-span-full" style={{ position: 'relative', listStyle: 'none' }}>
            <div
                style={{
                    boxSizing: 'border-box',
                    borderRadius: 16,
                    background: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-subtle) 55%, transparent)',
                    overflow: 'hidden',
                }}
            >
                {/* ── Header ─────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 76, paddingRight: 12 }}>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={expanded}
                        aria-controls={bodyId}
                        className="nui-ds-group-toggle"
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '14px 8px 14px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            color: 'inherit',
                            cursor: 'pointer',
                            borderRadius: 16,
                        }}
                    >
                        <span aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                            {integrationIcon(provider.integration, 26)}
                        </span>
                        <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                            <span
                                aria-live="polite"
                                style={{
                                    marginTop: 2,
                                    fontSize: 12,
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {counts}
                                {summary && (
                                    <>
                                        <span aria-hidden="true"> · </span>
                                        <EmbeddingStatusText status={summary} />
                                    </>
                                )}
                            </span>
                        </span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                            <DisclosureChevron open={expanded} size={16} />
                        </span>
                    </button>

                    {onManage && (
                        <button
                            type="button"
                            className="nui-ds-icon-btn"
                            onClick={onManage}
                            aria-label={`Change the files selected from ${name}`}
                            title="Change selection"
                            style={{
                                flexShrink: 0,
                                height: 30,
                                padding: '0 10px',
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontSize: 12,
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                            }}
                        >
                            Change
                        </button>
                    )}
                </div>

                {/* ── Folders and files ─────────────────────────────────── */}
                {expanded && (
                    <div id={bodyId} style={{ borderTop: '1px solid color-mix(in srgb, var(--border-subtle) 55%, transparent)', padding: '6px 16px 12px 28px' }}>
                        {provider.folders.map((folder) => {
                            const open = isFolderExpanded(folder);
                            const listId = `${bodyId}-${folder.id}`;
                            return (
                                <div key={folder.id} style={{ marginTop: 4 }}>
                                    <button
                                        type="button"
                                        onClick={() => onToggleFolder(folder)}
                                        aria-expanded={open}
                                        aria-controls={listId}
                                        className="nui-ds-group-toggle"
                                        title={folder.name}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '6px 4px',
                                            border: 'none',
                                            borderRadius: 8,
                                            background: 'transparent',
                                            textAlign: 'left',
                                            fontFamily: 'inherit',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            minWidth: 0,
                                        }}
                                    >
                                        <DisclosureChevron open={open} size={14} />
                                        <IconFolder size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                                        <span
                                            style={{
                                                minWidth: 0,
                                                fontSize: 12.5,
                                                fontWeight: 500,
                                                color: 'var(--text-primary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {folder.name}
                                        </span>
                                        <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {folder.unlisted ? '(not saved yet)' : `(${folder.files.length})`}
                                        </span>
                                    </button>

                                    {open && (
                                        folder.unlisted
                                            ? (
                                                <p id={listId} style={{ margin: '4px 0 4px 30px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                    The files in this folder are listed after you save.
                                                </p>
                                            )
                                            : folder.files.length === 0
                                                ? (
                                                    <p id={listId} style={{ margin: '4px 0 4px 30px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                        No files were processed from this folder.
                                                    </p>
                                                )
                                                : (
                                                    <ul
                                                        id={listId}
                                                        tabIndex={0}
                                                        aria-label={`Files in ${folder.name}`}
                                                        style={{
                                                            listStyle: 'none',
                                                            margin: '2px 0 0 26px',
                                                            padding: 0,
                                                            maxHeight: FILE_LIST_MAX_HEIGHT,
                                                            overflowY: 'auto',
                                                        }}
                                                    >
                                                        {folder.files.map(fileRow)}
                                                    </ul>
                                                )
                                    )}
                                </div>
                            );
                        })}

                        {provider.files.length > 0 && (
                            <ul
                                tabIndex={provider.files.length > 8 ? 0 : undefined}
                                aria-label={`Individual files from ${name}`}
                                style={{
                                    listStyle: 'none',
                                    margin: provider.folders.length > 0 ? '8px 0 0' : '4px 0 0',
                                    padding: 0,
                                    maxHeight: FILE_LIST_MAX_HEIGHT,
                                    overflowY: 'auto',
                                }}
                            >
                                {provider.files.map(fileRow)}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
};

export default DriveSourcesRecap;

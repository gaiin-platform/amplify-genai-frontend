/**
 * DriveFileRow — one line of the OneDrive / SharePoint browser.
 *
 * Two kinds of row share this component:
 *   containers (SharePoint sites and libraries, folders) — clicking drills in
 *   files                                               — clicking selects
 * In both cases the checkbox selects without navigating.
 *
 * There is no Type column: the leading icon carries it, with a muted label after
 * the name where the icon alone is ambiguous. There is no "N/A" — a file without
 * a size gets an empty cell.
 */

import React, { useState } from 'react';
import {
    IconBuildingCommunity,
    IconChevronRight,
    IconFolder,
    IconLibrary,
} from '@tabler/icons-react';
import { IntegrationFileRecord } from '@/types/integrations';
import { resolveDataSourceType } from '@/components/NewUI/shared/DataSourceCard';
import { displaySize, isContainer } from './driveBrowserModel';

export const DRIVE_ROW_HEIGHT = 46;

/** Level 2/3/4 sensitivity chips — compliance-visible, so all three are kept. */
const SENSITIVITY: Record<number, { label: string; color: string; title: string }> = {
    2: { label: 'Level 2', color: 'var(--file-icon-sheet)', title: 'Level 2 — Personal' },
    3: { label: 'Level 3', color: '#d97706', title: 'Level 3 — Private / Internal' },
    4: { label: 'Level 4', color: 'var(--text-error)', title: 'Level 4 — Confidential (access restricted)' },
};

/**
 * Containers are classified first: `resolveDataSourceType` reads
 * "SharePoint Library" as a plain file name and would hand back a generic file
 * icon for the one row type that must look navigable.
 */
const rowIcon = (record: IntegrationFileRecord): { icon: React.ReactNode; color: string; label: string } => {
    if (isContainer(record)) {
        const mime = record.mimeType.toLowerCase();
        if (mime.includes('site')) {
            return { icon: <IconBuildingCommunity size={22} stroke={1.6} />, color: 'var(--file-icon-doc)', label: 'Site' };
        }
        if (mime.includes('library')) {
            return { icon: <IconLibrary size={22} stroke={1.6} />, color: 'var(--file-icon-doc)', label: 'Library' };
        }
        return { icon: <IconFolder size={22} stroke={1.6} />, color: 'var(--text-secondary)', label: 'Folder' };
    }
    const descriptor = resolveDataSourceType(record.name, record.type);
    return { icon: descriptor.icon, color: descriptor.color, label: descriptor.label };
};

export interface DriveFileRowProps {
    record: IntegrationFileRecord;
    selected: boolean;
    /** Selected by way of an ancestor folder — ticked, but not untickable. */
    autoSelected: boolean;
    /** Level 4: no checkbox, no navigation. */
    blocked: boolean;
    /** Reserve the size cell only when some row in view actually has a size. */
    showSize: boolean;
    /** The header's bottom border already divides the first row from it. */
    isFirst: boolean;
    onToggle: () => void;
    onOpen: () => void;
    onBlockedClick: () => void;
}

export const DriveFileRow: React.FC<DriveFileRowProps> = ({
    record,
    selected,
    autoSelected,
    blocked,
    showSize,
    isFirst,
    onToggle,
    onOpen,
    onBlockedClick,
}) => {
    const [hovered, setHovered] = useState(false);
    const container = isContainer(record);
    const { icon, color, label } = rowIcon(record);
    const size = displaySize(record.size);
    const sensitivity = record.sensitivity && record.sensitivity > 1
        ? SENSITIVITY[record.sensitivity]
        : undefined;

    const activate = () => {
        if (blocked) { onBlockedClick(); return; }
        if (container) onOpen();
        else onToggle();
    };

    return (
        <div
            // An option inside the browser's listbox rather than a table row:
            // half-specified table semantics read worse to a screen reader than
            // a well-formed multi-select list, and this is a picker.
            role="option"
            tabIndex={0}
            aria-selected={selected}
            onClick={activate}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={record.name}
            style={{
                display: 'flex',
                alignItems: 'center',
                height: DRIVE_ROW_HEIGHT,
                // Selected wins over hover; both tint the full width, checkbox
                // gutter included, so the row reads as one target.
                background: selected
                    ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-app))'
                    : hovered
                        ? 'var(--bg-hover)'
                        : 'transparent',
                borderTop: isFirst ? 'none' : '1px solid var(--border-subtle)',
                cursor: blocked ? 'not-allowed' : 'pointer',
                opacity: blocked ? 0.6 : 1,
                outline: 'none',
                transition: 'background 100ms ease',
            }}
            onFocus={(event) => {
                (event.currentTarget as HTMLElement).style.boxShadow = 'inset 0 0 0 2px var(--accent)';
            }}
            onBlur={(event) => {
                (event.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
        >
            {/* Checkbox gutter — fixed 44px, centered, aligned with the header box */}
            <div
                style={{ width: 44, display: 'grid', placeItems: 'center', flexShrink: 0 }}
                onClick={(event) => event.stopPropagation()}
            >
                {!blocked && (
                    <input
                        type="checkbox"
                        checked={selected}
                        disabled={autoSelected}
                        onChange={onToggle}
                        aria-label={`Select ${record.name}`}
                        title={autoSelected ? 'To deselect items within, uncheck the parent folder.' : undefined}
                        style={{
                            width: 15,
                            height: 15,
                            accentColor: 'var(--accent)',
                            cursor: autoSelected ? 'not-allowed' : 'pointer',
                            opacity: autoSelected ? 0.5 : 1,
                        }}
                    />
                )}
            </div>

            {/* Type icon */}
            <span
                aria-hidden="true"
                style={{ display: 'grid', placeItems: 'center', width: 22, flexShrink: 0, color }}
            >
                {icon}
            </span>

            {/* Name + inline type / sensitivity labels */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginLeft: 10 }}>
                <span
                    style={{
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {record.name}
                </span>
                {!container && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {label}
                    </span>
                )}
                {sensitivity && (
                    <span
                        title={record.sensitivityLabel || sensitivity.title}
                        style={{ fontSize: 11, fontWeight: 500, color: sensitivity.color, flexShrink: 0 }}
                    >
                        {sensitivity.label}
                    </span>
                )}
            </div>

            {/* Size — empty when the record has none */}
            {showSize && (
                <span
                    style={{
                        width: 74,
                        textAlign: 'right',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                    }}
                >
                    {size ?? ''}
                </span>
            )}

            {/* Navigable affordance, on hover only */}
            <span
                aria-hidden="true"
                style={{
                    width: 26,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    color: 'var(--text-muted)',
                    opacity: container && hovered ? 1 : 0,
                    transition: 'opacity 100ms ease',
                }}
            >
                <IconChevronRight size={15} />
            </span>
        </div>
    );
};

export default DriveFileRow;

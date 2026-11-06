/**
 * AssistantConfigSummary — read-only view of an assistant's configuration (instructions, attached
 * documents, websites, drive files, skills, tools, workflow, enforced model). Used by the "View
 * prompt" dialog on shared assistants, where the viewer cannot edit. Tags are intentionally omitted.
 *
 * Presentational: it summarises the `Prompt` it is given (see `assistantConfigModel.ts`) and
 * touches nothing else. Tokens only; no animation.
 */

import React, { useEffect, useRef, useState } from 'react';
import { IconCloud, IconPlug, IconSparkles, IconSettings, IconTopologyStar3 } from '@tabler/icons-react';
import type { Prompt } from '@/types/prompt';
import { DataSourceCard, DataSourceCardGrid } from './DataSourceCard';
import { summarizeAssistantConfig, SummaryDataSource, SummaryDriveGroup } from './assistantConfigModel';

export interface AssistantConfigSummaryProps {
    prompt: Prompt;
    /** Model id → display name, so an enforced model reads as a name. Falls back to the id. */
    modelName?: (modelId: string) => string | undefined;
    /**
     * Opens one attached document or website. Omit and the cards stay read-only. The host owns the
     * request (download URL, permission errors, toast) so this component stays presentational;
     * return a promise and the card shows its "Preparing download…" state until it settles. Throw an
     * `Error` to report a failure: its message is shown inline under the cards (a toast would sit
     * behind this dialog's backdrop).
     */
    onOpenDocument?: (source: SummaryDataSource) => Promise<void> | void;
}

const MAX_DRIVE_NAMES = 6;

const SectionHeading: React.FC<{ children: React.ReactNode; count?: number }> = ({ children, count }) => (
    <h3 className="text-[12px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
        {children}
        {typeof count === 'number' && <span className="ml-1.5 font-normal">({count})</span>}
    </h3>
);

const Section: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
    <section className="mb-5 last:mb-0">
        <SectionHeading count={count}>{title}</SectionHeading>
        {children}
    </section>
);

const Chip: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; muted?: boolean }> = ({ icon, children, muted }) => (
    <li
        className="inline-flex items-center gap-1.5 max-w-full rounded-[6px] border px-2.5 py-1 text-[13px]"
        style={{
            borderColor: 'var(--border-subtle)',
            background: 'var(--bg-app)',
            color: muted ? 'var(--text-secondary)' : 'var(--text-primary)',
        }}
    >
        {icon}
        <span className="truncate">{children}</span>
    </li>
);

const ChipList: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <ul aria-label={label} className="flex flex-wrap gap-2 m-0 p-0" style={{ listStyle: 'none' }}>
        {children}
    </ul>
);

const driveSummaryLine = ({ fileCount, folderCount }: SummaryDriveGroup): string => {
    const parts: string[] = [];
    if (fileCount) parts.push(`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`);
    if (folderCount) parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`);
    return parts.join(', ');
};

const SKILL_MODE_LABEL: Record<string, string> = {
    all: 'All of these skills are always used',
    auto: 'Skills are chosen automatically for each message',
    manual: 'Skills are chosen manually',
};

export const AssistantConfigSummary: React.FC<AssistantConfigSummaryProps> = ({ prompt, modelName, onOpenDocument }) => {
    const summary = summarizeAssistantConfig(prompt);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [openError, setOpenError] = useState<string | null>(null);
    // Re-armed in the effect body (guide §16): a StrictMode remount must not strand the guard.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const open = async (source: SummaryDataSource) => {
        if (!onOpenDocument || openingId) return;
        setOpeningId(source.id);
        setOpenError(null);
        try {
            await onOpenDocument(source);
        } catch (error) {
            if (alive.current) setOpenError(error instanceof Error ? error.message : 'Could not open this item.');
        } finally {
            if (alive.current) setOpeningId(null);
        }
    };
    const cardProps = (source: SummaryDataSource) => onOpenDocument
        ? { onClick: () => { void open(source); }, downloading: openingId === source.id }
        : {};
    const enforcedModel = summary.enforcedModelId
        ? (modelName?.(summary.enforcedModelId) || summary.enforcedModelId)
        : undefined;

    return (
        <div data-testid="assistant-config-summary">
            <Section title="Instructions / system prompt">
                <pre
                    className="whitespace-pre-wrap break-words rounded-[8px] border p-4 text-[13px] leading-relaxed font-sans m-0"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                >
                    {summary.instructions || 'No prompt instructions were included with this share.'}
                </pre>
            </Section>

            {summary.documents.length > 0 && (
                <Section title="Documents" count={summary.documents.length}>
                    <DataSourceCardGrid label="Attached documents">
                        {summary.documents.map((doc) => (
                            <DataSourceCard key={doc.id} name={doc.name} type={doc.type} status="ready" {...cardProps(doc)} />
                        ))}
                    </DataSourceCardGrid>
                </Section>
            )}

            {openError && (
                <p role="alert" className="mb-5 mt-0 text-[12px]" style={{ color: 'var(--text-error)' }}>
                    {openError}
                </p>
            )}

            {summary.websites.length > 0 && (
                <Section title="Websites" count={summary.websites.length}>
                    <DataSourceCardGrid label="Attached websites">
                        {summary.websites.map((site) => (
                            <DataSourceCard key={site.id} name={site.name} type={site.type} status="ready" {...cardProps(site)} />
                        ))}
                    </DataSourceCardGrid>
                </Section>
            )}

            {summary.drive.length > 0 && (
                <Section title="Cloud drive files">
                    <ul aria-label="Attached drive files" className="m-0 p-0 flex flex-col gap-2" style={{ listStyle: 'none' }}>
                        {summary.drive.map((group) => (
                            <li
                                key={group.integration}
                                className="rounded-[8px] border px-3 py-2 text-[13px]"
                                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            >
                                <div className="flex items-center gap-2">
                                    <IconCloud size={15} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                                    <span className="font-medium">{group.label}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{driveSummaryLine(group)}</span>
                                </div>
                                {group.names.length > 0 && (
                                    <p className="mt-1 mb-0 text-[12px] break-words" style={{ color: 'var(--text-secondary)' }}>
                                        {group.names.slice(0, MAX_DRIVE_NAMES).join(', ')}
                                        {group.names.length > MAX_DRIVE_NAMES && ` and ${group.names.length - MAX_DRIVE_NAMES} more`}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {summary.skills.length > 0 && (
                <Section title="Skills" count={summary.skills.length}>
                    <ChipList label="Skills">
                        {summary.skills.map((skill, index) => (
                            <Chip key={`${skill.name}-${index}`} icon={<IconSparkles size={14} aria-hidden="true" />}>
                                {skill.name}
                                <span className="ml-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    {skill.required ? 'Required' : 'Optional'}
                                </span>
                            </Chip>
                        ))}
                    </ChipList>
                    {summary.skillSelectionMode && SKILL_MODE_LABEL[summary.skillSelectionMode] && (
                        <p className="mt-2 mb-0 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                            {SKILL_MODE_LABEL[summary.skillSelectionMode]}
                        </p>
                    )}
                </Section>
            )}

            {summary.tools.length > 0 && (
                <Section title="Tools & APIs" count={summary.tools.length}>
                    <ChipList label="Tools and APIs">
                        {summary.tools.map((tool) => (
                            <Chip key={tool} icon={<IconPlug size={14} aria-hidden="true" />}>{tool}</Chip>
                        ))}
                    </ChipList>
                </Section>
            )}

            {summary.hasWorkflow && (
                <Section title="Workflow">
                    <ChipList label="Workflow">
                        <Chip icon={<IconTopologyStar3 size={14} aria-hidden="true" />}>
                            {summary.workflowName ? `Runs the “${summary.workflowName}” workflow` : 'Runs a workflow template'}
                        </Chip>
                    </ChipList>
                </Section>
            )}

            {enforcedModel && (
                <Section title="Model">
                    <ChipList label="Model">
                        <Chip icon={<IconSettings size={14} aria-hidden="true" />}>
                            {enforcedModel}
                            {summary.enforcedEffort && (
                                <span className="ml-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    {summary.enforcedEffort} reasoning
                                </span>
                            )}
                        </Chip>
                    </ChipList>
                    <p className="mt-2 mb-0 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        This assistant always uses this model.
                    </p>
                </Section>
            )}
        </div>
    );
};

export default AssistantConfigSummary;

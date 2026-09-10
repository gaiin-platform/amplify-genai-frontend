import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { LucideAlertCircle, LucideChevronDown, LucideLoader2 } from './LucideIcons';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    ContextSelections,
    EpisodeProfile,
    Note,
    NotebookModel,
    NotebookSummary,
    PodcastGenerationResponse,
    SourceListItem,
    buildChatContext,
    generatePodcast,
    listEpisodeProfiles,
    listModels,
    listNotebooks,
    listNotes,
    listSources,
} from '@/services/notebookService';
import { formatModelName } from './modelDisplay';
import { formatTokenLimit, getContextUsageStatus, resolveContextWindow } from './modelContext';

type SourceMode = 'off' | 'insights' | 'full';
type NoteMode = 'off' | 'full';

interface NotebookSelection {
    sources: Record<string, SourceMode>;
    notes: Record<string, NoteMode>;
}

interface Props {
    onClose: () => void;
    onSubmitted: (response: PodcastGenerationResponse) => void;
    // Profile management lives in admin-gated sections — non-admins shouldn't
    // be told to create profiles they can't reach.
    isAdmin?: boolean;
}

// Helper function to format large numbers with K/M suffixes (reference).
const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

const getSourceDefaultMode = (source: SourceListItem): SourceMode =>
    source.insights_count && source.insights_count > 0 ? 'insights' : 'full';

const inputClass =
    'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100 dark:placeholder-gray-500';
const uppercaseLabelClass =
    'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const outlineBadgeClass =
    'inline-flex items-center rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium dark:border-neutral-600';

// Mirrors the reference GeneratePodcastDialog: a wide two-column layout with a
// multi-notebook content accordion on the left (per-source Summary/Full mode)
// and episode settings + Generate/Cancel on the right.
export const GeneratePodcastDialog = ({ onClose, onSubmitted, isAdmin = false }: Props) => {
    // Amplify's admin model table — the source of truth for context windows.
    const {
        state: { availableModels },
    } = useContext(HomeContext);

    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
    const [profiles, setProfiles] = useState<EpisodeProfile[]>([]);
    const [languageModels, setLanguageModels] = useState<NotebookModel[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
    const [selections, setSelections] = useState<Record<string, NotebookSelection>>({});
    const [sourcesByNotebook, setSourcesByNotebook] = useState<
        Record<string, SourceListItem[]>
    >({});
    const [notesByNotebook, setNotesByNotebook] = useState<Record<string, Note[]>>({});
    const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());

    const [episodeProfileId, setEpisodeProfileId] = useState<string>('');
    const [episodeName, setEpisodeName] = useState<string>('');
    const [instructions, setInstructions] = useState<string>('');

    const [tokenCount, setTokenCount] = useState<number>(0);
    const [charCount, setCharCount] = useState<number>(0);

    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Guards against out-of-order data fetches after unmount.
    const mountedRef = useRef<boolean>(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [nbs, eps, mdls] = await Promise.all([
                listNotebooks({ order_by: 'updated desc' }),
                listEpisodeProfiles(),
                listModels('language'),
            ]);
            if (cancelled) return;
            setNotebooks(nbs.filter((nb) => !nb.archived));
            setProfiles(eps);
            setLanguageModels(mdls);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Fetches a notebook's sources/notes once, then seeds their selection
    // defaults (sources → insights when available else full; notes → full) —
    // matching the reference, where loading a notebook's content selects it.
    const ensureNotebookData = useCallback(
        async (notebookId: string) => {
            if (sourcesByNotebook[notebookId] || fetchingIds.has(notebookId)) return;
            setFetchingIds((prev) => new Set(prev).add(notebookId));
            const [srcs, nts] = await Promise.all([
                listSources({ notebookId }),
                listNotes(notebookId),
            ]);
            if (!mountedRef.current) return;
            setSourcesByNotebook((prev) => ({ ...prev, [notebookId]: srcs }));
            setNotesByNotebook((prev) => ({ ...prev, [notebookId]: nts }));
            setSelections((prev) => {
                const current = prev[notebookId] ?? { sources: {}, notes: {} };
                const nextSources = { ...current.sources };
                for (const s of srcs) {
                    if (!(s.id in nextSources)) nextSources[s.id] = getSourceDefaultMode(s);
                }
                const nextNotes = { ...current.notes };
                for (const n of nts) {
                    if (!(n.id in nextNotes)) nextNotes[n.id] = 'full';
                }
                return { ...prev, [notebookId]: { sources: nextSources, notes: nextNotes } };
            });
            setFetchingIds((prev) => {
                const next = new Set(prev);
                next.delete(notebookId);
                return next;
            });
        },
        [sourcesByNotebook, fetchingIds],
    );

    const toggleExpanded = (notebookId: string) => {
        setExpandedNotebooks((prev) => {
            const next = new Set(prev);
            if (next.has(notebookId)) next.delete(notebookId);
            else next.add(notebookId);
            return next;
        });
        void ensureNotebookData(notebookId);
    };

    const handleNotebookToggle = async (notebookId: string, checked: boolean) => {
        await ensureNotebookData(notebookId);
        setSelections((prev) => {
            const srcs = sourcesByNotebook[notebookId] ?? [];
            const nts = notesByNotebook[notebookId] ?? [];
            const nextSources: Record<string, SourceMode> = {};
            const nextNotes: Record<string, NoteMode> = {};
            // ensureNotebookData may have resolved after this render's
            // sourcesByNotebook snapshot; fall back to whatever ids the
            // selection already knows about.
            const sourceIds =
                srcs.length > 0 ? srcs.map((s) => s.id) : Object.keys(prev[notebookId]?.sources ?? {});
            const noteIds =
                nts.length > 0 ? nts.map((n) => n.id) : Object.keys(prev[notebookId]?.notes ?? {});
            for (const id of sourceIds) {
                const s = srcs.find((ss) => ss.id === id);
                nextSources[id] = checked ? (s ? getSourceDefaultMode(s) : 'full') : 'off';
            }
            for (const id of noteIds) {
                nextNotes[id] = checked ? 'full' : 'off';
            }
            return { ...prev, [notebookId]: { sources: nextSources, notes: nextNotes } };
        });
    };

    const handleSourceModeChange = (
        notebookId: string,
        sourceId: string,
        mode: SourceMode,
    ) => {
        setSelections((prev) => ({
            ...prev,
            [notebookId]: {
                sources: { ...(prev[notebookId]?.sources ?? {}), [sourceId]: mode },
                notes: prev[notebookId]?.notes ?? {},
            },
        }));
    };

    const handleNoteToggle = (notebookId: string, noteId: string, checked: boolean) => {
        setSelections((prev) => ({
            ...prev,
            [notebookId]: {
                sources: prev[notebookId]?.sources ?? {},
                notes: {
                    ...(prev[notebookId]?.notes ?? {}),
                    [noteId]: checked ? 'full' : 'off',
                },
            },
        }));
    };

    // Per-notebook selections that actually include something.
    const activeSelections = useMemo(() => {
        const entries: { notebookId: string; selection: ContextSelections }[] = [];
        for (const [notebookId, selection] of Object.entries(selections)) {
            const sources: Record<string, SourceMode> = {};
            for (const [id, mode] of Object.entries(selection.sources)) {
                if (mode !== 'off') sources[id] = mode;
            }
            const notes: Record<string, NoteMode> = {};
            for (const [id, mode] of Object.entries(selection.notes)) {
                if (mode !== 'off') notes[id] = mode;
            }
            if (Object.keys(sources).length === 0 && Object.keys(notes).length === 0) {
                continue;
            }
            entries.push({
                notebookId,
                selection: { sources, notes } as ContextSelections,
            });
        }
        return entries;
    }, [selections]);

    const notebookSummaries = useMemo(() => {
        const map: Record<string, { sources: number; notes: number }> = {};
        for (const nb of notebooks) {
            const selection = selections[nb.id];
            map[nb.id] = {
                sources: selection
                    ? Object.values(selection.sources).filter((m) => m !== 'off').length
                    : 0,
                notes: selection
                    ? Object.values(selection.notes).filter((m) => m !== 'off').length
                    : 0,
            };
        }
        return map;
    }, [notebooks, selections]);

    const totalSelected = useMemo(
        () =>
            Object.values(notebookSummaries).reduce(
                (acc, s) => acc + s.sources + s.notes,
                0,
            ),
        [notebookSummaries],
    );

    // Update token/char counts when selections change (reference builds
    // context per notebook and sums the counts).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (activeSelections.length === 0) {
                setTokenCount(0);
                setCharCount(0);
                return;
            }
            try {
                let totalTokens = 0;
                let totalChars = 0;
                for (const { notebookId, selection } of activeSelections) {
                    const response = await buildChatContext(notebookId, selection);
                    if (cancelled) return;
                    if (response) {
                        totalTokens += response.token_count ?? 0;
                        totalChars += response.char_count ?? 0;
                    }
                }
                setTokenCount(totalTokens);
                setCharCount(totalChars);
            } catch {
                // Keep previous values on error, matching the reference.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeSelections]);

    const selectedProfile = useMemo(
        () => profiles.find((p) => p.id === episodeProfileId),
        [episodeProfileId, profiles],
    );

    // Context budget for the selected episode profile: the smaller context
    // window between its outline and transcript models (both see the full
    // selected content). New-style profiles reference model record IDs
    // (outline_llm/transcript_llm); legacy ones carry the model name directly.
    const contextLimit = useMemo(() => {
        if (!selectedProfile) return null;
        // Windows come from Amplify's admin model table (availableModels),
        // with the local pattern catalog as fallback — see resolveContextWindow.
        const resolve = (llmId?: string | null, legacyName?: string | null) => {
            const name = languageModels.find((m) => m.id === llmId)?.name ?? legacyName;
            if (!name) return null;
            const window = resolveContextWindow(name, availableModels);
            return window !== null ? { window, modelName: name } : null;
        };
        const candidates = [
            resolve(selectedProfile.outline_llm, selectedProfile.outline_model),
            resolve(selectedProfile.transcript_llm, selectedProfile.transcript_model),
        ];
        let limit: { window: number; modelName: string } | null = null;
        for (const c of candidates) {
            if (c && (!limit || c.window < limit.window)) limit = c;
        }
        return limit;
    }, [selectedProfile, languageModels, availableModels]);

    const contextUsage =
        contextLimit && tokenCount > 0
            ? getContextUsageStatus(tokenCount, contextLimit.window)
            : null;

    const handleSubmit = async () => {
        if (submitting) return;
        if (!selectedProfile) {
            setError('Select an episode profile before generating a podcast.');
            return;
        }
        if (!episodeName.trim()) {
            setError('Provide a name for the episode.');
            return;
        }
        if (activeSelections.length === 0) {
            setError('Select at least one source or note to include in the episode.');
            return;
        }

        setSubmitting(true);
        setError(null);

        // Reference content format: per-notebook built context serialized as
        // "Notebook: {name}\n{json}", joined with blank lines.
        const parts: string[] = [];
        for (const { notebookId, selection } of activeSelections) {
            const response = await buildChatContext(notebookId, selection);
            if (!response) {
                setSubmitting(false);
                setError('Failed to build context. Please review your selections.');
                return;
            }
            const name = notebooks.find((nb) => nb.id === notebookId)?.name ?? notebookId;
            parts.push(`Notebook: ${name}\n${JSON.stringify(response.context, null, 2)}`);
        }

        const result = await generatePodcast({
            episode_profile: selectedProfile.name,
            speaker_profile: selectedProfile.speaker_config,
            episode_name: episodeName.trim(),
            content: parts.join('\n\n'),
            briefing_suffix: instructions.trim() ? instructions.trim() : undefined,
        });

        setSubmitting(false);
        if (!result) {
            setError('Podcast generation failed.');
            return;
        }
        onSubmitted(result);
        onClose();
    };

    return (
        <Modal
            title="Generate Podcast Episode"
            onCancel={onClose}
            showSubmit={false}
            showCancel={false}
            width={() => Math.min(1080, window.innerWidth * 0.9)}
            height={() => window.innerHeight * 0.9}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select the content to include and configure the episode details
                        before generating a new podcast episode.
                    </p>

                    <div className="grid gap-6 md:grid-cols-[2fr_1fr] xl:grid-cols-[3fr_1fr]">
                        {/* Content selection panel */}
                        <div className="flex min-w-0 flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className={`text-sm ${uppercaseLabelClass}`}>Content</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Pick notebooks, sources, and notes to include in this
                                        episode.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={outlineBadgeClass}>
                                        {totalSelected} items selected
                                    </span>
                                    {(tokenCount > 0 || charCount > 0) && (
                                        <span
                                            className={`text-xs ${
                                                contextUsage === 'over'
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : contextUsage === 'warn'
                                                      ? 'text-amber-600 dark:text-amber-400'
                                                      : 'text-gray-500 dark:text-gray-400'
                                            }`}
                                        >
                                            {tokenCount > 0 &&
                                                `${formatNumber(tokenCount)}${
                                                    contextLimit
                                                        ? ` / ${formatTokenLimit(contextLimit.window)}`
                                                        : ''
                                                } tokens`}
                                            {tokenCount > 0 && charCount > 0 && ' · '}
                                            {charCount > 0 && `${formatNumber(charCount)} chars`}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50/60 dark:border-neutral-700 dark:bg-neutral-800/30">
                                {loading ? (
                                    <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
                                        <LucideLoader2
                                            size={16}
                                            className="mr-2 animate-spin"
                                        />
                                        Loading notebooks...
                                    </div>
                                ) : notebooks.length === 0 ? (
                                    <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
                                        No notebooks found. Create a notebook and add content
                                        before generating a podcast.
                                    </div>
                                ) : (
                                    <div className="max-h-[48vh] overflow-y-auto">
                                        {notebooks.map((notebook) => {
                                            const expanded = expandedNotebooks.has(notebook.id);
                                            const srcs =
                                                sourcesByNotebook[notebook.id] ?? [];
                                            const nts = notesByNotebook[notebook.id] ?? [];
                                            const selection = selections[notebook.id];
                                            const summary = notebookSummaries[notebook.id] ?? {
                                                sources: 0,
                                                notes: 0,
                                            };
                                            const checked =
                                                summary.sources + summary.notes > 0;
                                            const fetchingNb = fetchingIds.has(notebook.id);

                                            return (
                                                <div
                                                    key={notebook.id}
                                                    className="border-b border-gray-200 last:border-b-0 dark:border-neutral-700"
                                                >
                                                    <div className="flex items-start gap-3 px-4 pt-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(e) =>
                                                                handleNotebookToggle(
                                                                    notebook.id,
                                                                    e.target.checked,
                                                                )
                                                            }
                                                            className="mt-1 h-4 w-4 accent-purple-500"
                                                        />
                                                        <button
                                                            onClick={() =>
                                                                toggleExpanded(notebook.id)
                                                            }
                                                            className="flex flex-1 items-center justify-between gap-3 pb-3 text-left"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-medium">
                                                                    {notebook.name ||
                                                                        '(untitled)'}
                                                                </p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {checked
                                                                        ? `${summary.sources} Sources, ${summary.notes} Notes`
                                                                        : 'No content selected'}
                                                                </p>
                                                            </div>
                                                            <span className="flex items-center gap-2">
                                                                <span
                                                                    className={`${outlineBadgeClass} whitespace-nowrap`}
                                                                >
                                                                    {notebook.source_count ??
                                                                        srcs.length}{' '}
                                                                    Sources ·{' '}
                                                                    {notebook.note_count ??
                                                                        nts.length}{' '}
                                                                    Notes
                                                                </span>
                                                                <LucideChevronDown
                                                                    size={16}
                                                                    className={`text-gray-400 transition-transform ${
                                                                        expanded
                                                                            ? 'rotate-180'
                                                                            : ''
                                                                    }`}
                                                                />
                                                            </span>
                                                        </button>
                                                    </div>

                                                    {expanded && (
                                                        <div className="space-y-4 px-4 pb-4">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className={uppercaseLabelClass}>
                                                                        Sources
                                                                    </h4>
                                                                    {fetchingNb && (
                                                                        <LucideLoader2
                                                                            size={12}
                                                                            className="animate-spin text-gray-400"
                                                                        />
                                                                    )}
                                                                </div>
                                                                {srcs.length === 0 ? (
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {fetchingNb
                                                                            ? 'Loading…'
                                                                            : 'No sources available in this notebook.'}
                                                                    </p>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        {srcs.map((source) => {
                                                                            const mode =
                                                                                selection
                                                                                    ?.sources?.[
                                                                                    source.id
                                                                                ] ?? 'off';
                                                                            const hasInsights =
                                                                                (source.insights_count ??
                                                                                    0) > 0;
                                                                            return (
                                                                                <div
                                                                                    key={source.id}
                                                                                    className="flex items-center gap-3 rounded border border-gray-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-[#2b2c36]"
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={
                                                                                            mode !==
                                                                                            'off'
                                                                                        }
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleSourceModeChange(
                                                                                                notebook.id,
                                                                                                source.id,
                                                                                                e
                                                                                                    .target
                                                                                                    .checked
                                                                                                    ? getSourceDefaultMode(
                                                                                                          source,
                                                                                                      )
                                                                                                    : 'off',
                                                                                            )
                                                                                        }
                                                                                        className="h-4 w-4 accent-purple-500"
                                                                                    />
                                                                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                                                        <span className="truncate text-sm font-medium">
                                                                                            {source.title ||
                                                                                                'Untitled source'}
                                                                                        </span>
                                                                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                                                            <span>
                                                                                                {source
                                                                                                    .asset
                                                                                                    ?.url
                                                                                                    ? 'Link'
                                                                                                    : 'File'}
                                                                                            </span>
                                                                                            <span>
                                                                                                •
                                                                                            </span>
                                                                                            <span>
                                                                                                {source.embedded
                                                                                                    ? 'Embedded'
                                                                                                    : 'Not Embedded'}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <select
                                                                                        value={
                                                                                            mode ===
                                                                                            'off'
                                                                                                ? 'full'
                                                                                                : mode
                                                                                        }
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleSourceModeChange(
                                                                                                notebook.id,
                                                                                                source.id,
                                                                                                e
                                                                                                    .target
                                                                                                    .value as SourceMode,
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            mode ===
                                                                                            'off'
                                                                                        }
                                                                                        className={`w-[140px] flex-none ${inputClass} disabled:opacity-50`}
                                                                                    >
                                                                                        <option
                                                                                            value="insights"
                                                                                            disabled={
                                                                                                !hasInsights
                                                                                            }
                                                                                        >
                                                                                            Summary
                                                                                        </option>
                                                                                        <option value="full">
                                                                                            Full
                                                                                            content
                                                                                        </option>
                                                                                    </select>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="h-px bg-gray-200 dark:bg-neutral-700" />

                                                            <div className="space-y-2">
                                                                <h4 className={uppercaseLabelClass}>
                                                                    Notes
                                                                </h4>
                                                                {nts.length === 0 ? (
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {fetchingNb
                                                                            ? 'Loading…'
                                                                            : 'No notes available in this notebook.'}
                                                                    </p>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        {nts.map((note) => {
                                                                            const mode =
                                                                                selection
                                                                                    ?.notes?.[
                                                                                    note.id
                                                                                ] ?? 'off';
                                                                            return (
                                                                                <div
                                                                                    key={note.id}
                                                                                    className="flex items-center gap-3 rounded border border-gray-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-[#2b2c36]"
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={
                                                                                            mode !==
                                                                                            'off'
                                                                                        }
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleNoteToggle(
                                                                                                notebook.id,
                                                                                                note.id,
                                                                                                e
                                                                                                    .target
                                                                                                    .checked,
                                                                                            )
                                                                                        }
                                                                                        className="h-4 w-4 accent-purple-500"
                                                                                    />
                                                                                    <div className="flex min-w-0 flex-1 flex-col">
                                                                                        <span className="truncate text-sm font-medium">
                                                                                            {note.title ||
                                                                                                'Untitled note'}
                                                                                        </span>
                                                                                        {note.updated && (
                                                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                                                Updated{' '}
                                                                                                {new Date(
                                                                                                    note.updated.replace(
                                                                                                        ' ',
                                                                                                        'T',
                                                                                                    ),
                                                                                                ).toLocaleString()}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Episode settings */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className={`text-sm ${uppercaseLabelClass}`}>
                                    Episode Settings
                                </h3>
                                {loading ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        <LucideLoader2 size={16} className="animate-spin" />
                                        Loading episode profiles...
                                    </div>
                                ) : profiles.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-neutral-600 dark:bg-neutral-800/40 dark:text-gray-400">
                                        {isAdmin
                                            ? 'No episode profiles found. Create an episode profile before generating a podcast.'
                                            : 'Podcast generation is not set up yet. Please contact an administrator.'}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium leading-none">
                                                Episode profile
                                            </label>
                                            <select
                                                value={episodeProfileId}
                                                onChange={(e) =>
                                                    setEpisodeProfileId(e.target.value)
                                                }
                                                className={`w-full ${inputClass}`}
                                            >
                                                <option value="">
                                                    Select an episode profile
                                                </option>
                                                {profiles.map((profile) => (
                                                    <option
                                                        key={profile.id}
                                                        value={profile.id}
                                                    >
                                                        {profile.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedProfile && isAdmin && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Uses speaker profile{' '}
                                                    <strong>
                                                        {selectedProfile.speaker_config}
                                                    </strong>
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium leading-none">
                                                Episode name
                                            </label>
                                            <input
                                                type="text"
                                                value={episodeName}
                                                onChange={(e) =>
                                                    setEpisodeName(e.target.value)
                                                }
                                                placeholder="e.g., AI and the Future of Work"
                                                autoComplete="off"
                                                className={`w-full ${inputClass}`}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium leading-none">
                                                Additional instructions
                                            </label>
                                            <textarea
                                                value={instructions}
                                                onChange={(e) =>
                                                    setInstructions(e.target.value)
                                                }
                                                placeholder="Any supplementary advice to append to the episode briefing..."
                                                autoComplete="off"
                                                className={`min-h-[100px] w-full resize-none text-xs ${inputClass}`}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {contextUsage && contextUsage !== 'ok' && contextLimit && (
                                <div
                                    className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                                        contextUsage === 'over'
                                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300'
                                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300'
                                    }`}
                                >
                                    <LucideAlertCircle
                                        size={16}
                                        className="mt-0.5 flex-none"
                                    />
                                    <span>
                                        {contextUsage === 'over'
                                            ? `The selected content (~${formatNumber(tokenCount)} tokens) likely exceeds the ~${formatTokenLimit(contextLimit.window)}-token context limit of ${formatModelName(contextLimit.modelName)}, used by this episode profile — generation will fail. Switch sources to Summary mode or deselect content.`
                                            : `The selected content (~${formatNumber(tokenCount)} tokens) is close to the ~${formatTokenLimit(contextLimit.window)}-token context limit of ${formatModelName(contextLimit.modelName)}, used by this episode profile. Consider switching sources to Summary mode.`}
                                    </span>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                    <LucideAlertCircle
                                        size={16}
                                        className="mt-0.5 flex-none"
                                    />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-purple-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:pointer-events-none disabled:opacity-50"
                                >
                                    {submitting && (
                                        <LucideLoader2
                                            size={16}
                                            className="animate-spin"
                                        />
                                    )}
                                    {submitting ? 'Generating...' : 'Generate'}
                                </button>
                                <button
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="inline-flex h-9 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-600 dark:bg-transparent dark:hover:bg-neutral-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            }
        />
    );
};

export default GeneratePodcastDialog;

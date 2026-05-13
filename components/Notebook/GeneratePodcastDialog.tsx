import { useEffect, useMemo, useState } from 'react';
import { IconAlertCircle, IconLoader2 } from '@tabler/icons-react';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    BuildContextResponse,
    ContextSelections,
    Note,
    NotebookSummary,
    SourceListItem,
    buildChatContext,
    listNotebooks,
    listNotes,
    listSources,
} from '@/services/notebookContentService';
import {
    EpisodeProfile,
    generatePodcast,
    listEpisodeProfiles,
} from '@/services/notebookConfigService';

type SourceMode = 'off' | 'insights' | 'full';
type NoteMode = 'off' | 'full';

interface Props {
    onClose: () => void;
    onSubmitted: () => void;
}

export const GeneratePodcastDialog = ({ onClose, onSubmitted }: Props) => {
    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
    const [notebookId, setNotebookId] = useState<string>('');
    const [profiles, setProfiles] = useState<EpisodeProfile[]>([]);
    const [profileId, setProfileId] = useState<string>('');
    const [episodeName, setEpisodeName] = useState<string>('');
    const [instructions, setInstructions] = useState<string>('');

    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [sourceModes, setSourceModes] = useState<Record<string, SourceMode>>({});
    const [noteModes, setNoteModes] = useState<Record<string, NoteMode>>({});

    const [loading, setLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [nbs, eps] = await Promise.all([
                listNotebooks({ order_by: 'updated desc' }),
                listEpisodeProfiles(),
            ]);
            if (cancelled) return;
            setNotebooks(nbs);
            setProfiles(eps);
            if (nbs.length > 0) setNotebookId(nbs[0].id);
            if (eps.length > 0) setProfileId(eps[0].id);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!notebookId) {
            setSources([]);
            setNotes([]);
            return;
        }
        let cancelled = false;
        (async () => {
            const [srcs, nts] = await Promise.all([
                listSources({ notebookId }),
                listNotes(notebookId),
            ]);
            if (cancelled) return;
            setSources(srcs);
            setNotes(nts);
            const sm: Record<string, SourceMode> = {};
            for (const s of srcs) sm[s.id] = 'full';
            const nm: Record<string, NoteMode> = {};
            for (const nn of nts) nm[nn.id] = 'full';
            setSourceModes(sm);
            setNoteModes(nm);
        })();
        return () => {
            cancelled = true;
        };
    }, [notebookId]);

    const selectedProfile = useMemo(
        () => profiles.find((p) => p.id === profileId),
        [profileId, profiles],
    );

    const selectedSourceCount = useMemo(
        () => Object.values(sourceModes).filter((m) => m !== 'off').length,
        [sourceModes],
    );
    const selectedNoteCount = useMemo(
        () => Object.values(noteModes).filter((m) => m !== 'off').length,
        [noteModes],
    );

    const canSubmit =
        !submitting &&
        !loading &&
        !!notebookId &&
        !!selectedProfile &&
        episodeName.trim().length > 0 &&
        selectedSourceCount + selectedNoteCount > 0;

    const handleSubmit = async () => {
        if (!canSubmit || !selectedProfile) return;
        setSubmitting(true);
        setError(null);

        const selections: ContextSelections = {
            sources: sourceModes,
            notes: noteModes,
        };

        let context: BuildContextResponse | null = null;
        try {
            context = await buildChatContext(notebookId, selections);
        } catch {
            // Non-fatal: fall through with empty content fallback below.
        }

        if (!context) {
            setSubmitting(false);
            setError('Failed to build context for the selected sources/notes.');
            return;
        }

        const content = JSON.stringify(context.context, null, 2);

        const result = await generatePodcast({
            episode_profile: selectedProfile.name,
            speaker_profile: selectedProfile.speaker_config,
            episode_name: episodeName.trim(),
            content,
            notebook_id: notebookId,
            briefing_suffix: instructions.trim() || undefined,
        });

        setSubmitting(false);
        if (!result) {
            setError('Failed to submit the podcast generation job.');
            return;
        }
        onSubmitted();
        onClose();
    };

    return (
        <Modal
            title="Generate Podcast"
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={submitting ? 'Generating…' : 'Generate'}
            disableSubmit={!canSubmit}
            width={() => 720}
            height={() => 640}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <IconLoader2 size={16} className="animate-spin" />
                            Loading notebooks and profiles…
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                            <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                            <span>
                                No episode profiles found. Episode profiles must be configured
                                server-side before you can generate podcasts.
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">Notebook</label>
                                    <select
                                        value={notebookId}
                                        onChange={(e) => setNotebookId(e.target.value)}
                                        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                    >
                                        {notebooks.map((nb) => (
                                            <option key={nb.id} value={nb.id}>
                                                {nb.name || '(untitled)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">Episode profile</label>
                                    <select
                                        value={profileId}
                                        onChange={(e) => setProfileId(e.target.value)}
                                        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                    >
                                        {profiles.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedProfile && (
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                            Uses speaker profile{' '}
                                            <strong>{selectedProfile.speaker_config}</strong>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Episode name</label>
                                <input
                                    type="text"
                                    value={episodeName}
                                    onChange={(e) => setEpisodeName(e.target.value)}
                                    placeholder="My research deep-dive"
                                    className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">
                                    Additional instructions (optional)
                                </label>
                                <textarea
                                    rows={3}
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="e.g. focus on the methodology and skip the introduction"
                                    className="resize-none rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100"
                                />
                            </div>

                            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-700 dark:bg-[#343541]">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Content</span>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {selectedSourceCount} sources · {selectedNoteCount} notes
                                    </span>
                                </div>

                                <div>
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Sources
                                    </div>
                                    {sources.length === 0 ? (
                                        <div className="text-[12px] text-gray-400 dark:text-gray-500">
                                            No sources in this notebook.
                                        </div>
                                    ) : (
                                        <div className="max-h-32 overflow-y-auto pr-1">
                                            {sources.map((s) => {
                                                const mode = sourceModes[s.id] || 'off';
                                                const isPlaceholderTitle =
                                                    !s.title ||
                                                    s.title === 'Processing...' ||
                                                    s.title.trim() === '';
                                                const displayTitle = isPlaceholderTitle
                                                    ? '(Untitled)'
                                                    : s.title!;
                                                return (
                                                    <label
                                                        key={s.id}
                                                        className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={mode !== 'off'}
                                                            onChange={(e) =>
                                                                setSourceModes((prev) => ({
                                                                    ...prev,
                                                                    [s.id]: e.target.checked
                                                                        ? 'full'
                                                                        : 'off',
                                                                }))
                                                            }
                                                            className="text-purple-600"
                                                        />
                                                        <span
                                                            className={`truncate ${
                                                                isPlaceholderTitle
                                                                    ? 'italic text-gray-400 dark:text-gray-500'
                                                                    : ''
                                                            }`}
                                                            title={s.title || ''}
                                                        >
                                                            {displayTitle}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Notes
                                    </div>
                                    {notes.length === 0 ? (
                                        <div className="text-[12px] text-gray-400 dark:text-gray-500">
                                            No notes in this notebook.
                                        </div>
                                    ) : (
                                        <div className="max-h-32 overflow-y-auto pr-1">
                                            {notes.map((n) => {
                                                const mode = noteModes[n.id] || 'off';
                                                return (
                                                    <label
                                                        key={n.id}
                                                        className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={mode !== 'off'}
                                                            onChange={(e) =>
                                                                setNoteModes((prev) => ({
                                                                    ...prev,
                                                                    [n.id]: e.target.checked
                                                                        ? 'full'
                                                                        : 'off',
                                                                }))
                                                            }
                                                            className="text-purple-600"
                                                        />
                                                        <span className="truncate">
                                                            {n.title || '(untitled)'}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                    <IconAlertCircle size={16} className="mt-0.5 flex-none" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            }
        />
    );
};

export default GeneratePodcastDialog;

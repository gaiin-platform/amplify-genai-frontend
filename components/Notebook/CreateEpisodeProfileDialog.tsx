import { useEffect, useState } from 'react';
import { LucideAlertCircle } from './LucideIcons';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    EpisodeProfile,
    NotebookLanguage,
    NotebookModel,
    SpeakerProfile,
    createEpisodeProfile,
    listLanguages,
    listModels,
    updateEpisodeProfile,
} from '@/services/notebookService';
import { formatModelName, prepareModelOptions } from './modelDisplay';

interface Props {
    speakerProfiles: SpeakerProfile[];
    // When set, the dialog edits this profile (PUT) instead of creating one.
    initial?: EpisodeProfile;
    onClose: () => void;
    onCreated: (profile: EpisodeProfile) => void;
}

const inputClass =
    'rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100';

export const CreateEpisodeProfileDialog = ({
    speakerProfiles,
    initial,
    onClose,
    onCreated,
}: Props) => {
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [speakerConfig, setSpeakerConfig] = useState(
        initial?.speaker_config ?? speakerProfiles[0]?.name ?? '',
    );
    const [outlineModel, setOutlineModel] = useState(initial?.outline_llm ?? '');
    const [transcriptModel, setTranscriptModel] = useState(initial?.transcript_llm ?? '');
    const [language, setLanguage] = useState(initial?.language ?? '');
    const [briefing, setBriefing] = useState(initial?.default_briefing ?? '');
    const [numSegments, setNumSegments] = useState(initial?.num_segments ?? 5);

    const [languageModels, setLanguageModels] = useState<NotebookModel[]>([]);
    const [languages, setLanguages] = useState<NotebookLanguage[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [models, langs] = await Promise.all([listModels('language'), listLanguages()]);
            if (cancelled) return;
            const options = prepareModelOptions(models);
            setLanguageModels(options);
            setLanguages(langs);
            // Default both stages to the first model — but never clobber the
            // models already picked on the profile being edited.
            if (options.length > 0) {
                setOutlineModel((curr) => curr || options[0].id);
                setTranscriptModel((curr) => curr || options[0].id);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const segmentsValid = Number.isInteger(numSegments) && numSegments >= 3 && numSegments <= 20;

    const canSubmit =
        !submitting &&
        !!name.trim() &&
        !!speakerConfig &&
        !!outlineModel &&
        !!transcriptModel &&
        !!briefing.trim() &&
        segmentsValid;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);

        const data = {
            name: name.trim(),
            description: description.trim(),
            speaker_config: speakerConfig,
            outline_llm: outlineModel,
            transcript_llm: transcriptModel,
            language: language || null,
            default_briefing: briefing.trim(),
            num_segments: numSegments,
        };
        const result = initial
            ? await updateEpisodeProfile(initial.id, data)
            : await createEpisodeProfile(data);

        setSubmitting(false);
        if (!result) {
            setError(`Failed to ${initial ? 'update' : 'create'} episode profile.`);
            return;
        }
        onCreated(result);
        onClose();
    };

    const modelSelect = (value: string, onChange: (v: string) => void) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading}
            className={inputClass}
        >
            {loading && <option value="">Loading models…</option>}
            {!loading && languageModels.length === 0 && (
                <option value="">No language models configured</option>
            )}
            {languageModels.map((m) => (
                <option key={m.id} value={m.id}>
                    {formatModelName(m.name)}
                </option>
            ))}
        </select>
    );

    return (
        <Modal
            title={initial ? 'Edit Episode Profile' : 'Create Episode Profile'}
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={
                submitting
                    ? initial
                        ? 'Saving…'
                        : 'Creating…'
                    : initial
                      ? 'Save Changes'
                      : 'Create'
            }
            disableSubmit={!canSubmit}
            width={() => Math.min(680, window.innerWidth * 0.95)}
            height={() => Math.min(640, window.innerHeight * 0.9)}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    {speakerProfiles.length === 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                            <LucideAlertCircle size={16} className="mt-0.5 flex-none" />
                            <span>
                                No speaker profiles available. Create a speaker profile first —
                                episode profiles need one to define the voices.
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">
                                Profile name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Deep-dive interview"
                                className={inputClass}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">
                                Segments (3–20) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min={3}
                                max={20}
                                value={Number.isNaN(numSegments) ? '' : numSegments}
                                onChange={(e) => setNumSegments(parseInt(e.target.value, 10))}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional"
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">
                            Speaker profile <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={speakerConfig}
                            onChange={(e) => setSpeakerConfig(e.target.value)}
                            disabled={speakerProfiles.length === 0}
                            className={inputClass}
                        >
                            {speakerProfiles.length === 0 && (
                                <option value="">No speaker profiles</option>
                            )}
                            {speakerProfiles.map((sp) => (
                                <option key={sp.id} value={sp.name}>
                                    {sp.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">
                                Outline model <span className="text-red-500">*</span>
                            </label>
                            {modelSelect(outlineModel, setOutlineModel)}
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">
                                Transcript model <span className="text-red-500">*</span>
                            </label>
                            {modelSelect(transcriptModel, setTranscriptModel)}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Language</label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            disabled={loading}
                            className={inputClass}
                        >
                            <option value="">Default</option>
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.name} ({lang.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">
                            Default briefing <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={5}
                            value={briefing}
                            onChange={(e) => setBriefing(e.target.value)}
                            placeholder="Instructions that shape every episode generated with this profile — tone, structure, audience…"
                            className={`resize-none ${inputClass}`}
                        />
                    </div>

                    {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
                </div>
            }
        />
    );
};

export default CreateEpisodeProfileDialog;

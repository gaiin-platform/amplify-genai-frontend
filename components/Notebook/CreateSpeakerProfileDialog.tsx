import { useEffect, useState } from 'react';
import { LucidePlus, LucideTrash2 } from './LucideIcons';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import {
    NotebookModel,
    SpeakerProfile,
    SpeakerVoice,
    createSpeakerProfile,
    listModels,
    updateSpeakerProfile,
} from '@/services/notebookService';
import { formatModelName, prepareModelOptions } from './modelDisplay';

interface Props {
    // When set, the dialog edits this profile (PUT) instead of creating one.
    initial?: SpeakerProfile;
    onClose: () => void;
    onCreated: (profile: SpeakerProfile) => void;
}

const EMPTY_SPEAKER: SpeakerVoice = {
    name: '',
    voice_id: '',
    backstory: '',
    personality: '',
    voice_model: null,
};

const MAX_SPEAKERS = 4;

const inputClass =
    'rounded border border-[--border-subtle] bg-[--bg-composer] px-3 py-2 text-sm text-[--text-primary]';

export const CreateSpeakerProfileDialog = ({ initial, onClose, onCreated }: Props) => {
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [voiceModel, setVoiceModel] = useState(initial?.voice_model ?? '');
    const [speakers, setSpeakers] = useState<SpeakerVoice[]>(
        initial && initial.speakers.length > 0
            ? initial.speakers.map((s) => ({ ...s }))
            : [{ ...EMPTY_SPEAKER }],
    );

    const [ttsModels, setTtsModels] = useState<NotebookModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const models = await listModels('text_to_speech');
            if (cancelled) return;
            const unique = prepareModelOptions(models);
            setTtsModels(unique);
            // Default to the first model, but never clobber the model already
            // picked on the profile being edited.
            if (unique.length > 0) setVoiceModel((curr) => curr || unique[0].id);
            setModelsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const updateSpeaker = (index: number, patch: Partial<SpeakerVoice>) => {
        setSpeakers((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    };

    const addSpeaker = () => {
        setSpeakers((prev) =>
            prev.length >= MAX_SPEAKERS ? prev : [...prev, { ...EMPTY_SPEAKER }],
        );
    };

    const removeSpeaker = (index: number) => {
        setSpeakers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    };

    const speakersComplete = speakers.every(
        (s) =>
            s.name.trim() &&
            s.voice_id.trim() &&
            s.backstory.trim() &&
            s.personality.trim(),
    );

    const canSubmit = !submitting && !!name.trim() && !!voiceModel && speakersComplete;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);

        const data = {
            name: name.trim(),
            description: description.trim(),
            voice_model: voiceModel,
            speakers: speakers.map((s) => ({
                name: s.name.trim(),
                voice_id: s.voice_id.trim(),
                backstory: s.backstory.trim(),
                personality: s.personality.trim(),
                voice_model: s.voice_model || null,
            })),
        };
        const result = initial
            ? await updateSpeakerProfile(initial.id, data)
            : await createSpeakerProfile(data);

        setSubmitting(false);
        if (!result) {
            setError(`Failed to ${initial ? 'update' : 'create'} speaker profile.`);
            return;
        }
        onCreated(result);
        onClose();
    };

    const modelSelect = (
        value: string,
        onChange: (v: string) => void,
        allowEmpty: boolean,
    ) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={modelsLoading}
            className={inputClass}
        >
            {modelsLoading && <option value="">Loading models…</option>}
            {!modelsLoading && ttsModels.length === 0 && (
                <option value="">No text-to-speech models configured</option>
            )}
            {!modelsLoading && allowEmpty && <option value="">Use profile default</option>}
            {ttsModels.map((m) => (
                <option key={m.id} value={m.id}>
                    {formatModelName(m.name)}
                </option>
            ))}
        </select>
    );

    return (
        <CreationModalShell
            title={initial ? 'Edit Speaker Profile' : 'Create Speaker Profile'}
            onClose={onClose}
            onSave={handleSubmit}
            saveLabel={initial ? 'Save Changes' : 'Create'}
            isSaving={submitting}
            saveDisabled={!canSubmit}
        >
                <div className="flex flex-col gap-4 p-2 text-[--text-primary]">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">
                                Profile name <span className="text-[--text-error]">*</span>
                            </label>
                            <input
                                type="text"
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Two hosts, conversational"
                                className={inputClass}
                            />
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
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">
                            Voice model <span className="text-[--text-error]">*</span>
                        </label>
                        {modelSelect(voiceModel, setVoiceModel, false)}
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold">
                                Speakers ({speakers.length}/{MAX_SPEAKERS})
                            </div>
                            <div className="text-xs text-[--text-muted]">
                                Configure 1–4 voices for this profile.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addSpeaker}
                            disabled={speakers.length >= MAX_SPEAKERS}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-[--border-subtle] px-2.5 text-sm text-[--text-secondary] transition-colors hover:bg-[--bg-hover] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <LucidePlus size={16} />
                            Add speaker
                        </button>
                    </div>

                    {speakers.map((s, i) => (
                        <div
                            key={i}
                            className="flex flex-col gap-3 rounded-lg border border-[--border-subtle] p-3"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">Speaker {i + 1}</span>
                                <button
                                    type="button"
                                    onClick={() => removeSpeaker(i)}
                                    disabled={speakers.length <= 1}
                                    title="Remove speaker"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[--text-muted] transition-colors hover:bg-[--bg-hover] hover:text-[--text-error] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <LucideTrash2 size={16} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">
                                        Name <span className="text-[--text-error]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={s.name}
                                        onChange={(e) => updateSpeaker(i, { name: e.target.value })}
                                        placeholder={`Host ${i + 1}`}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">
                                        Voice ID <span className="text-[--text-error]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={s.voice_id}
                                        onChange={(e) =>
                                            updateSpeaker(i, { voice_id: e.target.value })
                                        }
                                        placeholder="voice_123"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">
                                    Backstory <span className="text-[--text-error]">*</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={s.backstory}
                                    onChange={(e) =>
                                        updateSpeaker(i, { backstory: e.target.value })
                                    }
                                    placeholder="Who is this speaker? Their background and expertise…"
                                    className={`resize-none ${inputClass}`}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">
                                    Personality <span className="text-[--text-error]">*</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={s.personality}
                                    onChange={(e) =>
                                        updateSpeaker(i, { personality: e.target.value })
                                    }
                                    placeholder="Speaking style, tone, quirks…"
                                    className={`resize-none ${inputClass}`}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">
                                    Per-speaker TTS override
                                </label>
                                {modelSelect(
                                    s.voice_model ?? '',
                                    (v) => updateSpeaker(i, { voice_model: v || null }),
                                    true,
                                )}
                            </div>
                        </div>
                    ))}

                    {error && <div className="text-sm text-[--text-error]">{error}</div>}
                </div>
        </CreationModalShell>
    );
};

export default CreateSpeakerProfileDialog;

import { useEffect, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Modal } from '@/components/ReusableComponents/Modal';
import {
    NotebookModel,
    SpeakerProfile,
    SpeakerVoice,
    createSpeakerProfile,
    listModels,
} from '@/services/notebookService';
import { formatModelName } from './modelDisplay';

interface Props {
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
    'rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100';

export const CreateSpeakerProfileDialog = ({ onClose, onCreated }: Props) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [voiceModel, setVoiceModel] = useState('');
    const [speakers, setSpeakers] = useState<SpeakerVoice[]>([{ ...EMPTY_SPEAKER }]);

    const [ttsModels, setTtsModels] = useState<NotebookModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const models = await listModels('text_to_speech');
            if (cancelled) return;
            setTtsModels(models);
            if (models.length > 0) setVoiceModel(models[0].id);
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

        const result = await createSpeakerProfile({
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
        });

        setSubmitting(false);
        if (!result) {
            setError('Failed to create speaker profile.');
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
                    {formatModelName(m.name)} ({m.provider})
                </option>
            ))}
        </select>
    );

    return (
        <Modal
            title="Create Speaker Profile"
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={submitting ? 'Creating…' : 'Create'}
            disableSubmit={!canSubmit}
            width={() => Math.min(680, window.innerWidth * 0.95)}
            height={() => Math.min(660, window.innerHeight * 0.9)}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
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
                            Voice model <span className="text-red-500">*</span>
                        </label>
                        {modelSelect(voiceModel, setVoiceModel, false)}
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold">
                                Speakers ({speakers.length}/{MAX_SPEAKERS})
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                Configure 1–4 voices for this profile.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addSpeaker}
                            disabled={speakers.length >= MAX_SPEAKERS}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:text-gray-200 dark:hover:bg-white/5"
                        >
                            <IconPlus size={14} />
                            Add speaker
                        </button>
                    </div>

                    {speakers.map((s, i) => (
                        <div
                            key={i}
                            className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-neutral-700"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">Speaker {i + 1}</span>
                                <button
                                    type="button"
                                    onClick={() => removeSpeaker(i)}
                                    disabled={speakers.length <= 1}
                                    title="Remove speaker"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                >
                                    <IconTrash size={15} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">
                                        Name <span className="text-red-500">*</span>
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
                                        Voice ID <span className="text-red-500">*</span>
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
                                    Backstory <span className="text-red-500">*</span>
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
                                    Personality <span className="text-red-500">*</span>
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

                    {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
                </div>
            }
        />
    );
};

export default CreateSpeakerProfileDialog;

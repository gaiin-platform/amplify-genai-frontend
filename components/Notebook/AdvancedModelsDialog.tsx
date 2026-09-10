import { useState } from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';
import { NotebookModel } from '@/services/notebookService';
import { formatModelName } from './modelDisplay';

export interface AskModels {
    strategy: string;
    answer: string;
    finalAnswer: string;
}

interface Props {
    models: NotebookModel[];
    initial: AskModels;
    onSave: (models: AskModels) => void;
    onClose: () => void;
}

const selectClass =
    'rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-[#40414f] dark:text-neutral-100';

// Pick a specific model for each stage of the Ask pipeline (strategy → answer →
// final answer), mirroring the original app's Advanced Model Selection dialog.
export const AdvancedModelsDialog = ({ models, initial, onSave, onClose }: Props) => {
    // If `initial` holds a model id that's no longer in `models` (removed/
    // renamed since it was saved), a <select> can't display it — the browser
    // silently falls back to rendering its first <option> without firing
    // onChange, so the visible selection would disagree with this state, and
    // clicking Save would re-persist the stale, invisible id instead of what
    // the user actually sees selected. Fall back to '' (shows the "Select a
    // model" placeholder) so state always matches what's rendered.
    const validId = (id: string) => (models.some((m) => m.id === id) ? id : '');
    const [strategy, setStrategy] = useState(validId(initial.strategy));
    const [answer, setAnswer] = useState(validId(initial.answer));
    const [finalAnswer, setFinalAnswer] = useState(validId(initial.finalAnswer));

    const canSave = !!strategy && !!answer && !!finalAnswer;

    const modelSelect = (
        label: string,
        value: string,
        onChange: (v: string) => void,
    ) => (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={selectClass}
            >
                {!value && <option value="">Select a model</option>}
                {models.map((m) => (
                    <option key={m.id} value={m.id}>
                        {formatModelName(m.name)}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <Modal
            title="Advanced Model Selection"
            onCancel={onClose}
            onSubmit={() => {
                if (!canSave) return;
                onSave({ strategy, answer, finalAnswer });
                onClose();
            }}
            submitLabel="Save Changes"
            disableSubmit={!canSave}
            width={() => 480}
            height={() => 420}
            content={
                <div className="flex flex-col gap-4 p-2 text-neutral-800 dark:text-neutral-100">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Choose specific models for each stage of the Ask process.
                    </p>
                    {modelSelect('Strategy Model', strategy, setStrategy)}
                    {modelSelect('Answer Model', answer, setAnswer)}
                    {modelSelect('Final Answer Model', finalAnswer, setFinalAnswer)}
                </div>
            }
        />
    );
};

export default AdvancedModelsDialog;

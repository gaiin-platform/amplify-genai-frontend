import React, { useState } from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { DialogShell, fieldCls, fieldStyle, ghostBtnCls, primaryBtnCls } from './DialogShell';
import { MAX_INSTRUCTIONS_LENGTH } from './useProjectDrafts';

interface InstructionsDialogProps {
    initial: string;
    saving: boolean;
    onSave: (text: string) => Promise<boolean>;
    onClose: () => void;
}

export const InstructionsDialog: React.FC<InstructionsDialogProps> = ({ initial, saving, onSave, onClose }) => {
    const [text, setText] = useState(initial);
    const changed = text !== initial;

    const submit = async () => {
        if (await onSave(text)) onClose();
    };

    return (
        <DialogShell
            title="Project instructions"
            onClose={onClose}
            footer={(
                <>
                    <button type="button" onClick={onClose} className={ghostBtnCls}>Cancel</button>
                    <button type="button" onClick={submit} disabled={!changed || saving} className={primaryBtnCls} style={{ background: 'var(--accent)' }}>
                        {saving && <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />} Save
                    </button>
                </>
            )}
        >
            <p className="mb-3 text-sm leading-5" style={{ color: 'var(--text-muted)' }}>
                Tell Amplify how to respond in every chat in this project. These are added on top of any assistant&apos;s own instructions.
            </p>
            <label htmlFor="instructions-text" className="sr-only">Instructions</label>
            <textarea
                id="instructions-text"
                data-autofocus
                value={text}
                maxLength={MAX_INSTRUCTIONS_LENGTH}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="e.g. Answer as a senior reviewer. Use APA citations. Keep replies under 200 words."
                className={`${fieldCls} resize-y leading-6`}
                style={fieldStyle}
            />
            <div className="mt-1 text-right text-xs" style={{ color: text.length > MAX_INSTRUCTIONS_LENGTH * 0.9 ? 'var(--accent)' : 'var(--text-muted)' }}>
                {text.length.toLocaleString()} / {MAX_INSTRUCTIONS_LENGTH.toLocaleString()}
            </div>
        </DialogShell>
    );
};

export default InstructionsDialog;

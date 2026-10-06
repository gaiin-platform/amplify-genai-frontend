import React, { useState } from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { DialogShell, fieldCls, fieldStyle, ghostBtnCls, primaryBtnCls } from './DialogShell';
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from './useProjectDrafts';

interface ProjectDetailsDialogProps {
    name: string;
    description: string;
    saving: boolean;
    onSave: (name: string, description: string) => Promise<boolean>;
    onClose: () => void;
}

export const ProjectDetailsDialog: React.FC<ProjectDetailsDialogProps> = ({ name: initialName, description: initialDescription, saving, onSave, onClose }) => {
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription);
    const changed = name !== initialName || description !== initialDescription;

    const submit = async () => {
        if (!name.trim()) return;
        if (await onSave(name, description)) onClose();
    };

    return (
        <DialogShell
            title="Edit project details"
            onClose={onClose}
            footer={(
                <>
                    <button type="button" onClick={onClose} className={ghostBtnCls}>Cancel</button>
                    <button type="button" onClick={submit} disabled={!changed || !name.trim() || saving} className={primaryBtnCls} style={{ background: 'var(--accent)' }}>
                        {saving && <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />} Save
                    </button>
                </>
            )}
        >
            <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <label htmlFor="details-name" className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input id="details-name" data-autofocus value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} className={fieldCls} style={fieldStyle} />
                <label htmlFor="details-description" className="mb-1 mt-4 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea id="details-description" value={description} maxLength={MAX_DESCRIPTION_LENGTH} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this project about?" className={`${fieldCls} resize-none`} style={fieldStyle} />
            </form>
        </DialogShell>
    );
};

export default ProjectDetailsDialog;

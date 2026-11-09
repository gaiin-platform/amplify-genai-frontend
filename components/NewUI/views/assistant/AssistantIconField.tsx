/**
 * AssistantIconField — choose the picture shown for an assistant: on its published page
 * (`/assistants/<path>`) and in the assistants list, in place of the generic robot.
 *
 * Replaces the icon control hidden inside the old `AssistantPathEditor` (which only appeared once
 * a path was set). The upload is the same one — `AttachFile` with `type: 'assistant-icon'` — and the
 * result is stored as `data.astIcon`, so the published page needs no change.
 *
 * Uploading is eager; deleting is not. A replaced or removed file is handed to `onQueueDelete` and the
 * host deletes it only after the save succeeds, so cancelling the editor never strips an assistant of
 * the icon it already had. The host must also refuse to save while `onUploadingChange(true)` is in force.
 */

import React, { useEffect, useRef, useState } from 'react';
import { IconLoader2, IconPhoto, IconRobot, IconTrash } from '@tabler/icons-react';
import { AttachFile } from '@/components/Chat/AttachFile';
import { AttachedDocument } from '@/types/attacheddocument';
import { IMAGE_FILE_EXTENSIONS } from '@/utils/app/const';
import { AssistantIconImage } from '@/components/NewUI/shared/AssistantIconImage';
import { readIconRef } from './assistantIconModel';

const ICON_INPUT_ID = '__attachFile_assistant_icon';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

export interface AssistantIconFieldProps {
    /** The icon the assistant has now (or `undefined`). */
    value: AttachedDocument | undefined;
    /** An upload finished (the new icon) or the icon was removed (`undefined`). */
    onChange: (icon: AttachedDocument | undefined) => void;
    /** A previously stored icon file the user replaced or removed. The host deletes it after a successful save. */
    onQueueDelete: (key: string) => void;
    onUploadingChange: (uploading: boolean) => void;
    /** Group assistants keep their files under the group. */
    groupId?: string;
}

const secondaryButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-raised)',
    color: 'var(--text-primary)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
};

export const AssistantIconField: React.FC<AssistantIconFieldProps> = ({ value, onChange, onQueueDelete, onUploadingChange, groupId }) => {
    /** A file being uploaded. Once it finishes it becomes `value` and this goes back to null. */
    const [pending, setPending] = useState<{ doc: AttachedDocument; progress: number } | null>(null);
    const pendingIdRef = useRef<string | null>(null);

    useEffect(() => {
        onUploadingChange(!!pending);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pending]);

    const queueDelete = (doc: AttachedDocument | undefined) => {
        const key = doc?.key;
        if (key) onQueueDelete(key);
    };

    const remove = () => {
        queueDelete(pending?.doc);
        queueDelete(value);
        pendingIdRef.current = null;
        setPending(null);
        onChange(undefined);
    };

    const iconRef = readIconRef(value);
    const uploading = !!pending;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                    aria-hidden="true"
                    style={{
                        width: 56,
                        height: 56,
                        flexShrink: 0,
                        borderRadius: 12,
                        overflow: 'hidden',
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {uploading ? (
                        <IconLoader2 size={20} className="motion-safe:animate-spin motion-reduce:animate-none" style={{ color: 'var(--text-muted)' }} />
                    ) : (
                        <AssistantIconImage
                            icon={iconRef}
                            radius={0}
                            fallback={<IconRobot size={24} style={{ color: 'var(--text-muted)' }} />}
                        />
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => (document.getElementById(ICON_INPUT_ID) as HTMLInputElement | null)?.click()}
                            className={FOCUS}
                            style={{ ...secondaryButton, opacity: uploading ? 0.6 : 1, cursor: uploading ? 'default' : 'pointer' }}
                        >
                            <IconPhoto size={14} aria-hidden="true" /> {value ? 'Replace icon' : 'Add an icon'}
                        </button>
                        {(value || uploading) && (
                            <button
                                type="button"
                                onClick={remove}
                                className={FOCUS}
                                style={{ ...secondaryButton, color: 'var(--text-secondary)' }}
                                aria-label={uploading ? 'Cancel icon upload' : 'Remove icon'}
                            >
                                <IconTrash size={14} aria-hidden="true" /> {uploading ? 'Cancel' : 'Remove'}
                            </button>
                        )}
                    </div>
                    <p role="status" style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                        {uploading
                            ? `Uploading… ${Math.min(pending!.progress, 99)}%`
                            : `Shown on the assistant’s page and in your assistants list. ${IMAGE_FILE_EXTENSIONS.join(', ').toUpperCase()}.`}
                    </p>
                </div>
            </div>

            {/* AttachFile brings its own old-UI paperclip; only its hidden <input> is wanted. Clipped rather
                than display:none so the programmatic click() that opens the file dialog keeps working. */}
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                <AttachFile
                    id={ICON_INPUT_ID}
                    allowedFileExtensions={IMAGE_FILE_EXTENSIONS}
                    groupId={groupId}
                    disableRag={false}
                    props={{ type: 'assistant-icon' }}
                    onAttach={(doc: AttachedDocument) => {
                        // The input accepts several files; the first wins and any in-flight one is replaced.
                        queueDelete(pending?.doc);
                        pendingIdRef.current = doc.id;
                        setPending({ doc, progress: 0 });
                    }}
                    onSetMetadata={() => { /* not needed for an icon */ }}
                    onSetKey={() => { /* AttachFile also sets the key on the document it handed us */ }}
                    onUploadProgress={(doc: AttachedDocument, progress: number) => {
                        if (pendingIdRef.current !== doc.id) return; // replaced or cancelled meanwhile
                        if (progress < 100) {
                            setPending({ doc, progress });
                            return;
                        }
                        // A stored icon being replaced is queued only now, so a failed upload keeps the old one.
                        if (value && value.key !== doc.key) queueDelete(value);
                        pendingIdRef.current = null;
                        setPending(null);
                        onChange(doc);
                    }}
                />
            </span>
        </div>
    );
};

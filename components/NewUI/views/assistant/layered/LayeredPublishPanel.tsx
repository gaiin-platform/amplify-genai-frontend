/**
 * LayeredPublishPanel — publish a layered assistant at `/assistants/<link>` and choose its icon.
 *
 * Replaces the old `AssistantPathEditor` for layered assistants. Controlled: the builder owns
 * `PublishState` (it needs it at save time, and `publishBlocker` reads it to stop a save whose link
 * was never validated). This panel runs the checks, debounced, in the same order the assistant
 * creation modal uses: shape → reserved words → appropriateness (LLM, falling back to a word filter)
 * → not taken by another assistant. The rules themselves live in `assistantPathRules`.
 *
 * Access (who may open it) is only offered for personal layered assistants; a group's is always
 * public, as before.
 */

import React, { useContext, useEffect, useRef, useState } from 'react';
import { Filter } from 'bad-words';
import { IconAlertTriangle, IconCheck, IconLoader2, IconPhoto, IconWorld } from '@tabler/icons-react';
import HomeContext from '@/components/Home/home.context';
import { useSession } from 'next-auth/react';
import { AttachedDocument } from '@/types/attacheddocument';
import { DefaultModels } from '@/types/model';
import { MessageType, newMessage } from '@/types/chat';
import { lookupAssistant } from '@/services/assistantService';
import { getUserAmplifyGroups } from '@/services/adminService';
import { promptForData } from '@/utils/app/llm';
import { IMAGE_FILE_EXTENSIONS } from '@/utils/app/const';
import { AttachFile } from '@/components/Chat/AttachFile';
import { CheckboxControl, TextControl } from '@/components/NewUI/shared/FormControls';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { EmailChipsInput } from '@/components/NewUI/shared/EmailChipsInput';
import { SignInRequiredNote } from '@/components/NewUI/shared/SignInRequiredNote';
import { resolveUsernameForEmail } from '@/components/NewUI/shared/emailSuggestions';
import { DataSourceCard, DataSourceCardGrid } from '@/components/NewUI/shared/DataSourceCard';
import { checkSlugSystemTerms, cleanSlug, validateSlug } from '../assistantPathRules';
import { PUBLIC_ACCESS, PublishState, isCurrentPath } from '../layeredPublishModel';

const CHECK_DEBOUNCE_MS = 1200;
const ICON_INPUT_ID = '__attachFile_layered_icon';

export interface LayeredPublishPanelProps {
    value: PublishState;
    onChange: (patch: Partial<PublishState>) => void;
    astIcon: AttachedDocument | undefined;
    onIconChange: (icon: AttachedDocument | undefined) => void;
    /** An icon file the user replaced or removed. The host deletes it only once the save succeeds. */
    onQueueIconDelete: (key: string) => void;
    /** The layered assistant's id, if it has been saved (lets "your own link" count as available). */
    assistantId?: string;
    /** Set for a group layered assistant (always public; icon files belong to the group). */
    groupId?: string;
}

const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' };
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

export const LayeredPublishPanel: React.FC<LayeredPublishPanelProps> = ({ value, onChange, astIcon, onIconChange, onQueueIconDelete, assistantId, groupId }) => {
    const { state: { featureFlags, chatEndpoint, statsService, amplifyUsers, defaultAccount }, getDefaultModel } = useContext(HomeContext);
    const { data: session } = useSession();
    const isGroup = !!groupId;
    const enabled = !!featureFlags?.assistantPathPublishing;

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const checkSeq = useRef(0);

    // ── Link validation (debounced) ───────────────────────────────────────
    useEffect(() => {
        const path = value.path.trim();
        const emit = (patch: Partial<PublishState>) => onChangeRef.current(patch);
        if (!path) {
            checkSeq.current++;
            emit({ available: false, checking: false, error: '' });
            return;
        }
        if (isCurrentPath({ path, savedPath: value.savedPath })) {
            checkSeq.current++;
            emit({ available: true, checking: false, error: '' });
            return;
        }
        const shape = validateSlug(path) || checkSlugSystemTerms(path);
        if (shape) {
            checkSeq.current++;
            emit({ available: false, checking: false, error: shape });
            return;
        }

        emit({ available: false, checking: true, error: '' });
        const seq = ++checkSeq.current;
        const timer = window.setTimeout(async () => {
            try {
                if (!(await isAppropriate(path))) {
                    if (seq === checkSeq.current) emit({ available: false, checking: false, error: 'This link contains inappropriate content. Please choose a different one.' });
                    return;
                }
                const result = await lookupAssistant(path);
                if (seq !== checkSeq.current) return;
                if (result.success && !(assistantId && result.assistantId === assistantId)) {
                    emit({ available: false, checking: false, error: 'This link is already in use by another assistant.' });
                } else {
                    emit({ available: true, checking: false, error: '' });
                }
            } catch {
                if (seq === checkSeq.current) emit({ available: false, checking: false, error: 'Couldn’t verify the link — check your connection.' });
            }
        }, CHECK_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.path, value.savedPath, assistantId]);

    // Invalidate in-flight checks on unmount.
    useEffect(() => () => { checkSeq.current++; }, []);

    /** LLM check first (PG-13 standard); if it can't answer, fall back to a word filter. */
    async function isAppropriate(path: string): Promise<boolean> {
        if (chatEndpoint) {
            try {
                const system = 'Analyze if the provided url path contains any inappropriate words, phrases, or characters. The standard of appropriateness is the same as the content of a PG-13 movie. Your response should be only YES or NO in all caps.';
                const messages = [newMessage({ role: 'user', content: `Is the following path appropriate for a public assistant path: ${path} \n Respond with either YES or NO in all caps`, type: MessageType.PROMPT })];
                const answer = await promptForData(chatEndpoint, messages, getDefaultModel(DefaultModels.CHEAPEST), system, defaultAccount, statsService, 20);
                if (answer) return answer.includes('YES') || !answer.includes('NO');
            } catch { /* fall through */ }
        }
        try { return !new Filter().isProfane(path); } catch { return true; }
    }

    // ── Access (personal only) ────────────────────────────────────────────
    const [ampGroups, setAmpGroups] = useState<string[] | null>(null);
    const restricted = !value.accessData.isPublic;
    useEffect(() => {
        if (isGroup || !restricted || ampGroups) return;
        let alive = true;
        getUserAmplifyGroups().then((r: any) => { if (alive) setAmpGroups(r?.success ? r.data : []); }).catch(() => { if (alive) setAmpGroups([]); });
        return () => { alive = false; };
    }, [isGroup, restricted, ampGroups]);

    const access = value.accessData;
    const setAccess = (next: typeof access) => onChange({ accessData: next });
    const userEmails = (access.accessTo.users ?? []).map((u) => (amplifyUsers as Record<string, string>)[u] || u);

    // ── Icon ──────────────────────────────────────────────────────────────
    const [icon, setIcon] = useState<{ doc: AttachedDocument; progress: number } | null>(astIcon ? { doc: astIcon, progress: 100 } : null);
    const removeIcon = () => {
        const key = (icon?.doc as any)?.key;
        if (key) onQueueIconDelete(key);
        setIcon(null);
        onIconChange(undefined);
    };

    if (!enabled) {
        return <p style={{ ...muted, margin: 0 }}>Publishing at a link isn’t enabled for your organization.</p>;
    }

    const path = value.path.trim();
    const current = isCurrentPath(value);
    const statusId = 'layered-link-status';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Link */}
            <div>
                <label htmlFor="layered-link" style={label}>Link</label>
                <div style={{ position: 'relative' }}>
                    <TextControl
                        id="layered-link"
                        value={value.path}
                        placeholder="my-layered-assistant"
                        maxLength={40}
                        invalid={!!value.error}
                        aria-describedby={statusId}
                        onChange={(e) => onChange({ path: cleanSlug(e.target.value) })}
                        style={{ paddingRight: 36, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                    />
                    <span aria-hidden="true" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex' }}>
                        {value.checking ? (
                            <IconLoader2 size={15} className="motion-safe:animate-spin motion-reduce:animate-none" style={{ color: 'var(--text-muted)' }} />
                        ) : path && value.error ? (
                            <IconAlertTriangle size={15} style={{ color: 'var(--text-error)' }} />
                        ) : path && (value.available || current) ? (
                            <IconCheck size={15} style={{ color: 'var(--success-fg)' }} />
                        ) : null}
                    </span>
                </div>
                <p id={statusId} role="status" style={{ ...muted, color: value.error ? 'var(--text-error)' : 'var(--text-muted)' }}>
                    {value.error
                        ? value.error
                        : value.checking
                            ? 'Checking availability…'
                            : path && (value.available || current)
                                ? `${current ? 'Current link' : 'Available'} — opens at ${typeof window !== 'undefined' ? window.location.origin : ''}/assistants/${path}`
                                : value.savedPath
                                    ? 'This layered assistant stays published at its current link; enter a different one to move it.'
                                    : 'Lowercase letters, numbers and hyphens, 3–40 characters. Leave empty to keep it unpublished.'}
                </p>
            </div>

            {/* Who can open it */}
            {path && !isGroup && (
                <div>
                    <span style={label}>Who can open it</span>
                    <SegmentedControl
                        items={[{ id: 'public', label: 'Anyone with the link' }, { id: 'specific', label: 'Specific people' }]}
                        value={restricted ? 'specific' : 'public'}
                        onChange={(id) => setAccess(id === 'public' ? { ...PUBLIC_ACCESS } : { isPublic: false, accessTo: access.accessTo })}
                        aria-label="Who can open the published link"
                    />
                    {restricted && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {ampGroups && ampGroups.length > 0 && (
                                <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
                                    <legend style={label}>Amplify groups</legend>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                                        {ampGroups.map((g, i) => (
                                            <CheckboxControl
                                                key={g}
                                                id={`layered-ampgroup-${i}`}
                                                label={g}
                                                checked={(access.accessTo.amplifyGroups ?? []).includes(g)}
                                                onChange={(on) => {
                                                    const current = access.accessTo.amplifyGroups ?? [];
                                                    setAccess({ ...access, accessTo: { ...access.accessTo, amplifyGroups: on ? [...current, g] : current.filter((x) => x !== g) } });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </fieldset>
                            )}
                            <div>
                                <span style={label}>People</span>
                                <EmailChipsInput
                                    selected={userEmails}
                                    onChange={(emails) =>
                                        setAccess({ ...access, accessTo: { ...access.accessTo, users: emails.map((e) => resolveUsernameForEmail(e, amplifyUsers as Record<string, string>)) } })
                                    }
                                    currentUserEmail={session?.user?.email ?? undefined}
                                    fontSize={12}
                                    inputId="layered-access-emails"
                                    ariaLabel="People who can open the link — email addresses"
                                />
                                <SignInRequiredNote action="access" fontSize={11} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Icon */}
            {path && (
                <div>
                    <span style={label}>Icon</span>
                    {icon && (
                        <div style={{ margin: '10px 0' }}>
                            <DataSourceCardGrid label="Assistant icon">
                                <DataSourceCard
                                    name={icon.doc.name}
                                    type={icon.doc.type}
                                    status={icon.progress === 100 ? 'ready' : icon.progress >= 95 ? 'processing' : 'uploading'}
                                    progress={icon.progress < 95 ? icon.progress : undefined}
                                    onRemove={removeIcon}
                                    onCancelUpload={removeIcon}
                                />
                            </DataSourceCardGrid>
                        </div>
                    )}
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                        <AttachFile
                            id={ICON_INPUT_ID}
                            allowedFileExtensions={IMAGE_FILE_EXTENSIONS}
                            onAttach={(doc: AttachedDocument) => {
                                const previous = (icon?.doc as any)?.key;
                                if (previous) onQueueIconDelete(previous);
                                setIcon({ doc, progress: 0 });
                            }}
                            onSetMetadata={() => { /* not needed for an icon */ }}
                            onSetKey={() => { /* AttachFile also sets the key on the document it handed us */ }}
                            onUploadProgress={(doc: AttachedDocument, progress: number) => {
                                setIcon({ doc, progress });
                                if (progress === 100) onIconChange(doc);
                            }}
                            disableRag={false}
                            props={{ type: 'assistant-icon' }}
                            groupId={groupId}
                        />
                    </span>
                    <button
                        type="button"
                        onClick={() => (document.getElementById(ICON_INPUT_ID) as HTMLInputElement | null)?.click()}
                        className={FOCUS}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
                    >
                        <IconPhoto size={14} aria-hidden="true" /> {icon ? 'Replace icon' : 'Add an icon'}
                    </button>
                    <p style={muted}>Shown on the published page. {IMAGE_FILE_EXTENSIONS.join(', ').toUpperCase()}.</p>
                </div>
            )}

            {!path && (
                <p style={{ ...muted, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconWorld size={14} aria-hidden="true" /> Add a link above to make this layered assistant openable from its own page.
                </p>
            )}
        </div>
    );
};

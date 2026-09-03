/**
 * SkillsCapabilityPanel — Capabilities → Skills, in the new UI.
 *
 * Replaces `components/Skills/SkillsSection` at this call site. That component is
 * untouched and still serves the classic editor (NEW_UI_GUIDE §1).
 *
 * Three things change beyond the palette:
 *
 *   - Its own accordion header is gone. The old section rendered an IconBrain +
 *     "Skills" + count pill + chevron *inside* CapabilityCard's identical header,
 *     so the editor showed the same title twice and needed two clicks to open.
 *   - Purple becomes `--accent`. Skills had a purple identity, which guide §3
 *     bans outright ("never use orange, purple, indigo, or violet as interactive
 *     accents"); every interactive element here is blue like the rest of the app.
 *   - The full-screen SkillEditor is early-returned rather than rendered as a
 *     child of the panel (guide §5.2), so it does not stack over the editor.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconBrain, IconLoader2, IconPlus, IconX } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import {
    CreateSkillData,
    Skill,
    SkillReference,
    SkillSelectionMode,
    UpdateSkillData,
} from '@/types/skill';
import { createSkill, getUserSkills } from '@/services/skillsService';
import { SkillEditor } from '@/components/Skills/SkillEditor';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { CapabilityRow } from './CapabilityRow';

export interface SkillsCapabilityPanelProps {
    chatEndpoint: string;
    selectedSkills: SkillReference[];
    onSkillsChange: (skills: SkillReference[]) => void;
    skillSelectionMode: SkillSelectionMode;
    onModeChange: (mode: SkillSelectionMode) => void;
}

const MODE_ITEMS = [
    { id: 'auto', label: 'Auto-select' },
    { id: 'manual', label: 'Manual only' },
    { id: 'hybrid', label: 'Required + Auto' },
];

const MODE_HINT: Record<SkillSelectionMode, string> = {
    auto: 'Skills are chosen automatically from the conversation context.',
    manual: 'Only the skills selected below are used.',
    hybrid: 'Skills marked “always include” are always used, plus auto-selection from the rest.',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 8,
};

const centeredState: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '20px 24px',
    fontSize: 12.5,
    color: 'var(--text-muted)',
    textAlign: 'center',
};

const linkButton: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: 12.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: 0,
};

export const SkillsCapabilityPanel: React.FC<SkillsCapabilityPanelProps> = ({
    chatEndpoint,
    selectedSkills,
    onSkillsChange,
    skillSelectionMode,
    onModeChange,
}) => {
    const [skills, setSkills] = useState<Skill[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showEditor, setShowEditor] = useState(false);
    const [saving, setSaving] = useState(false);

    // Re-armed in the effect body, not by the initial value — StrictMode's
    // simulated unmount would otherwise latch it false and strand the skeleton
    // forever (guide §16).
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const loadSkills = useCallback(async () => {
        setError(null);
        try {
            const response = await getUserSkills(chatEndpoint, true);
            if (!alive.current) return;
            if (response.success && response.data) setSkills(response.data);
            else {
                setSkills([]);
                setError(response.message || 'Could not load skills.');
            }
        } catch {
            if (!alive.current) return;
            setSkills([]);
            setError('Could not load skills.');
        }
    }, [chatEndpoint]);

    useEffect(() => { loadSkills(); }, [loadSkills]);

    const byId = useMemo(
        () => new Map((skills ?? []).map((skill) => [skill.id, skill])),
        [skills],
    );

    /** Only enabled skills are attachable — a disabled skill would never fire. */
    const available = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return (skills ?? []).filter((skill) => {
            if (!skill.isEnabled) return false;
            if (!needle) return true;
            return (
                skill.name.toLowerCase().includes(needle) ||
                (skill.description ?? '').toLowerCase().includes(needle)
            );
        });
    }, [skills, search]);

    const selectedIds = useMemo(
        () => new Set(selectedSkills.map((ref) => ref.skillId)),
        [selectedSkills],
    );

    const toggleSkill = (skillId: string, checked: boolean) => {
        if (checked) {
            if (selectedIds.has(skillId)) return;
            onSkillsChange([...selectedSkills, { skillId, isRequired: true }]);
        } else {
            onSkillsChange(selectedSkills.filter((ref) => ref.skillId !== skillId));
        }
    };

    const toggleRequired = (skillId: string) => {
        onSkillsChange(
            selectedSkills.map((ref) =>
                ref.skillId === skillId ? { ...ref, isRequired: !ref.isRequired } : ref,
            ),
        );
    };

    const handleCreate = async (skillData: CreateSkillData | UpdateSkillData) => {
        setSaving(true);
        try {
            const response = await createSkill(chatEndpoint, skillData as CreateSkillData);
            if (!alive.current) return;
            if (response.success && response.data) {
                const created = response.data;
                setShowEditor(false);
                await loadSkills();
                if (!alive.current) return;
                // Newly created skills are attached straight away — the user made
                // it from inside this editor, so they clearly want it here.
                onSkillsChange([...selectedSkills, { skillId: created.id, isRequired: true }]);
            } else {
                toast.error(response.message || 'Failed to create skill.');
            }
        } catch {
            if (alive.current) toast.error('Failed to create skill.');
        } finally {
            if (alive.current) setSaving(false);
        }
    };

    // Guide §5.2 — one modal at a time, as an early return below every hook.
    if (showEditor) {
        return (
            <div className="text-neutral-900 dark:text-white">
                <SkillEditor
                    onSave={handleCreate}
                    onCancel={() => setShowEditor(false)}
                    isLoading={saving}
                />
            </div>
        );
    }

    const loading = skills === null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Selection mode ── */}
            <div>
                <span style={labelStyle} id="skill-mode-label">Selection mode</span>
                <SegmentedControl
                    items={MODE_ITEMS}
                    value={skillSelectionMode}
                    onChange={(id) => onModeChange(id as SkillSelectionMode)}
                    size="xs"
                    aria-label="Skill selection mode"
                />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {MODE_HINT[skillSelectionMode]}
                </p>
            </div>

            {/* ── Attached skills ── */}
            {selectedSkills.length > 0 && (
                <div>
                    <span style={labelStyle}>
                        {`Attached (${selectedSkills.length})`}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {selectedSkills.map((ref) => {
                            const skill = byId.get(ref.skillId);
                            return (
                                <div
                                    key={ref.skillId}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '7px 10px',
                                        borderRadius: 8,
                                        border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border-subtle))',
                                        background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-app))',
                                    }}
                                >
                                    <IconBrain
                                        size={16}
                                        aria-hidden="true"
                                        style={{ flexShrink: 0, color: 'var(--accent)' }}
                                    />
                                    <span
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: 13,
                                            color: 'var(--text-primary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {/* A skill can be attached but no longer readable — shared then
                                            revoked, or deleted. Its id is still the contract, so it stays
                                            listed and removable rather than silently vanishing. */}
                                        {skill?.name ?? (loading ? 'Loading…' : 'Unavailable skill')}
                                    </span>

                                    <label
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            flexShrink: 0,
                                            fontSize: 11.5,
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                        }}
                                        title="Always send this skill, regardless of the conversation"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={ref.isRequired}
                                            onChange={() => toggleRequired(ref.skillId)}
                                            style={{ width: 13, height: 13, accentColor: 'var(--accent)', cursor: 'pointer' }}
                                        />
                                        Always include
                                    </label>

                                    <button
                                        type="button"
                                        aria-label={`Remove ${skill?.name ?? 'skill'}`}
                                        title="Remove"
                                        onClick={() => toggleSkill(ref.skillId, false)}
                                        style={{
                                            flexShrink: 0,
                                            display: 'grid',
                                            placeItems: 'center',
                                            width: 22,
                                            height: 22,
                                            borderRadius: 5,
                                            border: 'none',
                                            background: 'transparent',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            transition: 'color 100ms ease',
                                        }}
                                        onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-error)'; }}
                                        onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-muted)'; }}
                                    >
                                        <IconX size={13} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Browse ── */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            onClear={() => setSearch('')}
                            placeholder="Search skills…"
                            aria-label="Search skills"
                            fullWidth
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowEditor(true)}
                        style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            height: 34,
                            padding: '0 11px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'var(--accent)',
                            color: 'var(--accent-fg)',
                            fontSize: 12.5,
                            fontWeight: 500,
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                        }}
                    >
                        <IconPlus size={14} aria-hidden="true" />
                        New skill
                    </button>
                </div>

                <div
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label="Available skills"
                    aria-busy={loading}
                    style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        background: 'var(--bg-app)',
                        maxHeight: 260,
                        overflowY: 'auto',
                    }}
                >
                    {loading ? (
                        <div style={centeredState}>
                            <IconLoader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
                            <span>Loading skills…</span>
                        </div>
                    ) : error ? (
                        <div style={centeredState}>
                            <span>{error}</span>
                            <button type="button" onClick={loadSkills} style={linkButton}>Retry</button>
                        </div>
                    ) : available.length === 0 ? (
                        <div style={centeredState}>
                            <span>
                                {search.trim()
                                    ? `No skills match “${search.trim()}”.`
                                    : 'You have no skills yet. Create one to give this assistant specialized instructions.'}
                            </span>
                            {!search.trim() && (
                                <button type="button" onClick={() => setShowEditor(true)} style={linkButton}>
                                    Create your first skill
                                </button>
                            )}
                        </div>
                    ) : (
                        available.map((skill, index) => (
                            <CapabilityRow
                                key={skill.id}
                                isFirst={index === 0}
                                icon={<IconBrain size={16} />}
                                label={skill.name}
                                description={skill.description}
                                tags={skill.tags}
                                badges={[
                                    ...(skill.isShared ? ['shared'] : []),
                                    ...(skill.priority ? [`P${skill.priority}`] : []),
                                ]}
                                selected={selectedIds.has(skill.id)}
                                onToggle={(checked) => toggleSkill(skill.id, checked)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default SkillsCapabilityPanel;

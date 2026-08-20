// REPLACED BY NewUIAssistantCreationModal.tsx — safe to delete after verification.
// NewUIAssistantCreationModal merges the access-type selection (previously this
// component) with the creation form into a single unified modal. This file is
// kept for one session as a fallback reference only.
/**
 * NewAssistantTypeSelector — "Step 0" wizard modal shown before AssistantModal
 * opens. Lets the user pick an access model (private / managed-by-me / team)
 * and optionally enter a URL slug, emails, or team details, then hands the
 * result back to the parent via onConfirm so AssistantModal can be opened
 * pre-configured.
 *
 * Location: components/NewUI/views/NewAssistantTypeSelector.tsx
 *
 * NOTE ON ASTPATHDATA PRE-POPULATION:
 *   AssistantModal.tsx (DO NOT MODIFY) always initialises astPathData state to
 *   null, then runs a lookupAssistant() effect on mount. For a brand-new slug
 *   that has never been registered, the lookup returns "not found" and resets
 *   astPathData to emptyAstPathData (isPublic: true, accessTo: empty arrays).
 *   Consequence: the astPathData we pass via onConfirm cannot survive into
 *   AssistantModal's state — only astPath is reliably pre-filled (AssistantModal
 *   reads it from definition.astPath). Users who chose "Specific people" will
 *   need to uncheck "Publish to all users" inside AssistantModal's
 *   AssistantPathEditor to finish the isPublic: false configuration. This is an
 *   inherent constraint of not modifying AssistantModal.tsx.
 */

import React, {
    useState,
    useRef,
    useEffect,
    useContext,
    useCallback,
} from 'react';
import { IconX, IconLock, IconShare, IconUsers, IconLoader2 } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Group, GroupAccessType } from '@/types/groups';
import { AstPathData } from '@/components/Promptbar/components/AssistantModalComponents/AssistantPathEditor';
import { createAstAdminGroup, updateGroupMembers } from '@/services/groupsService';
import { useSession } from 'next-auth/react';
import { getUserIdentifier } from '@/utils/app/data';

// ── Types ──────────────────────────────────────────────────────────────────────

type AccessModel = 'private' | 'managed' | 'collaborative' | null;
type ManagedSubOption = 'specific' | 'public' | null;
type TeamMode = 'existing' | 'new';

export interface Props {
    /** Dismiss without choosing */
    onClose: () => void;
    /**
     * Called when user confirms any card.
     *
     * Card 1 (Private): astPath=null, astPathData=null, groupId=undefined
     * Card 2 (Managed): astPath=slug, astPathData=isPublic+accessTo, groupId=undefined
     * Card 3 (Team):    astPath=null, astPathData=null, groupId=string
     *
     * NOTE: AssistantModal ignores astPathData at init (resets via lookup effect).
     * Only astPath is reliably pre-filled. See file header for the full explanation.
     */
    onConfirm: (astPath: string | null, astPathData: AstPathData | null, groupId?: string) => void;
}

// ── Focusable selector for focus-trap ──────────────────────────────────────────

const FOCUSABLE_SEL =
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="button"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])';

// ── AccessCard ─────────────────────────────────────────────────────────────────

interface AccessCardProps {
    selected: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    description: string;
    disabled?: boolean;
    disabledReason?: string;
    children?: React.ReactNode;
}

const AccessCard: React.FC<AccessCardProps> = ({
    selected,
    onClick,
    icon,
    title,
    description,
    disabled = false,
    disabledReason,
    children,
}) => {
    const [hovered, setHovered] = useState(false);

    const leftBorderColor = selected
        ? 'var(--accent)'
        : hovered && !disabled
            ? 'var(--bg-active)'
            : 'transparent';

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={selected}
            aria-disabled={disabled}
            onClick={disabled ? undefined : onClick}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onClick();
                }
            }}
            onMouseEnter={() => !disabled && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderLeft: `4px solid ${leftBorderColor}`,
                borderRadius: 12,
                padding: 16,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'border-color 140ms ease',
                userSelect: 'none',
                outline: 'none',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                    style={{
                        flexShrink: 0,
                        color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                        marginTop: 1,
                        transition: 'color 140ms ease',
                    }}
                >
                    {icon}
                </div>
                <div style={{ flex: 1 }}>
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            marginBottom: 2,
                        }}
                    >
                        {title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {disabled && disabledReason ? disabledReason : description}
                    </div>
                </div>
            </div>

            {/* Expandable children */}
            {children && (
                <div
                    style={{
                        overflow: 'hidden',
                        maxHeight: selected ? 600 : 0,
                        transition: 'max-height 220ms ease-in-out',
                    }}
                >
                    <div style={{ paddingTop: 12 }}>{children}</div>
                </div>
            )}
        </div>
    );
};

// ── SubOptionCard ──────────────────────────────────────────────────────────────

interface SubOptionCardProps {
    selected: boolean;
    onClick: () => void;
    title: string;
}

const SubOptionCard: React.FC<SubOptionCardProps> = ({ selected, onClick, title }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onClick();
                }
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: selected
                    ? 'var(--bg-active)'
                    : hovered
                        ? 'var(--bg-hover)'
                        : 'transparent',
                cursor: 'pointer',
                transition: 'background 100ms ease',
                userSelect: 'none',
                outline: 'none',
            }}
        >
            <span
                style={{
                    flexShrink: 0,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: selected ? 'var(--accent)' : 'transparent',
                    transition: 'all 120ms ease',
                    display: 'inline-block',
                }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{title}</span>
        </div>
    );
};

// ── SlugInput ──────────────────────────────────────────────────────────────────

interface SlugInputProps {
    value: string;
    onChange: (raw: string) => void;
    error: string;
}

const SlugInput: React.FC<SlugInputProps> = ({ value, onChange, error }) => (
    <div style={{ padding: '4px 8px 0 24px' }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            URL path (e.g. my-assistant)
        </label>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="my-assistant"
            maxLength={40}
            style={{
                width: '100%',
                borderRadius: 8,
                border: `1px solid ${error ? '#e05252' : 'var(--border-subtle)'}`,
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                padding: '7px 10px',
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 120ms ease',
            }}
        />
        {error ? (
            <p style={{ fontSize: 11, color: '#e05252', margin: '3px 0 0' }}>{error}</p>
        ) : value ? (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                Will be available at /assistants/{value}
            </p>
        ) : null}
    </div>
);

// ── Shared field styles helper ─────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'Inter, ui-sans-serif, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
};

// ── Main component ─────────────────────────────────────────────────────────────

export const NewAssistantTypeSelector: React.FC<Props> = ({ onClose, onConfirm }) => {
    const {
        state: { featureFlags, groups, amplifyUsers },
    } = useContext(HomeContext);

    const { data: session } = useSession();
    const userIdentifier = getUserIdentifier(session?.user);

    const panelRef = useRef<HTMLDivElement>(null);

    // ── Access model state ──────────────────────────────────────────────────────
    const [selected, setSelected] = useState<AccessModel>(null);
    const [subOption, setSubOption] = useState<ManagedSubOption>(null);
    const [emails, setEmails] = useState('');
    const [slug, setSlug] = useState('');
    const [slugError, setSlugError] = useState('');

    // ── Card 3: team mode ───────────────────────────────────────────────────────
    const [teamMode, setTeamMode] = useState<TeamMode>('existing');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamMembers, setNewTeamMembers] = useState('');
    const [teamCreating, setTeamCreating] = useState(false);
    const [teamError, setTeamError] = useState('');

    // Focus panel on mount
    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    // ── Group access ────────────────────────────────────────────────────────────
    const adminGroups = groups.filter((g: Group) => {
        if (!userIdentifier) return false;
        const access = g.members?.[userIdentifier];
        return access === GroupAccessType.ADMIN || access === GroupAccessType.WRITE;
    });
    const hasGroupAccess =
        featureFlags.assistantAdminInterface && adminGroups.length > 0;

    // ── Slug validation ─────────────────────────────────────────────────────────
    const validateSlug = useCallback((value: string): string => {
        if (!value.trim()) return 'URL path is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Only lowercase letters, numbers, and hyphens allowed';
        if (value.length > 40) return 'Maximum 40 characters';
        return '';
    }, []);

    const handleSlugChange = (raw: string) => {
        const clean = raw
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .slice(0, 40);
        setSlug(clean);
        setSlugError(validateSlug(clean));
    };

    // ── Can Continue fire? ──────────────────────────────────────────────────────
    const isContinueEnabled = (): boolean => {
        if (selected === 'private') return true;
        if (selected === 'managed') {
            if (!featureFlags.assistantPathPublishing) return false;
            if (!subOption) return false;
            return !validateSlug(slug);
        }
        if (selected === 'collaborative') {
            if (teamCreating) return false;
            if (teamMode === 'existing') {
                if (adminGroups.length === 0) return false;
                if (adminGroups.length === 1) return true; // auto-selected
                return !!selectedGroupId;
            }
            if (teamMode === 'new') {
                return newTeamName.trim().length > 0;
            }
        }
        return false;
    };

    // ── Continue handler (async for team creation) ──────────────────────────────
    const handleContinue = async () => {
        if (selected === 'private') {
            onConfirm(null, null);
            return;
        }

        if (selected === 'managed' && subOption && slug && !validateSlug(slug)) {
            const astPathData: AstPathData =
                subOption === 'public'
                    ? { isPublic: true, accessTo: { amplifyGroups: [], users: [] } }
                    : {
                          isPublic: false,
                          accessTo: {
                              amplifyGroups: [],
                              users: emails
                                  .split(',')
                                  .map((e) => e.trim())
                                  .filter(Boolean),
                          },
                      };
            onConfirm(slug.toLowerCase(), astPathData);
            return;
        }

        if (selected === 'collaborative') {
            if (teamMode === 'existing') {
                const targetGroup =
                    adminGroups.length === 1
                        ? adminGroups[0]
                        : adminGroups.find((g) => g.id === selectedGroupId);
                if (targetGroup) {
                    onConfirm(null, null, targetGroup.id);
                }
                return;
            }

            if (teamMode === 'new' && newTeamName.trim()) {
                setTeamCreating(true);
                setTeamError('');
                try {
                    const result = await createAstAdminGroup({
                        name: newTeamName.trim(),
                        groupTypes: [],
                        amplifyGroups: [],
                        systemUsers: [],
                    });

                    if (!result || !result.id) {
                        setTeamError('Failed to create team. Please try again.');
                        setTeamCreating(false);
                        return;
                    }

                    // Add members if any emails were entered
                    if (newTeamMembers.trim()) {
                        const memberEmails = newTeamMembers
                            .split(',')
                            .map((e) => e.trim())
                            .filter(Boolean);

                        // Build members map: current user = admin, others = write
                        const members: Record<string, string> = {};
                        if (userIdentifier) {
                            members[userIdentifier] = GroupAccessType.ADMIN;
                        }
                        memberEmails.forEach((email) => {
                            // Try to find username from amplifyUsers (email→username reverse lookup)
                            const username =
                                Object.keys(amplifyUsers).find(
                                    (k) =>
                                        (amplifyUsers as Record<string, string>)[k] === email
                                ) || email;
                            if (username !== userIdentifier) {
                                members[username] = GroupAccessType.WRITE;
                            }
                        });

                        await updateGroupMembers({
                            groupId: result.id,
                            members,
                        });
                    }

                    onConfirm(null, null, result.id);
                } catch (err) {
                    setTeamError('An error occurred while creating the team. Please try again.');
                    setTeamCreating(false);
                }
                return;
            }
        }
    };

    // ── Focus trap ─────────────────────────────────────────────────────────────
    const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (e.key === 'Tab') {
            const all = Array.from(
                panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SEL) ?? []
            );
            if (all.length === 0) return;
            const first = all[0];
            const last = all[all.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    };

    const continueEnabled = isContinueEnabled();

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px',
            }}
            onClick={onClose}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-ast-type-title"
                tabIndex={-1}
                onKeyDown={handlePanelKeyDown}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: 520,
                    background: 'var(--bg-raised)',
                    borderRadius: 24,
                    padding: '28px 28px 24px',
                    position: 'relative',
                    outline: 'none',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
                    fontFamily: 'Inter, ui-sans-serif, sans-serif',
                }}
            >
                {/* Close × */}
                <button
                    aria-label="Close"
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                    }}
                    onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                    }
                >
                    <IconX size={15} />
                </button>

                {/* Header */}
                <h2
                    id="new-ast-type-title"
                    style={{
                        fontSize: 18,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        margin: '0 0 4px',
                    }}
                >
                    Create an Assistant
                </h2>
                <p
                    style={{
                        fontSize: 14,
                        color: 'var(--text-secondary)',
                        margin: '0 0 20px',
                    }}
                >
                    Choose who can access this assistant
                </p>

                {/* ── Cards ─────────────────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Card 1 — Private */}
                    <AccessCard
                        selected={selected === 'private'}
                        onClick={() => {
                            setSelected('private');
                            setSubOption(null);
                        }}
                        icon={<IconLock size={18} />}
                        title="Just for me"
                        description="Only you can see and use this assistant"
                    />

                    {/* Card 2 — Managed (only when feature flag on) */}
                    {featureFlags.assistantPathPublishing ? (
                        <AccessCard
                            selected={selected === 'managed'}
                            onClick={() => setSelected('managed')}
                            icon={<IconShare size={18} />}
                            title="I manage it, others can use it"
                            description="You control it. Choose how others access it."
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {/* 2a — Specific people */}
                                <SubOptionCard
                                    selected={subOption === 'specific'}
                                    onClick={() => setSubOption('specific')}
                                    title="Specific people — I'll list emails"
                                />
                                <div
                                    style={{
                                        overflow: 'hidden',
                                        maxHeight: subOption === 'specific' ? 120 : 0,
                                        transition: 'max-height 180ms ease-in-out',
                                    }}
                                >
                                    <div style={{ padding: '4px 8px 8px 24px' }}>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: 11,
                                                color: 'var(--text-muted)',
                                                marginBottom: 4,
                                            }}
                                        >
                                            Email addresses (comma-separated)
                                        </label>
                                        <textarea
                                            value={emails}
                                            onChange={(e) => setEmails(e.target.value)}
                                            rows={2}
                                            placeholder="user@example.com, another@example.com"
                                            style={{
                                                ...fieldStyle,
                                                fontSize: 12,
                                                resize: 'none',
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* 2b — Anyone with the link */}
                                <SubOptionCard
                                    selected={subOption === 'public'}
                                    onClick={() => setSubOption('public')}
                                    title="Anyone with the link — accessible at a URL"
                                />

                                {/* Slug input */}
                                <div
                                    style={{
                                        overflow: 'hidden',
                                        maxHeight: subOption ? 100 : 0,
                                        transition: 'max-height 180ms ease-in-out',
                                    }}
                                >
                                    <SlugInput
                                        value={slug}
                                        onChange={handleSlugChange}
                                        error={slugError}
                                    />
                                </div>
                            </div>
                        </AccessCard>
                    ) : (
                        <>
                            <AccessCard
                                selected={false}
                                onClick={() => {}}
                                icon={<IconShare size={18} />}
                                title="I manage it, others can use it"
                                description="You control it. Choose how others access it."
                                disabled={true}
                                disabledReason="Requires path publishing to be enabled by admin"
                            />
                            <p
                                style={{
                                    fontSize: 12,
                                    color: 'var(--text-muted)',
                                    margin: '0 0 4px',
                                    paddingLeft: 4,
                                }}
                            >
                                To share assistants with others, contact your admin to enable
                                assistant path publishing.
                            </p>
                        </>
                    )}

                    {/* Card 3 — Collaborative */}
                    {hasGroupAccess && (
                        <AccessCard
                            selected={selected === 'collaborative'}
                            onClick={() => setSelected('collaborative')}
                            icon={<IconUsers size={18} />}
                            title="Team assistant"
                            description="Multiple people can edit and manage this assistant"
                        >
                            {/* ── Team mode toggle ── */}
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 4,
                                    marginBottom: 10,
                                    background: 'var(--bg-raised)',
                                    borderRadius: 8,
                                    padding: 3,
                                    width: 'fit-content',
                                }}
                            >
                                {(['existing', 'new'] as TeamMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => {
                                            setTeamMode(mode);
                                            setTeamError('');
                                        }}
                                        style={{
                                            padding: '5px 12px',
                                            borderRadius: 6,
                                            border: 'none',
                                            fontSize: 12,
                                            fontWeight: teamMode === mode ? 500 : 400,
                                            cursor: 'pointer',
                                            background:
                                                teamMode === mode
                                                    ? 'var(--bg-active)'
                                                    : 'transparent',
                                            color:
                                                teamMode === mode
                                                    ? 'var(--text-primary)'
                                                    : 'var(--text-muted)',
                                            fontFamily: 'inherit',
                                            transition: 'all 120ms ease',
                                        }}
                                    >
                                        {mode === 'existing' ? 'Use existing team' : 'Create new team'}
                                    </button>
                                ))}
                            </div>

                            {/* Existing team selection */}
                            {teamMode === 'existing' && (
                                <>
                                    {adminGroups.length === 1 && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '8px 10px',
                                                borderRadius: 8,
                                                background: 'var(--bg-active)',
                                                fontSize: 13,
                                                color: 'var(--text-primary)',
                                                marginBottom: 4,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    background: 'var(--accent)',
                                                    flexShrink: 0,
                                                    display: 'inline-block',
                                                }}
                                            />
                                            Creating in: <strong>{adminGroups[0].name}</strong>
                                        </div>
                                    )}
                                    {adminGroups.length > 1 && (
                                        <select
                                            value={selectedGroupId || ''}
                                            onChange={(e) =>
                                                setSelectedGroupId(e.target.value || null)
                                            }
                                            style={fieldStyle}
                                        >
                                            <option value="">Choose a team…</option>
                                            {adminGroups.map((g) => (
                                                <option key={g.id} value={g.id}>
                                                    {g.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </>
                            )}

                            {/* New team creation form */}
                            {teamMode === 'new' && (
                                <div
                                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                                >
                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: 11,
                                                color: 'var(--text-muted)',
                                                marginBottom: 4,
                                            }}
                                        >
                                            Team name <span style={{ color: '#e05252' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newTeamName}
                                            onChange={(e) => setNewTeamName(e.target.value)}
                                            placeholder="e.g. Research Team"
                                            maxLength={80}
                                            style={{
                                                ...fieldStyle,
                                                borderColor: teamError
                                                    ? '#e05252'
                                                    : 'var(--border-subtle)',
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: 11,
                                                color: 'var(--text-muted)',
                                                marginBottom: 4,
                                            }}
                                        >
                                            Add members (comma-separated emails, optional)
                                        </label>
                                        <textarea
                                            value={newTeamMembers}
                                            onChange={(e) => setNewTeamMembers(e.target.value)}
                                            rows={2}
                                            placeholder="alice@example.com, bob@example.com"
                                            style={{
                                                ...fieldStyle,
                                                resize: 'none',
                                            }}
                                        />
                                        <p
                                            style={{
                                                fontSize: 11,
                                                color: 'var(--text-muted)',
                                                margin: '3px 0 0',
                                            }}
                                        >
                                            Members will be added with editor access. You will be
                                            the admin.
                                        </p>
                                    </div>
                                    {teamError && (
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: '#e05252',
                                                margin: 0,
                                            }}
                                        >
                                            {teamError}
                                        </p>
                                    )}
                                </div>
                            )}
                        </AccessCard>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        marginTop: 24,
                    }}
                >
                    <button
                        onClick={onClose}
                        disabled={teamCreating}
                        style={{
                            height: 36,
                            padding: '0 16px',
                            borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: 13,
                            cursor: teamCreating ? 'default' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: teamCreating ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                            if (!teamCreating) e.currentTarget.style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.background = 'transparent')
                        }
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleContinue}
                        disabled={!continueEnabled}
                        aria-disabled={!continueEnabled}
                        style={{
                            height: 36,
                            padding: '0 20px',
                            borderRadius: 8,
                            border: 'none',
                            background: continueEnabled
                                ? 'var(--accent)'
                                : 'var(--bg-active)',
                            color: continueEnabled ? '#fff' : 'var(--text-muted)',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: continueEnabled ? 'pointer' : 'default',
                            fontFamily: 'inherit',
                            transition: 'background 120ms ease, color 120ms ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        {teamCreating && (
                            <IconLoader2
                                size={14}
                                className="animate-spin"
                                style={{ flexShrink: 0 }}
                            />
                        )}
                        {teamCreating ? 'Creating team…' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewAssistantTypeSelector;

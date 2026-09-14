/**
 * NewGroupManagementModal — New-UI group management modal.
 *
 * Opened from the gear icon on a group header in GroupAssistantsTab.
 * Replicates the "Group Management" sub-tab of the old AssistantAdminUI using
 * new-UI design tokens, NewUILoadingStatus (not LoadingDialog), ConfirmDialog,
 * EmailChipsInput (§23), and CreationModalShell.
 *
 * Sections:
 *   1. Members      — add / remove / edit-access
 *   2. Group Types  — tag list with save
 *   3. Access       — Amplify Groups + System Users checkboxes
 *   4. Danger Zone  — Delete Group
 */

import React, {
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    IconUsers,
    IconTag,
    IconShieldCheck,
    IconTrash,
    IconPlus,
    IconX,
    IconCheck,
    IconSearch,
    IconLoader2,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { useSession } from 'next-auth/react';
import { getUserIdentifier } from '@/utils/app/data';
import { Group, GroupAccessType, Members } from '@/types/groups';
import {
    updateGroupMembers,
    updateGroupMembersPermissions,
    updateGroupTypes,
    updateGroupAmplifyGroups,
    updateGroupSystemUsers,
    deleteAstAdminGroup,
} from '@/services/groupsService';
import { getUserAmplifyGroups } from '@/services/adminService';
import { fetchAllSystemIds } from '@/services/apiKeysService';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { NewUILoadingStatus } from '@/components/NewUI/shared/NewUILoadingStatus';
import { CapabilityCard } from '@/components/NewUI/views/assistant/CapabilityCard';
import { EmailChipsInput } from '@/components/NewUI/shared/EmailChipsInput';
import { resolveUsernameForEmail } from '@/components/NewUI/shared/emailSuggestions';
import toast from 'react-hot-toast';

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
    group: Group;
    onClose: () => void;
}

// ── Access badge ───────────────────────────────────────────────────────────────

const ACCESS_LABELS: Record<GroupAccessType, string> = {
    [GroupAccessType.ADMIN]: 'Admin',
    [GroupAccessType.WRITE]: 'Write',
    [GroupAccessType.READ]: 'Read',
};

const AccessBadge: React.FC<{ level: GroupAccessType }> = ({ level }) => {
    const color =
        level === GroupAccessType.ADMIN
            ? { bg: 'rgba(239,68,68,0.1)', text: '#ef4444' }
            : level === GroupAccessType.WRITE
            ? { bg: 'rgba(59,130,246,0.1)', text: 'var(--accent)' }
            : { bg: 'var(--bg-raised)', text: 'var(--text-muted)' };
    return (
        <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: color.bg, color: color.text }}
        >
            {ACCESS_LABELS[level]}
        </span>
    );
};

const AccessSelect: React.FC<{
    value: GroupAccessType;
    onChange: (v: GroupAccessType) => void;
}> = ({ value, onChange }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value as GroupAccessType)}
        className="text-[12px] h-[28px] px-2 rounded-[6px] border"
        style={{
            backgroundColor: 'var(--bg-app)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
        }}
    >
        <option value={GroupAccessType.READ}>Read</option>
        <option value={GroupAccessType.WRITE}>Write</option>
        <option value={GroupAccessType.ADMIN}>Admin</option>
    </select>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const NewGroupManagementModal: React.FC<Props> = ({ group, onClose }) => {
    const {
        state: { amplifyUsers, groups },
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const { data: session } = useSession();
    const currentUser = getUserIdentifier(session?.user) ?? '';

    // ── Server data ──────────────────────────────────────────────────────────
    const [amplifyGroups, setAmplifyGroups] = useState<string[]>([]);
    const [systemUsers, setSystemUsers] = useState<string[]>([]);
    const [loadingInit, setLoadingInit] = useState(true);

    useEffect(() => {
        let alive = true;
        setLoadingInit(true);
        Promise.all([getUserAmplifyGroups(), fetchAllSystemIds()]).then(
            ([agResult, suResult]) => {
                if (!alive) return;
                const ags: string[] = agResult?.success
                    ? agResult.data ?? []
                    : agResult ?? [];
                // Also include any groups already on the saved group (in case the
                // admin added system users outside the current account's pool).
                const extraSu: string[] = group.systemUsers ?? [];
                const merged = Array.from(new Set([...(suResult ?? []), ...extraSu]));
                setAmplifyGroups(ags);
                setSystemUsers(merged);
                setLoadingInit(false);
            }
        );
        return () => { alive = false; };
    }, [group.id]);

    // Keep a live copy of the group so edits refresh from context updates
    const liveGroup: Group =
        groups.find((g: Group) => g.id === group.id) ?? group;

    // ── Loading overlay ──────────────────────────────────────────────────────
    const [loadingMsg, setLoadingMsg] = useState('');

    // ── SECTION 1: Members ───────────────────────────────────────────────────

    const [showAddPanel, setShowAddPanel] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');

    // Add panel state
    const [addEmails, setAddEmails] = useState<string[]>([]);
    const [addAccessMap, setAddAccessMap] = useState<Record<string, GroupAccessType>>({});

    // Per-row: which user is pending removal confirmation
    const [confirmRemoveUser, setConfirmRemoveUser] = useState<string | null>(null);

    // Filtered member rows
    const memberRows = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        return Object.entries(liveGroup.members ?? {})
            .filter(([username]) => {
                if (!q) return true;
                const email = amplifyUsers[username] ?? username;
                return (
                    username.toLowerCase().includes(q) ||
                    email.toLowerCase().includes(q)
                );
            })
            .sort(([a], [b]) => a.localeCompare(b));
    }, [liveGroup.members, memberSearch, amplifyUsers]);

    // All current member emails (for EmailChipsInput's exclude list)
    const currentMemberEmails = useMemo(
        () =>
            Object.keys(liveGroup.members ?? {}).map(
                (u) => amplifyUsers[u] ?? u
            ),
        [liveGroup.members, amplifyUsers]
    );

    const handleAddMembers = async () => {
        if (addEmails.length === 0) { setShowAddPanel(false); return; }
        const members: Members = {};
        for (const email of addEmails) {
            const username = resolveUsernameForEmail(email, amplifyUsers);
            members[username] = addAccessMap[email] ?? GroupAccessType.READ;
        }
        setLoadingMsg('Adding members…');
        const ok = await updateGroupMembers({
            group_id: liveGroup.id,
            update_type: 'ADD',
            members,
        });
        setLoadingMsg('');
        if (ok) {
            const updated = groups.map((g: Group) =>
                g.id === liveGroup.id
                    ? { ...g, members: { ...g.members, ...members } }
                    : g
            );
            homeDispatch({ field: 'groups', value: updated });
            toast.success('Members added');
        } else {
            toast.error('Failed to add members');
        }
        setShowAddPanel(false);
        setAddEmails([]);
        setAddAccessMap({});
    };

    /** Inline: change one member's access level and save immediately. */
    const handleChangeAccess = async (username: string, newLevel: GroupAccessType) => {
        setLoadingMsg('Updating access…');
        const ok = await updateGroupMembersPermissions({
            group_id: liveGroup.id,
            affected_members: { [username]: newLevel },
        });
        setLoadingMsg('');
        if (ok) {
            const updated = groups.map((g: Group) =>
                g.id === liveGroup.id
                    ? { ...g, members: { ...g.members, [username]: newLevel } }
                    : g
            );
            homeDispatch({ field: 'groups', value: updated });
        } else {
            toast.error('Failed to update access level');
        }
    };

    /** Inline: remove one member and save immediately. */
    const handleRemoveMember = async (username: string) => {
        setConfirmRemoveUser(null);
        setLoadingMsg('Removing member…');
        const ok = await updateGroupMembers({
            group_id: liveGroup.id,
            update_type: 'REMOVE',
            members: [username],
        });
        setLoadingMsg('');
        if (ok) {
            const updated = groups.map((g: Group) => {
                if (g.id !== liveGroup.id) return g;
                const next = { ...g.members };
                delete next[username];
                return { ...g, members: next };
            });
            homeDispatch({ field: 'groups', value: updated });
            toast.success('Member removed');
        } else {
            toast.error('Failed to remove member');
        }
    };

    // ── SECTION 2: Group Types ────────────────────────────────────────────────

    const [localTypes, setLocalTypes] = useState<string[]>(liveGroup.groupTypes ?? []);
    const [newTypeInput, setNewTypeInput] = useState('');
    const typesDirty = useMemo(
        () => JSON.stringify(localTypes) !== JSON.stringify(liveGroup.groupTypes ?? []),
        [localTypes, liveGroup.groupTypes]
    );

    const handleSaveTypes = async () => {
        setLoadingMsg('Saving group types…');
        const ok = await updateGroupTypes({ group_id: liveGroup.id, types: localTypes });
        setLoadingMsg('');
        if (ok) {
            const updated = groups.map((g: Group) =>
                g.id === liveGroup.id ? { ...g, groupTypes: localTypes } : g
            );
            homeDispatch({ field: 'groups', value: updated });
            toast.success('Group types saved');
        } else {
            toast.error('Failed to save group types');
        }
    };

    const addType = () => {
        const t = newTypeInput.trim();
        if (!t || localTypes.includes(t)) return;
        setLocalTypes((prev) => [...prev, t]);
        setNewTypeInput('');
    };

    // ── SECTION 3: Access Groups ──────────────────────────────────────────────

    const [localAmpGroups, setLocalAmpGroups] = useState<string[]>(
        liveGroup.amplifyGroups ?? []
    );
    const [localSysUsers, setLocalSysUsers] = useState<string[]>(
        liveGroup.systemUsers ?? []
    );
    const ampDirty = useMemo(
        () => JSON.stringify(localAmpGroups.sort()) !== JSON.stringify([...(liveGroup.amplifyGroups ?? [])].sort()),
        [localAmpGroups, liveGroup.amplifyGroups]
    );
    const sysDirty = useMemo(
        () => JSON.stringify(localSysUsers.sort()) !== JSON.stringify([...(liveGroup.systemUsers ?? [])].sort()),
        [localSysUsers, liveGroup.systemUsers]
    );

    const toggleAmpGroup = (g: string) =>
        setLocalAmpGroups((prev) =>
            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
        );
    const toggleSysUser = (u: string) =>
        setLocalSysUsers((prev) =>
            prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
        );

    const handleSaveAmpGroups = async () => {
        setLoadingMsg('Saving Amplify Groups…');
        const result = await updateGroupAmplifyGroups({
            group_id: liveGroup.id,
            amplify_groups: localAmpGroups,
        });
        setLoadingMsg('');
        if (result?.success) {
            const updated = groups.map((g: Group) =>
                g.id === liveGroup.id ? { ...g, amplifyGroups: localAmpGroups } : g
            );
            homeDispatch({ field: 'groups', value: updated });
            toast.success('Amplify Groups saved');
        } else {
            toast.error('Failed to save Amplify Groups');
        }
    };

    const handleSaveSysUsers = async () => {
        setLoadingMsg('Saving System Users…');
        const result = await updateGroupSystemUsers({
            group_id: liveGroup.id,
            system_users: localSysUsers,
        });
        setLoadingMsg('');
        if (result?.success) {
            const updated = groups.map((g: Group) =>
                g.id === liveGroup.id ? { ...g, systemUsers: localSysUsers } : g
            );
            homeDispatch({ field: 'groups', value: updated });
            toast.success('System Users saved');
        } else {
            toast.error('Failed to save System Users');
        }
    };

    // ── SECTION 4: Delete Group ───────────────────────────────────────────────

    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleDeleteGroup = async () => {
        setConfirmDelete(false);
        setLoadingMsg('Deleting group…');
        const ok = await deleteAstAdminGroup(liveGroup.id);
        setLoadingMsg('');
        if (ok) {
            const updated = groups.filter((g: Group) => g.id !== liveGroup.id);
            homeDispatch({ field: 'groups', value: updated });
            toast.success(`${liveGroup.name} deleted`);
            onClose();
        } else {
            toast.error('Failed to delete group');
        }
    };

    // ── Check admin access ────────────────────────────────────────────────────

    const memberAccess = liveGroup.members?.[currentUser];
    const isAdmin =
        memberAccess === GroupAccessType.ADMIN ||
        memberAccess === GroupAccessType.WRITE;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <CreationModalShell
                title={`${liveGroup.name} — Group Management`}
                onClose={onClose}
            >
                {loadingInit ? (
                    <div className="flex items-center justify-center py-16">
                        <IconLoader2
                            size={24}
                            className="motion-safe:animate-spin motion-reduce:animate-none"
                            style={{ color: 'var(--text-muted)' }}
                        />
                    </div>
                ) : (
                    <div className="px-6 py-5 flex flex-col gap-5">

                        {/* ── SECTION 1: Members ── */}
                        <CapabilityCard
                            icon={<IconUsers size={15} />}
                            title="Members"
                            badge={String(Object.keys(liveGroup.members ?? {}).length)}
                            defaultOpen
                        >
                            <div className="flex flex-col gap-3 pt-3 pb-1">

                                {/* Add Members button */}
                                {isAdmin && !showAddPanel && (
                                    <button
                                        onClick={() => setShowAddPanel(true)}
                                        className="self-start flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[12px] font-medium text-white"
                                        style={{ backgroundColor: 'var(--accent)' }}
                                    >
                                        <IconPlus size={13} />
                                        Add Members
                                    </button>
                                )}

                                {/* Add panel */}
                                {showAddPanel && (
                                    <div className="flex flex-col gap-3 p-3 rounded-[8px] border" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                            Add people by email. Set their access level below.
                                        </p>
                                        <EmailChipsInput
                                            selected={addEmails}
                                            onChange={setAddEmails}
                                            excludeEmails={currentMemberEmails}
                                            placeholder="Search or type an email…"
                                        />
                                        {addEmails.length > 0 && (
                                            <div className="flex flex-col gap-1.5">
                                                {addEmails.map((email) => (
                                                    <div key={email} className="flex items-center justify-between gap-3 text-[12px]" style={{ color: 'var(--text-primary)' }}>
                                                        <span className="truncate">{email}</span>
                                                        <AccessSelect
                                                            value={addAccessMap[email] ?? GroupAccessType.READ}
                                                            onChange={(v) =>
                                                                setAddAccessMap((prev) => ({ ...prev, [email]: v }))
                                                            }
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setShowAddPanel(false); setAddEmails([]); setAddAccessMap({}); }}
                                                className="h-[30px] px-3 rounded-[6px] text-[12px] border"
                                                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleAddMembers}
                                                disabled={addEmails.length === 0}
                                                className="flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[12px] font-medium text-white disabled:opacity-50"
                                                style={{ backgroundColor: 'var(--accent)' }}
                                            >
                                                <IconCheck size={13} />
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Search */}
                                <div className="relative">
                                    <IconSearch
                                        size={13}
                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--text-muted)' }}
                                    />
                                    <input
                                        type="text"
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        placeholder="Search members…"
                                        className="h-[32px] w-full pl-8 pr-3 rounded-[6px] border text-[12px] focus:outline-none"
                                        style={{
                                            backgroundColor: 'var(--bg-app)',
                                            borderColor: 'var(--border-subtle)',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>

                                {/* Member rows — inline access dropdown + remove button */}
                                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                                    {memberRows.length === 0 ? (
                                        <p className="text-[12px] text-center py-4" style={{ color: 'var(--text-muted)' }}>
                                            No members found
                                        </p>
                                    ) : (
                                        memberRows.map(([username, access]) => {
                                            const displayEmail = amplifyUsers[username] ?? username;
                                            const isSelf = username === currentUser;
                                            return (
                                                <div
                                                    key={username}
                                                    className="group/row flex items-center gap-2 px-3 py-2 rounded-[6px]"
                                                    style={{ backgroundColor: 'var(--bg-hover)' }}
                                                >
                                                    <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
                                                        {displayEmail}
                                                    </span>

                                                    {/* Inline access dropdown (admin only) */}
                                                    {isAdmin ? (
                                                        <AccessSelect
                                                            value={access}
                                                            onChange={(v) => handleChangeAccess(username, v)}
                                                        />
                                                    ) : (
                                                        <AccessBadge level={access} />
                                                    )}

                                                    {/* Inline remove button (admin only, not self) */}
                                                    {isAdmin && !isSelf && (
                                                        confirmRemoveUser === username ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Remove?</span>
                                                                <button
                                                                    onClick={() => handleRemoveMember(username)}
                                                                    className="h-[24px] px-2 rounded-[4px] text-[11px] font-medium"
                                                                    style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                                                                    aria-label="Confirm remove"
                                                                >
                                                                    Yes
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfirmRemoveUser(null)}
                                                                    className="h-[24px] px-2 rounded-[4px] text-[11px]"
                                                                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}
                                                                    aria-label="Cancel remove"
                                                                >
                                                                    No
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setConfirmRemoveUser(username)}
                                                                className="opacity-0 group-hover/row:opacity-100 flex items-center justify-center h-[26px] w-[26px] rounded-[6px] transition-all"
                                                                style={{ color: 'var(--text-muted)' }}
                                                                onMouseEnter={(e) => {
                                                                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.1)';
                                                                    (e.currentTarget as HTMLElement).style.color = '#ef4444';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                                                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                                                                }}
                                                                aria-label={`Remove ${displayEmail}`}
                                                                title="Remove member"
                                                            >
                                                                <IconTrash size={13} />
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </CapabilityCard>

                        {/* ── SECTION 2: Group Types ── */}
                        <CapabilityCard
                            icon={<IconTag size={15} />}
                            title="Group Types"
                            badge={localTypes.length > 0 ? String(localTypes.length) : undefined}
                            defaultOpen={localTypes.length > 0}
                        >
                            <div className="flex flex-col gap-3 pt-3 pb-1">
                                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                    Group types are categories used to segment users within this group.
                                </p>

                                {/* Tag chips */}
                                <div className="flex flex-wrap gap-2">
                                    {localTypes.map((t) => (
                                        <span
                                            key={t}
                                            className="flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-[12px]"
                                            style={{
                                                backgroundColor: 'var(--bg-raised)',
                                                border: '1px solid var(--border-subtle)',
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            {t}
                                            {isAdmin && (
                                                <button
                                                    onClick={() =>
                                                        setLocalTypes((prev) => prev.filter((x) => x !== t))
                                                    }
                                                    className="rounded-full p-0.5 transition-colors"
                                                    style={{ color: 'var(--text-muted)' }}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.color = '#ef4444')
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.color = 'var(--text-muted)')
                                                    }
                                                    aria-label={`Remove type ${t}`}
                                                >
                                                    <IconX size={11} />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>

                                {/* Add new type */}
                                {isAdmin && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newTypeInput}
                                            onChange={(e) => setNewTypeInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addType();
                                                }
                                            }}
                                            placeholder="New type name…"
                                            className="flex-1 h-[32px] px-3 rounded-[6px] border text-[12px] focus:outline-none"
                                            style={{
                                                backgroundColor: 'var(--bg-app)',
                                                borderColor: 'var(--border-subtle)',
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                        <button
                                            onClick={addType}
                                            className="flex items-center gap-1 h-[32px] px-3 rounded-[6px] text-[12px] font-medium text-white"
                                            style={{ backgroundColor: 'var(--accent)' }}
                                        >
                                            <IconPlus size={13} />
                                            Add
                                        </button>
                                    </div>
                                )}

                                {typesDirty && (
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setLocalTypes(liveGroup.groupTypes ?? [])}
                                            className="h-[30px] px-3 rounded-[6px] text-[12px] border"
                                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveTypes}
                                            className="h-[30px] px-3 rounded-[6px] text-[12px] font-medium text-white"
                                            style={{ backgroundColor: 'var(--accent)' }}
                                        >
                                            Save Types
                                        </button>
                                    </div>
                                )}
                            </div>
                        </CapabilityCard>

                        {/* ── SECTION 3: Access Groups ── */}
                        <CapabilityCard
                            icon={<IconShieldCheck size={15} />}
                            title="Access"
                            badge={
                                (localAmpGroups.length + localSysUsers.length) > 0
                                    ? String(localAmpGroups.length + localSysUsers.length)
                                    : undefined
                            }
                            defaultOpen={
                                (liveGroup.amplifyGroups?.length ?? 0) > 0 ||
                                (liveGroup.systemUsers?.length ?? 0) > 0
                            }
                        >
                            <div className="flex flex-col gap-5 pt-3 pb-1">

                                {/* Amplify Groups */}
                                {amplifyGroups.length > 0 && (
                                    <div>
                                        <p
                                            className="text-[12px] font-semibold mb-2"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Amplify Groups
                                        </p>
                                        <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                                            All members of selected Amplify Groups get read access to this group.
                                        </p>
                                        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                                            {amplifyGroups.map((ag) => (
                                                <label
                                                    key={ag}
                                                    className="flex items-center gap-2.5 px-3 py-2 rounded-[6px] cursor-pointer"
                                                    style={{ backgroundColor: 'var(--bg-hover)' }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={localAmpGroups.includes(ag)}
                                                        onChange={() => toggleAmpGroup(ag)}
                                                        className="accent-[--accent]"
                                                    />
                                                    <span className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                                                        {ag}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {ampDirty && (
                                            <div className="flex justify-end gap-2 mt-2">
                                                <button
                                                    onClick={() => setLocalAmpGroups(liveGroup.amplifyGroups ?? [])}
                                                    className="h-[30px] px-3 rounded-[6px] text-[12px] border"
                                                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveAmpGroups}
                                                    className="h-[30px] px-3 rounded-[6px] text-[12px] font-medium text-white"
                                                    style={{ backgroundColor: 'var(--accent)' }}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* System Users */}
                                {systemUsers.length > 0 && (
                                    <div>
                                        <p
                                            className="text-[12px] font-semibold mb-2"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            System Users
                                        </p>
                                        <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                                            Selected API system users get read access to this group.
                                        </p>
                                        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                                            {systemUsers.map((su) => (
                                                <label
                                                    key={su}
                                                    className="flex items-center gap-2.5 px-3 py-2 rounded-[6px] cursor-pointer"
                                                    style={{ backgroundColor: 'var(--bg-hover)' }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={localSysUsers.includes(su)}
                                                        onChange={() => toggleSysUser(su)}
                                                        className="accent-[--accent]"
                                                    />
                                                    <span className="text-[12px] font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                                                        {su}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {sysDirty && (
                                            <div className="flex justify-end gap-2 mt-2">
                                                <button
                                                    onClick={() => setLocalSysUsers(liveGroup.systemUsers ?? [])}
                                                    className="h-[30px] px-3 rounded-[6px] text-[12px] border"
                                                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveSysUsers}
                                                    className="h-[30px] px-3 rounded-[6px] text-[12px] font-medium text-white"
                                                    style={{ backgroundColor: 'var(--accent)' }}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {amplifyGroups.length === 0 && systemUsers.length === 0 && (
                                    <p className="text-[12px] py-2 text-center" style={{ color: 'var(--text-muted)' }}>
                                        No Amplify Groups or System Users configured for this account.
                                    </p>
                                )}
                            </div>
                        </CapabilityCard>

                        {/* ── SECTION 4: Danger Zone ── */}
                        {isAdmin && (
                            <div
                                className="rounded-[8px] p-4 border"
                                style={{ borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.04)' }}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[13px] font-semibold" style={{ color: '#ef4444' }}>
                                            Delete Group
                                        </p>
                                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            Permanently removes this group and all its assistants.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="flex items-center gap-1.5 h-[32px] px-3 rounded-[6px] text-[12px] font-medium transition-opacity hover:opacity-80"
                                        style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                                    >
                                        <IconTrash size={14} />
                                        Delete Group
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </CreationModalShell>

            {/* New-UI loading overlay */}
            <NewUILoadingStatus open={!!loadingMsg} message={loadingMsg} />

            {/* Delete group confirmation */}
            <ConfirmDialog
                isOpen={confirmDelete}
                title="Delete group?"
                message={
                    <>
                        Are you sure you want to permanently delete{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>{liveGroup.name}</strong>?
                        This cannot be undone.
                    </>
                }
                confirmLabel="Delete Group"
                variant="danger"
                onConfirm={handleDeleteGroup}
                onCancel={() => setConfirmDelete(false)}
            />
        </>
    );
};

export default NewGroupManagementModal;

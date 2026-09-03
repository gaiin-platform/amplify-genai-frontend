/**
 * NewUIAssistantCreationModal — unified ONE-STEP assistant creation form.
 *
 * Replaces the two-popup flow (NewAssistantTypeSelector → AssistantModal) with a
 * single CreationModalShell containing:
 *
 *   Section A — "Who can access this assistant?"
 *     Three option cards: Private / Managed URL / Team
 *
 *   Section B — Form fields
 *     Name · Description · Instructions / System Prompt
 *     Disclaimer to Append to Responses
 *     Data Sources (unified) — method buttons: From your computer / Website URL / OneDrive&SharePoint
 *     Skills · Tools / APIs
 *     Enforce Model
 *
 *   Advanced Settings ▾ (inline accordion at the bottom)
 *     Tags · Conversation Tags · Assistant Type · Allow Request Access
 *     Data Source Options · Message Options · Feature Options · API Options
 *     Email Events (featureFlag-gated, non-collaborative only)
 *
 * Implementation path: Option A (ported fields from AssistantModal).
 *
 * Location: components/NewUI/views/NewUIAssistantCreationModal.tsx
 */

import React, {
    useState,
    useRef,
    useContext,
    useEffect,
} from 'react';
import {
    IconLock,
    IconShare,
    IconUsers,
    IconChevronDown,
    IconChevronRight,
    IconAlertTriangle,
    IconFiles,
    IconUpload,
    IconWorldWww,
    IconCloudUpload,
    IconBrain,
    IconPlugConnected,
    IconTemplate,
} from '@tabler/icons-react';
import { AssistantWorkflowSelector } from '@/components/AssistantWorkflows/AssistantWorkflowSelector';
import { useSession } from 'next-auth/react';
import HomeContext from '@/pages/api/home/home.context';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { ModelPicker, EffortLevel } from '@/components/NewUI/shared/ModelPicker';
import { AssistantDefinition, AssistantProviderID } from '@/types/assistant';
import { Prompt } from '@/types/prompt';
import { MessageType } from '@/types/chat';
import { Group, GroupAccessType } from '@/types/groups';
import { AstPathData } from '@/components/Promptbar/components/AssistantModalComponents/AssistantPathEditor';
import { AttachedDocument } from '@/types/attacheddocument';
import { DriveFilesDataSources } from '@/types/integrations';
import { SkillReference, SkillSelectionMode } from '@/types/skill';
import { createAssistant, addAssistantPath } from '@/services/assistantService';
import { createAstAdminGroup, updateGroupMembers } from '@/services/groupsService';
import { getAgentTools } from '@/services/agentService';
import { getOpsForUser } from '@/services/opsService';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import { createAssistantPrompt, handleUpdateAssistantPrompt } from '@/utils/app/assistants';
import { getUserIdentifier } from '@/utils/app/data';
import { COMMON_DISALLOWED_FILE_EXTENSIONS } from '@/utils/app/const';
import { getSettings } from '@/utils/app/settings';
import { opLanguageOptionsMap } from '@/types/op';
import { Flag } from '@/components/ReusableComponents/FlagsMap';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { AssistantEmailEvents } from '@/components/Promptbar/components/AssistantModalComponents/AssistantEmailEvents';
import { addEventTemplate } from '@/services/emailEventService';
import { formatEmailEventTemplate, safeEmailEventTag } from '@/utils/app/assistantEmailEvents';
import { isWebsiteDs } from '@/components/DataSources/WebsiteURLInput';
import { AttachFile } from '@/components/Chat/AttachFile';
import {
    DataSourceCard,
    DataSourceCardGrid,
    DataSourceCardStatus,
} from '@/components/NewUI/shared/DataSourceCard';
import {
    DataSourceLibraryPicker,
    PickedLibraryFile,
} from '@/components/NewUI/shared/DataSourceLibraryPicker';
import { FileDropZone } from '@/components/NewUI/shared/FileDropZone';
import { processDragDropFiles } from '@/utils/fileHandler';
import { WebsiteURLInput } from '@/components/DataSources/WebsiteURLInput';
import AssistantDriveDataSources, { DriveRescanSchedule } from '@/components/Promptbar/components/AssistantModalComponents/AssistantDriveDataSources';
import { SkillsSection } from '@/components/Skills';
import ApiIntegrationsPanel from '@/components/AssistantApi/ApiIntegrationsPanel';

// ── Constants ──────────────────────────────────────────────────────────────────

/** id of AttachFile's hidden <input type="file"> — reused by the card Retry action. */
const ATTACH_FILE_INPUT_ID = '__attachFile_newui_assistant';

/**
 * How long a data source may sit without forward progress before its card flips
 * to the error state. AttachFile polls the content-ready endpoint for up to 120s
 * and reports nothing while it does, so this must sit comfortably above that.
 */
const UPLOAD_STALL_MS = 150_000;

// ── Types ──────────────────────────────────────────────────────────────────────

type AccessModel = 'private' | 'managed' | 'collaborative';
type ManagedSubOption = 'specific' | 'public';
type TeamMode = 'existing' | 'new';

export interface NewUIAssistantCreationModalProps {
    onClose: () => void;
    /**
     * Pre-selected group ID — passed from "New Assistant" in the Teams tab so
     * that card 3 is pre-selected and the group is already chosen.
     */
    initialGroupId?: string;
    /**
     * When provided, the modal opens in **edit mode**:
     *  - All form fields are pre-populated from the existing assistant's definition.
     *  - Title changes to "Edit Assistant", save button to "Save Changes".
     *  - Save calls createAssistant() with the existing assistantId so the backend
     *    treats the call as an update rather than a create.
     */
    editingAssistant?: Prompt;
}

// ── Shared field styles ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'Inter, ui-sans-serif, sans-serif',
    outline: 'none',
    transition: 'border-color 120ms ease',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
};

const fieldGroupStyle: React.CSSProperties = {
    marginBottom: 20,
};

const sectionHeadingStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: '0 0 12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
};

// ── Flag definitions (copied from AssistantModal.tsx — not exported from there) ─

/** Only includeDownloadLinks is surfaced to users; the rest keep default values. */
const DATA_SOURCE_FLAGS: Flag[] = [
    { label: 'Include Download Links for Referenced Documents', key: 'includeDownloadLinks', defaultValue: false,
      description: 'Assistant can include hyperlinks to relevant downloadable documents in its responses.' },
    { label: 'Include Attached Documents in RAG', key: 'ragAttachedDocuments', defaultValue: false,
      description: 'Allows Retrieval-Augmented Generation (RAG) to be performed on user-attached documents.' },
    { label: 'Include Attached Documents in Prompt', key: 'insertAttachedDocuments', defaultValue: true,
      description: 'The assistant will receive the full content of user-attached documents. (Recommended)' },
    { label: 'Include Conversation Documents in RAG', key: 'ragConversationDocuments', defaultValue: true,
      description: 'Applies RAG to documents from earlier in the conversation. (Recommended)' },
    { label: 'Include Conversation Documents in Prompt', key: 'insertConversationDocuments', defaultValue: false,
      description: 'The assistant receives the full content of documents from earlier in the conversation.' },
    { label: 'Include Attached Data Source Metadata in Prompt', key: 'insertAttachedDocumentsMetadata', defaultValue: false,
      description: 'Provides metadata of currently attached documents. (NOT Recommended)' },
    { label: 'Include Conversation Data Source Metadata in Prompt', key: 'insertConversationDocumentsMetadata', defaultValue: false,
      description: 'Provides metadata of documents from earlier in the conversation. (NOT Recommended)' },
    { label: 'Disable Data Source Insertion', key: 'disableDataSources', defaultValue: false,
      description: 'Ignores all user-provided documents. (NOT Recommended)' },
];
const VISIBLE_DATA_SOURCE_FLAGS = DATA_SOURCE_FLAGS.filter((f) => f.key === 'includeDownloadLinks');

const MESSAGE_OPTION_FLAGS: Flag[] = [
    { label: 'Include Message IDs in Messages',              key: 'includeMessageIds',           defaultValue: false },
    { label: 'Insert Line Numbers in User Messages',         key: 'includeUserLineNumbers',       defaultValue: false },
    { label: 'Insert Line Numbers in Assistant Messages',    key: 'includeAssistantLineNumbers',  defaultValue: false },
];

const FEATURE_OPTION_FLAGS: Flag[] = [
    { label: 'Allow Assistant to Create Artifacts', key: 'IncludeArtifactsInstr', defaultValue: true },
];

const API_OPTION_FLAGS: Flag[] = [
    { label: 'Allow Assistant to Use API Capabilities', key: 'IncludeApiInstr', defaultValue: false },
];

// ── Slug validation (copied exactly from NewAssistantTypeSelector.tsx) ─────────

function validateSlug(value: string): string {
    if (!value.trim()) return 'URL path is required';
    if (!/^[a-z0-9-]+$/.test(value)) return 'Only lowercase letters, numbers, and hyphens allowed';
    if (value.length > 40) return 'Maximum 40 characters';
    return '';
}

// ── AccessRadioCard ────────────────────────────────────────────────────────────
// Individual tile in the horizontal "who can access?" radio group.
// Implements role="radio" + aria-checked + roving tabindex (part of a radiogroup).
// Space / Enter selects; arrow keys are handled by the parent radiogroup container.

interface AccessRadioCardProps {
    id: string;
    value: AccessModel;
    selected: boolean;
    disabled?: boolean;
    icon: React.ReactNode;
    title: string;
    description: string;
    onSelect: () => void;
    /** id of the config panel this card controls — wires aria-controls */
    panelId: string;
}

const AccessRadioCard = React.forwardRef<HTMLDivElement, AccessRadioCardProps>(
    ({ id, value, selected, disabled = false, icon, title, description, onSelect, panelId }, ref) => {
        const [hovered, setHovered] = useState(false);

        return (
            <div
                ref={ref}
                id={id}
                role="radio"
                aria-checked={selected}
                aria-disabled={disabled}
                aria-controls={panelId}
                // Roving tabindex: selected card is the tab stop for the group
                tabIndex={selected ? 0 : -1}
                onClick={disabled ? undefined : onSelect}
                onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onSelect(); }
                    // Arrow keys are handled by the parent radiogroup container
                }}
                onMouseEnter={() => !disabled && setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocus={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                        '0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent)';
                }}
                onBlur={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
                style={{
                    // Equal-height column layout
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '14px 15px',
                    borderRadius: 10,
                    border: `2px solid ${
                        selected
                            ? 'var(--accent)'
                            : hovered && !disabled
                                ? 'color-mix(in srgb, var(--accent) 35%, var(--border-subtle))'
                                : 'var(--border-subtle)'
                    }`,
                    background: selected
                        ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-raised))'
                        : hovered && !disabled
                            ? 'var(--bg-hover)'
                            : 'var(--bg-raised)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.45 : 1,
                    transition: 'border-color 140ms ease, background 140ms ease',
                    userSelect: 'none',
                    outline: 'none',
                }}
            >
                {/* Icon */}
                <span style={{
                    lineHeight: 0,
                    color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'color 140ms ease',
                }}>
                    {icon}
                </span>

                {/* Text block — always same layout so cards stay equal height */}
                <div>
                    <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 4,
                        lineHeight: 1.3,
                    }}>
                        {title}
                    </div>
                    <div style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        lineHeight: 1.45,
                    }}>
                        {description}
                    </div>
                </div>
            </div>
        );
    }
);
AccessRadioCard.displayName = 'AccessRadioCard';

// ── Field style helpers ────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'Inter, ui-sans-serif, sans-serif',
    outline: 'none',
};

// ── CapabilityCard ─────────────────────────────────────────────────────────────
// Reusable collapsible card for Skills, Tools & APIs, and Workflow Templates.
// Provides consistent new-UI chrome (CSS token borders/bg/color) wrapping old-UI
// inner components that haven't been fully ported yet.

interface CapabilityCardProps {
    icon: React.ReactNode;
    title: string;
    /** Accent-tinted pill shown in the header when something is configured */
    badge?: string;
    children: React.ReactNode;
}

const CapabilityCard: React.FC<CapabilityCardProps> = ({ icon, title, badge, children }) => {
    const [open, setOpen] = useState(false);

    return (
        <div
            style={{
                border: `1px solid ${open || badge ? 'color-mix(in srgb, var(--accent) 30%, var(--border-subtle))' : 'var(--border-subtle)'}`,
                borderRadius: 10,
                background: 'var(--bg-raised)',
                overflow: 'hidden',
                transition: 'border-color 140ms ease',
            }}
        >
            {/* Clickable header row */}
            <button
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '12px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    outline: 'none',
                    transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
                {/* Icon */}
                <span style={{
                    flexShrink: 0,
                    lineHeight: 0,
                    color: open || badge ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'color 140ms ease',
                }}>
                    {icon}
                </span>

                {/* Title */}
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {title}
                </span>

                {/* Badge — only when something is configured */}
                {badge && (
                    <span style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--accent)',
                        background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-raised))',
                        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                        borderRadius: 20,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                    }}>
                        {badge}
                    </span>
                )}

                {/* Chevron rotates 90° when open */}
                <span style={{
                    flexShrink: 0,
                    lineHeight: 0,
                    color: 'var(--text-muted)',
                    transform: open ? 'rotate(90deg)' : 'none',
                    transition: 'transform 180ms ease',
                }}>
                    <IconChevronRight size={16} stroke={2} />
                </span>
            </button>

            {/* Content — max-height transition for smooth open/close */}
            <div style={{
                maxHeight: open ? 1400 : 0,
                overflow: 'hidden',
                transition: 'max-height 280ms ease-in-out',
            }}>
                <div style={{
                    padding: '14px',
                    borderTop: '1px solid var(--border-subtle)',
                }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

// ── SectionDivider ─────────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ label?: string }> = ({ label }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '24px 0 20px',
        }}
    >
        <div style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />
        {label && (
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </span>
        )}
        {label && <div style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />}
    </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const NewUIAssistantCreationModal: React.FC<NewUIAssistantCreationModalProps> = ({
    onClose,
    initialGroupId,
    editingAssistant,
}) => {
    const isEditMode = !!editingAssistant;
    const {
        state: {
            featureFlags,
            groups,
            amplifyUsers,
            prompts,
            availableModels,
            selectedAssistant,
            chatEndpoint,
            // Needed by the drag-and-drop path so dropped files log the same
            // stats event and honour the same RAG setting as picked files.
            statsService,
            ragOn,
        },
        dispatch: homeDispatch,
        setLoadingMessage,
    } = useContext(HomeContext);

    const { data: session } = useSession();
    const userIdentifier = getUserIdentifier(session?.user);

    // ── Section A: access type ─────────────────────────────────────────────
    // In edit mode, derive initial access type from the existing assistant.
    const deriveInitialAccessType = (): AccessModel => {
        if (editingAssistant) {
            if (editingAssistant.groupId) return 'collaborative';
            const def = editingAssistant.data?.assistant?.definition as AssistantDefinition | undefined;
            if (def?.astPath || (def?.data?.astPath as string | undefined)) return 'managed';
            return 'private';
        }
        return initialGroupId ? 'collaborative' : 'private';
    };
    const [accessType, setAccessType] = useState<AccessModel>(deriveInitialAccessType);

    // Managed URL sub-state
    const [subOption, setSubOption] = useState<ManagedSubOption>('public');
    const [emails, setEmails] = useState('');
    const [slug, setSlug] = useState('');
    const [slugError, setSlugError] = useState('');

    // Team sub-state
    const [teamMode, setTeamMode] = useState<TeamMode>('existing');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId ?? null);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamMembers, setNewTeamMembers] = useState('');

    // ── Section B: core form fields ───────────────────────────────────────
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [disclaimer, setDisclaimer] = useState('');
    const [enforceModel, setEnforceModel] = useState(false);
    const [enforcedModelId, setEnforcedModelId] = useState<string | undefined>(undefined);
    const [effortLevel, setEffortLevel] = useState<EffortLevel>('off');

    // ── Data sources state ────────────────────────────────────────────────
    const [dataSources, setDataSources] = useState<AttachedDocument[]>([]);
    const [documentState, setDocumentState] = useState<{ [key: string]: number }>({});
    /** Which data-source input panel is open: null = none. 'library' browses already-uploaded files. */
    const [activeDataSourceMethod, setActiveDataSourceMethod] = useState<'upload' | 'library' | 'website' | 'drive' | null>(null);
    const [websiteUrls, setWebsiteUrls] = useState<any[]>([]);
    /** id → failure reason. Drives the card's error state (icon + subtitle only). */
    const [dataSourceErrors, setDataSourceErrors] = useState<{ [key: string]: string }>({});
    /** id → cancel closure handed back by AttachFile for in-flight uploads. */
    const abortUploadRef = useRef<{ [key: string]: (() => void) | undefined }>({});
    const [integrationDataSources, setIntegrationDataSources] = useState<DriveFilesDataSources | undefined>(undefined);
    const [driveRescanSchedule, setDriveRescanSchedule] = useState<DriveRescanSchedule | null>(null);

    // ── Skills state ──────────────────────────────────────────────────────
    const [selectedSkills, setSelectedSkills] = useState<SkillReference[]>([]);
    const [skillSelectionMode, setSkillSelectionMode] = useState<SkillSelectionMode>('auto');

    // ── Tools / APIs state ────────────────────────────────────────────────
    const [selectedApis, setSelectedApis] = useState<any[]>([]);
    const [apiInfo, setApiInfo] = useState<any[]>([]);
    const [availableApis, setAvailableApis] = useState<any[] | null>(null);
    const [availableAgentTools, setAvailableAgentTools] = useState<Record<string, any> | null>(null);
    const [builtInAgentTools, setBuiltInAgentTools] = useState<string[]>([]);

    // ── Workflow template state ───────────────────────────────────────────
    /** ID of the selected base workflow template. Empty string → undefined on save. */
    const [baseWorkflowTemplateId, setBaseWorkflowTemplateId] = useState<string | undefined>(undefined);

    // ── Advanced section state ────────────────────────────────────────────
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [tags, setTags] = useState('');
    const [conversationTags, setConversationTags] = useState('');

    // Assistant Type (opsLanguageVersion) — default "v1 = Standard"
    // Note: overridden to 'v4' when a workflow template is selected (see save flow)
    const [opsLanguageVersion, setOpsLanguageVersion] = useState('v1');

    // Allow other users to request access to this assistant
    const [availableOnRequest, setAvailableOnRequest] = useState(false);

    // Data source / message / feature / API option flags
    const [dataSourceOptions, setDataSourceOptions] = useState<{ [k: string]: boolean }>(() =>
        DATA_SOURCE_FLAGS.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue }), {})
    );
    const [messageOptions, setMessageOptions] = useState<{ [k: string]: boolean }>(() =>
        MESSAGE_OPTION_FLAGS.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue }), {})
    );
    const [featureOptions, setFeatureOptions] = useState<{ [k: string]: boolean }>(() => {
        const settings = getSettings(featureFlags);
        return FEATURE_OPTION_FLAGS.reduce((acc: { [k: string]: boolean }, f) => {
            if (f.key === 'IncludeArtifactsInstr') {
                if (featureFlags.artifacts && (settings as any).featureOptions?.includeArtifacts) acc[f.key] = f.defaultValue;
            } else {
                acc[f.key] = f.defaultValue;
            }
            return acc;
        }, {});
    });
    const [apiOptions, setApiOptions] = useState<{ [k: string]: boolean }>(() =>
        API_OPTION_FLAGS.reduce((acc: { [k: string]: boolean }, f) => {
            if (f.key === 'IncludeApiInstr') { if (featureFlags.assistantApis) acc[f.key] = f.defaultValue; }
            else acc[f.key] = f.defaultValue;
            return acc;
        }, {})
    );

    // Email events — gated by featureFlags.assistantEmailEvents; non-collaborative only
    const [enableEmailEvents, setEnableEmailEvents] = useState(false);
    const [emailEventTag, setEmailEventTag] = useState<string | undefined>(undefined);
    const [emailEventTemplate, setEmailEventTemplate] = useState<{ systemPrompt?: string; userPrompt?: string } | undefined>(undefined);
    const [isEmailTagAvailable, setIsEmailTagAvailable] = useState(false);
    const [isCheckingEmailTag, setIsCheckingEmailTag] = useState(false);

    // ── Save / loading state ──────────────────────────────────────────────
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // ── Pre-populate form from editing assistant (edit mode only) ─────────
    useEffect(() => {
        if (!editingAssistant) return;

        const def = editingAssistant.data?.assistant?.definition as AssistantDefinition | undefined;
        if (!def) return;

        // Section B — core fields
        setName(def.name ?? '');
        setDescription(def.description ?? '');
        setInstructions(def.instructions ?? '');
        setDisclaimer(def.disclaimer ?? '');

        // Tags
        if (Array.isArray(def.tags)) setTags(def.tags.join(', '));
        const convTags = (def.data as any)?.conversationTags;
        if (Array.isArray(convTags)) setConversationTags(convTags.join(', '));

        // Enforce model
        const enforcedModel = (def.data as any)?.model as string | undefined;
        if (enforcedModel) {
            setEnforceModel(true);
            setEnforcedModelId(enforcedModel);
        }

        // Data sources (existing S3 keys — pre-loaded; new uploads handled by upload UI).
        // Already-saved sources are complete, so seed them at 100 or their cards
        // would spin forever waiting on an upload that already happened.
        if (Array.isArray(def.dataSources)) {
            const existing = def.dataSources as AttachedDocument[];
            setDataSources(existing);
            setDocumentState((prev) => {
                const next = { ...prev };
                existing.forEach((ds) => { next[ds.id] = 100; });
                return next;
            });
        }

        // Website URLs
        const wUrls = (def.data as any)?.websiteUrls;
        if (Array.isArray(wUrls)) setWebsiteUrls(wUrls);

        // Skills
        const skills = (def.data as any)?.skills;
        if (Array.isArray(skills)) setSelectedSkills(skills);
        const skillMode = (def.data as any)?.skillSelectionMode;
        if (skillMode) setSkillSelectionMode(skillMode);

        // Tools / APIs
        if (Array.isArray(def.tools)) setSelectedApis(def.tools);
        const opInfo = (def.data as any)?.operations;
        if (Array.isArray(opInfo)) setApiInfo(opInfo);
        const builtIn = (def.data as any)?.builtInOperations;
        if (Array.isArray(builtIn)) setBuiltInAgentTools(builtIn);

        // Advanced
        const opsVersion = (def.data as any)?.opsLanguageVersion as string | undefined;
        if (opsVersion) setOpsLanguageVersion(opsVersion);
        if ((def.data as any)?.availableOnRequest) setAvailableOnRequest(true);

        // Option flags — merge over defaults
        const dsOpts = (def.data as any)?.dataSourceOptions;
        if (dsOpts) setDataSourceOptions((prev) => ({ ...prev, ...dsOpts }));
        const msgOpts = (def.data as any)?.messageOptions;
        if (msgOpts) setMessageOptions((prev) => ({ ...prev, ...msgOpts }));
        const featOpts = (def.data as any)?.featureOptions;
        if (featOpts) setFeatureOptions((prev) => ({ ...prev, ...featOpts }));
        const apiOpts = (def.data as any)?.apiOptions;
        if (apiOpts) setApiOptions((prev) => ({ ...prev, ...apiOpts }));

        // Section A — access type sub-config
        if (editingAssistant.groupId) {
            setSelectedGroupId(editingAssistant.groupId);
        }
        const astPath = def.astPath ?? ((def.data as any)?.astPath as string | undefined);
        if (astPath) {
            setSlug(astPath);
            const astPathData = (def.data as any)?.astPathData;
            if (astPathData?.isPublic === false) {
                setSubOption('specific');
                const accessToUsers = astPathData?.accessTo?.users;
                if (Array.isArray(accessToUsers)) setEmails(accessToUsers.join(', '));
            } else {
                setSubOption('public');
            }
        }

        // Email events
        const emailEvents = (def.data as any)?.emailEvents;
        if (emailEvents?.tag) {
            setEnableEmailEvents(true);
            setEmailEventTag(emailEvents.tag);
            setEmailEventTemplate(emailEvents.template);
            setIsEmailTagAvailable(true); // assume existing tag is still valid
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount — editingAssistant is stable (passed as prop, not expected to change)

    // ── Lazy load APIs and agent tools ────────────────────────────────────
    const filterOps = async (data: any[]) => {
        const filteredOps = await filterSupportedIntegrationOps(data);
        if (filteredOps) setAvailableApis(filteredOps);
        else setAvailableApis([]);
    };

    useEffect(() => {
        if (featureFlags.integrations && availableApis === null) {
            getOpsForUser().then((ops) => {
                if (ops.success) filterOps(ops.data);
                else setAvailableApis([]);
            });
        }
        if (featureFlags.agentTools && availableAgentTools === null) {
            getAgentTools().then((tools) => {
                setAvailableAgentTools(tools.success ? tools.data : {});
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Group access calc ──────────────────────────────────────────────────
    const adminGroups: Group[] = groups.filter((g: Group) => {
        if (!userIdentifier) return false;
        const access = g.members?.[userIdentifier];
        return access === GroupAccessType.ADMIN || access === GroupAccessType.WRITE;
    });
    const hasGroupAccess = featureFlags.assistantAdminInterface && adminGroups.length > 0;

    // ── Access radio card refs (roving tabindex keyboard nav) ─────────────
    // cardRefs[i] corresponds to visibleCards[i] — built at render time
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

    // ── Slug validation on change ─────────────────────────────────────────
    const handleSlugChange = (raw: string) => {
        const clean = raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
        setSlug(clean);
        setSlugError(validateSlug(clean));
    };

    // ── Data source handlers ──────────────────────────────────────────────
    // These must produce NEW state objects: the card for a file has to appear
    // the instant it is selected (before the server knows about it), and its
    // progress ring has to tick — neither happens if we mutate in place.
    const onAttach = (doc: AttachedDocument) => {
        setDataSources((prev) => [...prev, doc as any]);
    };
    const onSetMetadata = (doc: AttachedDocument, metadata: any) => {
        setDataSources((prev) =>
            prev.map((x) => (x.id === doc.id ? { ...x, metadata } : x))
        );
    };
    const onSetKey = (doc: AttachedDocument, key: string) => {
        setDataSources((prev) =>
            prev.map((x) => (x.id === doc.id ? { ...x, key } : x))
        );
    };
    const onUploadProgress = (doc: AttachedDocument, progress: number) => {
        setDocumentState((prev) => ({ ...prev, [doc.id]: progress }));
        // Any forward progress clears a previously flagged stall.
        setDataSourceErrors((prev) => {
            if (!(doc.id in prev)) return prev;
            const next = { ...prev };
            delete next[doc.id];
            return next;
        });
    };
    /**
     * AttachFile hands back a cancel closure (typed as AbortController, actually
     * a function) so an in-flight upload can be aborted from the card's ×.
     */
    const onSetAbortController = (doc: AttachedDocument, abort: any) => {
        abortUploadRef.current[doc.id] =
            typeof abort === 'function' ? abort : () => abort?.abort?.();
    };

    /**
     * Files dropped onto the Data Sources section. Runs the same validation,
     * ZIP expansion and upload pipeline as the paperclip button — only the
     * gesture differs, so a dropped file and a picked file are indistinguishable
     * once attached.
     */
    const handleDroppedFiles = (files: File[]) => {
        if (!featureFlags.uploadDocuments) return;
        processDragDropFiles(files, {
            disallowedExtensions: COMMON_DISALLOWED_FILE_EXTENSIONS,
            onAttach,
            onUploadProgress,
            onSetKey,
            onSetMetadata,
            onSetAbortController,
            statsService,
            featureFlags,
            ragOn,
            uploadDocuments: featureFlags.uploadDocuments,
            groupId: undefined,
            props: {},
        });
    };

    /**
     * Library picks are already uploaded, so they land complete (progress 100).
     * Shape matches what the save step expects: raw S3 key in `id`, no `key`.
     */
    const addLibraryFiles = (picked: PickedLibraryFile[]) => {
        const fresh = picked.filter((file) => !dataSources.some((ds) => ds.id === file.id));
        if (fresh.length === 0) return;
        setDataSources((prev) => [
            ...prev,
            ...fresh.map((file) => ({
                id: file.id,
                name: file.name,
                raw: null,
                type: file.type,
                data: '',
                metadata: file.metadata,
            })) as AttachedDocument[],
        ]);
        setDocumentState((prev) => {
            const next = { ...prev };
            fresh.forEach((file) => { next[file.id] = 100; });
            return next;
        });
    };

    // ── Data source card helpers ──────────────────────────────────────────
    /** Uploading → 0–94, Processing → 95 (server extract), Ready → 100. */
    const dataSourceStatus = (ds: AttachedDocument): DataSourceCardStatus => {
        if (dataSourceErrors[ds.id]) return 'error';
        const progress = documentState[ds.id];
        if (progress === 100) return 'ready';
        if (typeof progress === 'number' && progress >= 95) return 'processing';
        return 'uploading';
    };

    /**
     * True while any attached source is still uploading or being processed.
     * Keyed off dataSources rather than documentState so a file selected a
     * moment ago (no progress entry yet) also blocks save. Sources flagged as
     * failed are excluded — they never reach 100 and would wedge the modal.
     */
    const hasPendingUploads = () =>
        dataSources.some(
            (ds) => (documentState[ds.id] ?? 0) < 100 && !dataSourceErrors[ds.id]
        );

    const removeDataSource = (ds: AttachedDocument) => {
        abortUploadRef.current[ds.id]?.();
        delete abortUploadRef.current[ds.id];
        setDataSources((prev) => prev.filter((x) => x.id !== ds.id));
        setDocumentState((prev) => {
            const next = { ...prev };
            delete next[ds.id];
            return next;
        });
        setDataSourceErrors((prev) => {
            const next = { ...prev };
            delete next[ds.id];
            return next;
        });
        if (isWebsiteDs(ds)) {
            setWebsiteUrls((prev: any[]) => prev.filter((u: any) => u.url !== ds.id));
        }
    };

    /** Drop the failed source and reopen the file picker so it can be re-added. */
    const retryDataSource = (ds: AttachedDocument) => {
        removeDataSource(ds);
        // The hidden <input> only exists while the upload panel is open, so open
        // it first and click once React has committed that render.
        setActiveDataSourceMethod('upload');
        const clickWhenMounted = (attempt = 0) => {
            const input = document.querySelector('#' + ATTACH_FILE_INPUT_ID) as HTMLInputElement | null;
            if (input) input.click();
            else if (attempt < 10) setTimeout(() => clickWhenMounted(attempt + 1), 30);
        };
        requestAnimationFrame(() => clickWhenMounted());
    };

    /**
     * Stall watchdog. The upload pipeline reports failures with an alert() and no
     * callback, so a broken upload otherwise leaves a card spinning forever.
     * Every progress update re-runs this effect and restarts the timers, making
     * this a "no forward progress for UPLOAD_STALL_MS" check.
     */
    useEffect(() => {
        const pending = dataSources.filter(
            (ds) => (documentState[ds.id] ?? 0) < 100 && !dataSourceErrors[ds.id]
        );
        if (pending.length === 0) return;

        const timers = pending.map((ds) =>
            setTimeout(() => {
                setDataSourceErrors((prev) => ({
                    ...prev,
                    [ds.id]: 'Upload didn’t finish',
                }));
            }, UPLOAD_STALL_MS)
        );
        return () => timers.forEach(clearTimeout);
    }, [dataSources, documentState, dataSourceErrors]);

    // ── Save-enabled logic ─────────────────────────────────────────────────
    const canSave = (): boolean => {
        if (!name.trim()) return false;
        if (accessType === 'managed') {
            if (!featureFlags.assistantPathPublishing) return false;
            if (!!validateSlug(slug)) return false;
        }
        if (accessType === 'collaborative') {
            if (teamMode === 'existing') {
                if (adminGroups.length === 0) return false;
                if (adminGroups.length > 1 && !selectedGroupId) return false;
            } else {
                if (!newTeamName.trim()) return false;
            }
        }
        // Prevent save while files are uploading
        if (hasPendingUploads()) return false;
        return true;
    };

    // ── Resolve groupId (may require creating a new team) ─────────────────
    const resolveGroupId = async (): Promise<string | null> => {
        if (accessType !== 'collaborative') return null;

        if (teamMode === 'existing') {
            if (adminGroups.length === 1) return adminGroups[0].id;
            return selectedGroupId;
        }

        // PORT: Copied from NewAssistantTypeSelector.tsx Card 3 "Create new team" logic
        const result = await createAstAdminGroup({
            name: newTeamName.trim(),
            groupTypes: [],
            amplifyGroups: [],
            systemUsers: [],
        });

        if (!result || !result.id) {
            throw new Error('Failed to create team. Please try again.');
        }

        if (newTeamMembers.trim()) {
            const memberEmails = newTeamMembers
                .split(',')
                .map((e: string) => e.trim())
                .filter(Boolean);

            const members: Record<string, string> = {};
            if (userIdentifier) {
                members[userIdentifier] = GroupAccessType.ADMIN;
            }
            memberEmails.forEach((email: string) => {
                const username =
                    Object.keys(amplifyUsers).find(
                        (k) => (amplifyUsers as Record<string, string>)[k] === email
                    ) || email;
                if (username !== userIdentifier) {
                    members[username] = GroupAccessType.WRITE;
                }
            });

            await updateGroupMembers({ groupId: result.id, members });
        }

        return result.id;
    };

    // ── Main save handler ─────────────────────────────────────────────────
    const handleSave = async () => {
        if (!name.trim()) {
            setNameError('Name is required');
            return;
        }
        setNameError('');
        setSaveError('');

        // Check uploads
        if (hasPendingUploads()) {
            setSaveError('Please wait for all data sources to finish uploading.');
            return;
        }

        setIsSaving(true);
        setLoadingMessage(isEditMode ? 'Saving assistant…' : 'Creating assistant…');

        try {
            // 1. Resolve groupId
            // In edit mode: reuse the existing groupId (don't create a new team).
            // In create mode: may create a new team first.
            let groupId: string | null = null;
            if (isEditMode) {
                groupId = editingAssistant!.groupId ?? null;
            } else {
                try {
                    groupId = await resolveGroupId();
                } catch (err: any) {
                    setSaveError(err.message || 'Failed to create team. Please try again.');
                    setIsSaving(false);
                    setLoadingMessage('');
                    return;
                }
            }

            // 2. Process tags
            const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
            const conversationTagList = conversationTags.split(',').map((t) => t.trim()).filter(Boolean);

            // 3. Process dataSources (S3 key formatting mirrors AssistantModal.handleUpdateAssistant)
            const processedDataSources = dataSources.map((ds: AttachedDocument) => {
                if (isWebsiteDs(ds) && !ds.key) return ds; // needs scraping
                if (groupId) {
                    if (!ds.key) (ds as any).key = ds.id;
                    if (!(ds as any).groupId) (ds as any).groupId = groupId;
                    return { ...ds, id: 's3://' + (ds as any).key };
                }
                if ((ds as any).key || (ds.id && ds.id.indexOf('://') > 0)) return ds;
                return { ...ds, id: 's3://' + ds.id };
            });

            // 4. Build the AssistantDefinition
            // In edit mode, carry forward the existing id/assistantId so the
            // backend treats the createAssistant call as an update.
            const existingDef = isEditMode
                ? (editingAssistant!.data?.assistant?.definition as AssistantDefinition | undefined)
                : undefined;

            const def: AssistantDefinition = {
                name: name.trim(),
                description: description.trim(),
                instructions: instructions.trim(),
                disclaimer: disclaimer.trim(),
                tools: selectedApis || [],
                tags: tagList,
                dataSources: processedDataSources as any,
                version: existingDef?.version ?? 1,
                fileKeys: existingDef?.fileKeys ?? [],
                provider: AssistantProviderID.AMPLIFY,
                // Carry forward existing IDs in edit mode
                ...(isEditMode && existingDef?.id ? { id: existingDef.id } : {}),
                ...(isEditMode && existingDef?.assistantId ? { assistantId: existingDef.assistantId } : {}),
                data: {
                    access: { read: true, write: true },
                    tags: tagList,
                    conversationTags: conversationTagList,
                    websiteUrls,
                    ...(integrationDataSources ? { integrationDriveData: integrationDataSources } : {}),
                    ...(selectedSkills.length > 0 ? { skills: selectedSkills, skillSelectionMode } : {}),
                    ...(builtInAgentTools.length > 0 ? { builtInOperations: builtInAgentTools } : {}),
                    ...(apiInfo.length > 0 ? { operations: apiInfo } : {}),
                    // Workflow template — forces v4 ops language; overrides opsLanguageVersion
                    ...(baseWorkflowTemplateId ? {
                        baseWorkflowTemplateId,
                        workflowTemplateId: baseWorkflowTemplateId,
                        opsLanguageVersion: 'v4',
                    } : { opsLanguageVersion }),
                    availableOnRequest,
                    dataSourceOptions,
                    messageOptions,
                    ...(Object.keys(featureOptions).length > 0 ? { featureOptions } : {}),
                    ...(Object.keys(apiOptions).length > 0 ? { apiOptions } : {}),
                    // Enforce model if the toggle is on
                    ...(enforceModel && enforcedModelId ? { model: enforcedModelId } : {}),
                    // groupId for team assistants
                    ...(groupId ? { groupId } : {}),
                } as any,
                // Pre-set astPath for Managed URL
                ...(accessType === 'managed' && slug ? { astPath: slug.toLowerCase() } : {}),
            };

            // 5. Call the create service
            const { id, assistantId, provider, data_sources } = await createAssistant(def);

            if (!id) {
                setSaveError('Unable to save the assistant at this time. Please try again.');
                setIsSaving(false);
                setLoadingMessage('');
                return;
            }

            def.id = id;
            def.provider = provider;
            def.assistantId = assistantId;
            if (data_sources) def.dataSources = data_sources;

            // 6a. Register email event template if enabled (requires assistantId)
            if (enableEmailEvents && featureFlags.assistantEmailEvents && accessType !== 'collaborative') {
                try {
                    const resolvedTag = (emailEventTag && emailEventTag.trim()) || safeEmailEventTag(name.trim());
                    setLoadingMessage('Setting up email event…');
                    const safeTemplate = {
                        userPrompt: emailEventTemplate?.userPrompt || '',
                        systemPrompt: emailEventTemplate?.systemPrompt || '',
                    };
                    await addEventTemplate(resolvedTag, formatEmailEventTemplate(safeTemplate), assistantId);
                    (def.data as any).emailEvents = { tag: resolvedTag, template: safeTemplate };
                } catch (emailErr) {
                    console.error('Error registering email event:', emailErr);
                    // Non-blocking — assistant is saved, email events registration failed
                }
            }

            // 6b. If Managed URL, register the path
            if (accessType === 'managed' && slug) {
                const formattedPath = slug.toLowerCase();
                setLoadingMessage(`Publishing assistant to /assistants/${formattedPath}…`);
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

                try {
                    const pathResult = await addAssistantPath(
                        assistantId,
                        formattedPath,
                        undefined,
                        astPathData.isPublic,
                        astPathData.accessTo
                    );
                    if (pathResult.success) {
                        def.astPath = formattedPath;
                        (def.data as any).astPath = formattedPath;
                        (def.data as any).astPathData = astPathData;
                    }
                } catch (pathErr) {
                    console.error('Error saving assistant path:', pathErr);
                }
            }

            // 7. Build the Prompt and update HomeContext state
            const aPrompt = createAssistantPrompt(def);
            // Carry forward the original prompt ID in edit mode so the
            // state update replaces the right entry (handleUpdateAssistantPrompt
            // matches by p.id, not by assistantId).
            if (isEditMode && editingAssistant!.id) {
                aPrompt.id = editingAssistant!.id;
            }
            if (groupId) {
                aPrompt.groupId = groupId;
                aPrompt.folderId = 'assistants';
            }

            await handleUpdateAssistantPrompt(aPrompt, prompts, homeDispatch, selectedAssistant);

            if (groupId) {
                const updatedGroups = groups.map((g: Group) => {
                    if (g.id !== groupId) return g;
                    if (isEditMode) {
                        // Replace the existing assistant entry
                        const already = g.assistants?.some((a: Prompt) => a.id === aPrompt.id);
                        return {
                            ...g,
                            assistants: already
                                ? g.assistants!.map((a: Prompt) => a.id === aPrompt.id ? aPrompt : a)
                                : [...(g.assistants || []), aPrompt],
                        };
                    }
                    // Create mode — append
                    return { ...g, assistants: [...(g.assistants || []), aPrompt] };
                });
                homeDispatch({ field: 'groups', value: updatedGroups });
            }

            setLoadingMessage('');
            onClose();
        } catch (err) {
            console.error(isEditMode ? 'Error updating assistant:' : 'Error creating assistant:', err);
            setSaveError(`An error occurred while ${isEditMode ? 'updating' : 'creating'} the assistant. Please try again.`);
            setIsSaving(false);
            setLoadingMessage('');
        }
    };

    // ── Empty definition for drive component (creation, no existing data) ──
    const emptyDefinitionForDrive: AssistantDefinition = {
        name: '',
        description: '',
        instructions: '',
        disclaimer: '',
        tools: [],
        tags: [],
        dataSources: [],
        version: 1,
        fileKeys: [],
        provider: AssistantProviderID.AMPLIFY,
        data: {} as any,
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <CreationModalShell
            title={isEditMode ? 'Edit Assistant' : 'New Assistant'}
            onClose={onClose}
            onSave={handleSave}
            saveLabel={isEditMode ? 'Save Changes' : 'Create'}
            isSaving={isSaving}
            saveDisabled={!canSave()}
        >
            {/* ── Section A: Access type ──────────────────────────────────── */}
            {(() => {
                // ── Build visible cards list (depends on feature flags) ─────────
                type CardDef = { value: AccessModel; icon: React.ReactNode; title: string; description: string; disabled?: boolean };
                const visibleCards: CardDef[] = [
                    {
                        value: 'private',
                        icon: <IconLock size={18} />,
                        title: 'Just for me',
                        description: 'Only you can see and use this assistant',
                    },
                    {
                        value: 'managed',
                        icon: <IconShare size={18} />,
                        title: 'I manage it, others can use it',
                        description: featureFlags.assistantPathPublishing
                            ? 'You control it. Choose how others access it.'
                            : 'Requires path publishing to be enabled by admin.',
                        disabled: !featureFlags.assistantPathPublishing,
                    },
                    ...(hasGroupAccess ? [{
                        value: 'collaborative' as const,
                        icon: <IconUsers size={18} />,
                        title: 'Team assistant',
                        description: 'Multiple people can edit and manage this assistant',
                    }] : []),
                ];

                const numCards = visibleCards.length;
                const activeIdx = visibleCards.findIndex((c) => c.value === accessType);
                const showPanel = accessType !== 'private';

                // Arrow centers under the active card (using card-center percentage)
                // Formula: (activeIdx + 0.5) / numCards * 100%
                const arrowCenterPct = numCards > 0
                    ? `${((activeIdx + 0.5) / numCards) * 100}%`
                    : '50%';

                // ── Arrow keys cycle through non-disabled cards ──────────────────
                const handleRadioKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
                    e.preventDefault();
                    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
                    let idx = activeIdx;
                    let attempts = 0;
                    do {
                        idx = (idx + dir + numCards) % numCards;
                        attempts++;
                    } while (visibleCards[idx].disabled && attempts < numCards);
                    if (!visibleCards[idx].disabled && idx !== activeIdx) {
                        setAccessType(visibleCards[idx].value);
                        cardRefs.current[idx]?.focus();
                    }
                };

                return (
                    <div style={{ marginBottom: 4 }}>
                        <p style={sectionHeadingStyle} id="access-group-label">
                            Who can access this assistant?
                        </p>

                        {/* ── Horizontal radio card grid ──────────────────────── */}
                        <div
                            role="radiogroup"
                            aria-labelledby="access-group-label"
                            onKeyDown={handleRadioKeyDown}
                            style={{
                                // auto-fit: wraps to 1 col below ~500px (3×160px+gaps)
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(155px, 100%), 1fr))',
                                gap: 8,
                                alignItems: 'stretch',
                            }}
                        >
                            {visibleCards.map((card, idx) => (
                                <AccessRadioCard
                                    key={card.value}
                                    ref={(el) => { cardRefs.current[idx] = el; }}
                                    id={`access-card-${card.value}`}
                                    value={card.value}
                                    selected={accessType === card.value}
                                    disabled={card.disabled}
                                    icon={card.icon}
                                    title={card.title}
                                    description={card.description}
                                    onSelect={() => !card.disabled && setAccessType(card.value)}
                                    panelId="access-config-panel"
                                />
                            ))}
                        </div>

                        {/* ── Arrow connector pointing up at active card ──────── */}
                        {/* Rendered outside the animated container so overflow:hidden doesn't clip it */}
                        {showPanel && (
                            <div aria-hidden="true" style={{ position: 'relative', height: 14 }}>
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 4,
                                        left: arrowCenterPct,
                                        transform: 'translateX(-50%) rotate(45deg)',
                                        width: 12,
                                        height: 12,
                                        background: 'var(--bg-raised)',
                                        // top+left borders → visible upper-left two faces of the diamond
                                        borderTop: '1px solid var(--accent)',
                                        borderLeft: '1px solid var(--accent)',
                                        zIndex: 2,
                                        transition: 'left 180ms ease-in-out',
                                    }}
                                />
                            </div>
                        )}
                        {/* Spacer when private (no arrow) so divider spacing is consistent */}
                        {!showPanel && <div style={{ height: 14 }} />}

                        {/* ── Config panel — CSS Grid height animation ────────── */}
                        {/*
                         * grid-template-rows: 0fr → 1fr collapses/expands smoothly.
                         * The inner div keeps overflow:hidden to contain the animation.
                         * Values are preserved across option switches (state lives in parent).
                         */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateRows: showPanel ? '1fr' : '0fr',
                                transition: 'grid-template-rows 180ms ease-in-out',
                            }}
                        >
                            <div
                                style={{
                                    overflow: 'hidden',
                                    opacity: showPanel ? 1 : 0,
                                    transition: 'opacity 150ms ease',
                                }}
                            >
                                <div
                                    id="access-config-panel"
                                    role="region"
                                    aria-label={`${visibleCards.find((c) => c.value === accessType)?.title ?? ''} configuration`}
                                    style={{
                                        border: '1px solid var(--accent)',
                                        borderRadius: 10,
                                        background: 'var(--bg-raised)',
                                        padding: 16,
                                    }}
                                >
                                    {/* ── Managed URL config ─────────────────── */}
                                    {accessType === 'managed' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                                            {/* Radio: Specific people */}
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                                                <input
                                                    type="radio"
                                                    name="access-managed-sub"
                                                    value="specific"
                                                    checked={subOption === 'specific'}
                                                    onChange={() => setSubOption('specific')}
                                                    style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                                                />
                                                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                                    Specific people — I&apos;ll list emails
                                                </span>
                                            </label>

                                            {/* Email input — animated reveal */}
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateRows: subOption === 'specific' ? '1fr' : '0fr',
                                                    transition: 'grid-template-rows 150ms ease',
                                                    paddingLeft: 26,
                                                }}
                                            >
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ paddingBottom: 4 }}>
                                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                            Email addresses (comma-separated)
                                                        </label>
                                                        <textarea
                                                            value={emails}
                                                            onChange={(e) => setEmails(e.target.value)}
                                                            rows={2}
                                                            placeholder="user@example.com, another@example.com"
                                                            style={{ ...fieldStyle, fontSize: 12, resize: 'none' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Radio: Anyone with link */}
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                                                <input
                                                    type="radio"
                                                    name="access-managed-sub"
                                                    value="public"
                                                    checked={subOption === 'public'}
                                                    onChange={() => setSubOption('public')}
                                                    style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                                                />
                                                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                                    Anyone with the link — accessible at a URL
                                                </span>
                                            </label>

                                            {/* URL slug (always visible when managed is active) */}
                                            <div style={{ paddingLeft: 26 }}>
                                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                    URL path{subOption === 'public' ? <span style={{ color: '#e05252' }}> *</span> : null}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={slug}
                                                    onChange={(e) => handleSlugChange(e.target.value)}
                                                    placeholder="my-assistant"
                                                    maxLength={40}
                                                    style={{
                                                        ...fieldStyle,
                                                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                                                        fontSize: 13,
                                                        borderColor: slugError ? '#e05252' : 'var(--border-subtle)',
                                                    }}
                                                />
                                                {slugError ? (
                                                    <p style={{ fontSize: 11, color: '#e05252', margin: '4px 0 0' }}>{slugError}</p>
                                                ) : slug ? (
                                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                        Will be available at /assistants/{slug}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Team (Collaborative) config ─────────── */}
                                    {accessType === 'collaborative' && (
                                        <div>
                                            {/* Mode toggle */}
                                            <div
                                                style={{
                                                    display: 'inline-flex',
                                                    gap: 3,
                                                    marginBottom: 14,
                                                    background: 'var(--bg-app)',
                                                    borderRadius: 8,
                                                    padding: 3,
                                                }}
                                            >
                                                {(['existing', 'new'] as TeamMode[]).map((mode) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setTeamMode(mode)}
                                                        style={{
                                                            padding: '5px 14px',
                                                            borderRadius: 6,
                                                            border: 'none',
                                                            fontSize: 12,
                                                            fontWeight: teamMode === mode ? 500 : 400,
                                                            cursor: 'pointer',
                                                            background: teamMode === mode ? 'var(--bg-active)' : 'transparent',
                                                            color: teamMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                                                            fontFamily: 'inherit',
                                                            transition: 'all 120ms ease',
                                                        }}
                                                    >
                                                        {mode === 'existing' ? 'Use existing team' : 'Create new team'}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Existing team */}
                                            {teamMode === 'existing' && (
                                                <>
                                                    {adminGroups.length === 1 && (
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            padding: '8px 10px', borderRadius: 8,
                                                            background: 'var(--bg-active)', fontSize: 13,
                                                            color: 'var(--text-primary)',
                                                        }}>
                                                            <span style={{
                                                                width: 8, height: 8, borderRadius: '50%',
                                                                background: 'var(--accent)', flexShrink: 0,
                                                                display: 'inline-block',
                                                            }} />
                                                            Creating in: <strong>{adminGroups[0].name}</strong>
                                                        </div>
                                                    )}
                                                    {adminGroups.length > 1 && (
                                                        <select
                                                            value={selectedGroupId || ''}
                                                            onChange={(e) => setSelectedGroupId(e.target.value || null)}
                                                            style={fieldStyle}
                                                        >
                                                            <option value="">Choose a team…</option>
                                                            {adminGroups.map((g: Group) => (
                                                                <option key={g.id} value={g.id}>{g.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </>
                                            )}

                                            {/* New team */}
                                            {teamMode === 'new' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                            Team name <span style={{ color: '#e05252' }}>*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={newTeamName}
                                                            onChange={(e) => setNewTeamName(e.target.value)}
                                                            placeholder="e.g. Research Team"
                                                            maxLength={80}
                                                            style={fieldStyle}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                            Add members (comma-separated emails, optional)
                                                        </label>
                                                        <textarea
                                                            value={newTeamMembers}
                                                            onChange={(e) => setNewTeamMembers(e.target.value)}
                                                            rows={2}
                                                            placeholder="alice@example.com, bob@example.com"
                                                            style={{ ...fieldStyle, resize: 'none' }}
                                                        />
                                                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                            Members will be added with editor access. You will be the admin.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <SectionDivider label="Assistant Details" />

            {/* ── Section B: Form fields ─────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* Name */}
                <div style={fieldGroupStyle}>
                    <label htmlFor="ast-creation-name" style={labelStyle}>
                        Name <span style={{ color: '#e05252' }}>*</span>
                    </label>
                    <input
                        id="ast-creation-name"
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }}
                        placeholder="Give your assistant a name"
                        maxLength={200}
                        style={{
                            ...inputStyle,
                            borderColor: nameError ? '#e05252' : 'var(--border-subtle)',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = nameError ? '#e05252' : 'var(--accent)'; }}
                        onBlur={(e) => { e.target.style.borderColor = nameError ? '#e05252' : 'var(--border-subtle)'; }}
                    />
                    {nameError && (
                        <p style={{ fontSize: 12, color: '#e05252', margin: '4px 0 0' }}>{nameError}</p>
                    )}
                </div>

                {/* Description */}
                <div style={fieldGroupStyle}>
                    <label htmlFor="ast-creation-description" style={labelStyle}>
                        Description
                    </label>
                    <textarea
                        id="ast-creation-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What does this assistant do?"
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                    />
                </div>

                {/* Instructions / System Prompt */}
                <div style={fieldGroupStyle}>
                    <label htmlFor="ast-creation-instructions" style={labelStyle}>
                        Instructions / System Prompt
                    </label>
                    <textarea
                        id="ast-creation-instructions"
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Describe how the assistant should behave, what it knows, and how to respond…"
                        rows={6}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                    />
                </div>

                {/* Disclaimer to Append to Responses */}
                <div style={fieldGroupStyle}>
                    <label htmlFor="ast-creation-disclaimer" style={labelStyle}>
                        Disclaimer to Append to Responses
                    </label>
                    <textarea
                        id="ast-creation-disclaimer"
                        value={disclaimer}
                        onChange={(e) => setDisclaimer(e.target.value)}
                        placeholder="Assistant disclaimer message."
                        rows={2}
                        style={{ ...inputStyle, resize: 'none' }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                    />
                </div>

                {/* Enforce Model toggle + picker */}
                <div style={fieldGroupStyle}>
                    <div
                        onClick={() => setEnforceModel((v) => !v)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 16,
                            marginBottom: 10,
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                            Enforce a specific model
                        </span>
                        <ToggleSwitch
                            checked={enforceModel}
                            onChange={setEnforceModel}
                            aria-label="Enforce a specific model"
                        />
                    </div>

                    {enforceModel && (
                        <div style={{ paddingLeft: 23 }}>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                Users will always use this model when chatting with this assistant.
                            </p>
                            <ModelPicker
                                selectedModelId={enforcedModelId}
                                selectedEffort={effortLevel}
                                onModelChange={(id) => setEnforcedModelId(id)}
                                onEffortChange={(e) => setEffortLevel(e)}
                                isNewChat={true}
                            />
                        </div>
                    )}
                </div>

                {/* ── Data Sources (unified) ─────────────────────────────────
                    The whole section is a drop target, so a file can be dragged
                    in without first opening the "From your computer" panel. */}
                <FileDropZone
                    onFiles={handleDroppedFiles}
                    disabled={!featureFlags.uploadDocuments}
                    label="Drop files to attach to this assistant"
                    hint="They upload straight into the data sources below"
                    variant="inset"
                    style={fieldGroupStyle}
                >
                    <label style={labelStyle}>Data Sources</label>

                    {/* Info banner */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-raised))',
                        marginBottom: 12,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                    }}>
                        <IconAlertTriangle size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                        After saving, allow a few minutes for data sources to take effect.
                    </div>

                    {/* ── Attached file cards ──────────────────────────────────
                        Sits above the add-source controls and keeps each card in
                        a stable grid slot from selection through ready, so state
                        changes never reflow the list. */}
                    {dataSources.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                            {/* 12px clearance: the card's × overlaps 8px above its top edge */}
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Attached ({dataSources.length})
                            </p>
                            <DataSourceCardGrid label="Attached data sources">
                                {dataSources.map((ds) => {
                                    const status = dataSourceStatus(ds);
                                    const progress = documentState[ds.id];
                                    return (
                                        <DataSourceCard
                                            key={ds.id}
                                            name={ds.name}
                                            type={ds.type}
                                            status={status}
                                            progress={
                                                status === 'uploading' && typeof progress === 'number'
                                                    ? progress
                                                    : undefined
                                            }
                                            error={dataSourceErrors[ds.id]}
                                            onRemove={() => removeDataSource(ds)}
                                            onCancelUpload={() => removeDataSource(ds)}
                                            onRetry={isWebsiteDs(ds) ? undefined : () => retryDataSource(ds)}
                                        />
                                    );
                                })}
                            </DataSourceCardGrid>
                        </div>
                    )}

                    {/* ── Method selector row ──────────────────────────────── */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>

                        {/* Button helper — shared style for the method buttons */}
                        {(
                            [
                                { key: 'upload', label: 'From your computer', icon: <IconUpload size={15} /> },
                                { key: 'library', label: 'From library', icon: <IconFiles size={15} /> },
                                ...(featureFlags.websiteUrls
                                    ? [{ key: 'website', label: 'Website URL', icon: <IconWorldWww size={15} /> }]
                                    : []),
                                ...(featureFlags.integrations && accessType !== 'collaborative'
                                    ? [{ key: 'drive', label: 'OneDrive / SharePoint', icon: <IconCloudUpload size={15} /> }]
                                    : []),
                            ] as { key: 'upload' | 'library' | 'website' | 'drive'; label: string; icon: React.ReactNode }[]
                        ).map(({ key, label, icon }) => {
                            const active = activeDataSourceMethod === key;
                            return (
                                <button
                                    key={key}
                                    aria-pressed={active}
                                    onClick={() => setActiveDataSourceMethod(active ? null : key)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '7px 13px',
                                        borderRadius: 8,
                                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
                                        background: active
                                            ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-raised))'
                                            : 'var(--bg-raised)',
                                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                        fontSize: 13,
                                        fontWeight: active ? 500 : 400,
                                        fontFamily: 'inherit',
                                        cursor: 'pointer',
                                        transition: 'border-color 120ms ease, background 120ms ease, color 120ms ease',
                                        outline: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                        }
                                    }}
                                >
                                    {icon}
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Active method panel ──────────────────────────────── */}

                    {/* Upload from computer — click "Choose files" or drop files here */}
                    {activeDataSourceMethod === 'upload' && (
                        <div
                            style={{
                                border: '1px dashed var(--border-subtle)',
                                borderRadius: 10,
                                padding: '16px 14px',
                                marginBottom: 12,
                                background: 'var(--bg-app)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            {/* AttachFile renders its own old-UI paperclip button; we only
                                want its hidden <input>, so clip the whole thing and drive
                                the input from the "Choose files" button below. Clipped
                                rather than display:none so the programmatic .click() that
                                opens the OS file dialog keeps working. */}
                            <span
                                style={{
                                    position: 'absolute',
                                    width: 1,
                                    height: 1,
                                    overflow: 'hidden',
                                    clip: 'rect(0 0 0 0)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <AttachFile
                                    id={ATTACH_FILE_INPUT_ID}
                                    groupId={undefined}
                                    disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                    onAttach={onAttach}
                                    onSetMetadata={onSetMetadata}
                                    onSetKey={onSetKey}
                                    onUploadProgress={onUploadProgress}
                                    onSetAbortController={onSetAbortController}
                                    disableRag={false}
                                />
                            </span>
                            <IconUpload size={20} style={{ color: 'var(--text-muted)' }} />
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    (document.querySelector('#' + ATTACH_FILE_INPUT_ID) as HTMLInputElement | null)?.click();
                                }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--accent)',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    fontFamily: 'inherit',
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                            >
                                Choose files
                            </button>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                or drag and drop them anywhere in this section
                            </span>
                        </div>
                    )}

                    {/* Browse already-uploaded files (new-UI library picker) */}
                    {activeDataSourceMethod === 'library' && (
                        <DataSourceLibraryPicker
                            attachedIds={dataSources.map((ds) => ds.id)}
                            onSelect={(picked) => {
                                addLibraryFiles(picked);
                                setActiveDataSourceMethod(null);
                            }}
                            onClose={() => setActiveDataSourceMethod(null)}
                        />
                    )}

                    {/* Website URL */}
                    {activeDataSourceMethod === 'website' && featureFlags.websiteUrls && (
                        <div
                            style={{
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 10,
                                padding: '12px 14px',
                                marginBottom: 12,
                                background: 'var(--bg-app)',
                            }}
                        >
                            <WebsiteURLInput
                                onAddURL={(url, isSitemap, maxPages, exclusions) => {
                                    const webType = isSitemap ? 'website/sitemap' : 'website/url';
                                    const websiteSource = {
                                        id: url,
                                        name: url,
                                        type: webType,
                                        metadata: {
                                            scanFrequency: null,
                                            sourceUrl: url,
                                            isSitemap: isSitemap,
                                            ...(maxPages !== undefined && { maxPages }),
                                            ...(exclusions && { exclusions }),
                                        },
                                    };
                                    setDataSources([...dataSources, websiteSource as any]);
                                    setDocumentState({ ...documentState, [url]: 100 });
                                    setWebsiteUrls([
                                        ...websiteUrls,
                                        { url, type: webType, lastScanned: null, ...websiteSource.metadata },
                                    ]);
                                }}
                            />
                        </div>
                    )}

                    {/* OneDrive / SharePoint */}
                    {activeDataSourceMethod === 'drive' && featureFlags.integrations && accessType !== 'collaborative' && (
                        <div
                            style={{
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 10,
                                padding: '12px 14px',
                                marginBottom: 12,
                                background: 'var(--bg-app)',
                            }}
                        >
                            <AssistantDriveDataSources
                                initAssistantDefintion={emptyDefinitionForDrive}
                                selectedDataSources={integrationDataSources ?? {}}
                                onSelectedDataSourcesChange={setIntegrationDataSources}
                                disallowedFileExtensions={COMMON_DISALLOWED_FILE_EXTENSIONS}
                                initRescanSchedule={driveRescanSchedule}
                                onRescanScheduleChange={setDriveRescanSchedule}
                                disableEdit={false}
                            />
                        </div>
                    )}

                </FileDropZone>

                {/* ── Capabilities: Skills · Tools & APIs · Workflow Template ── */}
                {((featureFlags.skills && !!chatEndpoint) || featureFlags.integrations || featureFlags.assistantWorkflows) && (
                    <>
                        <SectionDivider label="Capabilities" />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>

                            {/* Skills */}
                            {featureFlags.skills && chatEndpoint && (
                                <CapabilityCard
                                    icon={<IconBrain size={18} />}
                                    title="Skills"
                                    badge={selectedSkills.length > 0 ? `${selectedSkills.length} selected` : undefined}
                                >
                                    <SkillsSection
                                        chatEndpoint={chatEndpoint}
                                        selectedSkills={selectedSkills}
                                        onSkillsChange={setSelectedSkills}
                                        skillSelectionMode={skillSelectionMode}
                                        onModeChange={setSkillSelectionMode}
                                    />
                                </CapabilityCard>
                            )}

                            {/* Tools & APIs */}
                            {featureFlags.integrations && (
                                <CapabilityCard
                                    icon={<IconPlugConnected size={18} />}
                                    title="Tools & APIs"
                                    badge={
                                        selectedApis.length + builtInAgentTools.length > 0
                                            ? `${selectedApis.length + builtInAgentTools.length} configured`
                                            : undefined
                                    }
                                >
                                    {/*
                                     * flat={true} strips ApiIntegrationsPanel's own "Add Tools"
                                     * toggle button so our CapabilityCard header is the only trigger.
                                     */}
                                    <ApiIntegrationsPanel
                                        availableApis={availableApis}
                                        selectedApis={selectedApis}
                                        setSelectedApis={setSelectedApis}
                                        apiInfo={apiInfo}
                                        setApiInfo={setApiInfo}
                                        availableAgentTools={availableAgentTools}
                                        builtInAgentTools={builtInAgentTools}
                                        setBuiltInAgentTools={setBuiltInAgentTools}
                                        allowConfiguration={true}
                                        pythonFunctionOnSave={() => {
                                            getOpsForUser().then((ops) => {
                                                if (ops.success) filterOps(ops.data);
                                            });
                                        }}
                                        disabled={false}
                                        flat={true}
                                    />
                                </CapabilityCard>
                            )}

                            {/* Workflow Template */}
                            {featureFlags.assistantWorkflows && (
                                <CapabilityCard
                                    icon={<IconTemplate size={18} />}
                                    title="Workflow Template"
                                    badge={baseWorkflowTemplateId ? 'Template selected' : undefined}
                                >
                                    {/*
                                     * AssistantWorkflowSelector manages its own template list fetch
                                     * and renders a <select> dropdown with a "Base Assistant Workflow
                                     * Template" label. Selecting a template sets baseWorkflowTemplateId
                                     * which is written into def.data on save (forces opsLanguageVersion v4).
                                     */}
                                    <AssistantWorkflowSelector
                                        selectedTemplateId={baseWorkflowTemplateId}
                                        onTemplateChange={(id) => setBaseWorkflowTemplateId(id || undefined)}
                                        disabled={false}
                                    />
                                </CapabilityCard>
                            )}

                        </div>
                    </>
                )}

                {/* ── Save error ───────────────────────────────────────────── */}
                {saveError && (
                    <p
                        style={{
                            fontSize: 13,
                            color: '#e05252',
                            background: 'rgba(224,82,82,0.08)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            margin: '0 0 16px',
                        }}
                    >
                        {saveError}
                    </p>
                )}

                {/* ── Advanced Settings inline accordion ───────────────────── */}
                <div
                    style={{
                        marginTop: 8,
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: 16,
                    }}
                >
                    <button
                        onClick={() => setIsAdvancedOpen((v) => !v)}
                        aria-expanded={isAdvancedOpen}
                        aria-controls="advanced-settings-body"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            fontSize: 13,
                            fontWeight: 500,
                            fontFamily: 'inherit',
                            padding: '4px 0',
                            width: '100%',
                            textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                    >
                        {isAdvancedOpen
                            ? <IconChevronDown size={15} stroke={2} />
                            : <IconChevronRight size={15} stroke={2} />}
                        Advanced Settings
                    </button>

                    {/* Accordion body — CSS Grid height animation, no max-height guessing */}
                    <div
                        id="advanced-settings-body"
                        style={{
                            display: 'grid',
                            gridTemplateRows: isAdvancedOpen ? '1fr' : '0fr',
                            transition: 'grid-template-rows 280ms ease-in-out',
                        }}
                    >
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>

                                {/* ── Tags ──────────────────────────────────── */}
                                <div style={fieldGroupStyle}>
                                    <label htmlFor="ast-creation-tags" style={labelStyle}>Tags</label>
                                    <input
                                        id="ast-creation-tags"
                                        type="text"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        placeholder="research, writing, code (comma-separated)"
                                        style={inputStyle}
                                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                                    />
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                        Comma-separated tags that help categorize and find this assistant.
                                    </p>
                                </div>

                                {/* ── Conversation Tags ─────────────────────── */}
                                <div style={fieldGroupStyle}>
                                    <label htmlFor="ast-creation-conv-tags" style={labelStyle}>Conversation Tags</label>
                                    <input
                                        id="ast-creation-conv-tags"
                                        type="text"
                                        value={conversationTags}
                                        onChange={(e) => setConversationTags(e.target.value)}
                                        placeholder="project-x, support (comma-separated)"
                                        style={inputStyle}
                                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                                    />
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                        Tags automatically applied to every conversation created with this assistant.
                                    </p>
                                </div>

                                {/* ── Assistant Type ────────────────────────── */}
                                {featureFlags.integrations && (
                                    <div style={fieldGroupStyle}>
                                        <label htmlFor="ast-ops-language" style={labelStyle}>Assistant Type</label>
                                        <select
                                            id="ast-ops-language"
                                            value={baseWorkflowTemplateId ? 'v4' : opsLanguageVersion}
                                            onChange={(e) => setOpsLanguageVersion(e.target.value)}
                                            disabled={!!baseWorkflowTemplateId}
                                            title={baseWorkflowTemplateId ? 'This assistant is using a workflow template. You cannot change the assistant type.' : ''}
                                            style={{
                                                ...inputStyle,
                                                opacity: baseWorkflowTemplateId ? 0.45 : 1,
                                                cursor: baseWorkflowTemplateId ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            {Object.entries(opLanguageOptionsMap(featureFlags)).map(([val, label]) => (
                                                <option key={val} value={val}>{label as string}</option>
                                            ))}
                                        </select>
                                        {baseWorkflowTemplateId && (
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                Locked to Agent (v4) because a workflow template is selected.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ── Allow Request Access ──────────────────── */}
                                <div
                                    style={{ ...fieldGroupStyle, cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => setAvailableOnRequest((v) => !v)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                            Allow other users to request chat permissions for this assistant
                                        </span>
                                        <ToggleSwitch
                                            checked={availableOnRequest}
                                            onChange={setAvailableOnRequest}
                                            aria-label="Allow other users to request chat permissions for this assistant"
                                        />
                                    </div>
                                </div>

                                {/* ── Data Source Options ───────────────────── */}
                                <div style={fieldGroupStyle}>
                                    <p style={{ ...labelStyle, marginBottom: 10 }}>Data Source Options</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {VISIBLE_DATA_SOURCE_FLAGS.map((flag) => (
                                            <div
                                                key={flag.key}
                                                onClick={() => setDataSourceOptions((prev) => ({ ...prev, [flag.key]: !prev[flag.key] }))}
                                                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '8px 0', cursor: 'pointer', userSelect: 'none' }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{flag.label}</span>
                                                    {flag.description && (
                                                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{flag.description}</p>
                                                    )}
                                                </div>
                                                <ToggleSwitch
                                                    checked={!!dataSourceOptions[flag.key]}
                                                    onChange={(val) => setDataSourceOptions((prev) => ({ ...prev, [flag.key]: val }))}
                                                    aria-label={flag.label}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Message Options ───────────────────────── */}
                                <div style={fieldGroupStyle}>
                                    <p style={{ ...labelStyle, marginBottom: 10 }}>Message Options</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {MESSAGE_OPTION_FLAGS.map((flag) => (
                                            <div
                                                key={flag.key}
                                                onClick={() => setMessageOptions((prev) => ({ ...prev, [flag.key]: !prev[flag.key] }))}
                                                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '8px 0', cursor: 'pointer', userSelect: 'none' }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{flag.label}</span>
                                                    {flag.description && (
                                                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{flag.description}</p>
                                                    )}
                                                </div>
                                                <ToggleSwitch
                                                    checked={!!messageOptions[flag.key]}
                                                    onChange={(val) => setMessageOptions((prev) => ({ ...prev, [flag.key]: val }))}
                                                    aria-label={flag.label}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Feature Options (conditional) ────────── */}
                                {Object.keys(featureOptions).length > 0 && (
                                    <div style={fieldGroupStyle}>
                                        <p style={{ ...labelStyle, marginBottom: 10 }}>Feature Options</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {FEATURE_OPTION_FLAGS.filter((f) => f.key in featureOptions).map((flag) => (
                                                <div
                                                    key={flag.key}
                                                    onClick={() => setFeatureOptions((prev) => ({ ...prev, [flag.key]: !prev[flag.key] }))}
                                                    style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '8px 0', cursor: 'pointer', userSelect: 'none' }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{flag.label}</span>
                                                        {flag.description && (
                                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{flag.description}</p>
                                                        )}
                                                    </div>
                                                    <ToggleSwitch
                                                        checked={!!featureOptions[flag.key]}
                                                        onChange={(val) => setFeatureOptions((prev) => ({ ...prev, [flag.key]: val }))}
                                                        aria-label={flag.label}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── API Options (conditional) ─────────────── */}
                                {featureFlags.assistantApis && Object.keys(apiOptions).length > 0 && (
                                    <div style={fieldGroupStyle}>
                                        <p style={{ ...labelStyle, marginBottom: 10 }}>API Options</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {API_OPTION_FLAGS.filter((f) => f.key in apiOptions).map((flag) => (
                                                <div
                                                    key={flag.key}
                                                    onClick={() => setApiOptions((prev) => ({ ...prev, [flag.key]: !prev[flag.key] }))}
                                                    style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '8px 0', cursor: 'pointer', userSelect: 'none' }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{flag.label}</span>
                                                        {flag.description && (
                                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{flag.description}</p>
                                                        )}
                                                    </div>
                                                    <ToggleSwitch
                                                        checked={!!apiOptions[flag.key]}
                                                        onChange={(val) => setApiOptions((prev) => ({ ...prev, [flag.key]: val }))}
                                                        aria-label={flag.label}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Email Events (gated, non-collaborative) ─ */}
                                {featureFlags.assistantEmailEvents && accessType !== 'collaborative' && (
                                    <div style={fieldGroupStyle}>
                                        <AssistantEmailEvents
                                            assistantId={undefined}
                                            initialEmailEventTag={undefined}
                                            enableEmailEvents={enableEmailEvents}
                                            setEnableEmailEvents={setEnableEmailEvents}
                                            disableEdit={false}
                                            assistantName={name || 'New Assistant'}
                                            emailEventTag={emailEventTag}
                                            setEmailEventTag={setEmailEventTag}
                                            emailEventTemplate={emailEventTemplate}
                                            setEmailEventTemplate={setEmailEventTemplate}
                                            isTagAvailable={isEmailTagAvailable}
                                            setIsTagAvailable={setIsEmailTagAvailable}
                                            isCheckingTag={isCheckingEmailTag}
                                            setIsCheckingTag={setIsCheckingEmailTag}
                                        />
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CreationModalShell>
    );
};

export default NewUIAssistantCreationModal;

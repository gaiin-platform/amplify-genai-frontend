/**
 * NewAdminModal — New-UI two-column admin panel.
 *
 * Visual shell is identical to NewSettingsModal (left rail nav + right scrollable pane).
 * The old AdminUI top-tabs become left-rail nav items.
 * All tab content components are the same (unchanged).
 *
 * Tabs (as left-rail nav items):
 *   Configurations | Supported Models | Application Variables | OpenAI Endpoints
 *   Feature Flags  | Feature Data     | Ops | Embeddings
 *   Integrations (conditional) | Critical Errors (conditional)
 *
 * Entry points (same as before, now opens this modal instead of AdminUI):
 *   - NewSettingsModal "Admin Panel" nav item
 *   - NewSidebar "Admin" nav item
 *   - AccountMenu "Admin Panel" button
 */

import React, {
  FC, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import {
  IconX,
  IconSearch,
  IconRefresh,
  IconAdjustments,
  IconCpu,
  IconVariable,
  IconApi,
  IconFlag,
  IconDatabase,
  IconTerminal2,
  IconActivity,
  IconAlertTriangle,
  IconNetwork,
  IconDeviceFloppy,
  IconCheck,
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import {
  getAdminConfigs, getAvailableModels, getFeatureFlags,
  getPowerPoints, testEmbeddingEndpoint, testEndpoint,
  updateAdminConfigs,
} from '@/services/adminService';
import {
  AdminConfigTypes, Endpoint, FeatureFlagConfig, OpenAIModelsConfig,
  SupportedModel, SupportedModelsConfig, AdminTab, DefaultModelsConfig,
} from '@/types/admin';
import { adminTabHasChanges } from '@/utils/app/admin';
import { LoadingIcon } from '@/components/Loader/LoadingIcon';
import toast from 'react-hot-toast';
import InputsMap from '@/components/ReusableComponents/InputMap';
import { OpDef } from '@/types/op';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';
import { noRateLimit, normalizeRateLimits, RateLimit, RateLimits } from '@/types/rateLimit';
import { OpenAIEndpointsTab } from '@/components/Admin/AdminComponents/OpenAIEndpoints';
import { FeatureFlagsTab } from '@/components/Admin/AdminComponents/FeatureFlags';
import { emptySupportedModel, SupportedModelsTab } from '@/components/Admin/AdminComponents/SupportedModels';
import { ConfigurationsTab } from '@/components/Admin/AdminComponents/Configurations';
import { AdminsCard } from '@/components/NewUI/settings/admin/AdminsCard';
import {
  Integration, IntegrationProviders, integrationProviders, integrationProvidersList,
  IntegrationSecretsMap, IntegrationsMap, ProviderSettingsMap, AdminWebSearchConfig,
} from '@/types/integrations';
import { checkActiveIntegrations } from '@/services/oauthIntegrationsService';
import { IntegrationsTab } from '@/components/Admin/AdminComponents/Integrations';
import { EmbeddingsTab } from '@/components/Admin/AdminComponents/Embeddings';
import { OpsTab } from '@/components/Admin/AdminComponents/Ops';
import { Pptx_TEMPLATES, Ast_Group_Data, FeatureDataTab } from '@/components/Admin/AdminComponents/FeatureData';
import { CriticalErrorTrackingTab } from '@/components/Admin/AdminComponents/Critical_Error_Tracking';
import {
  Amplify_Groups,
  PromptCostAlert, EmailSupport, CriticalErrorsConfig,
} from '@/components/Admin/AdminUI';
import { ConversationStorage } from '@/types/conversationStorage';

// ── helpers re-exported from AdminUI ─────────────────────────────────────────

export const loadingIcon = (size: number = 16) => (
  <LoadingIcon style={{ width: `${size}px`, height: `${size}px` }} />
);

export const loadingState = (
  <div className="flex flex-row gap-2 ml-10 text-[1.2rem]" style={{ color: 'var(--text-muted)' }}>
    <>{loadingIcon(22)}</> Loading...
  </div>
);

// ── Nav definition ────────────────────────────────────────────────────────────

interface AdminNavItem {
  id: AdminTab;
  label: string;
  Icon: FC<{ size?: number; stroke?: number }>;
}

const BASE_ADMIN_TABS: AdminNavItem[] = [
  { id: 'Configurations',       label: 'Configurations',       Icon: IconAdjustments },
  { id: 'Supported Models',     label: 'Supported Models',     Icon: IconCpu },
  { id: 'Application Variables',label: 'Application Variables',Icon: IconVariable },
  { id: 'OpenAi Endpoints',     label: 'OpenAI Endpoints',     Icon: IconApi },
  { id: 'Feature Flags',        label: 'Feature Flags',        Icon: IconFlag },
  { id: 'Feature Data',         label: 'Feature Data',         Icon: IconDatabase },
  { id: 'Ops',                  label: 'Ops',                  Icon: IconTerminal2 },
  { id: 'Embeddings',           label: 'Embeddings',           Icon: IconActivity },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NewAdminModalProps {
  onClose: () => void;
  openToTab?: AdminTab;
}

// ── Left-rail nav row ─────────────────────────────────────────────────────────

interface NavRowProps {
  item: AdminNavItem;
  isSelected: boolean;
  hasChanges: boolean;
  onClick: () => void;
}

const NavRow: FC<NavRowProps> = ({ item, isSelected, hasChanges, onClick }) => {
  const { Icon } = item;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        height: '36px',
        padding: '0 8px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: isSelected ? 500 : 400,
        background: isSelected ? 'var(--bg-active)' : 'transparent',
        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        textAlign: 'left',
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      <Icon size={16} stroke={1.5} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {hasChanges && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            flexShrink: 0,
          }}
          title="Unsaved changes"
        />
      )}
    </button>
  );
};

// ── Main modal ────────────────────────────────────────────────────────────────

export const NewAdminModal: FC<NewAdminModalProps> = ({ onClose, openToTab }) => {
  const {
    state: { statsService, storageSelection, amplifyUsers, featureFlags },
    dispatch: homeDispatch,
    setLoadingMessage,
  } = useContext(HomeContext);

  // ── Loading / data state ──────────────────────────────────────────────────
  const [loadData, setLoadData]               = useState(true);
  const [stillLoadingData, setStillLoadingData] = useState(true);
  const [activeTab, setActiveTab]             = useState<AdminTab>(openToTab ?? 'Configurations');
  const [searchQuery, setSearchQuery]         = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Unsaved changes ───────────────────────────────────────────────────────
  const [unsavedConfigs, setUnsavedConfigs]   = useState<Set<AdminConfigTypes>>(new Set());
  const updateUnsavedConfigs = (type: AdminConfigTypes) =>
    setUnsavedConfigs((prev) => new Set(prev).add(type));

  // ── Admin data ────────────────────────────────────────────────────────────
  const [admins, setAdmins]               = useState<string[]>([]);
  const [allEmails, setAllEmails]         = useState<string[] | null>(null);
  const [rateLimits, setRateLimits]       = useState<RateLimits>([]);
  const [honorPersonalRateLimit, setHonorPersonalRateLimit] =
    useState<{ enabled: boolean; scope?: 'both' | 'apiKey' | 'amplifyAccount' }>({ enabled: false });
  const [promptCostAlert, setPromptCostAlert]   = useState<PromptCostAlert>({ isActive: false, alertMessage: '', cost: 0 });
  const [emailSupport, setEmailSupport]         = useState<EmailSupport>({ isActive: false, email: '' });
  const [criticalErrorsConfig, setCriticalErrorsConfig] =
    useState<CriticalErrorsConfig>({ isActive: false, email: '' });
  const [aiEmailDomain, setAiEmailDomain]       = useState<string>('');
  const [defaultConversationStorage, setDefaultConversationStorage] =
    useState<ConversationStorage>('future-local');
  const [availableModels, setAvailableModels]   = useState<SupportedModelsConfig>({});
  const [defaultModels, setDefaultModels]       = useState<DefaultModelsConfig>({
    user: '', advanced: '', cheapest: '', agent: '', documentCaching: '', embeddings: '',
  });
  const [features, setFeatures]                 = useState<FeatureFlagConfig>({});
  const [appVars, setAppVars]                   = useState<{ [key: string]: string }>({});
  const [appSecrets, setAppSecrets]             = useState<{ [key: string]: string }>({});
  const [userDocumentationUrl, setUserDocumentationUrl] = useState<string>('');
  const [defaultTimezone, setDefaultTimezone]   = useState<string>('America/Chicago');
  const [smartMessagesEnabled, setSmartMessagesEnabled] = useState<boolean>(false);
  const [refreshingTypes, setRefreshingTypes]   = useState<AdminConfigTypes[]>([]);
  const [openAiEndpoints, setOpenAiEndpoints]   = useState<OpenAIModelsConfig>({ models: [] });
  const testEndpointsRef = useRef<{ url: string; key: string; model: string }[]>([]);
  const [ops, setOps]                           = useState<OpDef[]>([]);
  const [astGroups, setAstGroups]               = useState<Ast_Group_Data[]>([]);
  const [changedAstGroups, setChangedAstGroups] = useState<string[]>([]);
  const [amplifyAstGroupId, setAmplifyAstGroupId] = useState<string>('');
  const [templates, setTemplates]               = useState<Pptx_TEMPLATES[]>([]);
  const [changedTemplates, setChangedTemplates] = useState<string[]>([]);
  const [ampGroups, setAmpGroups]               = useState<Amplify_Groups>({});
  const [integrations, setIntegrations]         = useState<IntegrationsMap | null>(null);
  const [integrationSecrets, setIntegrationSecrets] = useState<IntegrationSecretsMap>({});
  const [providerSettings, setProviderSettings] = useState<ProviderSettingsMap>({});
  const [webSearchConfig, setWebSearchConfig]   = useState<AdminWebSearchConfig | null>(null);
  const [hasChildModalOpen, setHasChildModalOpen] = useState<boolean>(false);

  // ── Tab list (dynamic, based on loaded data) ──────────────────────────────
  const tabs: AdminNavItem[] = [
    ...BASE_ADMIN_TABS,
    ...(integrations || featureFlags.webSearch || features.webSearch?.enabled
      ? [{ id: 'Integrations' as AdminTab, label: 'Integrations', Icon: IconNetwork }]
      : []),
    ...(featureFlags.criticalErrorTracking || features.criticalErrorTracking?.enabled
      ? [{ id: 'Critical Errors' as AdminTab, label: 'Critical Errors', Icon: IconAlertTriangle }]
      : []),
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isAvailableCheck = (isAvailable: boolean, handleClick: () => void, styling: string = '') => (
    <button
      title={isAvailable ? 'Click to set as unavailable' : 'Click to set as available'}
      className={`cursor-pointer ${styling}`}
      style={{ color: 'var(--text-primary)' }}
      onClick={handleClick}
    >
      {isAvailable
        ? <IconCheck className="text-green-500 hover:opacity-60" size={18} />
        : <IconX className="text-red-500 hover:opacity-60" size={18} />}
    </button>
  );

  const refresh = (
    type: AdminConfigTypes,
    click: () => void,
    loading: boolean,
    title: string = 'Refresh Variables',
    top: string = 'mt-1',
  ) => (
    <button
      title={title}
      disabled={refreshingTypes.includes(type)}
      className={`${top} py-1.5 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-white transition-colors duration-200 ${
        refreshingTypes.includes(type) ? '' : 'cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10'
      }`}
      onClick={() => {
        setRefreshingTypes([...refreshingTypes, type]);
        click();
      }}
    >
      {refreshingTypes.includes(type) ? <>{loadingIcon()}</> : <IconRefresh size={16} />}
    </button>
  );

  const admin_text =
    'rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50';

  // ── Integrations ──────────────────────────────────────────────────────────
  const mergeIntegrationLists = (
    supported: Integration[] | undefined,
    base: Integration[] | undefined,
  ): Integration[] => {
    if (!supported) return base || [];
    if (!base) return [];
    const lookup = new Map(supported.map((i) => [i.id, i]));
    return base.map((i: Integration) => lookup.get(i.id) ?? i);
  };

  const getActiveIntegrations = async (supported: IntegrationsMap | null) => {
    const result = await checkActiveIntegrations(integrationProvidersList);
    const map: IntegrationsMap = result.integrationLists;
    if (supported) {
      Object.keys(map).forEach((k) => {
        const key = k as IntegrationProviders;
        map[key] = mergeIntegrationLists(supported[key], map[key]);
      });
    }
    if (Object.keys(map).length > 0) {
      setIntegrations(map);
      setIntegrationSecrets(result.secrets);
    }
  };

  useEffect(() => {
    if (!stillLoadingData && !integrations && Object.keys(features).includes('integrations')) {
      getActiveIntegrations(null);
    }
  }, [features]);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const getConfigs = async () => {
      setLoadData(false);
      setLoadingMessage('Loading Admin Interface…');
      setStillLoadingData(true);
      const nonlazyReq = getAdminConfigs();
      const lazyResult = await getAdminConfigs(true);

      if (lazyResult.success) {
        const d = lazyResult.data;
        setAdmins(d[AdminConfigTypes.ADMINS] || []);
        const featureData = d[AdminConfigTypes.FEATURE_FLAGS];
        setFeatures(featureData || {});

        if (Object.keys(featureData).includes('integrations')) {
          const intData = d[AdminConfigTypes.INTEGRATIONS];
          if (intData) {
            const intList = intData.integrations || intData;
            let provSet = intData.provider_settings || {};
            Object.keys(intList).forEach((p) => {
              if (p === integrationProviders.Microsoft) {
                if (!provSet[p]) provSet[p] = {};
                if (provSet[p].azure_admin_consent_provided === undefined)
                  provSet[p].azure_admin_consent_provided = false;
              }
            });
            getActiveIntegrations(intList);
            setProviderSettings(provSet);
          }
        }

        setAmpGroups(d[AdminConfigTypes.AMPLIFY_GROUPS] || {});
        setTemplates(d[AdminConfigTypes.PPTX_TEMPLATES] || []);
        const rlc = d[AdminConfigTypes.RATE_LIMIT];
        if (rlc && typeof rlc === 'object' && 'limits' in rlc) {
          setRateLimits(normalizeRateLimits(rlc.limits));
          const rawHonor = rlc.honorPersonalRateLimit;
          if (rawHonor && typeof rawHonor === 'object' && 'enabled' in rawHonor)
            setHonorPersonalRateLimit(rawHonor);
          else if (typeof rawHonor === 'boolean')
            setHonorPersonalRateLimit({ enabled: rawHonor });
          else setHonorPersonalRateLimit({ enabled: false });
        } else {
          setRateLimits(normalizeRateLimits(rlc));
          setHonorPersonalRateLimit({ enabled: false });
        }
        setPromptCostAlert(d[AdminConfigTypes.PROMPT_COST_ALERT] || promptCostAlert);
        setDefaultConversationStorage(d[AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE] || defaultConversationStorage);
        setEmailSupport(d[AdminConfigTypes.EMAIL_SUPPORT] || emailSupport);
        setCriticalErrorsConfig(d[AdminConfigTypes.CRITICAL_ERRORS] || criticalErrorsConfig);
        setAiEmailDomain(d[AdminConfigTypes.AI_EMAIL_DOMAIN] || aiEmailDomain);
        setDefaultModels(d[AdminConfigTypes.DEFAULT_MODELS] || {});
        setWebSearchConfig(d[AdminConfigTypes.WEB_SEARCH] || null);
        setUserDocumentationUrl(d[AdminConfigTypes.USER_DOCUMENTATION_URL] || '');
        setDefaultTimezone(d[AdminConfigTypes.DEFAULT_TIMEZONE] || 'America/Chicago');
        setSmartMessagesEnabled(d[AdminConfigTypes.DEFAULT_SMART_MESSAGES] ?? false);
        setLoadingMessage('');

        const nonlazyResult = await nonlazyReq;
        if (nonlazyResult.success) {
          const nd = nonlazyResult.data;
          setAppVars(nd[AdminConfigTypes.APP_VARS] || {});
          setAppSecrets(nd[AdminConfigTypes.APP_SECRETS] || {});
          const opsData: OpDef[] = nd[AdminConfigTypes.OPS] || [];
          setOps(opsData.sort((a: OpDef, b: OpDef) => a.name.localeCompare(b.name)));
          setOpenAiEndpoints(nd[AdminConfigTypes.OPENAI_ENDPOINTS] || { models: [] });
          const am = nd[AdminConfigTypes.AVAILABLE_MODELS] || {};
          const base = emptySupportedModel();
          const updated = Object.entries(am).map(([k, m]) => {
            const up = Object.fromEntries(
              Object.entries(m as SupportedModel).map(([p, v]) => [p, v === null ? base[p as keyof SupportedModel] : v]),
            );
            return [k, up];
          });
          setAvailableModels(Object.fromEntries(updated));
          const astAdminGroups: Ast_Group_Data[] = nd[AdminConfigTypes.AST_ADMIN_GROUPS] || [];
          const amplifyAstGroupFound = astAdminGroups.find((g: Ast_Group_Data) =>
            g.groupName === AMPLIFY_ASSISTANTS_GROUP_NAME,
          );
          if (amplifyAstGroupFound) setAmplifyAstGroupId(amplifyAstGroupFound.group_id);
          setAstGroups(astAdminGroups);
          setStillLoadingData(false);
          return;
        }
      }
      alert('Unable to fetch admin configurations at this time. Please try again.');
      setLoadingMessage('');
      onClose();
    };

    if (loadData) getConfigs();
    if (!allEmails) setAllEmails(Object.values(amplifyUsers));
  }, [loadData]);

  // ── Keyboard / overlay close + focus trap ────────────────────────────────
  useEffect(() => {
    // Move focus into the modal on open
    panelRef.current?.focus();

    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !hasChildModalOpen) {
        if (unsavedConfigs.size === 0 ||
          confirm('You have unsaved changes!\n\nYou will lose any unsaved data. Close anyway?')) {
          onClose();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[aria-hidden="true"]'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, hasChildModalOpen, unsavedConfigs]);

  // Scroll to top on tab change
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeTab]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || hasChildModalOpen) return;
      if (unsavedConfigs.size === 0 ||
        confirm('You have unsaved changes!\n\nYou will lose any unsaved data. Close anyway?')) {
        onClose();
      }
    },
    [onClose, hasChildModalOpen, unsavedConfigs],
  );

  // ── getConfigTypeData (identical logic to AdminUI) ────────────────────────
  const getConfigTypeData = (type: AdminConfigTypes) => {
    switch (type) {
      case AdminConfigTypes.ADMINS:
        return admins;
      case AdminConfigTypes.RATE_LIMIT:
        return { limits: rateLimits, honorPersonalRateLimit };
      case AdminConfigTypes.PROMPT_COST_ALERT:
        return {
          ...promptCostAlert,
          cost: typeof promptCostAlert.cost === 'string'
            ? parseFloat(promptCostAlert.cost as string) || 0
            : Number(promptCostAlert.cost) || 0,
        };
      case AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE:
        return defaultConversationStorage;
      case AdminConfigTypes.EMAIL_SUPPORT:
        return emailSupport;
      case AdminConfigTypes.CRITICAL_ERRORS: {
        const isActive = Boolean(criticalErrorsConfig.isActive);
        return { isActive, email: isActive ? String(criticalErrorsConfig.email || '') : '' };
      }
      case AdminConfigTypes.AI_EMAIL_DOMAIN:
        return aiEmailDomain;
      case AdminConfigTypes.APP_SECRETS:
        return appSecrets;
      case AdminConfigTypes.APP_VARS:
        return appVars;
      case AdminConfigTypes.FEATURE_FLAGS:
        return features;
      case AdminConfigTypes.AVAILABLE_MODELS: {
        const sanitized: SupportedModelsConfig = {};
        Object.entries(availableModels).forEach(([k, m]) => {
          const s = { ...m } as SupportedModel;
          (['inputContextWindow', 'outputTokenLimit'] as const).forEach((f) => {
            (s as any)[f] = typeof m[f] === 'string' ? parseInt(String(m[f]), 10) || 0 : (m[f] as number) || 0;
          });
          (['outputTokenCost', 'inputTokenCost', 'inputCachedTokenCost', 'inputWriteCachedTokenCost'] as const).forEach((f) => {
            (s as any)[f] = typeof m[f] === 'string' ? parseFloat(String(m[f])) || 0.0 : (m[f] as number) || 0.0;
          });
          (['supportsImages', 'supportsReasoning', 'supportsSystemPrompts', 'supportsImageGeneration', 'supportsVideo', 'isAvailable', 'isBuiltIn'] as const).forEach((f) => {
            (s as any)[f] = Boolean(m[f]);
          });
          (['id', 'name', 'provider', 'description', 'systemPrompt'] as const).forEach((f) => {
            (s as any)[f] = String(m[f] || '');
          });
          s.exclusiveGroupAvailability = Array.isArray(m.exclusiveGroupAvailability)
            ? m.exclusiveGroupAvailability : [];
          sanitized[k] = s;
        });
        return sanitized;
      }
      case AdminConfigTypes.DEFAULT_MODELS: {
        const d: any = { ...defaultModels };
        Object.keys(d).forEach((k) => { if (d[k] === '') d[k] = null; });
        return d;
      }
      case AdminConfigTypes.AST_ADMIN_GROUPS:
        return astGroups
          .filter((g: Ast_Group_Data) => changedAstGroups.includes(g.group_id))
          .map((g: Ast_Group_Data) => ({
            group_id: g.group_id, isPublic: g.isPublic,
            amplifyGroups: g.amplifyGroups, supportConvAnalysis: g.supportConvAnalysis,
          }));
      case AdminConfigTypes.AMPLIFY_GROUPS: {
        const ag = { ...ampGroups };
        Object.keys(ag).forEach((k) => {
          if (!ag[k].isBillingGroup) ag[k].isBillingGroup = false;
          if (!ag[k].rateLimit) ag[k].rateLimit = [noRateLimit];
          else ag[k].rateLimit = normalizeRateLimits(ag[k].rateLimit as any);
          delete ag[k].groupName;
        });
        return ag;
      }
      case AdminConfigTypes.PPTX_TEMPLATES:
        return templates.filter((p: Pptx_TEMPLATES) => changedTemplates.includes(p.name));
      case AdminConfigTypes.INTEGRATIONS:
        return { integrations, provider_settings: providerSettings };
      case AdminConfigTypes.WEB_SEARCH: {
        if (!webSearchConfig) return null;
        const cfg: any = { allowUserWebSearchKeys: webSearchConfig.allowUserWebSearchKeys };
        if (webSearchConfig.provider) cfg.provider = webSearchConfig.provider;
        if ('api_key' in webSearchConfig && webSearchConfig.api_key) cfg.api_key = webSearchConfig.api_key;
        const acFields = [
          'bedrockAgentCoreGatewayUrl', 'bedrockAgentCoreAuthMode', 'bedrockAgentCoreRegion',
          'bedrockAgentCoreTokenUrl', 'bedrockAgentCoreClientId', 'bedrockAgentCoreScope',
          'bedrockAgentCoreToolName',
        ] as const;
        acFields.forEach((f) => {
          const v = (webSearchConfig as any)[f];
          if (typeof v === 'string' && v.trim()) cfg[f] = v.trim();
        });
        if (webSearchConfig.webSearchUserMessage?.trim())
          cfg.webSearchUserMessage = webSearchConfig.webSearchUserMessage.trim();
        return cfg;
      }
      case AdminConfigTypes.USER_DOCUMENTATION_URL:
        return userDocumentationUrl;
      case AdminConfigTypes.DEFAULT_TIMEZONE:
        return defaultTimezone;
      case AdminConfigTypes.DEFAULT_SMART_MESSAGES:
        return smartMessagesEnabled;
      case AdminConfigTypes.OPENAI_ENDPOINTS: {
        const toTest: { key: string; url: string; model: string }[] = [];
        const orig = new Set<string>();
        openAiEndpoints.models.forEach((m) => Object.keys(m).forEach((n) => orig.add(n)));
        const cleaned: OpenAIModelsConfig = {
          models: openAiEndpoints.models.map((m) => {
            const nm: Record<string, { endpoints: Endpoint[] }> = {};
            Object.keys(m).forEach((n) => {
              const eps = m[n].endpoints.filter((ep) => ep.url !== '' && ep.key !== '').map((ep) => {
                const { isNew, ...rest } = ep;
                if (isNew) toTest.push({ ...rest, model: n });
                return rest;
              });
              if (eps.length > 0) nm[n] = { endpoints: eps };
            });
            return nm;
          }).filter((m) => Object.keys(m).length > 0),
        };
        const cleaned2 = new Set<string>();
        cleaned.models.forEach((m) => Object.keys(m).forEach((n) => cleaned2.add(n)));
        orig.forEach((n) => { if (!cleaned2.has(n)) toast(`Removed ${n} (no endpoints configured)`); });
        setOpenAiEndpoints(cleaned);
        if (toTest.length > 0) testEndpointsRef.current = toTest;
        return cleaned;
      }
    }
  };

  // ── Validate + Save ───────────────────────────────────────────────────────
  const validateSavedData = () => {
    const models = Object.values(availableModels);
    if (models.filter((m: SupportedModel) => m.isAvailable && !m.id.includes('embedding')).length === 0)
      alert("No models are available. Update models under 'Supported Models' to enable chat.");
    if (Object.keys(defaultModels).some((k) => defaultModels[k as keyof DefaultModelsConfig] === '' && k !== 'agent')) {
      alert("Ensure all default models are set in the 'Supported Models' tab.");
      return false;
    }
    if (emailSupport.isActive && !emailSupport.email) {
      alert('Support Email requires an email address. Please add one or disable the feature.');
      return false;
    }
    if (criticalErrorsConfig.isActive && !criticalErrorsConfig.email) {
      alert('Critical Error Notifications require an email address. Please add one or disable the feature.');
      return false;
    }
    return true;
  };

  const processUrl = (url: string) => (url.endsWith('/') ? url : `${url}/`);

  const callTestEndpoints = async () => {
    for (const ep of testEndpointsRef.current) {
      const label = `Url: ${ep.url}\nKey: ${ep.key}`;
      setLoadingMessage(`Testing Endpoint:\n${label}`);
      let result: any = null;
      if (ep.model.includes('embed')) {
        const url = processUrl(ep.url);
        result = await testEmbeddingEndpoint(
          `${url}openai/deployments/${ep.model}/embeddings?api-version=2024-02-01`, ep.key,
        );
      } else {
        result = await testEndpoint(ep.url, ep.key, ep.model);
      }
      if (!result) {
        alert(`Failed to contact new endpoint:\n${label}\n\nCheck endpoint data and try again.`);
        setLoadingMessage('');
        return false;
      }
    }
    return true;
  };

  const updateOnSave = () => {
    const act = (types: AdminConfigTypes[], fn: () => void) => {
      if (types.some((t) => unsavedConfigs.has(t))) fn();
    };
    act([AdminConfigTypes.FEATURE_FLAGS], async () => {
      const r = await getFeatureFlags();
      if (r.success && r.data) {
        homeDispatch({ field: 'featureFlags', value: r.data });
        localStorage.setItem('mixPanelOn', JSON.stringify(r.data.mixPanel ?? false));
        window.dispatchEvent(new Event('updateFeatureSettings'));
      }
    });
    act([AdminConfigTypes.AVAILABLE_MODELS, AdminConfigTypes.DEFAULT_MODELS], async () => {
      const r = await getAvailableModels();
      if (r.success && r.data && r.data.models.length > 0) {
        const dm = r.data.default;
        const models = r.data.models;
        if (dm) homeDispatch({ field: 'defaultModelId', value: dm.id });
        if (r.data.cheapest) homeDispatch({ field: 'cheapestModelId', value: r.data.cheapest.id });
        if (r.data.advanced) homeDispatch({ field: 'advancedModelId', value: r.data.advanced.id });
        homeDispatch({ field: 'availableModels', value: models.reduce((a: any, m: any) => ({ ...a, [m.id]: m }), {}) });
        localStorage.setItem('defaultModel', JSON.stringify(dm));
      }
    });
    act([AdminConfigTypes.PPTX_TEMPLATES], async () => {
      const r = await getPowerPoints();
      const pptx = r.success && r.data ? r.data
        : templates.filter((p: Pptx_TEMPLATES) => p.isAvailable).map((p: Pptx_TEMPLATES) => p.name);
      homeDispatch({ field: 'powerPointTemplateOptions', value: pptx });
    });
    act([AdminConfigTypes.EMAIL_SUPPORT], () =>
      homeDispatch({ field: 'supportEmail', value: emailSupport.email }));
    act([AdminConfigTypes.AI_EMAIL_DOMAIN], () =>
      homeDispatch({ field: 'aiEmailDomain', value: aiEmailDomain }));
    act([AdminConfigTypes.PROMPT_COST_ALERT], () =>
      homeDispatch({ field: 'promptCostAlert', value: promptCostAlert }));
    act([AdminConfigTypes.WEB_SEARCH], () => {
      homeDispatch({ field: 'canAddWebSearchApiKey', value: webSearchConfig?.allowUserWebSearchKeys ?? false });
      homeDispatch({ field: 'webSearchUserMessage', value: webSearchConfig?.webSearchUserMessage?.trim() ?? null });
    });
    act([AdminConfigTypes.USER_DOCUMENTATION_URL], () =>
      homeDispatch({ field: 'userDocumentationUrl', value: userDocumentationUrl }));
    act([AdminConfigTypes.DEFAULT_SMART_MESSAGES], () =>
      homeDispatch({ field: 'featureFlags', value: { ...featureFlags, smartMessages: smartMessagesEnabled } }));
    act([AdminConfigTypes.RATE_LIMIT], () => {
      homeDispatch({ field: 'adminRateLimits', value: rateLimits });
      homeDispatch({ field: 'honorPersonalRateLimit', value: honorPersonalRateLimit });
    });
    if (!storageSelection)
      act([AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE], () =>
        homeDispatch({ field: 'storageSelection', value: defaultConversationStorage }));
  };

  const handleSave = async () => {
    if (unsavedConfigs.size === 0) { toast('No changes to save'); return; }
    const payload = Array.from(unsavedConfigs).map((t) => ({ type: t, data: getConfigTypeData(t) }));
    if (!validateSavedData()) return;
    if (testEndpointsRef.current.length > 0) {
      setLoadingMessage('Testing new endpoints…');
      const ok = await callTestEndpoints();
      if (!ok) {
        setLoadingMessage('');
        if (!confirm('Continue applying changes anyway?')) return;
      }
    }
    setLoadingMessage('Saving configurations…');
    const result = await updateAdminConfigs(payload);
    if (result.success) {
      if (result.data?.[AdminConfigTypes.ADMINS]?.error) {
        toast(`Admin config warning: ${result.data[AdminConfigTypes.ADMINS].error}`, { icon: '⚠️', duration: 5000 });
      }
      updateOnSave();
      toast('Configurations saved');
      setUnsavedConfigs(new Set());
      testEndpointsRef.current = [];
    } else {
      if (result.data && Object.keys(result.data).length !== unsavedConfigs.size) {
        const failed = Array.from(unsavedConfigs).filter((k) => !(k in result.data) || !result.data[k].success);
        if (failed.length > 0) alert(`Failed to save: ${failed.join(', ')}`);
      } else {
        alert('Unable to save configurations at this time. Please try again.');
      }
    }
    setLoadingMessage('');
  };

  // ── Tab label helper ──────────────────────────────────────────────────────
  const tabHasChanges = (tab: AdminTab) =>
    adminTabHasChanges(Array.from(unsavedConfigs), tab);

  // ── Filtered tabs ─────────────────────────────────────────────────────────
  const filteredTabs = searchQuery.trim()
    ? tabs.filter((t) => t.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : tabs;

  // ── Tab content ───────────────────────────────────────────────────────────
  const renderContent = () => {
    if (stillLoadingData && activeTab !== 'Feature Flags' && activeTab !== 'Configurations') {
      return loadingState;
    }
    switch (activeTab) {
      case 'Configurations':
        return (
          /* AdminsCard renders the new-UI admins section above ConfigurationsTab.
             The original admins card inside ConfigurationsTab is hidden via CSS:
               [data-new-ui-admin-content="true"] .admin-style-settings-card:has(#csvUploadButton)
             so both never show at the same time. */
          <>
            <AdminsCard
              admins={admins}
              setAdmins={setAdmins}
              amplifyUsers={amplifyUsers}
              allEmails={allEmails}
              updateUnsavedConfigs={updateUnsavedConfigs}
              onModalStateChange={setHasChildModalOpen}
            />
            <ConfigurationsTab
              admins={admins}
              setAdmins={setAdmins}
              ampGroups={ampGroups}
              setAmpGroups={setAmpGroups}
              amplifyUsers={amplifyUsers}
              rateLimits={rateLimits}
              setRateLimits={setRateLimits}
              honorPersonalRateLimit={honorPersonalRateLimit}
              setHonorPersonalRateLimit={setHonorPersonalRateLimit}
              promptCostAlert={promptCostAlert}
              setPromptCostAlert={setPromptCostAlert}
              defaultConversationStorage={defaultConversationStorage}
              setDefaultConversationStorage={setDefaultConversationStorage}
              emailSupport={emailSupport}
              setEmailSupport={setEmailSupport}
              aiEmailDomain={aiEmailDomain}
              setAiEmailDomain={featureFlags.assistantEmailEvents ? setAiEmailDomain : undefined}
              defaultTimezone={defaultTimezone}
              setDefaultTimezone={setDefaultTimezone}
              smartMessagesEnabled={smartMessagesEnabled}
              setSmartMessagesEnabled={setSmartMessagesEnabled}
              features={features}
              allEmails={allEmails}
              admin_text={admin_text}
              updateUnsavedConfigs={updateUnsavedConfigs}
              onModalStateChange={setHasChildModalOpen}
            />
          </>
        );
      case 'Supported Models':
        return stillLoadingData ? loadingState : (
          <SupportedModelsTab
            availableModels={availableModels}
            setAvailableModels={setAvailableModels}
            defaultModels={defaultModels}
            setDefaultModels={setDefaultModels}
            ampGroups={ampGroups}
            isAvailableCheck={isAvailableCheck}
            updateUnsavedConfigs={updateUnsavedConfigs}
            featureFlags={features}
          />
        );
      case 'Application Variables':
        return stillLoadingData ? loadingState : (
          <div className="flex flex-col gap-6">
            {/* App Secrets */}
            <div className="admin-style-settings-card">
              <div className="admin-style-settings-card-header">
                <div className="flex flex-row items-center gap-3 mb-2">
                  <h3 className="admin-style-settings-card-title">Application Secrets</h3>
                </div>
                <p className="admin-style-settings-card-description">
                  Manage sensitive application configuration secrets
                </p>
              </div>
              {Object.keys(appSecrets).length > 0 ? (
                <div className="mx-4">
                  <InputsMap
                    id={AdminConfigTypes.APP_SECRETS}
                    inputs={Object.keys(appSecrets).sort((a, b) => b.length - a.length)
                      .map((s) => ({ label: s, key: s }))}
                    state={appSecrets}
                    inputChanged={(key: string, value: string) => {
                      setAppSecrets({ ...appSecrets, [key]: value });
                      updateUnsavedConfigs(AdminConfigTypes.APP_SECRETS);
                    }}
                    obscure
                  />
                </div>
              ) : <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 16px' }}>No application secrets retrieved</div>}
            </div>

            {/* App Vars */}
            <div className="admin-style-settings-card">
              <div className="admin-style-settings-card-header">
                <div className="flex flex-row items-center gap-3 mb-2">
                  <h3 className="admin-style-settings-card-title">Application Environment Variables</h3>
                </div>
                <p className="admin-style-settings-card-description">
                  Configure application environment variables and settings
                </p>
              </div>
              {Object.keys(appVars).length > 0 ? (
                <div className="mx-4 truncate">
                  <InputsMap
                    id={AdminConfigTypes.APP_VARS}
                    inputs={Object.keys(appVars).sort((a, b) => b.length - a.length)
                      .map((s) => ({ label: s, key: s }))}
                    state={appVars}
                    inputChanged={(key: string, value: string) => {
                      setAppVars({ ...appVars, [key]: value });
                      updateUnsavedConfigs(AdminConfigTypes.APP_VARS);
                    }}
                    obscure
                  />
                </div>
              ) : <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 16px' }}>No application variables retrieved</div>}
            </div>

            {/* User Documentation URL */}
            <div className="admin-style-settings-card">
              <div className="admin-style-settings-card-header">
                <div className="flex flex-row items-center gap-3 mb-2">
                  <h3 className="admin-style-settings-card-title">User Documentation URL</h3>
                </div>
                <p className="admin-style-settings-card-description">
                  Configure the URL for user documentation
                </p>
              </div>
              <div className="mx-4">
                <input
                  type="text"
                  placeholder="https://your-documentation-url.com"
                  value={userDocumentationUrl}
                  onChange={(e) => {
                    setUserDocumentationUrl(e.target.value);
                    updateUnsavedConfigs(AdminConfigTypes.USER_DOCUMENTATION_URL);
                  }}
                  className="w-full rounded border border-neutral-500 px-4 py-2 dark:bg-[#40414F] dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                />
              </div>
            </div>
          </div>
        );
      case 'OpenAi Endpoints':
        return stillLoadingData ? loadingState : (
          <OpenAIEndpointsTab
            openAiEndpoints={openAiEndpoints}
            setOpenAiEndpoints={setOpenAiEndpoints}
            updateUnsavedConfigs={updateUnsavedConfigs}
          />
        );
      case 'Feature Flags':
        return (
          <FeatureFlagsTab
            features={features}
            setFeatures={setFeatures}
            ampGroups={ampGroups}
            amplifyUsers={amplifyUsers}
            allEmails={allEmails}
            admin_text={admin_text}
            updateUnsavedConfigs={updateUnsavedConfigs}
          />
        );
      case 'Feature Data':
        return (
          <FeatureDataTab
            stillLoadingData={stillLoadingData}
            admins={admins}
            ampGroups={ampGroups}
            amplifyUsers={amplifyUsers}
            astGroups={astGroups}
            setAstGroups={setAstGroups}
            amplifyAstGroupId={amplifyAstGroupId}
            setAmplifyAstGroupId={setAmplifyAstGroupId}
            changedAstGroups={changedAstGroups}
            setChangedAstGroups={setChangedAstGroups}
            templates={templates}
            setTemplates={setTemplates}
            changedTemplates={changedTemplates}
            setChangedTemplates={setChangedTemplates}
            isAvailableCheck={isAvailableCheck}
            admin_text={admin_text}
            updateUnsavedConfigs={updateUnsavedConfigs}
          />
        );
      case 'Ops':
        return stillLoadingData ? loadingState : (
          <OpsTab ops={ops} setOps={setOps} admin_text={admin_text} />
        );
      case 'Embeddings':
        return (
          <EmbeddingsTab
            refresh={refresh}
            refreshingTypes={refreshingTypes}
            setRefreshingTypes={setRefreshingTypes}
          />
        );
      case 'Critical Errors':
        return (
          <CriticalErrorTrackingTab
            stillLoadingData={stillLoadingData}
            criticalErrorsConfig={criticalErrorsConfig}
            setCriticalErrorsConfig={setCriticalErrorsConfig}
            updateUnsavedConfigs={updateUnsavedConfigs}
          />
        );
      case 'Integrations':
        return stillLoadingData ? loadingState : (
          <IntegrationsTab
            integrations={integrations}
            setIntegrations={setIntegrations}
            integrationSecrets={integrationSecrets}
            setIntegrationSecrets={setIntegrationSecrets}
            azureAdminConsentProvided={providerSettings[integrationProviders.Microsoft]?.azure_admin_consent_provided || false}
            setAzureAdminConsentProvided={(value: boolean) => {
              setProviderSettings({
                ...providerSettings,
                [integrationProviders.Microsoft]: {
                  ...providerSettings[integrationProviders.Microsoft],
                  azure_admin_consent_provided: value,
                },
              });
              updateUnsavedConfigs(AdminConfigTypes.INTEGRATIONS);
            }}
            updateUnsavedConfigs={updateUnsavedConfigs}
            webSearchConfig={webSearchConfig}
            setWebSearchConfig={(config: AdminWebSearchConfig | null) => {
              setWebSearchConfig(config);
              updateUnsavedConfigs(AdminConfigTypes.WEB_SEARCH);
            }}
          />
        );
      default:
        return (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px' }}>
            Select a section from the left rail.
          </div>
        );
    }
  };

  const activeTabItem = tabs.find((t) => t.id === activeTab);
  const totalChanges = unsavedConfigs.size;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Modal panel */}
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          height: 'min(820px, 90dvh)',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gridTemplateRows: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          outline: 'none',
        }}
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-heading"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left Rail ───────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* Header area */}
          <div style={{ padding: '14px 10px 8px', flexShrink: 0 }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 4px' }}>
              <span
                id="admin-modal-heading"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  flex: 1,
                }}
              >
                Admin Panel
              </span>
              {totalChanges > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(217,119,87,0.15)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}
                >
                  {totalChanges} unsaved
                </span>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '4px' }}>
              <IconSearch
                size={13}
                style={{
                  position: 'absolute', left: '9px', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', height: '32px',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '0 10px 0 26px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Nav items — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px', overscrollBehavior: 'contain' }}>
            {filteredTabs.map((tab) => (
              <NavRow
                key={tab.id}
                item={tab}
                isSelected={activeTab === tab.id}
                hasChanges={tabHasChanges(tab.id)}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          {/* Footer: reload + save */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* Reload */}
            <button
              onClick={() => {
                if (unsavedConfigs.size === 0 ||
                  confirm('Reload will discard unsaved changes. Continue?')) {
                  setLoadData(true);
                  setUnsavedConfigs(new Set());
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', height: '32px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
              title={unsavedConfigs.size > 0 ? 'Reload — unsaved changes will be lost' : 'Reload admin data'}
            >
              <IconRefresh size={13} />
              Reload
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={totalChanges === 0 || stillLoadingData}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', height: '34px',
                background: totalChanges > 0 && !stillLoadingData
                  ? 'var(--accent)' : 'var(--bg-raised)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: totalChanges > 0 && !stillLoadingData ? '#fff' : 'var(--text-muted)',
                cursor: totalChanges > 0 && !stillLoadingData ? 'pointer' : 'default',
                transition: 'background 0.15s, color 0.15s, opacity 0.15s',
                opacity: totalChanges === 0 ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (totalChanges > 0 && !stillLoadingData)
                  (e.currentTarget as HTMLElement).style.opacity = '0.88';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = totalChanges === 0 ? '0.5' : '1';
              }}
              title={stillLoadingData ? 'Still loading data…' : undefined}
            >
              <IconDeviceFloppy size={14} />
              {stillLoadingData ? 'Still loading…' : totalChanges > 0 ? `Save ${totalChanges} change${totalChanges > 1 ? 's' : ''}` : 'Save changes'}
            </button>
          </div>
        </div>

        {/* ── Right Content Pane ───────────────────────────────────────────── */}
        {/* text-neutral-900 dark:text-white establishes the default inherited text color for all
            admin tab components — matching the old AdminUI wrapper so they all render correctly. */}
        <div
          className="text-neutral-900 dark:text-white"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header row — [Section Title .............. ×]
              flexShrink:0 keeps it fixed while the content below scrolls. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px 16px 24px',
              flexShrink: 0,
            }}
          >
            {/* Section heading */}
            <h2
              style={{
                fontSize: '18px', fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {activeTabItem?.label ?? activeTab}
              {tabHasChanges(activeTab) && (
                <span style={{ fontSize: '13px', color: 'var(--accent)', marginLeft: '8px', fontWeight: 500 }}>
                  ● unsaved
                </span>
              )}
            </h2>

            <button
              onClick={() => {
                if (unsavedConfigs.size === 0 ||
                  confirm('You have unsaved changes!\n\nClose anyway?')) {
                  onClose();
                }
              }}
              aria-label="Close"
              style={{
                flexShrink: 0,
                width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }}
            >
              <IconX size={20} stroke={2} />
            </button>
          </div>

          {/* Scrollable content area — sits below the fixed header row */}
          <div
            ref={contentRef}
            data-new-ui-admin-content="true"
            style={{
              flex: 1,
              minHeight: 0,
              padding: '0 24px 40px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {/* Tab content */}
            <React.Suspense fallback={<div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</div>}>
              {renderContent()}
            </React.Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAdminModal;

/**
 * NewApiKeysSection — Settings → API Access.
 *
 * Replaces the legacy `Settings/AccountComponents/ApiKeys.tsx` render in the New UI. That
 * component queued per-field edits for a `settingsSave` window event which only the classic
 * settings dialog ever fires, so in the New UI edits were never sent. Here every card saves
 * itself (see `apiKeys/ApiKeyCard`), and the create flow and the rotate flow share
 * `shared/OneTimeSecretReveal` for the shown-once key.
 *
 * Services and payloads are unchanged: fetchAllApiKeys, createApiKey, updateApiKeys,
 * rotateApiKey, deactivateApiKey, getUserMtdCosts.
 *
 * Reports "leaving would lose something" (uncopied key / unsaved edits) to the modal through
 * `onLeaveGuardChange`.
 *
 * Location: components/NewUI/settings/NewApiKeysSection.tsx
 */

import React, { FC, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { IconChevronDown, IconLoader2, IconPlus } from '@tabler/icons-react';
import HomeContext from '@/components/Home/home.context';
import { Account, noCoaAccount } from '@/types/accounts';
import { ApiKey } from '@/types/apikeys';
import { UNLIMITED, PeriodType } from '@/types/rateLimit';
import { createApiKey, fetchAllApiKeys } from '@/services/apiKeysService';
import { getUserMtdCosts } from '@/services/mtdCostService';
import { getUserIdentifier } from '@/utils/app/data';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { NewUILoadingStatus } from '@/components/NewUI/shared/NewUILoadingStatus';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { EmailChipsInput } from '@/components/NewUI/shared/EmailChipsInput';
import { SignInRequiredNote } from '@/components/NewUI/shared/SignInRequiredNote';
import { resolveUsernameForEmail } from '@/components/NewUI/shared/emailSuggestions';
import {
  CheckboxControl,
  FieldError,
  SelectControl,
  TextAreaControl,
  TextControl,
} from '@/components/NewUI/shared/FormControls';
import { OneTimeSecretReveal, useOneTimeSecret } from '@/components/NewUI/shared/OneTimeSecretReveal';
import { ApiKeyCard, CardGuardKind } from './apiKeys/ApiKeyCard';
import { AccessTypesField } from './apiKeys/AccessTypesField';
import { ApiKeysIntro, BILLING_CALLOUT_ID } from './apiKeys/ApiKeysIntro';
import { btnPrimary, btnSecondary } from './apiKeys/buttonStyles';
import {
  KeySort,
  RATE_PERIOD_OPTIONS,
  KeyStatusFilter,
  buildRateLimit,
  draftAccessTypes,
  emptyDraft,
  filterAndSortKeys,
  formatAccount,
  isCreateFormDirty,
  formatPurpose,
  minExpirationDate,
  mtdCostForKey,
  setFullAccess,
  setNoExpiration,
  toggleAccessType,
  validateCreate,
} from './apiKeys/apiKeyModel';
import { LeaveGuard, UNSAVED_KEY_EDITS_GUARD, UNSAVED_KEY_GUARD } from './leaveGuard';

export interface NewApiKeysSectionProps {
  accounts: Account[];
  defaultAccount: Account;
  onLeaveGuardChange: (guard: LeaveGuard | null) => void;
}

// Elevated surface: sits on the page background (--bg-app) as a white card with a subtle border.
const cardShell: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };

const STATUS_FILTER_ITEMS = [
  { id: 'All', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Inactive', label: 'Inactive' },
];

// ── Key list (used for both "Your keys" and "Delegated to you") ──────────────
// No outer container: the cards sit directly on the page background.

const KeyList: FC<{
  title: string;
  description: string;
  emptyText: string;
  keys: ApiKey[];
  showPurposeFilter?: boolean;
  /** Primary action at the right of the title row (e.g. "Create key"). */
  action?: ReactNode;
  renderCard: (key: ApiKey) => ReactNode;
}> = ({ title, description, emptyText, keys, showPurposeFilter = false, action, renderCard }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<KeyStatusFilter>('All');
  // 'status' = active keys first, then the rest by name (until the user picks a sort).
  const [sort, setSort] = useState<KeySort>('status');
  const [purpose, setPurpose] = useState('All');

  const purposes = useMemo(
    () => ['All', ...Array.from(new Set(keys.filter((k) => k.purpose).map((k) => k.purpose as string)))],
    [keys],
  );
  const visible = useMemo(
    () => filterAndSortKeys(keys, { search, status, sort, purpose: showPurposeFilter ? purpose : 'All' }),
    [keys, search, status, sort, purpose, showPurposeFilter],
  );

  return (
    <section aria-label={title}>
      {/* Title row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{description}</p>
        </div>
        {action}
      </div>

      {/* One toolbar row; wraps on narrow widths */}
      {keys.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 14 }}>
          <div style={{ flex: '1 1 220px', minWidth: 180, maxWidth: 320 }}>
            <SearchInput
              fullWidth
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              aria-label={`Search ${title.toLowerCase()}`}
            />
          </div>
          {/* The shared control is full-width with equal segments; a fixed wrapper sizes it to its content. */}
          <div style={{ flex: 'none', width: 216 }}>
            <SegmentedControl
              aria-label="Filter by status"
              items={STATUS_FILTER_ITEMS}
              value={status}
              onChange={(id) => setStatus(id as KeyStatusFilter)}
            />
          </div>
          {showPurposeFilter && purposes.length > 1 && (
            <div style={{ flex: 'none', width: 150 }}>
              <SelectControl
                aria-label="Filter by key type"
                value={purpose}
                style={{ height: 34 }}
                onChange={(e) => setPurpose(e.target.value)}
              >
                {purposes.map((p) => (
                  <option key={p} value={p}>
                    {p === 'All' ? 'All types' : formatPurpose(p)}
                  </option>
                ))}
              </SelectControl>
            </div>
          )}
          <div style={{ flex: 'none', width: 170 }}>
            <SelectControl
              aria-label="Sort keys"
              value={sort}
              style={{ height: 34 }}
              onChange={(e) => setSort(e.target.value as KeySort)}
            >
              <option value="status">Sort: Active first</option>
              <option value="name">Sort: Name</option>
              <option value="lastAccessed">Sort: Last used</option>
              <option value="expiration">Sort: Expiration</option>
            </SelectControl>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {keys.length === 0 ? (
          <p style={{ margin: 0, padding: '12px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            {emptyText}
          </p>
        ) : visible.length === 0 ? (
          <p style={{ margin: 0, padding: '12px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No keys match your filters.
          </p>
        ) : (
          visible.map((key) => <React.Fragment key={key.api_owner_id}>{renderCard(key)}</React.Fragment>)
        )}
      </div>
    </section>
  );
};

// ── Section ──────────────────────────────────────────────────────────────────

export const NewApiKeysSection: FC<NewApiKeysSectionProps> = ({ accounts, defaultAccount, onLeaveGuardChange }) => {
  const {
    state: { statsService, amplifyUsers },
  } = useContext(HomeContext);
  const { data: session } = useSession();
  const userId = getUserIdentifier(session?.user);
  const userEmail = session?.user?.email ?? undefined;

  const validAccounts = useMemo(() => accounts.filter((a) => a.id !== noCoaAccount.id), [accounts]);
  // A billing account is a real entry from the accounts service; the "No COA On File" placeholder
  // doesn't count. (The parent only renders this section once the accounts have loaded.)
  const hasBillingAccount = validAccounts.length > 0;

  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [mtd, setMtd] = useState<any>(null);

  const displayName = (id: string) => (amplifyUsers && amplifyUsers[id]) || id;

  // ── load ──
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    fetchAllApiKeys()
      .then((result: any) => {
        if (cancelled) return;
        if (!result?.success) setLoadError(true);
        else setKeys(Array.isArray(result.data) ? result.data : []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    let cancelled = false;
    getUserMtdCosts()
      .then((result: any) => {
        if (!cancelled && result?.success && result.data) setMtd(result.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // ── leave guard aggregation ──
  const [guards, setGuards] = useState<Record<string, CardGuardKind>>({});
  const handleGuardChange = useCallback((id: string, kind: CardGuardKind) => {
    setGuards((prev) => {
      if ((prev[id] ?? null) === kind) return prev;
      const next = { ...prev };
      if (kind) next[id] = kind;
      else delete next[id];
      return next;
    });
  }, []);

  const created = useOneTimeSecret();
  const guardValues = Object.values(guards);
  const aggregate: CardGuardKind =
    created.needsConfirm || guardValues.includes('key') ? 'key' : guardValues.includes('edits') ? 'edits' : null;
  useEffect(() => {
    onLeaveGuardChange(aggregate === 'key' ? UNSAVED_KEY_GUARD : aggregate === 'edits' ? UNSAVED_KEY_EDITS_GUARD : null);
  }, [aggregate, onLeaveGuardChange]);
  useEffect(() => () => onLeaveGuardChange(null), [onLeaveGuardChange]);

  // beforeunload while a key is uncopied / edits are unsaved
  useEffect(() => {
    if (!aggregate) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [aggregate]);

  // ── list mutations ──
  const replaceKey = useCallback(
    (next: ApiKey) => setKeys((prev) => prev && prev.map((k) => (k.api_owner_id === next.api_owner_id ? next : k))),
    [],
  );
  const markDeactivated = useCallback(
    (id: string) =>
      setKeys((prev) => prev && prev.map((k) => (k.api_owner_id === id ? { ...k, active: false } : k))),
    [],
  );
  const markRotated = useCallback(
    (id: string) =>
      setKeys((prev) => prev && prev.map((k) => (k.api_owner_id === id ? { ...k, needs_rotation: false } : k))),
    [],
  );

  const ownerKeys = useMemo(() => (keys ?? []).filter((k) => k.owner === userId), [keys, userId]);
  const delegatedKeys = useMemo(() => (keys ?? []).filter((k) => k.delegate === userId), [keys, userId]);

  const renderCard = (key: ApiKey) => (
    <ApiKeyCard
      apiKey={key}
      userId={userId}
      accounts={validAccounts}
      ownerLabel={displayName(key.owner)}
      delegateLabel={key.delegate ? displayName(key.delegate) : undefined}
      mtdCost={mtdCostForKey(mtd, key)}
      onUpdated={replaceKey}
      onDeactivated={markDeactivated}
      onRotated={markRotated}
      onGuardChange={handleGuardChange}
    />
  );

  // ── create form ──
  const initialAccountId = (defaultAccount.id !== noCoaAccount.id ? defaultAccount.id : validAccounts[0]?.id) ?? '';
  const [createOpen, setCreateOpen] = useState(false);
  const createSectionRef = useRef<HTMLElement>(null);
  // "Create key" in the list header: open the form, bring it into view, focus the name field.
  const openCreate = () => {
    setCreateOpen(true);
    requestAnimationFrame(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      createSectionRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      document.getElementById('nui-key-name')?.focus({ preventScroll: true });
    });
  };
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState(() => emptyDraft(initialAccountId));
  const [delegate, setDelegate] = useState<string[]>([]);
  const [showDelegate, setShowDelegate] = useState(false);
  const [systemUse, setSystemUse] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createErrors = validateCreate({
    name,
    accountSelected: !!validAccounts.find((a) => a.id === draft.accountId),
    ratePeriod: draft.ratePeriod,
    rateAmount: draft.rateAmount,
    includeExpiration: !draft.noExpiration,
    expirationDate: draft.expirationDate,
    fullAccess: draft.fullAccess,
    selectedTypes: draftAccessTypes(draft),
  });
  const err = (field: keyof typeof createErrors) => (attempted ? createErrors[field] : undefined);

  const resetCreateForm = () => {
    setName('');
    setDescription('');
    setDraft(emptyDraft(initialAccountId));
    setDelegate([]);
    setShowDelegate(false);
    setSystemUse(false);
    setAttempted(false);
    setCreateError(null);
  };

  // Has the user entered anything? (Anything that differs from a freshly opened form.)
  const createDirty = isCreateFormDirty({ name, description, delegate, systemUse, draft }, initialAccountId);
  const [pendingDiscardCreate, setPendingDiscardCreate] = useState(false);

  const closeCreate = (restoreFocus: boolean) => {
    resetCreateForm();
    setCreateOpen(false);
    // The focused Cancel button unmounts with the form; hand focus back to the header button.
    if (restoreFocus) requestAnimationFrame(() => document.getElementById('nui-open-create')?.focus());
  };
  /** Cancel / the collapse chevron: confirm first when there is something to lose. */
  const requestCloseCreate = (restoreFocus: boolean) => {
    if (creating) return;
    if (createDirty) setPendingDiscardCreate(true);
    else closeCreate(restoreFocus);
  };

  const handleCreate = async () => {
    if (creating) return;
    setAttempted(true);
    if (Object.keys(createErrors).length > 0) return;
    const account = validAccounts.find((a) => a.id === draft.accountId);
    if (!account) return;

    const delegateEmail = delegate[0] ?? '';
    const data = {
      owner: userId,
      account,
      delegate: delegateEmail ? resolveUsernameForEmail(delegateEmail, amplifyUsers) : null,
      appName: name.trim(),
      appDescription: description,
      rateLimit: buildRateLimit(draft.ratePeriod, draft.rateAmount),
      expirationDate: draft.noExpiration ? null : draft.expirationDate,
      accessTypes: draftAccessTypes(draft),
      systemUse: systemUse && !delegateEmail,
    };

    setCreating(true);
    setCreateError(null);
    try {
      const result: any = await createApiKey(data);
      if (!result?.success || !(result.data?.apiKey || result.data?.delegate)) {
        setCreateError(result?.message || 'Unable to create the API key at this time.');
        return;
      }
      statsService?.createApiKeyEvent?.(data);
      if (result.data.apiKey && !result.data.delegate) {
        created.show(result.data.apiKey);
        toast.success('API key created');
      } else {
        toast.success('Delegated key created — the delegate needs to rotate it to get their key.');
      }
      resetCreateForm();
      setCreateOpen(false);
      setLoadAttempt((n) => n + 1); // pull in the new key
    } catch {
      setCreateError('Unable to create the API key at this time.');
    } finally {
      setCreating(false);
    }
  };

  // ── render ──
  if (!keys && !loadError) {
    return <NewUILoadingStatus open message="Loading API keys…" variant="inline" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary)' }}>
      {/* Intro: page-level description, no card */}
      <ApiKeysIntro
        hasBillingAccount={hasBillingAccount}
        onOpenAccountSettings={() =>
          window.dispatchEvent(new CustomEvent('openNewUISettingsSection', { detail: { section: 'account' } }))
        }
      />

      {/* Shown-once key from creation */}
      {created.secret !== null && (
        <>
          {created.dialog}
          <OneTimeSecretReveal
            secret={created.secret}
            copied={created.copied}
            onCopied={created.markCopied}
            onDone={created.requestDone}
          />
        </>
      )}

      {/* Create */}
      <ConfirmDialog
        isOpen={pendingDiscardCreate}
        title="Discard this new key?"
        message="You've started filling in a new API key. If you cancel now, what you entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onCancel={() => setPendingDiscardCreate(false)}
        onConfirm={() => {
          setPendingDiscardCreate(false);
          closeCreate(true);
        }}
      />
      <section ref={createSectionRef} aria-label="Create API key" style={cardShell}>
        <button
          type="button"
          aria-expanded={createOpen}
          aria-controls="nui-create-key-panel"
          onClick={() => (createOpen ? requestCloseCreate(false) : openCreate())}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
            background: 'transparent',
            border: 0,
            borderRadius: 12,
            textAlign: 'left',
            cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>Create API key</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)' }}>
              Fill in the details to generate a new key.
            </span>
          </span>
          <IconChevronDown
            size={18}
            aria-hidden="true"
            style={{ color: 'var(--text-muted)', transform: createOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          />
        </button>

        {createOpen && (
          <div id="nui-create-key-panel" style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--border-subtle)' }}>
            {validAccounts.length === 0 && (
              <div
                role="status"
                style={{
                  margin: '14px 0 0',
                  padding: '10px 12px',
                  fontSize: 13,
                  color: 'var(--warning-fg)',
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 8,
                }}
              >
                No billing accounts found. Add an account in Account settings before creating a key.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 24px', marginTop: 16 }}>
              <div>
                <label htmlFor="nui-key-name" style={labelStyle}>Application name</label>
                <TextControl
                  id="nui-key-name"
                  value={name}
                  invalid={!!err('name')}
                  aria-describedby="nui-key-name-err"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nightly report job"
                />
                <FieldError id="nui-key-name-err">{err('name')}</FieldError>
              </div>
              <div>
                <label htmlFor="nui-key-account" style={labelStyle}>Bill to</label>
                <SelectControl
                  id="nui-key-account"
                  value={draft.accountId}
                  invalid={!!err('account')}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
                >
                  {validAccounts.length === 0 && <option value="">No accounts</option>}
                  {validAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatAccount(a)}
                    </option>
                  ))}
                </SelectControl>
                <FieldError id="nui-key-account-err">{err('account')}</FieldError>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="nui-key-desc" style={labelStyle}>Description (optional)</label>
                <TextAreaControl
                  id="nui-key-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will this key be used for?"
                />
              </div>

              <div>
                <label htmlFor="nui-key-rate" style={labelStyle}>Rate limit</label>
                <SelectControl
                  id="nui-key-rate"
                  value={draft.ratePeriod}
                  onChange={(e) => setDraft({ ...draft, ratePeriod: e.target.value as PeriodType })}
                >
                  {RATE_PERIOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectControl>
                {draft.ratePeriod !== UNLIMITED && (
                  <div style={{ marginTop: 8 }}>
                    <TextControl
                      aria-label="Rate limit amount in dollars"
                      inputMode="decimal"
                      placeholder="$0.00"
                      value={draft.rateAmount}
                      invalid={!!err('rateLimit')}
                      onChange={(e) => setDraft({ ...draft, rateAmount: e.target.value })}
                    />
                  </div>
                )}
                <FieldError id="nui-key-rate-err">{err('rateLimit')}</FieldError>
              </div>

              <div>
                <label htmlFor="nui-key-exp" style={labelStyle}>Expiration</label>
                {draft.noExpiration ? (
                  <TextControl id="nui-key-exp" type="text" value="" placeholder="No expiration" disabled readOnly />
                ) : (
                  <TextControl
                    id="nui-key-exp"
                    type="date"
                    min={minExpirationDate()}
                    value={draft.expirationDate}
                    invalid={!!err('expirationDate')}
                    onChange={(e) => setDraft({ ...draft, expirationDate: e.target.value })}
                  />
                )}
                <div style={{ marginTop: 8 }}>
                  <CheckboxControl
                    id="nui-key-noexp"
                    label="No expiration"
                    checked={draft.noExpiration}
                    onChange={(checked) => setDraft(setNoExpiration(draft, checked))}
                  />
                </div>
                <FieldError id="nui-key-exp-err">{err('expirationDate')}</FieldError>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <AccessTypesField
                  idPrefix="nui-create-access"
                  fullAccess={draft.fullAccess}
                  access={draft.access}
                  error={err('accessTypes')}
                  onFullAccessChange={(checked) => setDraft(setFullAccess(draft, checked))}
                  onToggle={(type) => setDraft(toggleAccessType(draft, type))}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                {!showDelegate ? (
                  <button
                    type="button"
                    onClick={() => setShowDelegate(true)}
                    className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] text-[13px] border border-[--border-subtle] text-[--text-secondary] hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                  >
                    <IconPlus size={14} aria-hidden="true" /> Add delegate
                  </button>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ ...labelStyle, marginBottom: 4 }}>Delegate</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDelegate(false);
                          setDelegate([]);
                        }}
                        className="text-[12px] underline text-[--text-muted] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] rounded-sm"
                      >
                        Remove delegate
                      </button>
                    </div>
                    <EmailChipsInput
                      selected={delegate}
                      onChange={(emails) => setDelegate(emails.slice(-1))}
                      currentUserEmail={userEmail}
                      placeholder="Search or type their email…"
                      placeholderWithSelection="Replace delegate…"
                      ariaLabel="Delegate email"
                    />
                    <SignInRequiredNote action="delegate" />
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <CheckboxControl
                    id="nui-key-system"
                    label="For system use (not tied to any individual user)"
                    checked={systemUse && delegate.length === 0}
                    disabled={delegate.length > 0}
                    onChange={setSystemUse}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <div role="alert" style={{ fontSize: 13, color: 'var(--text-error)', flex: 1, minWidth: 160 }}>{createError}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={btnSecondary} disabled={creating} onClick={() => requestCloseCreate(true)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={creating || validAccounts.length === 0}
                  aria-busy={creating}
                  onClick={handleCreate}
                >
                  {creating ? (
                    <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />
                  ) : (
                    <IconPlus size={15} aria-hidden="true" />
                  )}
                  {creating ? 'Creating…' : 'Create key'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {loadError && (
        <div role="alert" style={{ ...cardShell, padding: 16, color: 'var(--text-error)', fontSize: 13 }}>
          Unable to load your API keys.{' '}
          <button
            type="button"
            onClick={() => setLoadAttempt((n) => n + 1)}
            className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] rounded-sm"
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      )}

      {keys && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <KeyList
            title="Your API keys"
            description="Keys you own. Open a key to view or edit its details."
            emptyText="You don't have any API keys yet. Create one to get started."
            keys={ownerKeys}
            showPurposeFilter
            // The form has its own "Create key" submit button, so hide this one while the form is
            // open — and while a just-created key is still on screen (creating another would
            // replace the shown-once key before it was copied).
            action={
              createOpen || created.secret !== null ? null : (
                // Without a billing account the button stays focusable (aria-disabled, not `disabled`,
                // which would also swallow the hover that shows the tooltip) but does nothing.
                <button
                  id="nui-open-create"
                  type="button"
                  className={`${btnPrimary}${hasBillingAccount ? '' : ' opacity-50 hover:opacity-50 cursor-not-allowed'}`}
                  aria-disabled={!hasBillingAccount}
                  aria-describedby={hasBillingAccount ? undefined : BILLING_CALLOUT_ID}
                  title={hasBillingAccount ? undefined : 'Add a billing account in Account settings to create a key.'}
                  onClick={hasBillingAccount ? openCreate : undefined}
                >
                  <IconPlus size={15} aria-hidden="true" />
                  Create key
                </button>
              )
            }
            renderCard={renderCard}
          />
          <KeyList
            title="Delegated to you"
            description="Keys created by others and assigned to you. Billing goes to the key owner's account."
            emptyText="No keys have been delegated to you."
            keys={delegatedKeys}
            renderCard={renderCard}
          />
        </div>
      )}
    </div>
  );
};

export default NewApiKeysSection;

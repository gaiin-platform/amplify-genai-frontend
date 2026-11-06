/**
 * ApiKeyCard — one API key in Settings → API Access.
 *
 *   header      the whole row is the expand button: name · meta line (account, delegate,
 *               last used, cost) · one status pill (Active / Expired / Inactive)
 *   details     a read-only grid (view) that switches, all at once, to real form controls (edit);
 *               both modes share one grid so the columns don't move
 *   key section rotate / deactivate, and the shown-once reveal after a rotation
 *
 * Edit state is per card. Save sends ONE `/keys/update` request carrying only the changed
 * fields (the backend applies them atomically, so a key either saves or doesn't — there is no
 * partial per-field failure to report). Escape cancels. Collapsing the card — or, through
 * `onGuardChange`, leaving Settings — while there are unsaved edits or an uncopied key asks first.
 *
 * Replaces the legacy `Label`/`RotateApiKey`/`NewApiKey` in Settings/AccountComponents/ApiKeys.tsx,
 * which queued edits for a `settingsSave` event the New UI never fires (so nothing was saved).
 *
 * Location: components/NewUI/settings/apiKeys/ApiKeyCard.tsx
 */

import React, { FC, ReactNode, useContext, useEffect, useId, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconPencil,
  IconRefresh,
  IconUsers,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import HomeContext from '@/components/Home/home.context';
import { ApiKey } from '@/types/apikeys';
import { Account } from '@/types/accounts';
import { UNLIMITED, PeriodType } from '@/types/rateLimit';
import { deactivateApiKey } from '@/services/apiKeysService';
import { formatDateYMDToMDY } from '@/utils/app/date';
import { formatCurrency } from '@/utils/app/data';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { DisclosureChevron } from '@/components/NewUI/shared/DisclosureChevron';
import {
  CheckboxControl,
  FieldError,
  SelectControl,
  TextControl,
} from '@/components/NewUI/shared/FormControls';
import { OneTimeSecretReveal, useOneTimeSecret } from '@/components/NewUI/shared/OneTimeSecretReveal';
import {
  ApiKeyDraft,
  DraftErrors,
  KeyStatus,
  RATE_PERIOD_OPTIONS,
  UNTITLED_KEY,
  accessChips,
  canRotateKey,
  describeLastUsed,
  describeRateLimit,
  diffDraft,
  draftFromKey,
  editBlockReason,
  formatAccount,
  formatTimestamp,
  getCreatedAt,
  hasKeyName,
  isDraftDirty,
  keyDisplayName,
  keyStatus,
  minExpirationDate,
  setFullAccess,
  setNoExpiration,
  toggleAccessType,
  validateDraft,
} from './apiKeyModel';
import { AccessTypesField } from './AccessTypesField';
import { rotateKey, saveKeyUpdates } from './apiKeyActions';
import { btnGhostDanger, btnPrimary, btnSecondary } from './buttonStyles';

export type CardGuardKind = 'key' | 'edits' | null;

export interface ApiKeyCardProps {
  apiKey: ApiKey;
  /** The signed-in user's identifier (compared against owner / delegate). */
  userId: string | null;
  /** Billing accounts a key can be moved to (the "no COA" placeholder already removed). */
  accounts: Account[];
  /** Display text for the owner (delegated view) and delegate (owner view). */
  ownerLabel?: string;
  delegateLabel?: string;
  /** Month-to-date cost for this key, if known. */
  mtdCost: number | null;
  onUpdated: (key: ApiKey) => void;
  onDeactivated: (id: string) => void;
  onRotated: (id: string) => void;
  /** Tells the Settings modal whether leaving now would discard something. */
  onGuardChange: (id: string, kind: CardGuardKind) => void;
  /** Start expanded (tests; and a freshly rotated key). */
  defaultOpen?: boolean;
}

const REASON_COPY: Record<'delegated' | 'inactive' | 'expired', string> = {
  delegated: 'Read only — only the key owner can edit it.',
  inactive: "This key was deactivated. Deactivated keys can't be edited or reactivated.",
  expired: "This key has expired, so it can't be edited or rotated. Create a new key to replace it.",
};

const STATUS_LABEL: Record<KeyStatus, string> = { active: 'Active', expired: 'Expired', inactive: 'Inactive' };

const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
const valueStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' };
// auto-FILL (not auto-fit): the track count must not depend on how many fields a mode shows,
// or switching view ⇄ edit would move the columns.
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '16px 24px',
};
const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 };
const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 24,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

const Chip: FC<{ children: ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 24,
      padding: '0 10px',
      fontSize: 12,
      color: 'var(--text-secondary)',
      background: 'var(--bg-active)',
      borderRadius: 999,
    }}
  >
    {children}
  </span>
);

const Dot = () => (
  <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
    ·
  </span>
);

/** A read-only cell. `semantic` = inside the view-mode <dl>; edit mode uses plain divs. */
const ReadCell: FC<{ label: string; children: ReactNode; wide?: boolean; semantic: boolean }> = ({
  label,
  children,
  wide,
  semantic,
}) =>
  semantic ? (
    <div style={wide ? fullRow : undefined}>
      <dt style={labelStyle}>{label}</dt>
      <dd style={{ ...valueStyle, ...(wide ? { display: 'flex', flexWrap: 'wrap', gap: 6 } : null) }}>{children}</dd>
    </div>
  ) : (
    <div style={wide ? fullRow : undefined}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{children}</div>
    </div>
  );

export const ApiKeyCard: FC<ApiKeyCardProps> = ({
  apiKey,
  userId,
  accounts,
  ownerLabel,
  delegateLabel,
  mtdCost,
  onUpdated,
  onDeactivated,
  onRotated,
  onGuardChange,
  defaultOpen = false,
}) => {
  const {
    state: { statsService },
  } = useContext(HomeContext);
  const uid = useId();
  const id = apiKey.api_owner_id;
  const ids = {
    header: `${uid}-header`,
    panel: `${uid}-panel`,
    account: `${uid}-account`,
    expiration: `${uid}-expiration`,
    rate: `${uid}-rate`,
    full: `${uid}-full`,
  };

  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ApiKeyDraft>(() => draftFromKey(apiKey));
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<null | (() => void)>(null);

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const oneTime = useOneTimeSecret();

  const editButtonRef = useRef<HTMLButtonElement>(null);
  const firstFieldFocus = useRef(false);

  const isOwnerView = apiKey.owner === userId;
  const blockReason = editBlockReason(apiKey, userId);
  const canEdit = !blockReason;
  const status = keyStatus(apiKey);
  const expired = status === 'expired';
  const name = keyDisplayName(apiKey);
  const lastUsed = describeLastUsed(apiKey);
  const createdAt = getCreatedAt(apiKey);
  const rotatable = canRotateKey(apiKey, userId);
  const deactivatable = status === 'active' && (apiKey.owner === userId || apiKey.delegate === userId);
  const accountOptions =
    apiKey.account && !accounts.some((a) => a.id === apiKey.account!.id)
      ? [apiKey.account, ...accounts]
      : accounts;

  const dirty = editing && isDraftDirty(apiKey, draft, accountOptions);
  const errors: DraftErrors = editing ? validateDraft(apiKey, draft, accountOptions) : {};
  const showError = (field: keyof DraftErrors) =>
    (attempted || touched[field]) && errors[field] ? errors[field] : undefined;

  // Tell the modal whether leaving would lose something.
  const guardKind: CardGuardKind = oneTime.needsConfirm ? 'key' : dirty ? 'edits' : null;
  useEffect(() => {
    onGuardChange(id, guardKind);
  }, [id, guardKind, onGuardChange]);
  useEffect(() => () => onGuardChange(id, null), [id, onGuardChange]);

  // Move focus into the form when edit mode opens, and back to the button when it closes.
  useEffect(() => {
    if (editing && firstFieldFocus.current) {
      firstFieldFocus.current = false;
      document.getElementById(ids.account)?.focus();
    }
  }, [editing, ids.account]);

  const startEditing = () => {
    setDraft(draftFromKey(apiKey));
    setAttempted(false);
    setTouched({});
    setSaveError(null);
    firstFieldFocus.current = true;
    setEditing(true);
  };

  const stopEditing = (refocus: boolean) => {
    setEditing(false);
    setAttempted(false);
    setTouched({});
    setSaveError(null);
    setDraft(draftFromKey(apiKey));
    if (refocus) requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  /** Run `action` after the uncopied-key and unsaved-edit checks. */
  const requestLeave = (action: () => void) => {
    oneTime.guard(() => {
      if (dirty) setPendingDiscard(() => action);
      else action();
    });
  };

  const toggleOpen = () => {
    if (!open) {
      setOpen(true);
      return;
    }
    requestLeave(() => {
      stopEditing(false);
      setOpen(false);
    });
  };

  const focusFirstInvalid = () => {
    const order: Array<[keyof DraftErrors, string]> = [
      ['account', ids.account],
      ['expirationDate', ids.expiration],
      ['rateLimit', ids.rate],
      ['accessTypes', ids.full],
    ];
    const hit = order.find(([field]) => errors[field]);
    if (hit) document.getElementById(hit[1])?.focus();
  };

  const handleSave = async () => {
    if (saving) return;
    setAttempted(true);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid();
      return;
    }
    const updates = diffDraft(apiKey, draft, accountOptions);
    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    setSaveError(null);
    const outcome = await saveKeyUpdates(apiKey, updates);
    setSaving(false);
    if (!outcome.ok) {
      setSaveError(outcome.message);
      return;
    }
    statsService?.updateApiKeyEvent?.(outcome.payload);
    onUpdated(outcome.key);
    setEditing(false);
    setAttempted(false);
    setTouched({});
    requestAnimationFrame(() => editButtonRef.current?.focus());
    toast.success('API key updated');
  };

  const handleRotate = async () => {
    setConfirmRotate(false);
    setRotating(true);
    setRotateError(null);
    const outcome = await rotateKey(id);
    setRotating(false);
    if (!outcome.ok) {
      setRotateError(outcome.message);
      return;
    }
    oneTime.show(outcome.apiKey);
    onRotated(id);
  };

  const handleDeactivate = async () => {
    setConfirmDeactivate(false);
    setDeactivating(true);
    setDeactivateError(null);
    try {
      const ok = await deactivateApiKey(id);
      if (!ok) {
        setDeactivateError('Failed to deactivate this key. Please try again later.');
        return;
      }
      statsService?.deactivateApiKeyEvent?.(id);
      stopEditing(false);
      onDeactivated(id);
    } catch {
      setDeactivateError('Failed to deactivate this key. Please try again later.');
    } finally {
      setDeactivating(false);
    }
  };

  // Escape cancels edit mode. Stopping propagation keeps the Settings modal from also closing.
  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && editing && !saving) {
      e.stopPropagation();
      stopEditing(true);
    }
  };

  // ── header ────────────────────────────────────────────────────────────────

  const delegateFull = delegateLabel || apiKey.delegate || '';

  const metaItems: ReactNode[] = [];
  if (isOwnerView) {
    metaItems.push(
      <span key="acct" title={apiKey.account ? formatAccount(apiKey.account) : undefined} style={{ ...ellipsis, maxWidth: 220 }}>
        {apiKey.account?.name ?? 'No account'}
      </span>,
    );
  } else if (ownerLabel) {
    metaItems.push(
      <span key="owner" title={ownerLabel} style={{ ...ellipsis, maxWidth: 260 }}>
        Owner: {ownerLabel}
      </span>,
    );
  }
  if (apiKey.systemId) metaItems.push(<span key="systemId">System ID: {apiKey.systemId}</span>);
  if (isOwnerView && apiKey.delegate) {
    metaItems.push(
      <span
        key="delegate"
        title={delegateFull}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: 'min(100%, 280px)' }}
      >
        <IconUsers size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ flexShrink: 0 }}>Delegate:</span>
        <span style={ellipsis}>{delegateFull}</span>
      </span>,
    );
  }
  metaItems.push(
    <span key="lastUsed" title={lastUsed.title}>
      {lastUsed.label}
    </span>,
  );
  if (mtdCost !== null) metaItems.push(<span key="cost">{formatCurrency(mtdCost)} this month</span>);

  const statusPill =
    status === 'active' ? (
      <span style={{ ...pillBase, color: 'var(--success-fg)', background: 'var(--success-bg)' }}>
        <IconCheck size={13} stroke={2.5} aria-hidden="true" />
        Active
      </span>
    ) : status === 'expired' ? (
      <span
        style={{
          ...pillBase,
          color: 'var(--warning-fg)',
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
        }}
      >
        Expired
      </span>
    ) : (
      <span style={{ ...pillBase, color: 'var(--text-muted)', background: 'var(--bg-active)' }}>Inactive</span>
    );

  const needsRotation = status === 'active' && !!apiKey.needs_rotation && (apiKey.delegate ? true : !apiKey.purpose);
  const rotationHint =
    'There is no active key associated with this API key. Rotate it to get a working key.';

  // ── view / edit bodies ────────────────────────────────────────────────────

  // Fields that are never editable — shown in both modes, after the editable ones, so the
  // editable cells keep the same columns when the mode changes.
  const infoCells = (
    <>
      {isOwnerView && apiKey.delegate && (
        <ReadCell label="Delegate" semantic={!editing}>
          <span style={{ overflowWrap: 'anywhere' }}>{delegateFull}</span>
        </ReadCell>
      )}
      {createdAt && formatTimestamp(createdAt) && (
        <ReadCell label="Created" semantic={!editing}>
          {formatTimestamp(createdAt)}
        </ReadCell>
      )}
      <ReadCell label="Last used" semantic={!editing}>
        {lastUsed.never ? 'Never used' : formatTimestamp(apiKey.lastAccessed)}
      </ReadCell>
    </>
  );

  const viewGrid = (
    <dl style={{ ...gridStyle, margin: 0 }}>
      <ReadCell label={isOwnerView ? 'Account' : 'Owner'} semantic>
        {isOwnerView ? formatAccount(apiKey.account) : ownerLabel || apiKey.owner}
      </ReadCell>
      <ReadCell label="Expiration" semantic>
        {apiKey.expirationDate ? (
          <>
            {formatDateYMDToMDY(apiKey.expirationDate)}
            {expired && <span style={{ color: 'var(--warning-fg)' }}> · Expired</span>}
          </>
        ) : (
          'No expiration'
        )}
      </ReadCell>
      <ReadCell label="Rate limit" semantic>
        {describeRateLimit(apiKey.rateLimit)}
      </ReadCell>
      <ReadCell label="Access types" wide semantic>
        {accessChips(apiKey.accessTypes).map((chip) => (
          <Chip key={chip}>{chip}</Chip>
        ))}
        {accessChips(apiKey.accessTypes).length === 0 && 'None'}
      </ReadCell>
      {infoCells}
    </dl>
  );

  const touch = (field: string) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  const editGrid = (
    <div style={gridStyle}>
      <div>
        <label htmlFor={ids.account} style={{ ...labelStyle, display: 'block' }}>
          Account
        </label>
        <SelectControl
          id={ids.account}
          value={draft.accountId}
          invalid={!!showError('account')}
          disabled={saving}
          onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
        >
          {accountOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {formatAccount(a)}
            </option>
          ))}
        </SelectControl>
        <FieldError id={`${ids.account}-err`}>{showError('account')}</FieldError>
      </div>

      <div>
        <label htmlFor={ids.expiration} style={{ ...labelStyle, display: 'block' }}>
          Expiration
        </label>
        {draft.noExpiration ? (
          // Deterministic empty state: nothing to show (a cleared native date input can keep
          // painting its old value in some browsers).
          <TextControl id={ids.expiration} type="text" value="" placeholder="No expiration" disabled readOnly />
        ) : (
          <TextControl
            id={ids.expiration}
            type="date"
            min={minExpirationDate()}
            value={draft.expirationDate}
            disabled={saving}
            invalid={!!showError('expirationDate')}
            aria-describedby={`${ids.expiration}-err`}
            onChange={(e) => setDraft({ ...draft, expirationDate: e.target.value })}
            onBlur={() => touch('expirationDate')}
          />
        )}
        <div style={{ marginTop: 8 }}>
          <CheckboxControl
            id={`${ids.expiration}-none`}
            label="No expiration"
            checked={draft.noExpiration}
            disabled={saving}
            onChange={(checked) => setDraft(setNoExpiration(draft, checked))}
          />
        </div>
        <FieldError id={`${ids.expiration}-err`}>{showError('expirationDate')}</FieldError>
      </div>

      <div>
        <label htmlFor={ids.rate} style={{ ...labelStyle, display: 'block' }}>
          Rate limit
        </label>
        <SelectControl
          id={ids.rate}
          value={draft.ratePeriod}
          disabled={saving}
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
              disabled={saving}
              invalid={!!showError('rateLimit')}
              aria-describedby={`${ids.rate}-err`}
              onChange={(e) => setDraft({ ...draft, rateAmount: e.target.value })}
              onBlur={() => touch('rateLimit')}
            />
          </div>
        )}
        <FieldError id={`${ids.rate}-err`}>{showError('rateLimit')}</FieldError>
      </div>

      <div style={fullRow}>
        <AccessTypesField
          idPrefix={`${uid}-access`}
          fullAccessId={ids.full}
          fullAccess={draft.fullAccess}
          access={draft.access}
          disabled={saving}
          error={showError('accessTypes')}
          onFullAccessChange={(checked) => {
            setDraft(setFullAccess(draft, checked));
            touch('accessTypes');
          }}
          onToggle={(type) => {
            setDraft(toggleAccessType(draft, type));
            touch('accessTypes');
          }}
        />
      </div>

      {infoCells}
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <article
      aria-label={`API key ${name}`}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      }}
    >
      {oneTime.dialog}
      <ConfirmDialog
        isOpen={pendingDiscard !== null}
        title="Discard unsaved changes?"
        message={`Your changes to “${name}” haven't been saved.`}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="danger"
        onCancel={() => setPendingDiscard(null)}
        onConfirm={() => {
          const action = pendingDiscard;
          setPendingDiscard(null);
          action?.();
        }}
      />
      <ConfirmDialog
        isOpen={confirmRotate}
        title="Rotate this API key?"
        message={
          <>
            The current key will <strong>stop working immediately</strong>. Anything still using it —
            scripts, apps, integrations — will be rejected until you give it the new key. The new key keeps
            this key&apos;s settings and usage history, and is shown only once.
          </>
        }
        confirmLabel="Rotate key"
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setConfirmRotate(false)}
        onConfirm={handleRotate}
      />
      <ConfirmDialog
        isOpen={confirmDeactivate}
        title={`Deactivate “${name}”?`}
        message={
          <>
            Anything using this key will <strong>stop working immediately</strong>. A deactivated key can&apos;t
            be edited, rotated or reactivated — to get access back you&apos;d need to create a new key.
          </>
        }
        confirmLabel="Deactivate key"
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
      />

      {/* Header — the whole row is the expand / collapse button */}
      <button
        type="button"
        id={ids.header}
        aria-expanded={open}
        aria-controls={ids.panel}
        aria-label={`${name}, ${STATUS_LABEL[status]}`}
        onClick={toggleOpen}
        className="w-full hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--accent] transition-colors"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'transparent',
          border: 0,
          borderRadius: open ? '12px 12px 0 0' : 12,
          textAlign: 'left',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
          <DisclosureChevron open={open} />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              overflowWrap: 'anywhere',
              ...(hasKeyName(apiKey) ? null : { fontStyle: 'italic', fontWeight: 400, color: 'var(--text-muted)' }),
            }}
          >
            {hasKeyName(apiKey) ? apiKey.applicationName : UNTITLED_KEY}
          </span>
          <span
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 8,
              rowGap: 2,
              fontSize: 12,
              color: 'var(--text-muted)',
              minWidth: 0,
            }}
          >
            {metaItems.flatMap((item, i) => (i === 0 ? [item] : [<Dot key={`dot${i}`} />, item]))}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {editing && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <IconPencil size={12} aria-hidden="true" />
              Editing
            </span>
          )}
          {needsRotation && (
            <span
              title={rotationHint}
              style={{
                ...pillBase,
                color: 'var(--warning-fg)',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
              }}
            >
              <IconAlertTriangle size={13} aria-hidden="true" style={{ color: 'var(--warning-icon)' }} />
              Rotation required
            </span>
          )}
          {statusPill}
        </span>
      </button>

      {/* Details */}
      {open && (
        <div
          id={ids.panel}
          role="region"
          aria-labelledby={ids.header}
          onKeyDown={handlePanelKeyDown}
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <div style={{ padding: 18 }}>
            {/* Fields, with Edit beside the first row. wrap-reverse puts Edit ABOVE the fields
                when there isn't room beside them. */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap-reverse',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ flex: '1 1 440px', minWidth: 0 }}>{editing ? editGrid : viewGrid}</div>
              {canEdit && (
                // Reserved in both modes so the grid keeps its width while editing.
                <div style={{ flex: 'none', width: 84, display: 'flex', justifyContent: 'flex-end' }}>
                  {!editing && (
                    <button
                      ref={editButtonRef}
                      type="button"
                      onClick={startEditing}
                      aria-label={`Edit details for ${name}`}
                      className={btnSecondary}
                    >
                      <IconPencil size={15} aria-hidden="true" />
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {blockReason && (
              <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{REASON_COPY[blockReason]}</p>
            )}

            {editing && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginTop: 20,
                  paddingTop: 14,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div role="alert" style={{ fontSize: 13, color: 'var(--text-error)', flex: 1, minWidth: 180 }}>
                  {saveError}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={btnSecondary} disabled={saving} onClick={() => stopEditing(true)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!dirty || saving}
                    aria-busy={saving}
                    onClick={handleSave}
                  >
                    {saving && <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />}
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Key section — only for keys that can still be used */}
          {(oneTime.secret !== null || (!editing && (rotatable || deactivatable))) && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 18px' }}>
              {oneTime.secret !== null ? (
                <OneTimeSecretReveal
                  secret={oneTime.secret}
                  copied={oneTime.copied}
                  onCopied={oneTime.markCopied}
                  onDone={oneTime.requestDone}
                />
              ) : (
                <>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>API key</h4>
                  <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 560 }}>
                    For security, keys are only shown once, when created or rotated. Rotate the key if it&apos;s
                    lost or compromised.
                  </p>
                  {needsRotation && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--warning-fg)' }}>{rotationHint}</p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {rotatable && (
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={rotating}
                        aria-busy={rotating}
                        onClick={() => setConfirmRotate(true)}
                      >
                        {rotating ? (
                          <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />
                        ) : (
                          <IconRefresh size={15} aria-hidden="true" />
                        )}
                        {rotating ? 'Rotating…' : 'Rotate key'}
                      </button>
                    )}
                    {deactivatable && (
                      <button
                        type="button"
                        className={btnGhostDanger}
                        disabled={deactivating}
                        onClick={() => setConfirmDeactivate(true)}
                      >
                        {deactivating ? 'Deactivating…' : 'Deactivate key'}
                      </button>
                    )}
                  </div>
                  {(rotateError || deactivateError) && (
                    <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-error)' }}>
                      {rotateError || deactivateError}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export default ApiKeyCard;

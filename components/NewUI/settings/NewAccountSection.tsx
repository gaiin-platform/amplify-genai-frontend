/**
 * NewAccountSection — new-UI styled Account settings section.
 * PORT: Logic ported from components/Settings/AccountComponents/Account.tsx
 *       DO NOT MODIFY the original component.
 *
 * What this section does (all from original):
 *  - Loads accounts on mount via getAccounts()
 *  - Loads MTD cost data via getUserMtdCosts()
 *  - Add account (COA/ID + name + rate limit), delete, edit rate limit inline
 *  - Default account selector
 *  - Save via saveAccounts()
 *  - Wires settingsSave event exactly like the original
 */

import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  IconTrashX,
  IconPlus,
  IconCheck,
  IconX,
  IconEdit,
  IconLoader2,
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { getAccounts, saveAccounts } from '@/services/accountService';
import { Account, noCoaAccount } from '@/types/accounts';
import {
  formatRateLimit,
  PeriodType,
  RateLimit,
  rateLimitObj,
  UNLIMITED,
  periodTypes,
} from '@/types/rateLimit';
import { getUserMtdCosts, UserMtdCosts } from '@/services/mtdCostService';
import { formatCurrency } from '@/utils/app/data';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Inline new-UI styled RateLimiter
// (does not modify RateLimit.tsx — this is a styled port for the new UI)
// ─────────────────────────────────────────────────────────────────────────────

const NewRateLimiter: FC<{
  period: PeriodType;
  setPeriod: (p: PeriodType) => void;
  rate: string;
  setRate: (r: string) => void;
  allowUnlimited?: boolean;
}> = ({ period, setPeriod, rate, setRate, allowUnlimited = false }) => {
  const formatDollar = (value: string): string => {
    if (value.length > 8) return rate;
    const numericValue = value.replace(/[^\d]/g, '');
    const integerValue = parseInt(numericValue, 10);
    if (isNaN(integerValue)) return '$0.00';
    const dollars = Math.floor(integerValue / 100);
    const cents = integerValue % 100;
    return `$${dollars}.${cents.toString().padStart(2, '0')}`;
  };

  const inputSty: React.CSSProperties = {
    height: '30px',
    background: 'var(--bg-app)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '0 10px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as PeriodType)}
        style={{ ...inputSty, width: '106px', cursor: 'pointer' }}
      >
        {periodTypes
          .filter((p) => allowUnlimited || p !== 'Unlimited')
          .map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
      </select>
      {period !== UNLIMITED && (
        <input
          type="text"
          placeholder="$0.00"
          value={rate}
          onChange={(e) => setRate(formatDollar(e.target.value))}
          style={{ ...inputSty, width: '76px', textAlign: 'right' }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const NewAccountSection: FC = () => {
  const { dispatch: homeDispatch } = useContext(HomeContext);
  const { data: session } = useSession();

  // ── Account state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);
  const [isLoading, setIsLoading] = useState(true);

  // ── MTD cost state
  const [mtdData, setMtdData] = useState<UserMtdCosts | null>(null);
  const [mtdLoading, setMtdLoading] = useState(false);

  // ── Unsaved-change tracking (mirrors original: addedAccounts + hasEdits)
  const [addedAccounts, setAddedAccounts] = useState<string[]>([]);
  const [hasEdits, setHasEdits] = useState(false);
  const unsaved = addedAccounts.length > 0 || hasEdits;

  // ── Row hover
  const [hoverAccount, setHoverAccount] = useState<number | null>(null);

  // ── Inline rate-limit editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPeriod, setEditPeriod] = useState<PeriodType>(UNLIMITED);
  const [editRate, setEditRate] = useState<string>('');

  // ── Add-account form
  const accountNameRef = useRef<HTMLInputElement>(null);
  const accountIdRef = useRef<HTMLInputElement>(null);
  const [addPeriod, setAddPeriod] = useState<PeriodType>(UNLIMITED);
  const [addRate, setAddRate] = useState<string>('');

  // ── Load accounts on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const result = await getAccounts();
      if (!result.success) {
        alert('Unable to fetch accounts. Please try again.');
      } else if (result.data) {
        const loaded: Account[] = result.data;
        setAccounts(loaded);
        const def = loaded.find((a: Account) => a.isDefault) ?? loaded[0] ?? noCoaAccount;
        setDefaultAccount(def);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  // ── Load MTD costs on mount
  useEffect(() => {
    if (!session?.user?.email) return;
    setMtdLoading(true);
    getUserMtdCosts()
      .then((result) => {
        if (result.success) setMtdData(result.data);
      })
      .finally(() => setMtdLoading(false));
  }, [session?.user?.email]);

  // ── MTD cost helpers (ported from original getAccountMtdCost)
  const getAccountMtdCost = (accountId: string) => {
    if (!mtdData?.accounts) return null;
    const matching = mtdData.accounts.filter(
      (acc) => acc.accountInfo.split('#')[0] === accountId,
    );
    if (matching.length === 0) return null;
    return {
      dailyCost: matching.reduce((s, a) => s + a.dailyCost, 0),
      monthlyCost: matching.reduce((s, a) => s + a.monthlyCost, 0),
      totalCost: matching.reduce((s, a) => s + a.totalCost, 0),
    };
  };

  // ── Add account
  const handleAddAccount = () => {
    const newName = accountNameRef.current?.value?.trim();
    const newId = accountIdRef.current?.value?.trim();
    if (!newId || !newName) return;
    if (accounts.find((a) => a.name === newName)) {
      alert('Account name must be unique.\n\nPlease rename the account you are trying to add.');
      return;
    }
    const newAccount: Account = {
      id: newId,
      name: newName,
      rateLimit: rateLimitObj(addPeriod, addRate),
    };
    setAccounts([...accounts, newAccount]);
    setAddedAccounts([...addedAccounts, newName]);
    if (accountNameRef.current) accountNameRef.current.value = '';
    if (accountIdRef.current) accountIdRef.current.value = '';
    setAddPeriod(UNLIMITED);
    setAddRate('');
  };

  // ── Delete account
  const handleDeleteAccount = (accountName: string) => {
    const account = accounts.find((a) => a.name === accountName);
    if (!account) return;
    if (account.id === noCoaAccount.id) {
      alert('The "No COA" account cannot be deleted.');
      return;
    }
    if (addedAccounts.includes(accountName)) {
      setAddedAccounts(addedAccounts.filter((n) => n !== accountName));
    } else {
      setHasEdits(true);
    }
    setAccounts(accounts.filter((a) => a.name !== accountName));
  };

  // ── Inline rate-limit editing
  const handleStartEdit = (index: number) => {
    const acc = accounts[index];
    setEditingIndex(index);
    setEditPeriod(acc.rateLimit?.period ?? UNLIMITED);
    setEditRate(acc.rateLimit?.rate != null ? String(acc.rateLimit.rate) : '');
  };

  const handleConfirmEdit = () => {
    if (editingIndex === null) return;
    const updatedRateLimit = rateLimitObj(editPeriod, editRate);
    setAccounts(
      accounts.map((a, i) =>
        i === editingIndex ? { ...a, rateLimit: updatedRateLimit } : a,
      ),
    );
    setHasEdits(true);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => setEditingIndex(null);

  // ── Save (same logic as original handleSave)
  const handleSave = async () => {
    if (accounts.length === 0) {
      alert('You must have at least one account.');
      return;
    }
    toast('Saving Account changes...');
    const updatedAccounts = accounts.map((acc) => ({
      ...acc,
      isDefault: acc.name === defaultAccount.name,
    }));
    const updatedDefault = updatedAccounts.find((a) => a.isDefault);
    const result = await saveAccounts(updatedAccounts);
    if (!result.success) {
      alert('Unable to save accounts. Please try again.');
    } else {
      homeDispatch({ field: 'defaultAccount', value: updatedDefault ?? accounts[0] });
      setHasEdits(false);
      setAddedAccounts([]);
      toast('Account changes saved.');
    }
  };

  // ── Wire settingsSave event (same pattern as original)
  useEffect(() => {
    window.addEventListener('settingsSave', handleSave);
    return () => window.removeEventListener('settingsSave', handleSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, defaultAccount, addedAccounts, hasEdits]);

  // ── Rate-limit warning (ported from original)
  const rateLimitWarning = (() => {
    if (!mtdData) return null;
    for (const account of accounts) {
      const limit = account.rateLimit;
      if (!limit?.rate || limit.period?.toLowerCase() === 'unlimited') continue;
      const cost = getAccountMtdCost(account.id);
      if (!cost) continue;
      let spent = 0;
      if (limit.period === 'Daily') spent = cost.dailyCost;
      else if (limit.period === 'Monthly') spent = cost.monthlyCost + cost.dailyCost;
      else if (limit.period === 'Total') spent = cost.totalCost;
      const pct = (spent / limit.rate) * 100;
      if (pct >= 100) return { account, spent, pct, exceeded: true };
      if (pct >= 80) return { account, spent, pct, exceeded: false };
    }
    return null;
  })();

  // ─────────────────────────────────────────────────────────────
  // Shared style helpers
  // ─────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '20px',
  };

  const fieldInput: React.CSSProperties = {
    height: '34px',
    width: '100%',
    background: 'var(--bg-app)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '0 10px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ─── Important notice callout ─── */}
      <div style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '4px solid #f59e0b',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}>
        <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: '#f59e0b' }} />
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>Important: </strong>
          By configuring a rate limit on an account, you acknowledge that usage up to that limit may
          result in charges. Any spending beyond what is covered under your plan or institution
          remains your responsibility. Please set limits that reflect your intended usage.
        </span>
      </div>

      {/* ─── MTD Cost Summary ─── */}
      {mtdLoading ? (
        <div style={{
          ...card,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}>
          <IconLoader2 size={16} style={{ flexShrink: 0 }} className="animate-spin" />
          Loading cost data…
        </div>
      ) : mtdData ? (
        <div style={card}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
            Cost Summary
          </h3>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'Today', value: formatCurrency(mtdData.dailyCost) },
              { label: 'This month', value: formatCurrency(mtdData.monthlyCost) },
              { label: 'All time', value: formatCurrency(mtdData.totalCost) },
            ].map((stat) => (
              <div key={stat.label}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ─── Rate-limit warning banner ─── */}
      {rateLimitWarning && (
        <div style={{
          background: rateLimitWarning.exceeded
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(251,146,60,0.08)',
          border: `1px solid ${rateLimitWarning.exceeded ? '#ef4444' : '#fb923c'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          fontSize: '13px',
        }}>
          <IconAlertTriangle
            size={16}
            style={{
              flexShrink: 0,
              marginTop: 1,
              color: rateLimitWarning.exceeded ? '#ef4444' : '#fb923c',
            }}
          />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
              {rateLimitWarning.exceeded
                ? `Rate limit reached on "${rateLimitWarning.account.name}"`
                : `Approaching rate limit on "${rateLimitWarning.account.name}"`}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Spent{' '}
              <strong>${rateLimitWarning.spent.toFixed(2)}</strong> of{' '}
              <strong>${rateLimitWarning.account.rateLimit.rate?.toFixed(2)}</strong>{' '}
              {rateLimitWarning.account.rateLimit.period?.toLowerCase()} limit (
              {rateLimitWarning.pct.toFixed(0)}% used).{' '}
              {rateLimitWarning.exceeded
                ? 'Your requests are currently being blocked.'
                : 'You are close to your limit.'}
            </div>
          </div>
        </div>
      )}

      {/* ─── Add account form ─── */}
      <div style={card}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Add New Account
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Create a new account with COA string and rate limits
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Account Name</label>
            <input
              ref={accountNameRef}
              type="text"
              placeholder="Enter account name"
              onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
              style={fieldInput}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>COA String</label>
            <input
              ref={accountIdRef}
              type="text"
              placeholder="Enter COA string"
              onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
              style={fieldInput}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rate Limit</label>
            <NewRateLimiter
              period={addPeriod}
              setPeriod={setAddPeriod}
              rate={addRate}
              setRate={setAddRate}
              allowUnlimited
            />
          </div>
          <button
            type="button"
            onClick={handleAddAccount}
            style={{
              height: '34px',
              padding: '0 16px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <IconPlus size={14} />
            Add Account
          </button>
        </div>
      </div>

      {/* ─── Default account selector ─── */}
      {!isLoading && accounts.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Default Account
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Select which account to use by default for new conversations
          </p>
          <select
            id="accountSelect"
            value={defaultAccount.name}
            onChange={(e) => {
              const sel = accounts.find((a) => a.name === e.target.value);
              if (sel) {
                setDefaultAccount(sel);
                setHasEdits(true);
              }
            }}
            style={{
              width: '100%',
              height: '36px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '0 10px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            {accounts.map((a) => (
              <option key={a.name} value={a.name}>
                {`${a.name} — ${a.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ─── Accounts list ─── */}
      <div style={card}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Your Accounts
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Manage your existing accounts and their settings
        </p>

        {isLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
            fontSize: '13px',
            padding: '16px 0',
          }}>
            <IconLoader2 size={16} className="animate-spin" />
            Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <p style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            padding: '16px 0',
          }}>
            No accounts yet. Add one above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {accounts.map((account, index) => {
              const isHovered = hoverAccount === index;
              const cost = getAccountMtdCost(account.id);
              const isEditing = editingIndex === index;
              const isDefault = account.name === defaultAccount.name;

              return (
                <div
                  key={`${account.id}-${index}`}
                  onMouseEnter={() => setHoverAccount(index)}
                  onMouseLeave={() => setHoverAccount(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '11px 12px',
                    background: isHovered ? 'var(--bg-hover)' : 'var(--bg-app)',
                    borderRadius: '8px',
                    transition: 'background 0.1s',
                    minHeight: '48px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Name + badge + COA */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {account.name}
                      </span>
                      {isDefault && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          background: 'rgba(217,119,87,0.12)',
                          borderRadius: '4px',
                          padding: '1px 7px',
                          whiteSpace: 'nowrap',
                        }}>
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginTop: '1px',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {account.id}
                    </div>
                  </div>

                  {/* MTD cost */}
                  {cost && (
                    <span style={{
                      fontSize: '12px',
                      color: cost.totalCost > 10 ? '#ef4444' : 'var(--text-secondary)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {formatCurrency(cost.totalCost)}
                    </span>
                  )}

                  {/* Rate limit — display or edit inline */}
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <NewRateLimiter
                        period={editPeriod}
                        setPeriod={setEditPeriod}
                        rate={editRate}
                        setRate={setEditRate}
                        allowUnlimited
                      />
                      <button
                        title="Confirm"
                        onClick={handleConfirmEdit}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--accent)',
                          padding: '4px',
                        }}
                      >
                        <IconCheck size={15} />
                      </button>
                      <button
                        title="Cancel"
                        onClick={handleCancelEdit}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px',
                        }}
                      >
                        <IconX size={15} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-active)',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatRateLimit(account.rateLimit)}
                      </span>
                      {isHovered && (
                        <button
                          title="Edit rate limit"
                          onClick={() => handleStartEdit(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: '4px',
                            lineHeight: 0,
                          }}
                        >
                          <IconEdit size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Delete button */}
                  {account.id !== noCoaAccount.id && isHovered && !isEditing && (
                    <button
                      title="Delete account"
                      onClick={() => handleDeleteAccount(account.name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '4px',
                        lineHeight: 0,
                        flexShrink: 0,
                        transition: 'color 0.1s',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.color = '#ef4444')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)')
                      }
                    >
                      <IconTrashX size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Save button ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          onClick={handleSave}
          disabled={!unsaved}
          style={{
            height: '36px',
            padding: '0 20px',
            borderRadius: '8px',
            border: 'none',
            background: unsaved ? 'var(--accent)' : 'var(--bg-active)',
            color: unsaved ? '#fff' : 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: unsaved ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default NewAccountSection;

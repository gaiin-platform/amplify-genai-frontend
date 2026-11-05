import React, { FC } from 'react';
import {
  ActivityWindow,
  AssistantType,
  DocKind,
  MigrationInventory,
  MigrationMode,
  MigrationScope,
  ScopeEstimate,
} from '@/services/ragMigrationService';
import { fmt } from './RagMigrationUi';

const WINDOWS: { value: ActivityWindow; label: string }[] = [
  { value: null, label: 'Any age' },
  { value: 30, label: 'Used in last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 180, label: 'Last 6 months' },
  { value: 365, label: 'Last year' },
];

const MODES: { value: MigrationMode; title: string; description: string }[] = [
  { value: 'assistant', title: 'Assistant documents only', description: 'Documents attached to assistants. The safest first step.' },
  { value: 'all', title: 'All embedded documents', description: 'Everything with embeddings, including files users attached with RAG on.' },
];

const ASSISTANT_TYPES: { value: AssistantType; label: string }[] = [
  { value: 'personal', label: 'Assistants' },
  { value: 'group', label: 'Group assistants' },
];

const KINDS: { value: DocKind; label: string }[] = [
  { value: 'upload', label: 'Uploaded files' },
  { value: 'website', label: 'Web pages' },
  { value: 'drive', label: 'Cloud drive files (SharePoint…)' },
];

const BUCKETS = ['d30', 'd90', 'd180', 'd365', 'older'];
const WINDOW_BUCKET: Record<number, number> = { 30: 0, 90: 1, 180: 2, 365: 3 };

type Facet = NonNullable<MigrationInventory['facets']>[number];

const matches = (facet: Facet, scope: MigrationScope, ignore?: 'kinds' | 'types'): boolean => {
  if (scope.mode === 'assistant') {
    if (!facet.assistant) return false;
    if (ignore !== 'types' && scope.assistantTypes?.length && !facet.types.some((t) => scope.assistantTypes!.includes(t))) return false;
  }
  if (ignore !== 'kinds' && scope.kinds?.length && !scope.kinds.includes(facet.kind)) return false;
  if (scope.activeWithinDays && BUCKETS.indexOf(facet.bucket) > WINDOW_BUCKET[scope.activeWithinDays]) return false;
  return true;
};

const sum = (facets: Facet[], key: 'documents' | 'childFiles') => facets.reduce((a, f) => a + f[key], 0);

/** What the chosen scope would migrate, from the counts taken at the last refresh. */
export const estimateScope = (inventory: MigrationInventory | null | undefined, scope: MigrationScope): ScopeEstimate | null => {
  if (!inventory?.facets) return null;
  const selected = inventory.facets.filter((f) => matches(f, scope));
  const childFiles = sum(selected, 'childFiles');
  return { documents: sum(selected, 'documents'), childFiles, estimatedEmbeddingCalls: childFiles * 20, estimatedQaCalls: childFiles * 10 };
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 12, borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
  background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-primary)',
});

const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' };
const note: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 };

const toggle = <T extends string>(current: T[] | null | undefined, value: T): T[] | null => {
  const set = new Set(current ?? []);
  if (set.has(value)) set.delete(value); else set.add(value);
  return set.size ? Array.from(set) : null;           // nothing picked means all of them
};

export const ScopePicker: FC<{
  scope: MigrationScope; inventory?: MigrationInventory | null; onChange: (scope: MigrationScope) => void;
}> = ({ scope, inventory, onChange }) => {
  const facets = inventory?.facets;
  const estimate = estimateScope(inventory, scope);
  const countKind = (kind: DocKind) => (facets ? sum(facets.filter((f) => f.kind === kind && matches(f, scope, 'kinds')), 'documents') : null);
  const countType = (type: AssistantType) => (facets ? sum(facets.filter((f) => f.assistant && f.types.includes(type) && matches(f, { ...scope, mode: 'assistant' }, 'types')), 'documents') : null);
  const sites = Object.entries(inventory?.sites ?? {});

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {MODES.map((m) => (
          <div
            key={m.value}
            onClick={() => onChange({ ...scope, mode: m.value })}
            style={{
              flex: '1 1 240px', cursor: 'pointer', padding: 14, borderRadius: 10,
              border: `1px solid ${scope.mode === m.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>{m.description}</div>
          </div>
        ))}
      </div>

      {scope.mode === 'assistant' && (
        <>
          <div style={label}>Which assistants</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <button style={chip(!scope.assistantTypes?.length)} onClick={() => onChange({ ...scope, assistantTypes: null })}>All assistants</button>
            {ASSISTANT_TYPES.map((t) => {
              const count = countType(t.value);
              return (
                <button key={t.value} style={chip(!!scope.assistantTypes?.includes(t.value))} onClick={() => onChange({ ...scope, assistantTypes: toggle(scope.assistantTypes, t.value) })}>
                  {t.label}{count !== null ? ` (${fmt(count)})` : ''}
                </button>
              );
            })}
          </div>
          <p style={{ ...note, margin: '0 0 14px' }}>A document used by several kinds of assistant is counted under each.</p>
        </>
      )}

      <div style={label}>Where the documents came from</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <button style={chip(!scope.kinds?.length)} onClick={() => onChange({ ...scope, kinds: null })}>Everything</button>
        {KINDS.map((k) => {
          const count = countKind(k.value);
          return (
            <button key={k.value} style={chip(!!scope.kinds?.includes(k.value))} onClick={() => onChange({ ...scope, kinds: toggle(scope.kinds, k.value) })}>
              {k.label}{count !== null ? ` (${fmt(count)})` : ''}
            </button>
          );
        })}
      </div>
      <p style={{ ...note, margin: '0 0 14px' }}>
        {sites.length > 0 ? `Sites and drives: ${sites.slice(0, 6).map(([site, n]) => `${site} (${fmt(n)})`).join(', ')}. ` : ''}
        Read from each file&apos;s record: scraped pages carry their web address, synced files carry their drive id.
      </p>

      <div style={label}>Only documents that were…</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {WINDOWS.map((w) => (
          <button key={String(w.value)} style={chip(scope.activeWithinDays === w.value)} onClick={() => onChange({ ...scope, activeWithinDays: w.value })}>
            {w.label}
          </button>
        ))}
      </div>
      <p style={{ ...note, margin: '0 0 14px' }}>
        “Used” is the latest of: a search that included the document, a chat that used the file, or, for documents with no recorded use
        yet{inventory ? ` (${fmt(inventory.legacy.neverAccessedSinceTracking)} so far)` : ''}, the day it was embedded. Use is recorded from now on
        for every document an assistant or chat searches, so this gets more accurate over time. Skipped documents can still migrate later,
        or on first use if enabled below.
      </p>

      <div style={{ padding: 14, borderRadius: 10, background: 'var(--border-subtle)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {estimate ? (
          <>
            <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(estimate.documents)}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>documents to migrate</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(estimate.childFiles)}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>chunk files</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>≤ {fmt(estimate.estimatedEmbeddingCalls)}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>embedding calls</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>≤ {fmt(estimate.estimatedQaCalls)}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>question-generation model calls</div></div>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {inventory ? 'Press Refresh counts once to break the counts down by assistant type and source.' : 'Counting…'}
          </span>
        )}
      </div>
      <p style={{ ...note, margin: '10px 0 0' }}>
        Estimates are upper bounds. Migrating re-runs embedding and question generation, so it has real cost; start small. To hand-pick
        individual documents, use the Documents section below: choose the Complete filter, tick documents and press Create new embeddings.
      </p>
    </div>
  );
};

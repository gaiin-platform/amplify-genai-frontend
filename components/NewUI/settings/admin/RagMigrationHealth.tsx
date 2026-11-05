import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessSummary,
  BrowseResult,
  BrowseState,
  CleanupPreview,
  DocStatus,
  FileDetails,
  HealthDoc,
  LookupResult,
  MigrationHealth,
  MigrationStatus,
  Namespace,
  QueueDepths,
  SearchResult,
  runMigrationAction,
} from '@/services/ragMigrationService';
import { Bar, Button, Card, Pill, Stat, fmt } from './RagMigrationUi';

const NAMESPACE_LABELS: Record<Namespace, string> = {
  global: 'Old index (PostgreSQL)',
  global2: 'New index (DynamoDB)',
  preHash: 'Older records',
};

const STATE_COLORS: Record<string, string> = {
  completed: '#16a34a', failed: '#dc2626', processing: '#2563eb', starting: '#d97706', noStatus: '#6b7280',
};

const mono: React.CSSProperties = { fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' };
const muted: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)' };

const hours = (seconds: number) => `${Math.round(seconds / 3600)} h`;

// ── Counts of uploads, documents and chunks ──────────────────────────────────

/** The headline numbers: uploads, distinct documents, failures and stuck documents. */
export const HealthSummary: FC<{ health?: MigrationHealth }> = ({ health }) => {
  if (!health) return null;
  // The older records (neither global/ nor global2/) are not problems, so they are left out of these numbers.
  const counted = (['global', 'global2'] as Namespace[]).filter((ns) => health.documents[ns].total > 0);
  const stuck = counted.reduce((sum, ns) => sum + health.stuck[ns], 0);
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat
          label="Files uploaded" value={fmt(Object.values(health.uploads.userFiles).reduce((a, b) => a + b, 0))}
          hint="Counted once per user file"
        />
        <Stat
          label="Distinct documents" value={fmt(Object.values(health.uploads.uniqueContent).reduce((a, b) => a + b, 0))}
          hint="Identical files share one"
        />
        <Stat
          label="Failed documents" value={fmt(counted.reduce((a, ns) => a + health.documents[ns].failed, 0))}
          tone={counted.some((ns) => health.documents[ns].failed) ? 'bad' : 'good'} hint="Embedding ended in an error"
        />
        <Stat
          label={`Stuck > ${hours(health.stuckAfterSeconds)}`} value={fmt(stuck)}
          tone={stuck ? 'warn' : 'good'} hint="Documents processing with no update"
        />
    </div>
  );
};

export const HealthCard: FC<{ health?: MigrationHealth }> = ({ health }) => {
  if (!health) {
    return (
      <Card title="Health overview" subtitle="Every upload, document and chunk by state.">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Not counted yet. Use “Refresh counts” above.
        </p>
      </Card>
    );
  }
  const rows = (['global', 'global2', 'preHash'] as Namespace[]).filter((ns) => health.documents[ns].total > 0);
  return (
    <Card
      title="Health overview"
      subtitle="Counted from the embedding progress and file pointer tables at the last refresh. A document is complete when every chunk is embedded."
    >
      {rows.map((ns) => {
        const d = health.documents[ns];
        const c = health.chunks[ns];
        const chunkTotal = c.completed + c.failed + c.processing + c.starting + c.other;
        return (
          <div key={ns} style={{ padding: '14px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{NAMESPACE_LABELS[ns]}</span>
              <span style={muted}>
                {fmt(health.uploads.userFiles[ns])} user files → {fmt(health.uploads.uniqueContent[ns])} distinct documents
                {health.orphans[ns] ? ` · ${fmt(health.orphans[ns])} not used by any file` : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Documents ({fmt(d.total)})</div>
            <StateBar counts={d} total={d.total} />
            {ns !== 'preHash' && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0 4px' }}>
                  Chunks ({fmt(chunkTotal)}) · {fmt(c.docsWithFailedChunks)} document(s) have at least one failed chunk
                </div>
                <StateBar counts={c} total={chunkTotal} />
              </>
            )}
            {ns === 'preHash' && (
              <p style={{ ...muted, margin: '8px 0 0' }}>Records that are not under a global/ or global2/ key: uploads from before files were de-duplicated by content hash (stored under the user's own file path) and old assistant-level records (ast/…). The migration cannot move them and does not touch them, and they are not counted as problems. The bar above shows their state.</p>
            )}
          </div>
        );
      })}
    </Card>
  );
};

const StateBar: FC<{ counts: Record<string, number>; total: number }> = ({ counts, total }) => {
  const order = ['completed', 'processing', 'starting', 'failed', 'noStatus', 'other'];
  return (
    <>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border-subtle)' }}>
        {order.map((state) =>
          counts[state] ? (
            <div key={state} title={`${state}: ${counts[state]}`} style={{ width: `${(counts[state] / Math.max(1, total)) * 100}%`, background: STATE_COLORS[state] ?? '#6b7280' }} />
          ) : null,
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
        {order.map((state) =>
          counts[state] ? (
            <span key={state} style={muted}>
              <span style={{ color: STATE_COLORS[state] ?? '#6b7280' }}>●</span> {state === 'noStatus' ? 'no status' : state} {fmt(counts[state])}
            </span>
          ) : null,
        )}
      </div>
    </>
  );
};

// ── Queues and documents being worked on ─────────────────────────────────────

export const LiveCard: FC<{ health?: MigrationHealth; queues?: QueueDepths; migrating?: MigrationStatus['migrating'] }> = ({ health, queues, migrating }) => {
  const names = Object.keys(queues ?? {});
  const others = (health?.inFlight ?? []).filter((doc) => !(migrating ?? []).some((m) => m.contentKey === doc.contentKey));
  return (
    <Card title="In flight" subtitle="Updates every few seconds while work is running (every 10 seconds otherwise). The queues and the documents being migrated are live; the list of other documents is from the last count.">
      {names.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {names.map((name) => {
            const q = queues![name];
            const failedQueue = name.endsWith('(failed)');
            const unreadable = q.waiting === null;
            return (
              <Stat
                key={name} label={name} value={unreadable ? '—' : fmt((q.waiting ?? 0) + (q.working ?? 0))}
                hint={unreadable ? `Could not read${q.error ? ` (${q.error})` : ''}` : `${fmt(q.waiting)} waiting · ${fmt(q.working)} working`}
                tone={failedQueue && (q.waiting ?? 0) > 0 ? 'bad' : undefined}
              />
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Being migrated now</div>
      {!migrating || migrating.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>No document is having new embeddings created right now.</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {migrating.map((doc) => <DocRow key={doc.contentKey} doc={doc} />)}
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Other documents being embedded (from the last count)</div>
      {others.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>None at the last count.</p>
      ) : (
        <>
          <div style={{ ...muted, marginBottom: 6 }}>{fmt(health?.inFlightCount)} document(s) in progress</div>
          {others.map((doc) => <DocRow key={doc.contentKey} doc={doc} />)}
        </>
      )}
    </Card>
  );
};

const DocRow: FC<{ doc: HealthDoc; right?: React.ReactNode; bare?: boolean }> = ({ doc, right, bare }) => (
  <div style={{ padding: '8px 0', borderTop: bare ? undefined : '1px solid var(--border-subtle)', display: 'flex', gap: 12, alignItems: 'center' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={mono}>{doc.contentKey}</div>
      <div style={muted}>
        {doc.owner ? `${doc.owner} · ` : ''}{fmt(doc.chunksDone)}/{fmt(doc.totalChunks)} chunks
        {doc.chunksFailed ? ` · ${fmt(doc.chunksFailed)} failed` : ''}
        {doc.lastUpdated ? ` · updated ${doc.lastUpdated.slice(0, 16).replace('T', ' ')}` : ''}
      </div>
      <div style={{ width: 220, marginTop: 4 }}>
        <Bar value={doc.chunksDone} max={Math.max(1, doc.totalChunks)} color={STATE_COLORS[doc.state]} />
      </div>
    </div>
    {doc.reason && <Pill text={doc.reason} color={doc.reason === 'stuck' ? '#d97706' : '#dc2626'} />}
    {right}
  </div>
);

const SideSummary: FC<{ title: string; side: NonNullable<LookupResult['legacy']> }> = ({ title, side }) => {
  const p = side.progress;
  return (
    <div style={{ flex: '1 1 300px', padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ ...mono, margin: '2px 0 8px' }}>{side.key}</div>
      {p ? (
        <>
          <div style={{ fontSize: 12, color: STATE_COLORS[p.state] }}>{p.state} · {fmt(p.chunksDone)}/{fmt(p.totalChunks)} chunks</div>
          <div style={muted}>
            completed {fmt(p.chunks.completed)} · failed {fmt(p.chunks.failed)} · processing {fmt(p.chunks.processing)} · starting {fmt(p.chunks.starting)}
          </div>
          {p.failedChunkNumbers.length > 0 && <div style={{ ...muted, color: '#ef4444' }}>failed chunks: {p.failedChunkNumbers.join(', ')}</div>}
        </>
      ) : (
        <div style={muted}>No embedding record</div>
      )}
      <div style={{ ...muted, marginTop: 8 }}>
        Who can read it: {accessText(side.accessSummary)}
        {side.access.length > 0 && (
          <span title={side.access.map((a) => `${a.principal} (${a.level})`).join('\n')} style={{ marginLeft: 6, textDecoration: 'underline dotted', cursor: 'help' }}>list</span>
        )}
      </div>
    </div>
  );
};

// ── What a cleanup would do ──────────────────────────────────────────────────

export const CleanupPreviewPanel: FC<{ preview: CleanupPreview | null }> = ({ preview }) => {
  if (!preview) return null;
  return (
    <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        Cleanup preview: {fmt(preview.ready)} of {fmt(preview.switched)} documents with moved references are ready
      </div>
      <p style={{ ...muted, margin: '4px 0 8px' }}>{preview.note}</p>
      {preview.documents.filter((d) => !d.ready).slice(0, 10).map((d) => (
        <div key={d.contentKey} style={{ padding: '4px 0' }}>
          <div style={mono}>{d.contentKey}</div>
          <div style={{ ...muted, color: '#d97706' }}>{d.blockers.join(' · ')}</div>
        </div>
      ))}
    </div>
  );
};

// ── Progress of a migration you started from the list below ────────────────────

const REBUILD_DONE: DocStatus[] = ['built', 'cutover', 'cleaned', 'failed', 'rolledback'];
const REBUILD_POLL_MS = 5000;
const REBUILD_STATUS: Record<string, string> = {
  planned: 'Waiting to start', building: 'Creating embeddings', built: 'New embeddings ready, references not moved', cutover: 'References moved',
  failed: 'Migration failed', rolledback: 'Rolled back', cleaned: 'Old copy removed',
};

/** The documents you picked for new embeddings, with how far each one is. Refreshes by itself until all have finished, and again when ``version`` changes. */
export const CreationProgress: FC<{
  keys: string[]; version?: number; onClear: () => void; onContinue?: () => void; onRows?: (rows: Record<string, LookupResult>) => void;
}> = ({ keys, version = 0, onClear, onContinue, onRows }) => {
  const [rows, setRows] = useState<Record<string, LookupResult>>({});
  const finished = keys.length > 0 && keys.every((k) => {
    const status = rows[k]?.migration?.status;
    return !!status && REBUILD_DONE.includes(status);
  });

  const refresh = useCallback(async (live: () => boolean) => {
    const answers = await Promise.all(keys.map((key) => runMigrationAction('lookup', { query: key })));
    if (!live()) return;
    setRows((previous) => {
      const next = { ...previous };
      answers.forEach((answer, index) => { if (answer.success) next[keys[index]] = answer.data as LookupResult; });
      return next;
    });
  }, [keys]);

  useEffect(() => {
    if (finished) return undefined;
    let live = true;
    refresh(() => live);
    const timer = setInterval(() => refresh(() => live), REBUILD_POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, [refresh, finished]);

  useEffect(() => {                       // something changed (references moved, rolled back): look again once
    if (version === 0) return undefined;
    let live = true;
    refresh(() => live);
    return () => { live = false; };
  }, [refresh, version]);

  useEffect(() => { onRows?.(rows); }, [rows, onRows]);

  const done = keys.filter((k) => REBUILD_DONE.includes(rows[k]?.migration?.status as DocStatus)).length;

  return (
    <div style={{ marginBottom: 12, padding: 14, border: '1px solid var(--accent)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          New embeddings progress: {fmt(done)} of {fmt(keys.length)} finished{finished ? '' : ' (updates every few seconds)'}
        </div>
        {finished && onContinue && <Button kind="primary" onClick={onContinue}>Continue to move references</Button>}
        <Button onClick={onClear} title="Only forgets this list on the page; nothing is undone">Forget this list</Button>
      </div>
      {keys.map((key) => {
        const row = rows[key];
        const status = row?.migration?.status;
        const progress = row?.global2?.progress;
        const file = fileLabel(row?.file);
        return (
          <div key={key} style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{file?.name ?? key.split('/').pop()}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: status === 'failed' ? '#ef4444' : status && REBUILD_DONE.includes(status) ? '#16a34a' : 'var(--accent)' }}>
                {status === 'building' && progress && progress.totalChunks > 0 && progress.chunksDone >= progress.totalChunks
                  ? 'All chunks embedded, checking the result'
                  : status ? REBUILD_STATUS[status] ?? status : row ? 'Not started' : 'Checking…'}
              </span>
              {progress && progress.totalChunks > 0 && <span style={muted}>{fmt(progress.chunksDone)} of {fmt(progress.totalChunks)} chunks embedded{progress.chunksFailed ? ` · ${fmt(progress.chunksFailed)} failed` : ''}</span>}
            </div>
            {progress && progress.totalChunks > 0 && <div style={{ marginTop: 4 }}><Bar value={progress.chunksDone} max={progress.totalChunks} /></div>}
            {row?.migration?.error && <div style={{ ...muted, color: '#ef4444' }}>{row.migration.error}</div>}
          </div>
        );
      })}
    </div>
  );
};

/** Everything selected so far, whether or not it is in the list below; each can be removed here. */
const SelectionTray: FC<{ picked: Selection; onChange: (picked: Selection) => void; onContinue?: () => void }> = ({ picked, onChange, onContinue }) => {
  if (picked.size === 0) return <p style={{ ...muted, margin: '0 0 10px' }}>Nothing selected yet. Search for a document and press Select, or tick documents in the list.</p>;
  return (
    <div style={{ margin: '0 0 12px', padding: 12, border: '1px solid var(--accent)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Selected ({fmt(picked.size)})</span>
        <Button onClick={() => onChange(new Map())}>Clear selection</Button>
        {onContinue && <Button kind="primary" onClick={onContinue}>Continue to create embeddings</Button>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Array.from(picked.entries()).map(([key, name]) => (
          <span key={key} title={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 10px', borderRadius: 999, border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-primary)' }}>
            {name}
            <button
              aria-label={`Remove ${name} from the selection`}
              onClick={() => { const copy = new Map(picked); copy.delete(key); onChange(copy); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Documents: filter by state, look one up, migrate ─────────────────────────

const fileLabel = (file?: FileDetails) => {
  const first = file?.files?.[0];
  if (!first) return null;
  const type = (first.type ?? '').split('/').pop()?.split('.').pop()?.slice(0, 12);
  const source = first.kind === 'website' ? `Web page · ${first.site ?? 'unknown site'}` : first.kind === 'drive' ? `Synced from ${first.site ?? 'a cloud drive'}` : null;
  return { name: first.name || first.key.split('/').pop() || first.key, type, source, uploads: file?.uploads ?? 0 };
};

const accessText = (a?: AccessSummary) => {
  if (!a) return 'unknown';
  const parts = [
    a.users ? `${fmt(a.users)} ${a.users === 1 ? 'person' : 'people'}` : '',
    a.assistants ? `${fmt(a.assistants)} assistant${a.assistants === 1 ? '' : 's'}` : '',
    a.groups ? `${fmt(a.groups)} group${a.groups === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nobody listed';
};

/** Everything known about one document, found by user file key or content key. Loads when shown. */
/** The Select / Remove button for the document a lookup found, or the reason it cannot be selected. */
const SelectControl: FC<{ result: LookupResult; picked: Selection; onToggle: (key: string, name: string) => void }> = ({ result, picked, onToggle }) => {
  const key = result.contentKey;
  const name = fileLabel(result.file)?.name ?? key.split('/').pop() ?? key;
  const reason = !key.startsWith('global/') ? 'This document is already in the new index.'
    : !result.legacy.progress ? 'This document has no old embeddings to migrate.'
      : result.migration && ['building', 'planned'].includes(result.migration.status) ? 'Its new embeddings are already being created.'
        : result.migration && ['cutover', 'cleaned'].includes(result.migration.status) ? 'Its references have already been moved to the new embeddings.'
          : null;
  if (reason) return <div style={{ ...muted, marginBottom: 8 }}>{reason}</div>;
  const chosen = picked.has(key);
  const built = result.migration?.status === 'built';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
      {built && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Its new embeddings are already created. Select it to move its references (step 4); step 3 will not create them again.</span>}
      <Button kind={chosen ? 'plain' : 'primary'} onClick={() => onToggle(key, name)}>{chosen ? 'Remove from selection' : 'Select this document'}</Button>
      {chosen && <span style={{ fontSize: 12, color: '#16a34a' }}>Selected</span>}
    </div>
  );
};

/** One sentence on how the migration of this document went, from the migration record and the new copy's progress. */
const rebuildOutcome = (result: LookupResult): string => {
  const doc = result.migration;
  if (!doc) return '';
  const copy = result.global2.progress;
  const chunks = copy && copy.totalChunks > 0 ? `${fmt(copy.chunksDone)} of ${fmt(copy.totalChunks)} chunks embedded${copy.chunksFailed ? `, ${fmt(copy.chunksFailed)} failed` : ''}` : '';
  const took = doc.startedAt && doc.builtAt ? ` in ${Math.max(1, Math.round(doc.builtAt - doc.startedAt))} s` : '';
  const when = (doc.builtAt ?? doc.updatedAt) ? new Date((doc.builtAt ?? doc.updatedAt ?? 0) * 1000).toLocaleString() : '';
  switch (doc.status) {
    case 'planned': return 'Waiting in the queue; it has not started.';
    case 'building': return `Creating the new embeddings now${chunks ? `: ${chunks}` : ''}.`;
    case 'failed': return `The migration failed${doc.error ? `: ${doc.error}` : ''}.`;
    case 'built': return `Migrated${took}${when ? ` (${when})` : ''}${chunks ? `: ${chunks}` : ''}. Users still read the old embeddings; move the references when ready.`;
    case 'cutover': return `Migrated${took}${chunks ? `: ${chunks}` : ''}. References moved: chat and assistants read from the new embeddings.`;
    case 'cleaned': return 'Live on the new copy; the old copy has been removed.';
    case 'rolledback': return 'Rolled back: users are served from the old copy again.';
    default: return '';
  }
};

export type Selection = Map<string, string>;     // content key -> name shown for it

const DetailPanel: FC<{ query: string; onClose?: () => void; selection?: { picked: Selection; onToggle: (key: string, name: string) => void } }> = ({ query, onClose, selection }) => {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setResult(null);
    setError(null);
    runMigrationAction('lookup', { query: query.trim() }).then((response) => {
      if (!live) return;
      if (!response.success) setError(response.error ?? 'Not found');
      else setResult(response.data as LookupResult);
    });
    return () => { live = false; };
  }, [query]);

  return (
    <div style={{ margin: '4px 0 10px', padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10, maxHeight: 360, overflowY: 'auto' }}>
      {onClose && <div style={{ textAlign: 'right' }}><Button onClick={onClose}>Close</Button></div>}
      {!result && !error && <div style={muted}>Loading details…</div>}
      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
      {result && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6 }}>
            Migration: <b>{result.migration?.status ?? 'not started'}</b>
            {result.migration?.error ? ` · ${result.migration.error}` : ''}
          </div>
          {result.migration && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{rebuildOutcome(result)}</div>}
          {selection && <SelectControl result={result} picked={selection.picked} onToggle={selection.onToggle} />}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
            {!result.file ? 'File details are not available from this server version yet.' : result.file.uploads === 0
              ? 'No user file points to this document.'
              : `Uploaded ${fmt(result.file.uploads)} time${result.file.uploads === 1 ? '' : 's'}:`}
            {(result.file?.files ?? []).map((f) => (
              <div key={f.key} style={muted}>
                {f.name || '(name unknown)'} {f.type ? `· ${f.type}` : ''}{f.sourceUrl ? ` · web page ${f.sourceUrl}` : ''} · {f.owner}{f.createdAt ? ` · ${String(f.createdAt).slice(0, 10)}` : ''}
              </div>
            ))}
            {result.file && result.file.uploads > result.file.files.length && (
              <div style={muted}>and {fmt(result.file.uploads - result.file.files.length)} more</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <SideSummary title="Old index" side={result.legacy} />
            {result.global2.progress || result.migration ? (
              <SideSummary title="New index" side={result.global2} />
            ) : (
              <div style={{ flex: '1 1 300px', padding: 12, border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>New index</div>
                <div style={muted}>Not migrated yet.</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const diagnosis = (doc: HealthDoc, matched: BrowseState[]): string => {
  const failedChunks = doc.chunksFailed;
  if (matched.includes('failed')) {
    return doc.totalChunks > 0 && doc.chunksDone === doc.totalChunks
      ? 'Every chunk finished, but the document is marked failed (it was stopped or ended in error).'
      : `Embedding failed after ${fmt(doc.chunksDone)} of ${fmt(doc.totalChunks)} chunks${failedChunks ? `, ${fmt(failedChunks)} of them failed` : ''}.`;
  }
  if (matched.includes('stuck')) {
    return failedChunks
      ? `Never finished: ${fmt(failedChunks)} chunk(s) failed, so it stays at “${doc.state}”.`
      : `Started embedding but has not updated in hours (“${doc.state}”).`;
  }
  if (matched.includes('failedChunks')) return `Finished, but ${fmt(failedChunks)} chunk(s) failed, so parts of it cannot be searched.`;
  if (matched.includes('processing')) return 'Embedding is in progress.';
  if (matched.includes('starting')) return 'Waiting to start embedding.';
  return 'Embedding is complete.';
};

const FILTERS: { value: BrowseState; label: string }[] = [
  { value: 'failed', label: 'Failed' },
  { value: 'stuck', label: 'Stuck' },
  { value: 'failedChunks', label: 'Failed chunks' },
  { value: 'processing', label: 'Processing' },
  { value: 'starting', label: 'Starting' },
  { value: 'completed', label: 'Complete' },
];
const NEEDS_ATTENTION: BrowseState[] = ['failed', 'stuck', 'failedChunks'];

const filterCount = (health: MigrationHealth | undefined, ns: 'global' | 'global2', state: BrowseState): number | null => {
  if (!health) return null;
  const docs = health.documents[ns];
  switch (state) {
    case 'failed': return docs.failed;
    case 'stuck': return health.stuck[ns];
    case 'failedChunks': return health.chunks[ns].docsWithFailedChunks;
    case 'processing': return docs.processing;
    case 'starting': return docs.starting;
    case 'completed': return docs.completed;
    default: return null;
  }
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 12, borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
  background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-primary)',
});

const looksLikeKey = (text: string) => /^global2?\//.test(text) || (text.includes('/') && /\.[a-z0-9]{2,6}(\.json)?$/i.test(text));

const MIGRATION_LABELS: Record<string, string> = {
  planned: 'queued', building: 'creating embeddings', built: 'embeddings ready, references not moved', cutover: 'references moved',
  rolledback: 'rolled back', failed: 'migration failed', cleaned: 'old copy removed',
};

/**
 * Find documents and migrate chosen ones. Search by part of a file's name or owner, or paste a key for everything known
 * about one document; or browse by state (failed, stuck, complete, ...). Tick documents and create their new embeddings.
 */
export const DocumentsPanel: FC<{ health?: MigrationHealth; picked: Selection; onPickedChange: (picked: Selection) => void; onContinue?: () => void }> = ({ health, picked, onPickedChange: setPicked, onContinue }) => {
  const [ns, setNs] = useState<'global' | 'global2'>('global');
  const [states, setStates] = useState<BrowseState[]>(NEEDS_ATTENTION);
  const [pages, setPages] = useState<Partial<Record<BrowseState, { docs: HealthDoc[]; next: string | null }>>>({});
  const [loading, setLoading] = useState<BrowseState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const load = async (state: BrowseState, namespace: 'global' | 'global2', start: string | null = null) => {
    setLoading((l) => [...l, state]);
    const response = await runMigrationAction('browse', { state, namespace, limit: 50, start });
    setLoading((l) => l.filter((s) => s !== state));
    if (!response.success) {
      setError(response.error ?? 'Could not load documents');
      return;
    }
    const page = response.data as BrowseResult;
    setPages((p) => ({ ...p, [state]: { docs: start ? [...(p[state]?.docs ?? []), ...page.documents] : page.documents, next: page.next } }));
  };

  // Opening the panel shows what needs attention straight away.
  useEffect(() => {
    states.forEach((s) => load(s, ns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const text = query.trim();
    if (!text) return;
    setError(null);
    if (looksLikeKey(text)) {                      // a key: show everything known about that one document
      setResults(null);
      setSearched(text);
      return;
    }
    setSearched(null);
    setSearching(true);
    const response = await runMigrationAction('search', { query: text });
    setSearching(false);
    if (!response.success) {
      setResults(null);
      setError(response.error ?? 'The search did not work');
      return;
    }
    setResults(response.data as SearchResult);
  };

  const clearSearch = () => {
    setResults(null);
    setSearched(null);
    setQuery('');
    setError(null);
  };

  const toggleState = (state: BrowseState) => {
    if (states.includes(state)) {
      setStates(states.filter((s) => s !== state));
      return;
    }
    setStates([...states, state]);
    if (!pages[state]) load(state, ns);
  };

  const chooseNamespace = (next: 'global' | 'global2') => {
    if (next === ns) return;
    setNs(next);
    setPages({});
    setOpen(null);
    setError(null);
    states.forEach((s) => load(s, next));
  };

  // A document can match several states; list it once, with the states it matched.
  const rows = useMemo(() => {
    const byKey = new Map<string, { doc: HealthDoc; matched: BrowseState[] }>();
    states.forEach((s) => (pages[s]?.docs ?? []).forEach((doc) => {
      const found = byKey.get(doc.contentKey);
      if (found) found.matched.push(s); else byKey.set(doc.contentKey, { doc, matched: [s] });
    }));
    return Array.from(byKey.values());
  }, [pages, states]);

  const anyNext = states.some((s) => pages[s]?.next);
  const toggle = (key: string, name: string) => {
    const copy = new Map(picked);
    if (copy.has(key)) copy.delete(key); else copy.set(key, name);
    setPicked(copy);
  };
  const nameOfRow = (doc: HealthDoc) => fileLabel(doc.file)?.name ?? doc.contentKey.split('/').pop() ?? doc.contentKey;
  const searchable = (results?.files ?? []).filter((f) => f.contentKey?.startsWith('global/')).map((f) => [f.contentKey as string, f.name || (f.contentKey as string).split('/').pop() || ''] as [string, string]);
  const pickable: [string, string][] = results ? searchable : ns === 'global' ? rows.map((r) => [r.doc.contentKey, nameOfRow(r.doc)] as [string, string]) : [];
  const allPicked = pickable.length > 0 && pickable.every(([k]) => picked.has(k));
  const pickAllShown = () => {                    // adds or removes only what is shown; the rest of the selection stays
    const copy = new Map(picked);
    pickable.forEach(([k, name]) => { if (allPicked) copy.delete(k); else copy.set(k, name); });
    setPicked(copy);
  };
  const selection = { picked, onToggle: toggle };

  return (
    <div>
      <SelectionTray picked={picked} onChange={setPicked} onContinue={onContinue} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Search by file name or owner, or paste a file key or content key (global/…, global2/…)"
          style={{ flex: '1 1 320px', padding: '6px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)' }}
        />
        <Button kind="primary" disabled={!query.trim() || searching} onClick={submit}>{searching ? 'Searching…' : 'Search'}</Button>
        {(results || searched) && <Button onClick={clearSearch}>Clear</Button>}
      </div>
      {searched && <DetailPanel query={searched} selection={selection} />}
      {error && <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px' }}>{error}</p>}

      {!results && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <button style={chip(ns === 'global')} onClick={() => chooseNamespace('global')}>Old index</button>
            <button style={chip(ns === 'global2')} onClick={() => chooseNamespace('global2')}>New index</button>
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-subtle)', margin: '0 4px' }} />
            {FILTERS.map((f) => {
              const count = filterCount(health, ns, f.value);
              return (
                <button key={f.value} style={chip(states.includes(f.value))} onClick={() => toggleState(f.value)} aria-pressed={states.includes(f.value)}>
                  {f.label}{count !== null ? ` (${fmt(count)})` : ''}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={muted}>
          {results ? `${fmt(results.files.length)} file(s) match “${query.trim()}”${results.truncated ? ' (more exist; narrow the search)' : ''}` : `${fmt(rows.length)} shown`}
          
        </span>
        {pickable.length > 0 && <Button onClick={pickAllShown}>{allPicked ? 'Unselect all shown' : 'Select all shown'}</Button>}
      </div>

      <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0 12px' }}>
        {results ? (
          <>
            {results.files.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0' }}>No file matches.</p>}
            {results.files.map((file) => {
              const rebuildable = !!file.contentKey?.startsWith('global/');
              const shownKey = file.contentKey ?? file.key;
              return (
                <div key={file.key} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
                    {rebuildable ? (
                      <input type="checkbox" checked={picked.has(file.contentKey as string)} onChange={() => toggle(file.contentKey as string, file.name || (file.contentKey as string).split('/').pop() || '')} aria-label="Select document" />
                    ) : (
                      <span style={{ width: 13 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {file.name || '(name unknown)'}
                        {file.type ? <span style={{ ...muted, marginLeft: 6 }}>{file.type}</span> : null}
                      </div>
                      <div style={muted}>
                        {file.owner}
                        {file.contentKey ? ` · ${fmt(file.chunksDone)}/${fmt(file.totalChunks)} chunks` : ' · no embeddings (RAG was off, or an older upload)'}
                      </div>
                      <div style={{ ...muted, wordBreak: 'break-all' }}>{shownKey}</div>
                    </div>
                    {file.state && <Pill text={file.state === 'noStatus' ? 'no status' : file.state} color={STATE_COLORS[file.state] ?? '#6b7280'} />}
                    {file.migration && <Pill text={MIGRATION_LABELS[file.migration] ?? file.migration} color="#6b7280" />}
                    <Button onClick={() => setOpen(open === file.key ? null : file.key)}>{open === file.key ? 'Hide' : 'Details'}</Button>
                  </div>
                  {open === file.key && <DetailPanel query={file.key} selection={selection} />}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {states.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0' }}>Pick one or more states above.</p>}
            {states.length > 0 && rows.length === 0 && loading.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0' }}>No documents in {states.length > 1 ? 'those states' : 'that state'}.</p>
            )}
            {loading.length > 0 && rows.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0' }}>Loading…</p>}
            {rows.map(({ doc, matched }) => {
              const label = fileLabel(doc.file);
              return (
                <div key={doc.contentKey} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
                    {ns === 'global' && (
                      <input type="checkbox" checked={picked.has(doc.contentKey)} onChange={() => toggle(doc.contentKey, nameOfRow(doc))} aria-label="Select document" />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {label ? label.name : 'File name unknown'}
                        {label?.type ? <span style={{ ...muted, marginLeft: 6 }}>{label.type}</span> : null}
                        {label?.source ? <span style={{ ...muted, marginLeft: 6 }}>{label.source}</span> : null}
                        {label && label.uploads > 1 ? <span style={{ ...muted, marginLeft: 6 }}>uploaded {fmt(label.uploads)}×</span> : null}
                      </div>
                      {doc.file?.files?.[0]?.sourceUrl && <div style={{ ...muted, wordBreak: 'break-all' }}>Web page: {doc.file.files[0].sourceUrl}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0' }}>{diagnosis(doc, matched)}</div>
                      <div style={{ ...muted, wordBreak: 'break-all' }}>{doc.contentKey}</div>
                      <div style={muted}>
                        {doc.owner ? `${doc.owner} · ` : ''}{fmt(doc.chunksDone)}/{fmt(doc.totalChunks)} chunks
                        {doc.chunksFailed ? ` · ${fmt(doc.chunksFailed)} failed` : ''}
                        {doc.lastUpdated ? ` · updated ${doc.lastUpdated.slice(0, 16).replace('T', ' ')}` : ''}
                      </div>
                    </div>
                    {matched.map((s) => (
                      <Pill key={s} text={FILTERS.find((f) => f.value === s)?.label ?? s} color={s === 'stuck' || s === 'starting' ? '#d97706' : s === 'completed' ? '#16a34a' : s === 'processing' ? '#2563eb' : '#dc2626'} />
                    ))}
                    <Button onClick={() => setOpen(open === doc.contentKey ? null : doc.contentKey)}>{open === doc.contentKey ? 'Hide' : 'Details'}</Button>
                  </div>
                  {open === doc.contentKey && <DetailPanel query={doc.contentKey} selection={selection} />}
                </div>
              );
            })}
            {anyNext && (
              <div style={{ padding: '10px 0' }}>
                <Button disabled={loading.length > 0} onClick={() => states.forEach((s) => pages[s]?.next && load(s, ns, pages[s]!.next))}>
                  {loading.length > 0 ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

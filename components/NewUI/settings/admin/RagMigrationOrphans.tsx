import React, { FC, useCallback, useEffect, useState } from 'react';
import { OrphanCategory, OrphanKind, OrphanRemoval, OrphanReport, runMigrationAction } from '@/services/ragMigrationService';
import { Button, fmt } from './RagMigrationUi';

const CONFIRM = 'DELETE';
const MAX_PER_REQUEST = 100;   // the server's cap per delete

const NAMES: Record<OrphanKind, { title: string; blurb: string }> = {
  assistantGone: { title: 'Files of deleted assistants', blurb: 'Made for an assistant that no longer exists.' },
  drive: { title: 'Cloud-drive files', blurb: 'Synced from SharePoint or another drive; no assistant uses them.' },
  website: { title: 'Scraped web pages', blurb: 'Saved from a website scan; no assistant uses them.' },
  group: { title: 'Group files', blurb: 'Owned by a group; no assistant uses them.' },
};

const text = { primary: { color: 'var(--text-primary)' }, secondary: { color: 'var(--text-secondary)' }, muted: { color: 'var(--text-muted)' } };

/** Why files are kept, in plain words, only the reasons that apply. */
const keptRows = (c: OrphanCategory): [string, number][] =>
  ([
    ['Still used by an assistant', c.inUse],
    ['Embeddings still exist (cannot be deleted from here)', c.embeddings],
    ['Used in a chat lately', c.recent],
    ['Added or changed in the last 14 days', c.tooNew],
    ['Part of the migration', c.migrating],
  ] as [string, number][]).filter(([, n]) => n > 0);

const FileLine: FC<{ name?: string | null; type?: string | null; fileKey: string; note?: string }> = ({ name, type, fileKey, note }) => (
  <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
    <div style={{ fontSize: 13, ...text.primary, wordBreak: 'break-word' }}>
      {name || '(name unknown)'}{type ? <span style={{ fontSize: 12, ...text.muted }}> · {type}</span> : null}
    </div>
    <div style={{ fontSize: 12, ...text.muted, wordBreak: 'break-all' }}>{fileKey}</div>
    {note && <div style={{ fontSize: 12, ...text.secondary }}>{note}</div>}
  </div>
);

const NOTE: Record<string, string> = {
  'never processed': 'Never finished uploading, so there is nothing else to remove.',
  'content is shared': 'Another upload shares the same content, so only this copy goes.',
  'last reference': 'The last copy, with no embeddings, so its text goes too.',
};

const COLUMNS = 'minmax(200px, 1fr) 84px 84px 150px';

const TextButton: FC<{ onClick: () => void; children: React.ReactNode; tone?: 'danger'; disabled?: boolean }> = ({ onClick, children, tone, disabled }) => (
  <button
    onClick={onClick} disabled={disabled}
    style={{
      padding: '4px 8px', fontSize: 13, borderRadius: 6, background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, color: tone === 'danger' ? '#dc2626' : 'var(--accent)',
    }}
  >
    {children}
  </button>
);

/** One kind of file: a single row, with the file list and the delete confirmation opening underneath it. */
const CategoryRow: FC<{ category: OrphanCategory; busy: boolean; deleting: { kind: OrphanKind; count: number } | null; onRemove: (kind: OrphanKind, count: number) => Promise<void> }> = ({ category, busy, deleting, onRemove }) => {
  const running = deleting?.kind === category.id;
  const [open, setOpen] = useState<'review' | 'delete' | null>(null);
  const [typed, setTyped] = useState('');
  const [wanted, setWanted] = useState('');
  const name = NAMES[category.id] ?? { title: category.label, blurb: '' };
  const kept = keptRows(category);
  const keptTotal = kept.reduce((sum, [, n]) => sum + n, 0);
  const cap = Math.min(MAX_PER_REQUEST, category.removable);
  const parsed = Number.parseInt(wanted, 10);
  const batch = wanted === '' ? cap : Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), cap) : cap;
  const validCount = wanted === '' || (Number.isInteger(Number(wanted)) && parsed >= 1 && parsed <= cap);
  const none = category.removable === 0;

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 12, alignItems: 'center', padding: '12px 4px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, ...text.primary }}>{name.title}</div>
          <div style={{ fontSize: 12, ...text.secondary }}>{name.blurb}</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'right', color: none ? 'var(--text-muted)' : 'var(--text-primary)' }}>{fmt(category.removable)}</div>
        <div style={{ fontSize: 14, textAlign: 'right', ...text.secondary }} title={kept.map(([label, n]) => `${label}: ${n}`).join('\n')}>{fmt(keptTotal)}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {!none && (
            <>
              <TextButton onClick={() => setOpen(open === 'review' ? null : 'review')}>{open === 'review' ? 'Hide' : 'Review'}</TextButton>
              <TextButton tone="danger" disabled={busy} onClick={() => setOpen(open === 'delete' ? null : 'delete')}>Delete…</TextButton>
            </>
          )}
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 4px 14px' }}>
          {kept.length > 0 && (
            <p style={{ fontSize: 12, ...text.secondary, margin: '0 0 8px', lineHeight: 1.6 }}>
              Staying: {kept.map(([label, n]) => `${fmt(n)} ${label.charAt(0).toLowerCase()}${label.slice(1)}`).join(' · ')}
            </p>
          )}

          {open === 'delete' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, ...text.primary, display: 'flex', alignItems: 'center', gap: 8 }}>
                How many to delete (of {fmt(category.removable)}{category.removable > cap ? `, up to ${fmt(cap)} at a time` : ''})
                <input
                  type="number" min={1} max={cap} step={1} inputMode="numeric" value={wanted} placeholder={String(cap)}
                  onChange={(e) => setWanted(e.target.value)}
                  aria-label={`Number of ${name.title} to delete`}
                  style={{ width: 90, padding: '5px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)' }}
                />
              </label>
              <span style={{ fontSize: 13, ...text.primary }}>This cannot be undone. Type <b>{CONFIRM}</b>:</span>
              <input
                value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM}
                aria-label={`Type ${CONFIRM} to confirm deleting ${name.title}`}
                style={{ width: 120, padding: '5px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)' }}
              />
              <Button kind="danger" loading={running} disabled={busy || typed !== CONFIRM || !validCount} onClick={async () => { await onRemove(category.id, batch); setTyped(''); setWanted(''); setOpen(null); }}>
                {running ? `Deleting ${fmt(deleting?.count)}…` : `Delete ${fmt(batch)}`}
              </Button>
              {running && <span style={{ fontSize: 12, ...text.secondary }}>Checking each file again, then deleting. This can take several seconds.</span>}
            </div>
          )}

          {open === 'review' && (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 600, ...text.secondary, marginBottom: 2 }}>
                Would be deleted{category.removable > category.examples.length ? ` (first ${category.examples.length} of ${fmt(category.removable)})` : ''}
              </div>
              {category.examples.map((e) => <FileLine key={e.key} name={e.name} type={e.type} fileKey={e.key} note={NOTE[e.why ?? '']} />)}
              {category.embeddingExamples.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, ...text.secondary, margin: '12px 0 2px' }}>Staying because their embeddings still exist</div>
                  {category.embeddingExamples.map((e) => <FileLine key={e.key} name={e.name} type={e.type} fileKey={e.key} />)}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Files that exist only because an assistant needed them (synced drive files, scraped web pages, group files, files of
 * deleted assistants) and that no assistant mentions any more. Everything is judged again by the server when you delete;
 * an ordinary upload in someone's library is never listed.
 */
export const OrphanPanel: FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [report, setReport] = useState<OrphanReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: OrphanKind; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rules, setRules] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await runMigrationAction('orphans');
    setLoading(false);
    if (!response.success) {
      setError(response.error ?? 'The check did not work');
      return;
    }
    setReport(response.data as OrphanReport);
  }, []);

  useEffect(() => { check(); }, [check]);

  const remove = async (kind: OrphanKind, count: number) => {
    setWorking(true);
    setDeleting({ kind, count });
    setMessage(null);
    const response = await runMigrationAction('remove_orphans', { category: kind, confirm: CONFIRM, limit: count });
    setWorking(false);
    setDeleting(null);
    if (!response.success) {
      setError(response.error ?? 'Deleting did not work');
      return;
    }
    const r = response.data as OrphanRemoval;
    setError(null);
    setMessage(
      `Deleted ${fmt(r.removed)} file${r.removed === 1 ? '' : 's'}${r.errors ? `; ${fmt(r.errors)} could not be deleted` : ''}.` +
      `${r.withContent ? ` ${fmt(r.withContent)} were the last copy, so their text was removed too.` : ''}` +
      `${r.more ? ' More are left; delete again to continue.' : ''}`,
    );
    onChanged();
    await check();
  };

  const total = report?.categories.reduce((sum, c) => sum + c.removable, 0) ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ fontSize: 13, ...text.secondary, margin: 0, lineHeight: 1.6 }}>
          Files that were made for assistants (synced drive files, scraped web pages, group files) and that no assistant uses any more.
          Ordinary files in someone's library are never listed here, and nothing is deleted until you confirm.
        </p>
        <button
          onClick={() => setRules(!rules)} aria-expanded={rules}
          style={{ marginTop: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)' }}
        >
          {rules ? 'Hide how this is decided' : 'How this is decided'}
        </button>
        {rules && (
          <ul style={{ fontSize: 12, ...text.secondary, lineHeight: 1.7, margin: '6px 0 0', paddingLeft: 18 }}>
            <li>A file counts as used if its key, its content or its hash appears anywhere in any version of any assistant, layered assistant or group.</li>
            <li>Files added or changed in the last 14 days, used in a chat lately, or being migrated are left alone.</li>
            <li>Deleting removes that upload's record, its pointer and its stored copy. The shared text goes only if it is the last copy and has no embeddings.</li>
            <li>Embeddings are never deleted from here, and images and videos are not covered.</li>
            <li>The server checks every file again at the moment you delete.</li>
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button disabled={loading || working} onClick={check}>{loading ? 'Checking…' : 'Check again'}</Button>
        {report && (
          <span style={{ fontSize: 13, ...text.secondary }}>
            Checked {fmt(report.examined)} assistant files: <b style={text.primary}>{fmt(total)}</b> can be deleted
            {report.truncated ? ' (stopped at the limit; delete some, then check again)' : ''}
          </span>
        )}
      </div>

      {loading && !report && <p style={{ fontSize: 13, ...text.secondary, margin: 0 }}>Checking every assistant file against every assistant. This can take a minute.</p>}
      {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}
      {message && <p style={{ fontSize: 13, ...text.primary, margin: 0 }}>{message}</p>}
      {report && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 12, padding: '0 4px 6px', fontSize: 12, ...text.muted }}>
            <span>Kind of file</span><span style={{ textAlign: 'right' }}>To delete</span><span style={{ textAlign: 'right' }}>Staying</span><span />
          </div>
          {report.categories.map((category) => (
            <CategoryRow key={category.id} category={category} busy={working || loading} deleting={deleting} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  );
};

import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { Bar, Button, Card, Collapsible, MigrationSkeleton, Notice, Pill, Stat, Step, StepNav, Tabs, ago, fmt } from './RagMigrationUi';
import { ScopePicker, estimateScope } from './RagMigrationScope';
import { CleanupPreviewPanel, CreationProgress, DocumentsPanel, Selection, HealthCard, HealthSummary, LiveCard } from './RagMigrationHealth';
import { OrphanPanel } from './RagMigrationOrphans';
import { finishedCount, useMigrationRun } from './useMigrationRun';
import {
  AssistantUsage,
  CleanupPreview,
  LookupResult,
  MigrationAction,
  MigrationScope,
  MigrationStatus,
  getMigrationStatus,
  runMigrationAction,
  updateMigrationSettings,
} from '@/services/ragMigrationService';

const POLL_MS = 10_000;
const FAST_POLL_MS = 3_000;           // while documents are being created or old embeddings are being removed
type AssistantResult = { assistants?: number; updated?: string[]; failed?: { assistantId: string; error: string }[] };

/** One plain sentence on what a Move references / Roll back / Update assistants press did, including the assistants. */
const referencesMessage = (action: MigrationAction, data: { cutover?: number; restored?: number; assistants?: AssistantResult } | undefined): string => {
  const a = data?.assistants ?? {};
  const failed = a.failed?.length ?? 0;
  const assistants = a.assistants
    ? ` ${fmt(a.updated?.length ?? 0)} of ${fmt(a.assistants)} assistant(s) now store the ${action === 'rollback' ? 'old' : 'new'} document ids.${failed ? ` ${fmt(failed)} could not be updated (${a.failed?.[0]?.error}); they keep working, and “Update assistants” tries again.` : ''}`
    : ' No assistant stores these documents.';
  if (action === 'cutover') return `Moved the references of ${fmt(data?.cutover)} document(s). Library files and assistants use the new embeddings now.${assistants}`;
  if (action === 'rollback') return `Rolled back ${fmt(data?.restored)} reference(s) to the old embeddings.${assistants}`;
  return `Checked the assistants for ${action === 'update_assistants' ? 'moved documents' : ''}.${assistants}`;
};

const TRACKED_STORAGE = 'ragMigration.trackedDocuments';
const STEP_LABELS = ['Choose', 'Pace and safety', 'Create embeddings', 'Move references', 'Clean up'];

const NumberField: FC<{ label: string; hint: string; value: number | null; min: number; max: number; onChange: (v: number | null) => void; allowEmpty?: boolean }> = ({
  label, hint, value, min, max, onChange, allowEmpty,
}) => (
  <label style={{ display: 'block', flex: '1 1 200px' }}>
    <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
    <input
      type="number" min={min} max={max} value={value ?? ''} placeholder={allowEmpty ? 'No limit' : undefined}
      onChange={(e) => onChange(e.target.value === '' ? (allowEmpty ? null : min) : Number(e.target.value))}
      style={{
        width: '100%', marginTop: 4, padding: '6px 10px', fontSize: 13, borderRadius: 8,
        border: '1px solid var(--border-subtle)', background: 'var(--bg-base, transparent)', color: 'var(--text-primary)',
      }}
    />
    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{hint}</span>
  </label>
);

const ToggleRow: FC<{ label: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label, description, checked, onChange,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</div>
    </div>
    <ToggleSwitch checked={checked} onChange={onChange} aria-label={label} />
  </div>
);

const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)' };


/** How recently the documents still to migrate were used, from the saved counts. */
const LastUsed: FC<{ inventory: NonNullable<MigrationStatus['inventory']> }> = ({ inventory }) => {
  const rows: [string, number][] = [
    ['Used in the last 30 days', inventory.ageBuckets.d30],
    ['31–90 days ago', inventory.ageBuckets.d90],
    ['91–180 days ago', inventory.ageBuckets.d180],
    ['181–365 days ago', inventory.ageBuckets.d365],
    ['Over a year ago', inventory.ageBuckets.older],
  ];
  return (
    <Card title="When were the documents still to migrate last used?">
      {rows.map(([label, count]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '190px 1fr 60px', gap: 10, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
          <Bar value={count} max={Math.max(1, ...rows.map((r) => r[1]))} />
          <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--text-primary)' }}>{fmt(count)}</span>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
        “Used” is the latest search or chat that used the document. {fmt(inventory.legacy.neverAccessedSinceTracking)} documents have
        no recorded use yet and are dated by when they were embedded; use is recorded from now on.
      </p>
    </Card>
  );
};

// ── Tab ──────────────────────────────────────────────────────────────────────

export const RagMigrationTab: FC = () => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'bulk' | 'pick'>('bulk');
  const [picked, setPicked] = useState<Selection>(new Map());                // documents selected for migration: content key -> name
  const [tracked, setTracked] = useState<string[]>(() => {                // documents sent for new embeddings (kept for this browser session)
    try { return JSON.parse(sessionStorage.getItem(TRACKED_STORAGE) ?? '[]'); } catch { return []; }
  });
  const [trackedRows, setTrackedRows] = useState<Record<string, LookupResult>>({});
  const [usage, setUsage] = useState<Record<string, AssistantUsage>>({});     // which assistants use the built / moved documents
  const [usageState, setUsageState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [version, setVersion] = useState(0);                              // bumped after an action so the progress list looks again
  useEffect(() => {
    try { sessionStorage.setItem(TRACKED_STORAGE, JSON.stringify(tracked)); } catch { /* storage unavailable: it just resets on reload */ }
  }, [tracked]);
  const [notice, setNotice] = useState<string | null>(null);
  const [scope, setScope] = useState<MigrationScope>({ mode: 'assistant', activeWithinDays: null, kinds: null, assistantTypes: null });
  const [batchSize, setBatchSize] = useState(10);
  const [maxInFlight, setMaxInFlight] = useState(20);
  const [maxDocs, setMaxDocs] = useState<number | null>(null);
  const [autoCutover, setAutoCutover] = useState(false);
  const [migrateOnAccess, setMigrateOnAccess] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [changedSince, setChangedSince] = useState(false);            // something moved since the numbers were counted
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [cleanRun, setCleanRun] = useState<{ baseline: number; total: number } | null>(null);      // the last "Remove old embeddings" press
  const dirty = useRef(false);
  const statusRef = useRef<MigrationStatus | null>(null);      // the latest status, readable before React re-renders

  const applyConfig = useCallback((next: MigrationStatus) => {
    const c = next.config;
    setScope(c.scope);
    setBatchSize(c.batchSize);
    setMaxInFlight(c.maxInFlight);
    setMaxDocs(c.maxDocs);
    setAutoCutover(c.autoCutover);
    setMigrateOnAccess(c.migrateOnAccess);
  }, []);

  const load = useCallback(async () => {
    const result = await getMigrationStatus();
    if (!result.success || !result.data) {
      setError(result.error ?? 'Unable to load migration status');
      return;
    }
    setError(null);
    statusRef.current = result.data;
    setStatus(result.data);
    if (!dirty.current) applyConfig(result.data); // never overwrite edits in progress
  }, [applyConfig]);

  const workingRef = useRef(false);                      // a run is starting documents (set below, read by the poll)
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await load();
      if (!alive) return;
      const current = statusRef.current;
      const active = workingRef.current || !!current?.config.cleanupRequested
        || ((current?.pipeline.planned ?? 0) + (current?.pipeline.building ?? 0)) > 0;
      timer = setTimeout(tick, active ? FAST_POLL_MS : POLL_MS);       // one request at a time; faster while something is happening
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [load]);

  const edit = <T,>(setter: (v: T) => void) => (value: T) => {
    dirty.current = true;
    setUnsaved(true);
    setter(value);
  };

  const perform = async (
    label: string, action: MigrationAction,
    extra: { keys?: string[]; all?: boolean } = {},
    confirmText?: string,
  ): Promise<boolean> => {
    if (confirmText && !window.confirm(confirmText)) return false;
    setBusy(label);
    setNotice(null);
    const before = statusRef.current;
    const result = await runMigrationAction(action, extra);
    setBusy(null);
    if (!result.success) {
      setNotice(result.error ?? 'That did not work');
    } else if (result.data?.errors?.length) {
      setNotice(`Finished with ${result.data.errors.length} problem(s): ${result.data.errors[0].error}`);
    } else if (action === 'preview_cleanup') {
      setCleanupPreview(result.data as CleanupPreview);
    } else if (action === 'cleanup') {
      setCleanRun({ baseline: before?.pipeline.cleaned ?? 0, total: result.data?.eligible ?? 0 });
      setNotice(`Cleanup started for ${fmt(result.data?.eligible)} document(s). It runs in the background, about a minute for a few documents; “Old embeddings removed” counts up as each one finishes.`);
    } else if (action === 'clear_queue') {
      setNotice(`Took ${fmt(result.data?.removed)} waiting document(s) out of the queue.`);
    } else if (action === 'cutover' || action === 'rollback' || action === 'update_assistants') {
      setNotice(referencesMessage(action, result.data));
    } else if (action === 'rebuild') {
      const skipped = result.data?.skipped?.length ? `, ${result.data.skipped.length} skipped (${result.data.skipped[0].reason})` : '';
      setNotice(`Started ${result.data?.started ?? 0} of ${result.data?.queued ?? 0} document(s)${skipped}.`);
    }
    setVersion((v) => v + 1);
    if (action === 'refresh_inventory') setChangedSince(false);
    else if (result.success && ['cutover', 'rollback', 'update_assistants', 'cleanup', 'rebuild'].includes(action)) setChangedSince(true);
    await load();
    return result.success;
  };

  const saveSettings = async (): Promise<boolean> => {
    setBusy('settings');
    const result = await updateMigrationSettings({ scope, batchSize, maxInFlight, maxDocs, autoCutover, migrateOnAccess });
    setBusy(null);
    if (!result.success) {
      setNotice(result.error ?? 'Could not save settings');
      return false;
    }
    dirty.current = false;
    setUnsaved(false);
    await load();
    return true;
  };

  const pipeline = status?.pipeline;
  const inventory = status?.inventory ?? null;
  const migrated = (pipeline?.cutover ?? 0) + (pipeline?.cleaned ?? 0);
  const created = (pipeline?.built ?? 0) + migrated;                  // documents whose new embeddings exist
  const inFlight = (pipeline?.planned ?? 0) + (pipeline?.building ?? 0) + (pipeline?.built ?? 0);
  const embedded = inventory?.legacy.complete ?? 0;
  const now = status?.serverTime;
  const estimate = estimateScope(inventory, scope);

  // The run reads the SAVED settings, so what the server enforces and what the page assumes cannot differ.
  const getStatus = useCallback(() => statusRef.current, []);
  const getSettings = useCallback(() => {
    const c = statusRef.current?.config;
    return { batchSize: c?.batchSize ?? 10, maxInFlight: c?.maxInFlight ?? 20, maxDocs: c?.maxDocs ?? null };
  }, []);
  const run = useMigrationRun(getStatus, getSettings, load);
  workingRef.current = run.state === 'running';
  // Progress of the documents this run started, from the saved counts (no lookup per document, so it stays cheap for thousands).
  const runDone = Math.min(run.started, Math.max(0, finishedCount(pipeline) - run.baseline));
  const runFailed = run.started ? pipeline?.failed ?? 0 : 0;
  const runCreating = run.started > 0 && runDone < run.started;
  const waitingToMove = run.started > 0 && !runCreating && (pipeline?.built ?? 0) > 0;      // finished documents are waiting for Move references

  const statusSignature = tracked.map((k) => trackedRows[k]?.migration?.status ?? '').join(',');

  // Step 4 shows how many assistants are involved, so you can see whether anything needs updating.
  useEffect(() => {
    if (step !== 4 || (mode === 'pick' && tracked.length === 0)) return undefined;
    let live = true;
    setUsageState('loading');
    runMigrationAction('assistant_usage', mode === 'pick' ? { keys: tracked } : {}).then((response) => {
      if (!live) return;
      if (response.success) setUsage((response.data as { documents: Record<string, AssistantUsage> }).documents);
      setUsageState(response.success ? 'ready' : 'failed');
    });
    return () => { live = false; };
    // statusSignature: look again when a document finishes, so the count never reflects an earlier moment
  }, [step, mode, tracked, version, statusSignature]);

  // When the documents you sent finish, recount once so the overview numbers match.
  const sawUnfinished = useRef(false);
  useEffect(() => {
    if (tracked.length === 0) return;
    const done = ['built', 'cutover', 'cleaned', 'failed', 'rolledback'];
    const finished = tracked.every((k) => done.includes(trackedRows[k]?.migration?.status ?? ''));
    if (!finished) { sawUnfinished.current = true; return; }
    if (sawUnfinished.current) {
      sawUnfinished.current = false;
      perform('inventory', 'refresh_inventory');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedRows, tracked]);

  const usageRows = Object.values(usage);
  const willUpdate = usageRows.filter((u) => u.status === 'built').reduce((sum, u) => sum + u.onOld, 0);       // use of a ready document that moves on Move references
  const pendingUpdate = usageRows.filter((u) => u.status === 'cutover').reduce((sum, u) => sum + u.onOld, 0);  // moved documents some assistant still stores under the old id
  const usageNames = Array.from(new Set(usageRows.flatMap((u) => u.names))).slice(0, 6).join(', ');

  const statusOf = (key: string) => trackedRows[key]?.migration?.status;
  const readyKeys = tracked.filter((k) => statusOf(k) === 'built');
  const movedKeys = tracked.filter((k) => statusOf(k) === 'cutover');
  // moved documents whose assistants still store the old id: Move references finishes these too
  const staleKeys = movedKeys.filter((k) => (usage[k]?.onOld ?? 0) > 0);
  const checkingDocs = mode === 'pick' && tracked.some((k) => !trackedRows[k]);      // the first look at the documents has not come back yet
  const readyCount = mode === 'pick' ? readyKeys.length : pipeline?.built ?? 0;
  const movedCount = mode === 'pick' ? movedKeys.length : pipeline?.cutover ?? 0;
  const toMove = readyCount + (mode === 'pick' ? staleKeys.length : Math.min(pendingUpdate, Math.max(0, 50 - readyCount)));

  /** Back to a clean page: forgets the picked and sent lists and goes to step 1. Nothing on the server is touched or undone. */
  const startOver = () => {
    perform('inventory', 'refresh_inventory');                  // the choices above are counts; recount so they match what is left
    setPicked(new Map());
    setTracked([]);
    setTrackedRows({});
    setUsage({});
    setCleanupPreview(null);
    setCleanRun(null);
    setNotice(null);
    setMode('bulk');
    setStep(1);
  };

  const startRun = async () => {
    const what = scope.mode === 'assistant' ? 'assistant documents' : 'all embedded documents';
    const resume = run.state === 'paused';
    const text = `${resume ? 'Resume' : 'Start'} migrating ${what}${estimate ? ` (${fmt(estimate.documents)} match your choices)` : ''} in the new index?\n\nIt uses your login and is recorded under you and the “rag_migration” account, never under the documents' owners. ${autoCutover ? 'Documents switch over automatically once verified.' : 'Nothing goes live until you switch documents over.'}\n\nIt keeps starting documents while this page stays open and your login is valid (about an hour). Pause stops starting new ones; Stop also empties the waiting queue.`;
    if (!window.confirm(text)) return;
    if (dirty.current && !(await saveSettings())) return;
    run.start();
  };

  const stopRun = async () => {
    if (!window.confirm(`Stop? ${fmt(pipeline?.planned)} waiting document(s) are taken out of the queue. Documents already being migrated finish on their own and never have their references moved without you.`)) return;
    run.stop();
    await perform('stop', 'clear_queue');
  };

  // Nothing is counted the first time the page opens, so count once on its own instead of showing empty cards.
  const autoCounted = useRef(false);
  useEffect(() => {
    // also when the saved counts predate the breakdown by assistant type and source
    if (status && (!status.inventory || !status.inventory.facets) && !autoCounted.current) {
      autoCounted.current = true;
      perform('inventory', 'refresh_inventory');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!status) return <MigrationSkeleton error={error} />;

  const counting = busy === 'inventory' || (!inventory && !error);
  const nothingToStart = !!estimate && estimate.documents === 0 && !pipeline?.planned;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card
        title="RAG Migration"
        subtitle="Migrates documents from the old vector database in the new multimodal index (Nova), checks them, then starts using the new copies. Users notice nothing until you start using them, and nothing is deleted until you remove old copies."
      >
        {status.inSecretSweepWindow && (
          <p style={{ ...muted, margin: '0 0 10px' }}>New documents are not started between 02:55 and 03:20 UTC while the nightly credential cleanup runs.</p>
        )}
        {status.config.lastError && (
          <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 10px' }}>
            {status.config.lastError}{' '}
            <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => perform('dismiss', 'dismiss_error')}>dismiss</a>
          </p>
        )}
        {(notice || error) && <p style={{ fontSize: 12, color: error ? '#ef4444' : 'var(--text-secondary)', margin: 0 }}>{error ?? notice}</p>}
        {!notice && !error && !status.config.lastError && !status.inSecretSweepWindow && (
          <p style={{ ...muted, margin: 0 }}>Open “Bulk migrate” below to choose documents and start. Nothing runs until you press Start.</p>
        )}
      </Card>

      {/* The rundown: what exists and where it stands */}
      <Card
        title="Overview"
        subtitle="Only documents with embeddings (RAG on) are migrated. Files attached with RAG off keep working as they are."
        right={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={muted}>
              {counting ? 'Counting…' : `Counted ${ago(inventory?.generatedAt, now)}`}
              {!counting && changedSince && <b style={{ color: '#d97706', marginLeft: 6 }}>Out of date: things changed since. Refresh counts.</b>}
            </span>
            <Button disabled={!!busy && busy !== 'inventory'} loading={busy === 'inventory'} onClick={() => perform('inventory', 'refresh_inventory')}>Refresh counts</Button>
          </div>
        }
      >
        {!inventory ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
            <span
              className="motion-safe:animate-pulse"
              style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', display: 'inline-block' }}
            />
            Loading your documents… this can take a minute on a large system.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}><HealthSummary health={inventory.health} /></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <Stat label="Embedded documents" value={fmt(embedded)} hint={`${fmt(inventory.legacy.incomplete)} incomplete in the old index`} />
              <Stat label="Attached to an assistant" value={fmt(inventory.legacy.assistantReferenced)} hint="Documents an assistant uses" />
              <Stat label="Other embedded files" value={fmt(inventory.legacy.otherEmbedded)} hint="Attached to chats with RAG on" />
              <Stat
                label="In the new index" value={fmt(inventory.global2.complete)}
                tone={inventory.global2.complete ? 'good' : undefined}
                hint={`${fmt(inventory.global2.total)} documents there, ${fmt(inventory.global2.complete)} complete`}
              />
            </div>
            <div style={{ borderTop: '2px solid #16a34a', paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>Migration progress: new embeddings (Nova)</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <Stat label="New embeddings created" value={fmt(created)} tone="good" hint={embedded ? `${fmt(Math.round((created / embedded) * 1000) / 10)}% of the ${fmt(embedded)} embedded documents` : undefined} />
                <Stat label="In progress" value={fmt(inFlight)} hint={`${fmt(pipeline?.planned)} queued · ${fmt(pipeline?.building)} creating · ${fmt(pipeline?.built)} ready, references not moved`} />
                <Stat label="Failed" value={fmt(pipeline?.failed)} tone={pipeline?.failed ? 'bad' : undefined} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <Stat label="Ready to go live" value={fmt(pipeline?.built)} hint="New embeddings are created and checked; users still get the old ones until you move references" />
                <Stat label="Live on new embeddings" value={fmt(migrated)} tone="good" hint="References moved: file records and assistants use the new embeddings" />
                <Stat label="Old embeddings removed" value={fmt(pipeline?.cleaned)} hint="Old copies deleted from the legacy database (of the live ones)" />
              </div>
              <Bar value={created} max={embedded} color="#16a34a" />
              <div style={{ ...muted, marginTop: 4 }}>{fmt(created)} of {fmt(embedded)} embedded documents have new embeddings ({fmt(migrated)} with references moved)</div>
            </div>
          </>
        )}
      </Card>

      <Collapsible
        title="State breakdown"
        summary={inventory?.health ? 'Every upload, document and chunk by state, and when documents were last used' : 'Counts needed first'}
      >
        <HealthCard health={inventory?.health} />
        {inventory && <LastUsed inventory={inventory} />}
      </Collapsible>

      <Collapsible
        title="Migrate documents"
        summary={
          run.state === 'running' ? `Running · ${fmt(run.started)} started this run`
            : inFlight > 0 ? `${fmt(inFlight)} in progress · ${fmt(migrated)} migrated`
              : migrated > 0 ? `${fmt(migrated)} migrated` : 'Choose documents, set the pace, start'
        }
        defaultOpen
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <StepNav labels={STEP_LABELS} active={step} onChange={setStep} />
          <Button onClick={startOver} title="Forgets the selected and sent lists on this page, recounts, and returns to step 1. Nothing is undone on the server.">Start over</Button>
        </div>
        {(notice || busy) && <Notice>{busy ? 'Working…' : notice}</Notice>}
        {step === 1 && (
        <Step n={1} title="Choose what to migrate" subtitle="Migrate everything that matches a scope, or select individual documents. Documents already migrated are skipped.">
          <Tabs
            value={mode} onChange={(v) => setMode(v as 'bulk' | 'pick')}
            options={[
              { value: 'bulk', label: 'Bulk', hint: 'Everything that matches a scope, in batches' },
              { value: 'pick', label: 'Select documents', hint: 'Search or browse and select the documents you want' },
            ]}
          />
          {mode === 'bulk'
            ? <ScopePicker scope={scope} inventory={inventory} onChange={edit(setScope)} />
            : <DocumentsPanel health={inventory?.health} picked={picked} onPickedChange={setPicked} onContinue={() => setStep(3)} />}
        </Step>)}

        {step === 2 && (
        <Step
          n={2} title="Set the pace and safety"
          right={unsaved ? <Button kind="primary" disabled={busy === 'settings'} onClick={saveSettings}>Save changes</Button> : undefined}
          subtitle={unsaved ? 'You have unsaved changes. They are saved automatically when you press Start.' : 'Defaults are safe; the first run is best kept small.'}
        >
          {mode === 'bulk' ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <NumberField label="Start this many at a time" hint="Documents started each round (a round runs every 15 s while there is room, max 50)" value={batchSize} min={1} max={50} onChange={(v) => edit(setBatchSize)(v ?? 1)} />
            <NumberField label="Most at once" hint="Most documents being created at the same time" value={maxInFlight} min={1} max={200} onChange={(v) => edit(setMaxInFlight)(v ?? 1)} />
            <NumberField label="Stop after" hint="Documents to start in one run (blank = everything in the scope)" value={maxDocs} min={1} max={1000000} allowEmpty onChange={edit(setMaxDocs)} />
            </div>
          ) : (
            <>
              <Notice>Selected documents start right away (up to 50 at a time), so there is no pace to set.</Notice>
            </>
          )}
          <ToggleRow
            label="Migrate on first use"
            description="While on, every time a chat or assistant searches an old-index document, that document is added to the queue ahead of the bulk list, even if it is outside the choices above. It does not start anything by itself: queued documents are picked up the next time a run is going (Start)."
            checked={migrateOnAccess}
            onChange={edit(setMigrateOnAccess)}
          />
        </Step>)}

        {step === 3 && (
        <Step
          n={3} title="Create new embeddings"
          subtitle="Starting uses your login and keeps going while this page is open. Documents already being created are never recalled by Pause or Stop; they finish on their own."
        >
          <Notice>
            This step only creates new embeddings next to the old ones. Nothing uses them yet: no assistant, chat or file points at them, and
            nothing existing is changed or removed. The next step, “Move references”, is what makes them live.
          </Notice>
          {mode === 'bulk' ? (
          <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <Button
              kind="primary" disabled={!!busy || run.state === 'running' || !inventory || nothingToStart || waitingToMove} loading={run.starting}
              title={waitingToMove ? 'Documents from this run are ready: move their references first (or use Start over)' : nothingToStart ? 'Nothing in this scope is waiting to be migrated' : undefined}
              onClick={startRun}
            >
              {run.state === 'paused' ? 'Resume' : 'Start'}
            </Button>
            {run.state === 'running' && <Button onClick={run.pause}>Pause</Button>}
            {(run.state !== 'idle' || (pipeline?.planned ?? 0) > 0) && <Button kind="danger" disabled={!!busy} onClick={stopRun}>Stop</Button>}
            <Pill
              text={run.state === 'running' ? 'Starting documents' : run.state === 'paused' ? 'Paused' : runCreating ? 'All started, being created' : 'Not running'}
              color={run.state === 'running' || runCreating ? '#2563eb' : run.state === 'paused' ? '#d97706' : '#6b7280'}
            />
          </div>
          {run.message && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px' }}>{run.message}</p>}

          {run.started > 0 ? (
            <div style={{ padding: 14, border: '1px solid var(--accent)', borderRadius: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  This run: {fmt(runDone)} of {fmt(run.started)} started document(s) finished
                  {runCreating ? ' (updates every few seconds)' : runFailed ? `, ${fmt(runFailed)} failed` : ', all created and checked'}
                </div>
                {!runCreating && (pipeline?.built ?? 0) > 0 && <Button kind="primary" onClick={() => setStep(4)}>Continue to move references</Button>}
              </div>
              <Bar value={runDone} max={run.started} color="#16a34a" />
              {!runCreating && runFailed > 0 && <p style={{ ...muted, margin: '8px 0 0' }}>Failed documents are listed below with the reason; “Retry failed” tries them again.</p>}
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {(pipeline?.failed ?? 0) > 0 && <Button disabled={!!busy} onClick={() => perform('retry', 'retry_failed')}>Retry failed</Button>}
              </div>
              {status.failures.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Documents that could not be migrated ({fmt(pipeline?.failed)})
                  </div>
                  <p style={{ ...muted, margin: '0 0 4px' }}>Files over the size limits will not succeed; others can be retried.</p>
                  {status.failures.map((doc) => (
                    <div key={doc.contentKey} style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{doc.contentKey}</div>
                      <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{doc.error ?? 'Unknown error'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {doc.owner ? `${doc.owner} · ` : ''}{doc.attempts ?? 0} attempt(s) · {ago(doc.updatedAt, now)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
          </>
          ) : (
          <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <Button
              kind="primary" disabled={!!busy || picked.size === 0} loading={busy === 'rebuild'}
              onClick={async () => {
                const keys = Array.from(picked.keys());
                if (await perform('rebuild', 'rebuild', { keys }, `Create new embeddings for ${keys.length} document(s) from their original files?\n\nThis only creates new embeddings next to the old ones; no assistant or chat uses them until you move references (step 4). It re-runs embedding and question generation, billed to the migration account.`)) {
                  setTracked((previous) => Array.from(new Set([...previous, ...keys])));
                  setPicked(new Map());
                }
              }}
            >
              Create new embeddings ({fmt(picked.size)} picked)
            </Button>
            {picked.size === 0 && tracked.length === 0 && <span style={muted}>Select documents in step 1 first.</span>}
          </div>
          {picked.size > 0 && (
            <div style={{ marginBottom: 12, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Picked, not started yet</div>
              {Array.from(picked.entries()).map(([key, name]) => (
                <div key={key} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0', wordBreak: 'break-all' }}>{name || key.split('/').pop()}</div>
              ))}
            </div>
          )}
          {tracked.length > 0 && (
            <CreationProgress keys={tracked} version={version} onRows={setTrackedRows} onContinue={() => setStep(4)} onClear={() => { setTracked([]); setTrackedRows({}); }} />
          )}
          </>
          )}
          <div style={{ marginTop: 16 }}>
            <LiveCard health={inventory?.health} queues={status.queues} migrating={status.migrating} />
          </div>
        </Step>)}

        {step === 4 && (
        <Step
          n={4} title="Move references"
          subtitle="Make chat and assistants read from the new embeddings. This is the step that changes what users get."
        >
          <Notice>
            Until you do this, every assistant and file keeps using the old embeddings. Moving a document’s references copies who can read it
            to the new embeddings first, points its file records at them, and then changes the document id saved inside every assistant that uses
            it (the newest version of each, in place, with no new version). Nothing is deleted, and “Roll back” puts all of it back right away.
          </Notice>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Stat label="Ready to move" value={fmt(readyCount)} loading={checkingDocs} hint={mode === 'pick' ? 'Of the documents you selected' : 'New embeddings created and checked'} />
            <Stat label="References moved" value={fmt(movedCount)} tone="good" loading={checkingDocs} />
            <Stat label="Rolled back" value={fmt(pipeline?.rolledback)} />
            <Stat
              label="Assistants to update" value={fmt(willUpdate + pendingUpdate)} tone={pendingUpdate ? 'warn' : undefined}
              loading={usageState === 'loading' || checkingDocs}
              hint={usageState === 'failed' ? 'Could not check which assistants use these documents. Press Refresh counts or reopen this step.' : `${fmt(willUpdate)} when you move references · ${fmt(pendingUpdate)} moved documents still stored under the old id${usageNames ? ` (${usageNames})` : ''}`}
            />
          </div>
          {mode === 'pick' && tracked.length === 0 && <p style={{ ...muted, margin: '0 0 12px' }}>Create new embeddings for some selected documents first (step 3).</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Button
              kind="primary" disabled={!!busy || !toMove} loading={busy === 'cutover'}
              onClick={() => perform('cutover', 'cutover', mode === 'pick' ? { keys: [...readyKeys, ...staleKeys] } : { all: true }, `Move the references of ${mode === 'pick' ? `these ${readyKeys.length} document(s)` : 'up to 50 documents'} to their new embeddings and update the assistants that use them?\n\nEach one has complete, checked new embeddings. Who can read the document is copied to the new embeddings first. Nothing is deleted and the old embeddings stay as they are.\n\nIf answers look wrong, “Roll back” in this step puts everything back right away (until you remove old embeddings).`)}
            >
              Move references ({fmt(toMove)})
            </Button>
            <Button
              kind="danger" disabled={!!busy || !movedCount} loading={busy === 'rollback'}
              onClick={() => perform('rollback', 'rollback', mode === 'pick' ? { keys: movedKeys } : { all: true }, 'Point these documents back to their old embeddings? Use this if answers look wrong.')}
            >
              Roll back ({fmt(movedCount)})
            </Button>
          </div>
          {mode === 'pick' && tracked.length > 0 && (
            <CreationProgress keys={tracked} version={version} onRows={setTrackedRows} onClear={() => { setTracked([]); setTrackedRows({}); }} />
          )}
          <ToggleRow
            label="Move references automatically"
            description="Move a document's references as soon as its new embeddings are created and checked. Automatic moves cannot update the ids saved in assistants (that needs your login); they keep working, and pressing “Move references” later updates them. Off means you press “Move references” yourself, which is recommended for the first run."
            checked={autoCutover}
            onChange={edit(setAutoCutover)}
          />
        </Step>)}

        {step === 5 && (
        <Step
          n={5} title="Clean up"
          subtitle={`After references are moved and working, remove the old embeddings from the legacy database. Only documents whose new embeddings exist are cleaned.`}
        >
          <Notice>This is the only step that deletes anything, and it cannot be undone: once old embeddings are removed, that document can no longer be rolled back. Nothing is ever removed automatically. Old embeddings stay until you press “Remove old embeddings”, which acts on every document whose references have moved and whose new embeddings exist. Use “Preview cleanup” first to see exactly which.</Notice>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <Stat label="References moved" value={fmt(pipeline?.cutover)} tone="good" />
            <Stat label="Old embeddings removed" value={fmt(pipeline?.cleaned)} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button disabled={!!busy || !pipeline?.cutover} loading={busy === 'preview'} onClick={() => perform('preview', 'preview_cleanup')}>Preview cleanup</Button>
            <Button
              disabled={!!busy || !pipeline?.cutover || !status.legacyCleanupConfigured} loading={busy === 'cleanup' || !!status.config.cleanupRequested}
              title={status.legacyCleanupConfigured ? undefined : 'The legacy cleanup function is not deployed'}
              onClick={() => perform('cleanup', 'cleanup', {}, `Remove the old PostgreSQL embeddings of every document whose references have moved? Only documents whose new embeddings exist are cleaned. This cannot be undone and rollback will no longer be possible for them.`)}
            >
              Remove old embeddings
            </Button>
          </div>
          {cleanRun && (() => {
            const removed = Math.min(cleanRun.total, Math.max(0, (pipeline?.cleaned ?? 0) - cleanRun.baseline));
            const running = !!status.config.cleanupRequested;
            return (
              <div style={{ margin: '12px 0', padding: 14, border: '1px solid var(--accent)', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Removing old embeddings: {fmt(removed)} of {fmt(cleanRun.total)} done
                  {running ? ' (updates every few seconds)' : removed >= cleanRun.total ? ', finished' : `, finished; ${fmt(cleanRun.total - removed)} were skipped (Preview cleanup shows why)`}
                </div>
                <Bar value={removed} max={Math.max(1, cleanRun.total)} color="#16a34a" />
              </div>
            );
          })()}
          <CleanupPreviewPanel preview={cleanupPreview} />
        </Step>)}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <Button disabled={step === 1} onClick={() => setStep(step - 1)}>Back</Button>
          <Button kind={step < STEP_LABELS.length ? 'primary' : 'plain'} disabled={step === STEP_LABELS.length} onClick={() => setStep(step + 1)}>Next</Button>
        </div>
      </Collapsible>

      <Collapsible
        title="Clean up orphaned files"
        summary="Synced drive files, scraped web pages and group files that no assistant uses any more"
      >
        <OrphanPanel onChanged={() => { setChangedSince(true); load(); }} />
      </Collapsible>
    </div>
  );
};

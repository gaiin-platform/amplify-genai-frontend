import React, { FC, useEffect, useState } from 'react';
import { Button, Stat, ago, fmt } from './RagMigrationUi';
import { CostEstimate, MigrationCosts, runMigrationAction } from '@/services/ragMigrationService';

const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)' };

/** Dollars, with enough digits that a few cents never shows as $0.00. */
export const money = (value: number | undefined | null): string => {
  const n = value ?? 0;
  return `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
};

/**
 * A rough cost of the chosen documents (or of the next batch), shown before anything is started. It is asked for again
 * when the choice changes. Nova and question generation are worked out from each document's stored token count and the
 * model prices; OCR is a ceiling, because which pages need it is only known once the file is read.
 */
export const CostEstimateBox: FC<{ keys?: string[]; count?: number }> = ({ keys, count }) => {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>(keys ? 'loading' : 'idle');
  const signature = keys ? keys.join('|') : `next:${count ?? ''}`;

  const ask = async (isCurrent: () => boolean) => {
    setState('loading');
    const result = await runMigrationAction('estimate', keys ? { keys: keys.slice(0, 50) } : { count });
    if (!isCurrent()) return;
    if (result.success && result.data) { setEstimate(result.data as CostEstimate); setState('ready'); } else setState('failed');
  };

  useEffect(() => {
    setEstimate(null);
    if (!keys) { setState('idle'); return undefined; }          // the next batch is only worked out when asked: it can take a minute
    if (keys.length === 0) return undefined;
    let current = true;
    const timer = setTimeout(() => ask(() => current), 400);
    return () => { current = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (keys && keys.length === 0) return null;
  const totals = estimate?.totals;
  const counted = estimate ? estimate.docs.filter((doc) => doc.known).length : 0;
  const ocr = totals?.ocrMax
    ? { value: `up to ${money(totals.ocrMax)}`, hint: `${fmt(totals.ocrPdfs)} PDF(s) with little text per page, if every page were scanned${totals.ocrOffice ? `; pictures in ${fmt(totals.ocrOffice)} Office file(s) may also be read ($0.0015 a page)` : ''}` }
    : totals?.ocrPdfs || totals?.ocrOffice
      ? { value: 'Possible', hint: `${totals.ocrOffice ? `Pictures in ${fmt(totals.ocrOffice)} Office file(s) may be read ($0.0015 a page read). ` : ''}${totals.ocrPdfs ? `${fmt(totals.ocrPdfs)} PDF(s) with unknown page counts. ` : ''}Known only once the file is opened` }
      : { value: 'None expected', hint: totals?.noOcr ? 'PDFs here have text on their pages, and the other file types are not read by OCR' : undefined };
  const basis = estimate?.assumptions.callBasis;
  return (
    <div style={{ marginBottom: 12, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          Estimated cost {estimate ? `for ${fmt(counted)} document(s)` : keys ? '' : `of the next ${fmt(count)} document(s)`}
          <span style={{ ...muted, fontWeight: 400, marginLeft: 6 }}>an estimate, not a bill</span>
        </div>
        {!keys && <Button disabled={state === 'loading'} loading={state === 'loading'} onClick={() => ask(() => true)}>{estimate ? 'Estimate again' : 'Estimate'}</Button>}
      </div>
      {state === 'idle' && <p style={{ ...muted, margin: 0 }}>Works out the next documents in the queue (it lines them up from your scope first, which can take a minute).</p>}
      {state === 'failed' && <p style={{ ...muted, margin: 0 }}>Could not work out an estimate right now.</p>}
      {(state === 'loading' || state === 'ready') && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Stat
              label="Nova embeddings" value={money(totals?.embedding)} loading={state === 'loading'}
              hint={totals?.images ? `Includes up to ${fmt(totals.images)} page images at ${money(estimate?.assumptions.imagePrice)} each` : undefined}
            />
            <Stat label="Question generation" value={money(totals?.qa)} loading={state === 'loading'} hint={estimate?.qaModel ? `Written by ${estimate.qaModel}` : undefined} />
            <Stat label="Text reading (OCR)" value={ocr.value} loading={state === 'loading'} hint={ocr.hint} />
            <Stat label="Without OCR" value={money((totals?.embedding ?? 0) + (totals?.qa ?? 0))} tone="good" loading={state === 'loading'} hint="Embeddings plus questions" />
          </div>
          {!!totals?.unknown && (
            <p style={{ ...muted, margin: '8px 0 0' }}>{fmt(totals.unknown)} document(s) have no stored size and are not counted.</p>
          )}
          {estimate && (
            <p style={{ ...muted, margin: '8px 0 0' }}>
              About {fmt(totals?.chunks)} chunks (roughly {fmt(estimate.assumptions.chunkTokens)} tokens each), {fmt(estimate.assumptions.qaCallsPerChunk)} question calls per chunk at
              {' '}{money(estimate.assumptions.callCost)} a call{basis === 'assumed'
                ? ', an assumed price: the migration account has no recent calls to measure yet'
                : basis ? `, the average of its last ${fmt(basis.calls)} calls (${basis.model === 'mixed' ? 'several models' : basis.model}, ${fmt(basis.avgInput)} tokens in and ${fmt(basis.avgOutput)} out, including the chat service's own instructions)` : ''}.
              Page images are counted at one per page, the most there could be. Their price is from a third-party catalog and not yet confirmed with AWS.
            </p>
          )}
        </>
      )}
    </div>
  );
};

/** What the migration has cost so far, across every admin who ran it. */
export const CostOverview: FC<{ costs?: MigrationCosts | null; busy: boolean; now: number; onRefresh: () => void }> = ({ costs, busy, now, onRefresh }) => {
  const spent = costs?.spent;
  const questions = costs?.billedQuestions?.total;
  const total = (spent?.embeddingCost ?? 0) + (spent?.ocrCost ?? 0) + (questions ?? spent?.qaCost ?? 0);
  const admins = costs?.billedQuestions?.admins ?? [];
  return (
    <div style={{ borderTop: '2px solid #16a34a', paddingTop: 12, marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>What the migration has cost</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={muted}>{busy ? 'Working it out…' : costs ? `Worked out ${ago(costs.generatedAt, now)}` : 'Not worked out yet'}</span>
          <Button disabled={busy} loading={busy} onClick={onRefresh}>Refresh costs</Button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat label="Total" value={money(total)} tone="good" loading={busy && !costs} hint="Embeddings, OCR and question generation" />
        <Stat label="Nova embeddings" value={money(spent?.embeddingCost)} loading={busy && !costs} hint="Recorded for each call" />
        <Stat label="Text reading (OCR)" value={money(spent?.ocrCost)} loading={busy && !costs} hint="Textract pages, recorded for each run" />
        <Stat
          label="Question generation" value={money(questions ?? spent?.qaCost)} loading={busy && !costs}
          hint={questions !== undefined
            ? `Billed to the migration account${admins.length > 1 ? ` by ${fmt(admins.length)} admins` : ''}. Worked out per document: ${money(spent?.qaCost)}`
            : 'Counted per call and priced at the recent average'}
        />
      </div>
      {(costs?.billedError || costs?.pricingError) && (
        <p style={{ ...muted, margin: '8px 0 0', color: '#d97706' }}>
          {costs.billedError ? `The billed question generation total could not be read (${costs.billedError}), so the total above leaves it out.` : ''}
          {costs.pricingError ? ` Question calls could not be priced (${costs.pricingError}).` : ''}
        </p>
      )}
      {admins.length > 1 && (
        <p style={{ ...muted, margin: '8px 0 0' }}>
          Question generation by admin: {admins.map((admin) => `${admin.user.slice(0, 8)} ${money(admin.total)}`).join(' · ')}
        </p>
      )}
      <p style={{ ...muted, margin: '8px 0 0' }}>
        Counted from when each cost started being recorded, so documents rebuilt earlier show no embedding or OCR figure. Lambda running time is not included.
      </p>
    </div>
  );
};

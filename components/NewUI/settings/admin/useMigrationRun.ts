import { useCallback, useEffect, useRef, useState } from 'react';
import { MigrationStatus, runMigrationAction } from '@/services/ragMigrationService';

export type RunState = 'idle' | 'running' | 'paused';

/** Documents whose new embeddings are done one way or the other (ready, moved, cleaned or failed). */
export const finishedCount = (pipeline?: MigrationStatus['pipeline']): number =>
  (pipeline?.built ?? 0) + (pipeline?.cutover ?? 0) + (pipeline?.cleaned ?? 0) + (pipeline?.failed ?? 0);

const ROUND_MS = 15_000;            // how often a running migration looks for room to start more documents
const LOGIN_MARGIN_S = 120;         // stop starting documents this long before the login expires

interface Settings {
  batchSize: number;
  maxInFlight: number;
  /** Stop after starting this many documents in one run (null = no limit). */
  maxDocs: number | null;
}

/**
 * Drives a bulk migration from this page: it keeps starting documents, a few at a time, whenever fewer than
 * "most at once" are being rebuilt, until the scope is used up, the limit is reached, it is paused, or the login
 * is about to expire. Starting needs the admin's own login (nothing is stored on the server), so it runs only
 * while the page is open. Documents already being rebuilt are never recalled; they finish on their own.
 */
export const useMigrationRun = (getStatus: () => MigrationStatus | null, getSettings: () => Settings, onProgress: () => void) => {
  const [state, setState] = useState<RunState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [started, setStarted] = useState(0);
  const [loginExpiresAt, setLoginExpiresAt] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);              // a request that starts documents is out
  const [baseline, setBaseline] = useState(0);                  // documents already finished when this run began

  const stateRef = useRef<RunState>('idle');
  const startedRef = useRef(0);
  const expiryRef = useRef<number | null>(null);
  const working = useRef(false);

  const halt = useCallback((next: RunState, text: string | null) => {
    stateRef.current = next;
    setState(next);
    setMessage(text);
  }, []);

  const round = useCallback(async () => {
    if (working.current || stateRef.current !== 'running') return;
    const status = getStatus();
    if (!status) return;
    if (expiryRef.current && Date.now() / 1000 > expiryRef.current - LOGIN_MARGIN_S) {
      halt('paused', 'Your login is about to expire, so no more documents are being started. Sign in again, then press Start to continue.');
      return;
    }
    const { batchSize, maxInFlight, maxDocs } = getSettings();
    const room = maxInFlight - (status.pipeline.building ?? 0);
    const remaining = maxDocs ? maxDocs - startedRef.current : Number.POSITIVE_INFINITY;
    if (remaining <= 0) {
      halt('idle', `Stopped: ${startedRef.current} document(s) were started, the limit you set.`);
      return;
    }
    const count = Math.min(batchSize, room, remaining, 50);
    if (count <= 0) return;                                  // wait for some of the running ones to finish

    working.current = true;
    setStarting(true);
    const result = await runMigrationAction('migrate', { count });
    working.current = false;
    setStarting(false);
    if (stateRef.current !== 'running') return;              // paused while the request was out
    if (!result.success) {
      halt('paused', result.error ?? 'Starting documents did not work.');
      return;
    }
    const data = result.data ?? {};
    startedRef.current += data.started ?? 0;
    setStarted(startedRef.current);
    if (data.loginExpiresAt) {
      expiryRef.current = data.loginExpiresAt;
      setLoginExpiresAt(data.loginExpiresAt);
    }
    if (!data.started && !data.queuedLeft && !data.couldNotStart) {
      halt('idle', startedRef.current ? `Done: ${startedRef.current} document(s) were started. Nothing else in this scope is waiting. They keep being created on their own; progress is below.` : 'Nothing in this scope is waiting to be migrated.');
    }
    onProgress();
  }, [getStatus, getSettings, halt, onProgress]);

  useEffect(() => {
    if (state !== 'running') return undefined;
    const timer = setInterval(round, ROUND_MS);
    return () => clearInterval(timer);
  }, [state, round]);

  const start = useCallback(() => {
    if (stateRef.current === 'running') return;
    if (stateRef.current === 'idle') {                       // a new run; resuming a paused one keeps its count
      startedRef.current = 0;
      setStarted(0);
      setBaseline(finishedCount(getStatus()?.pipeline));
    }
    halt('running', null);
    round();
  }, [halt, round, getStatus]);

  const pause = useCallback(() => {
    if (stateRef.current === 'running') halt('paused', 'Paused. Documents already being rebuilt keep going; no new ones are started.');
  }, [halt]);

  const stop = useCallback(() => halt('idle', null), [halt]);

  return { state, message, started, loginExpiresAt, starting, baseline, start, pause, stop };
};

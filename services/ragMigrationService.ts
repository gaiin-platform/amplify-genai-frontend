import { doRequestOp } from './doRequestOp';

const URL_PATH = '/rag_migration';
const SERVICE_NAME = 'ragMigration';

export type MigrationMode = 'assistant' | 'all';
export type ActivityWindow = null | 30 | 90 | 180 | 365;
export type DocStatus = 'planned' | 'building' | 'built' | 'cutover' | 'rolledback' | 'failed' | 'cleaned';

export type DocKind = 'upload' | 'website' | 'drive';
export type AssistantType = 'personal' | 'group';

export interface MigrationScope {
  mode: MigrationMode;
  activeWithinDays: ActivityWindow;
  /** Only these sources; null or empty means all. */
  kinds?: DocKind[] | null;
  /** Assistant mode only: only documents used by these kinds of assistant; null or empty means all. */
  assistantTypes?: AssistantType[] | null;
}

export interface MigrationConfig {
  scope: MigrationScope;
  batchSize: number;
  maxInFlight: number;
  autoCutover: boolean;
  migrateOnAccess: boolean;
  maxDocs: number | null;
  planRequested: boolean;
  inventoryRequested: boolean;
  cleanupRequested: boolean;
  lastError?: string | null;
  lastTick?: number | null;
  lastPlan?: { at: number; considered: number; added: number } | null;
  updatedBy?: string | null;
}

export interface ScopeEstimate {
  documents: number;
  childFiles: number;
  estimatedEmbeddingCalls: number;
  estimatedQaCalls: number;
}

export interface MigrationInventory {
  generatedAt: number;
  legacy: {
    total: number;
    complete: number;
    incomplete: number;
    assistantReferenced: number;
    otherEmbedded: number;
    neverAccessedSinceTracking: number;
  };
  global2: { total: number; complete: number };
  migrated: number;
  ageBuckets: { d30: number; d90: number; d180: number; d365: number; older: number };
  scopes: Record<string, ScopeEstimate>;
  /** Documents still to migrate, by assistant use, source and how recently used; the page sums these for any scope. */
  facets?: { assistant: boolean; types: AssistantType[]; kind: DocKind; bucket: string; documents: number; childFiles: number }[];
  sites?: Record<string, number>;
  pipeline?: Record<DocStatus, number>;
  health?: MigrationHealth;
}

export type Namespace = 'global' | 'global2' | 'preHash';
export type DocState = 'completed' | 'failed' | 'processing' | 'starting' | 'noStatus';

export interface UploadedFile {
  key: string;
  kind?: DocKind;
  site?: string | null;
  sourceUrl?: string | null;
  owner: string;
  name?: string | null;
  type?: string | null;
  createdAt?: string | null;
}

export interface FileDetails {
  uploads: number;
  files: UploadedFile[];
}

export interface AccessSummary {
  users: number;
  assistants: number;
  groups: number;
}

export interface HealthDoc {
  file?: FileDetails;
  contentKey: string;
  state: DocState;
  owner?: string | null;
  totalChunks: number;
  chunksDone: number;
  chunksFailed: number;
  lastUpdated?: string | null;
  reason?: 'failed' | 'stuck' | 'failed chunks';
}

export interface MigrationHealth {
  generatedAt: number;
  uploads: { userFiles: Record<Namespace, number>; uniqueContent: Record<Namespace, number> };
  documents: Record<Namespace, Record<DocState, number> & { total: number }>;
  chunks: Record<Namespace, { completed: number; failed: number; processing: number; starting: number; other: number; docsWithFailedChunks: number }>;
  stuck: Record<Namespace, number>;
  stuckAfterSeconds: number;
  orphans: Record<Namespace, number>;
  attention: HealthDoc[];
  attentionCount: number;
  inFlight: HealthDoc[];
  inFlightCount: number;
}

export type QueueDepths = Record<string, { waiting: number | null; working: number | null; delayed: number | null; error?: string }>;

export type BrowseState = 'failed' | 'stuck' | 'processing' | 'starting' | 'completed' | 'failedChunks' | 'noStatus';

export interface BrowseResult {
  documents: HealthDoc[];
  next: string | null;
}

export interface LookupSide {
  key: string;
  progress: (HealthDoc & { chunks: Record<string, number>; failedChunkNumbers: number[] }) | null;
  access: { principal: string; level: string }[];
  accessSummary: AccessSummary;
}

export interface LookupResult {
  query: string;
  contentKey: string;
  pointer: Record<string, string> | null;
  file: FileDetails;
  legacy: LookupSide;
  global2: LookupSide;
  migration: MigrationDoc | null;
}

export interface SearchedFile {
  key: string;
  name?: string | null;
  type?: string | null;
  owner: string;
  /** null when the file has no embedding (RAG off, or uploaded before content hashing). */
  contentKey: string | null;
  state: DocState | null;
  chunksDone: number;
  totalChunks: number;
  migration: DocStatus | null;
}

export interface SearchResult {
  files: SearchedFile[];
  /** More files matched than are shown; narrow the search. */
  truncated: boolean;
}

export type OrphanKind = 'assistantGone' | 'drive' | 'website' | 'group';

export interface OrphanExample {
  key: string;
  name?: string | null;
  type?: string | null;
  owner: string;
  why?: string;
}

export interface OrphanCategory {
  id: OrphanKind;
  label: string;
  /** Can be deleted now. */
  removable: number;
  /** An assistant still mentions it (kept). */
  inUse: number;
  /** Its content still has embeddings, which an admin cannot delete here (kept). */
  embeddings: number;
  /** Used in a chat lately (kept). */
  recent: number;
  /** Created or changed in the last 14 days (kept). */
  tooNew: number;
  /** A migration record exists for it (kept). */
  migrating: number;
  examples: OrphanExample[];
  embeddingExamples: OrphanExample[];
}

export interface OrphanReport {
  categories: OrphanCategory[];
  examined: number;
  truncated: boolean;
}

export interface OrphanRemoval {
  category: OrphanKind;
  removed: number;
  uploadOnly: number;
  withContent: number;
  kept: Record<string, number>;
  errors: number;
  more: boolean;
}

export interface CleanupPreview {
  switched: number;
  ready: number;
  legacyCleanupConfigured: boolean;
  note: string;
  documents: { contentKey: string; childFiles?: number; ready: boolean; blockers: string[] }[];
}

export interface MigrationDoc {
  contentKey: string;
  status: DocStatus;
  trigger?: 'bulk' | 'access';
  owner?: string;
  childFiles?: number;
  assistantReferenced?: boolean;
  attempts?: number;
  error?: string;
  cleanupNote?: string;
  createdAt?: number;
  updatedAt?: number;
  startedAt?: number;
  builtAt?: number;
  cutoverAt?: number;
}

/** Which assistants use a document: how many store the old id and how many already store the new one. */
export interface AssistantUsage {
  status: DocStatus | null;
  onOld: number;
  onNew: number;
  names: string[];
}

export interface MigrationStatus {
  config: MigrationConfig;
  inventory: MigrationInventory | null;
  inventoryAgeSeconds: number | null;
  pipeline: Record<DocStatus, number>;
  legacyCleanupConfigured: boolean;
  inSecretSweepWindow: boolean;
  failures: MigrationDoc[];
  queues?: QueueDepths;
  /** Documents whose new embeddings are being created right now, read fresh on every status call. */
  migrating?: (HealthDoc & { legacyKey: string; startedAt?: number })[];
  serverTime: number;
}

export type MigrationAction =
  | 'migrate' | 'plan' | 'refresh_inventory' | 'retry_failed'
  | 'cutover' | 'rollback' | 'cleanup' | 'dismiss_error'
  | 'update_assistants' | 'assistant_usage' | 'lookup' | 'rebuild' | 'preview_cleanup' | 'browse' | 'search' | 'clear_queue' | 'orphans' | 'remove_orphans';

export interface MigrationSettingsPatch {
  scope?: MigrationScope;
  batchSize?: number;
  maxInFlight?: number;
  maxDocs?: number | null;
  autoCutover?: boolean;
  migrateOnAccess?: boolean;
}

interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const call = async <T>(op: string, data: any, enablePolling = false): Promise<Result<T>> => {
  try {
    const result = await doRequestOp({ method: 'POST', path: URL_PATH, op, data, service: SERVICE_NAME, enablePolling });
    if (!result) return { success: false, error: 'No response from the server' };
    // A polled (long-running) call reports a failure as `message`, a direct call as `error`.
    return result.success === false && !result.error ? { ...result, error: result.message ?? 'Request failed' } : result;
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Request failed' };
  }
};

export const getMigrationStatus = () => call<MigrationStatus>('/status', {});

export const listMigrationDocs = (status: DocStatus, limit = 50) =>
  call<MigrationDoc[]>('/docs', { status, limit });

export const updateMigrationSettings = (patch: MigrationSettingsPatch) => call<void>('/settings', patch);

export const runMigrationAction = (
  action: MigrationAction,
  extra: {
    keys?: string[]; all?: boolean; query?: string; count?: number;
    state?: BrowseState; namespace?: 'global' | 'global2'; limit?: number; start?: string | null;
    category?: OrphanKind; confirm?: string;
  } = {},
) => call<any>('/action', { action, ...extra }, true); // actions can outlast the 29 s gateway limit, so the result is polled for

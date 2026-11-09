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
  note: string;
  documents: { contentKey: string; childFiles?: number; ready: boolean; blockers: string[] }[];
}

export interface MigrationDoc {
  contentKey: string;
  status: DocStatus;
  trigger?: 'bulk' | 'access' | 'manual';
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
  /** Added up as the rebuild runs: Nova embeddings and Textract are recorded; question calls are counted and priced at the recent average. */
  embeddingCost?: number;
  ocrCost?: number;
  qaCost?: number;
  qaCalls?: number;
}

/** Which assistants use a document: how many store the old id and how many already store the new one. */
export interface AssistantUsage {
  status: DocStatus | null;
  onOld: number;
  onNew: number;
  names: string[];
}

/** What the migration has cost, refreshed on demand ("Refresh costs"). All figures are USD. */
export interface MigrationCosts {
  generatedAt: number;
  /** Nova embeddings and Textract pages are exact; question generation is counted per call and priced at the recent average. */
  spent: { embeddingCost: number; ocrCost: number; qaCost: number; qaCalls: number; documents: number };
  /** What the chat service billed the migration account for question generation, across every admin who ran the migration. */
  /** Set when part of the figures could not be read: what went wrong, so the Overview can say what is missing. */
  billedError?: string;
  pricingError?: string;
  billedQuestions?: { total: number; admins: { user: string; thisMonth: number; total: number }[] };
}

/** A rough cost of rebuilding chosen documents, before anything is started. */
export interface CostEstimate {
  docs: {
    contentKey: string; name?: string | null; known: boolean; chunks?: number; tokens?: number; images?: number; embedding?: number; qa?: number;
    /** pdf: could need Textract, `max` is every page; pictures: an Office file whose pictures may be read; none: no OCR expected. */
    ocr?: { kind: 'pdf' | 'pictures' | 'none'; max: number };
  }[];
  totals: { embedding: number; qa: number; ocrMax: number; ocrPdfs: number; ocrOffice: number; noOcr: number; unknown: number; chunks: number; images: number };
  assumptions: {
    chunkTokens: number; novaTokensPerChunk: number; qaCallsPerChunk: number; callCost: number; imagePrice: number;
    /** What a question call is priced from: the migration account's recent calls, or an assumption while there are none. */
    callBasis: 'assumed' | { calls: number; model: string; avgInput: number; avgOutput: number };
  };
  qaModel?: string | null;
}

export interface MigrationStatus {
  config: MigrationConfig;
  costs?: MigrationCosts | null;
  inventory: MigrationInventory | null;
  inventoryAgeSeconds: number | null;
  counting?: boolean;                 // a count of the documents is running right now (started by any visit to this page)
  pipeline: Record<DocStatus, number>;
  inSecretSweepWindow: boolean;
  failures: MigrationDoc[];
  /** Documents waiting to be started (the oldest 20). */
  queued?: MigrationDoc[];
  queues?: QueueDepths;
  /** Documents whose new embeddings are being created right now, read fresh on every status call. */
  migrating?: (HealthDoc & { legacyKey: string; startedAt?: number })[];
  serverTime: number;
}

export type MigrationAction =
  | 'migrate' | 'refresh_inventory' | 'retry_failed'
  | 'cutover' | 'rollback' | 'cleanup' | 'dismiss_error'
  | 'assistant_usage' | 'lookup' | 'rebuild' | 'preview_cleanup' | 'browse' | 'search' | 'clear_queue' | 'orphans' | 'remove_orphans'
  | 'estimate' | 'refresh_costs';

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

export const updateMigrationSettings = (patch: MigrationSettingsPatch) => call<void>('/settings', patch);

export const runMigrationAction = (
  action: MigrationAction,
  extra: {
    keys?: string[]; all?: boolean; query?: string; count?: number;
    state?: BrowseState; namespace?: 'global' | 'global2'; limit?: number; start?: string | null;
    category?: OrphanKind; confirm?: string;
  } = {},
) => call<any>('/action', { action, ...extra }, true); // actions can outlast the 29 s gateway limit, so the result is polled for

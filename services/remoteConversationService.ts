import { Conversation } from "@/types/chat";
import { FolderInterface } from "@/types/folder";
import { compressConversation, saveConversations, uncompressConversation } from "@/utils/app/conversation";
import { storageGet, storageKeys, storageRemove, storageSet } from "@/utils/app/storage";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/state/conversation";
const NO_SUCH_KEY_ERROR = 'NoSuchKey';
const SERVICE_NAME = "conversation";

// Conversations whose compressed payload exceeds this threshold are uploaded via
// presigned S3 PUT URL to bypass the request body limits on the way to the backend.
//
// Measured AFTER compressConversation() on the serialized number[] because:
//   - That is the actual data bulk going into requestOp.ts
//   - requestOp.ts runs a second lzwCompress on the JSON-stringified payload;
//     LZW on a digit/comma string can expand up to ~1.8x when its output codes
//     are re-serialized as JSON, so: wire payload ≈ 1.8 × compressed JSON size
//   - The API Gateway -> Lambda proxy integration is capped at 6 MB (the 10 MB API Gateway limit
//     is not the binding one), so 3 MB × 1.8 = 5.4 MB keeps a safe margin below it.
const LARGE_UPLOAD_THRESHOLD_BYTES = 3 * 1024 * 1024; // 3 MB compressed JSON

// ─────────────────────────────────────────────────────────────────────────────
// Reliable save / delete queue
//
// Cloud chats used to be saved with a fire-and-forget upload whose result was ignored, while the
// local copy was stripped to a metadata stub at the same moment. Any failed upload (network blip,
// expired token, oversize, 5xx) therefore lost the latest messages silently. Now:
//   * every save is persisted locally (IndexedDB) BEFORE the network call and only removed once the
//     server acknowledged it; leftovers are replayed on the next start / when the browser is back
//     online (replayPendingConversationSync)
//   * saves and deletes for the same chat are serialized, and a newer save supersedes a queued one,
//     so a slow early request can never land after (and overwrite) a later one
//   * failures are retried with backoff and surfaced to the user
//   * each save carries the server version we last saw; if the chat was changed elsewhere meanwhile
//     the server rejects it and we keep the user's version as a separate "conflicted copy" instead
//     of silently overwriting the other change
//   * deletes are retried and remembered, so a failed delete cannot resurrect the chat on next sync
// ─────────────────────────────────────────────────────────────────────────────

const PENDING_UPLOAD_PREFIX = 'pendingConversationUpload:';
const PENDING_DELETE_PREFIX = 'pendingConversationDelete:';
const RETRY_DELAYS_MS = [1000, 3000, 8000];
const BACKGROUND_RETRY_MS = 30000;
// Server reasons that will never succeed on retry
const NON_RETRYABLE_REASONS = new Set(['EMPTY_OVERWRITE', 'INVALID_ID', 'INVALID_PAYLOAD']);
// Only warn before closing the tab for saves younger than this: a save that has been failing for longer is
// retried in the background but must not block navigation forever.
const UNLOAD_WARNING_MAX_AGE_MS = 5 * 60 * 1000;
// A held blank chat that was never written in is forgotten after this long.
const HELD_BLANK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// After a failed regular upload, payloads at least this big are retried through the presigned URL path
// (the regular path goes through the API Gateway / Lambda payload limits).
const PRESIGNED_RETRY_MIN_BYTES = 1024 * 1024;
export const CONVERSATION_SAVE_CONFLICT_EVENT = 'conversationSaveConflict';

interface PendingUpload {
    id: string;
    compressed: number[];
    folder: FolderInterface | null;
    // baseline for conflict detection when it cannot be taken from memory (record replayed from a previous session)
    expectedVersion: number | null;
    savedAt: number;
    // account that created the record; a record is only replayed for the same account
    user?: string | null;
}

interface UploadResult {
    success: boolean;
    version?: number;
    reason?: string;
    message?: string;
}

// Server version (S3 LastModified, ms) of each chat as last fetched/saved by this tab.
// `null` = we wrote it but do not know the new version (presigned upload): the next save carries no baseline.
const remoteVersions = new Map<string, number | null>();
let currentSyncUser: string | null = null;
/** Tell the sync layer which account is signed in; pending saves/deletes are only replayed for their own account. */
export const setConversationSyncUser = (user: string | null | undefined) => {
    currentSyncUser = user ? user.toLowerCase() : null;
    if (currentSyncUser && deferredUploads.size > 0) flushDeferredUploads();
};

// Saves requested while nobody is signed in (e.g. the blank chat the page creates on load, behind the login
// page). Nothing can be sent, and a failure toast / a stored retry record would be wrong: they are kept in
// memory only and sent as soon as the user is known.
const deferredUploads = new Map<string, { conversation: Conversation; folders: FolderInterface[]; options: UploadOptions }>();
// ── Held blank chats ─────────────────────────────────────────────────────────────────────────────
// A brand-new chat has nothing worth saving. Creating its cloud object anyway meant every page load (even
// behind the login page) or "New chat" click left another empty chat in the user's cloud list. So a chat
// that is KNOWN to be blank (messageCount === 0) and not in the cloud yet is only held here, in this
// browser. Whatever asks for the chat (fetchRemoteConversation, bulk downloads, ...) gets this copy; the
// cloud object is created by the first real save, which also releases the hold.
const HELD_BLANK_PREFIX = 'heldBlankConversation:';
interface HeldBlank { conversation: Conversation; savedAt: number; user: string | null }
const heldBlankChats = new Map<string, HeldBlank>();

const isKnownBlankChat = (c: Conversation) =>
    c.messageCount === 0 && (c.messages?.length ?? 0) === 0 && (c.compressedMessages?.length ?? 0) === 0;

const holdBlankConversation = async (conversation: Conversation) => {
    const held: HeldBlank = { conversation: { ...conversation, isLocal: false }, savedAt: Date.now(), user: currentSyncUser };
    heldBlankChats.set(conversation.id, held);
    try {
        await storageSet(HELD_BLANK_PREFIX + conversation.id, JSON.stringify(held));
    } catch (e) {
        console.error('Could not persist held blank conversation', e);
    }
};

/** Forget held blank chats (they got content, were deleted, or turned out to exist in the cloud). */
export const releaseHeldBlankConversations = (ids: string[]) => {
    ids.forEach((id) => {
        heldBlankChats.delete(id);
        storageRemove(HELD_BLANK_PREFIX + id).catch(() => undefined);
    });
};

const readHeldBlank = async (id: string): Promise<HeldBlank | undefined> => {
    const inMemory = heldBlankChats.get(id);
    if (inMemory) return belongsToCurrentUser(inMemory.user) ? inMemory : undefined;
    try {
        const raw = await storageGet(HELD_BLANK_PREFIX + id);
        if (!raw) return undefined;
        const held = JSON.parse(raw) as HeldBlank;
        if (!held?.conversation || !belongsToCurrentUser(held.user)) return undefined;
        if (Date.now() - held.savedAt > HELD_BLANK_MAX_AGE_MS) {
            storageRemove(HELD_BLANK_PREFIX + id).catch(() => undefined);
            return undefined;
        }
        heldBlankChats.set(id, held);
        return held;
    } catch {
        return undefined;
    }
};

/** Ids of the chats that exist only in this browser because they are still blank (no cloud object yet). */
export const getHeldBlankConversationIds = async (): Promise<Set<string>> => {
    const ids = new Set<string>();
    const keys = await storageKeys(HELD_BLANK_PREFIX);
    for (const key of keys) {
        const id = key.substring(HELD_BLANK_PREFIX.length);
        if (await readHeldBlank(id)) ids.add(id);
    }
    return ids;
};

const flushDeferredUploads = () => {
    const items = Array.from(deferredUploads.values());
    deferredUploads.clear();
    items.forEach(({ conversation, folders, options }) => {
        uploadConversation(conversation, folders, null, options).catch((e) => console.error('Deferred conversation save failed', e));
    });
};
const belongsToCurrentUser = (owner?: string | null) => !owner || !currentSyncUser || owner === currentSyncUser;
// Latest un-acknowledged save per chat (also mirrored to storage)
const pendingUploads = new Map<string, PendingUpload>();
const uploadSeq = new Map<string, number>();
const pendingDeletes = new Set<string>();
const recentlyDeleted = new Set<string>();
const conflictCopies = new Map<string, string>();
// ids that are themselves conflict copies: a copy is never forked again (bounds the recursion)
const conflictCopyIds = new Set<string>();
const chains = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Per-chat serialization of uploads and deletes
const runExclusive = <T>(id: string, task: () => Promise<T>): Promise<T> => {
    const previous = chains.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    chains.set(id, next);
    next.then(() => undefined, () => undefined).then(() => {
        if (chains.get(id) === next) chains.delete(id);
    });
    return next;
};

let listenersInstalled = false;
let backgroundRetryTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleBackgroundRetry = () => {
    if (backgroundRetryTimer || typeof window === 'undefined') return;
    backgroundRetryTimer = setTimeout(() => {
        backgroundRetryTimer = null;
        replayPendingConversationSync().catch((e) => console.error('Background conversation sync retry failed', e));
    }, BACKGROUND_RETRY_MS);
};

const installListeners = () => {
    if (listenersInstalled || typeof window === 'undefined') return;
    listenersInstalled = true;
    // Warn before closing the tab while a save has not been acknowledged yet. (The pending record is
    // also in storage, so it is replayed on the next load if the user leaves anyway.)
    window.addEventListener('beforeunload', (event) => {
        const cutoff = Date.now() - UNLOAD_WARNING_MAX_AGE_MS;
        if (Array.from(pendingUploads.values()).some((r) => r.savedAt > cutoff)) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
    window.addEventListener('online', () => {
        replayPendingConversationSync().catch((e) => console.error('Conversation sync retry failed', e));
    });
};

export const hasUnsavedConversations = () => pendingUploads.size > 0;
export const hasPendingUpload = (id: string) => pendingUploads.has(id);
export const getKnownRemoteVersion = (id: string) => remoteVersions.get(id);

/** Forget an unsent save (e.g. the user's move to the cloud failed and the chat must stay private/local). */
export const cancelPendingUpload = (id: string) => {
    deferredUploads.delete(id);
    releaseHeldBlankConversations([id]);
    uploadSeq.set(id, (uploadSeq.get(id) ?? 0) + 1);
    const record = pendingUploads.get(id);
    if (record) clearPendingUpload(record);
    storageRemove(PENDING_UPLOAD_PREFIX + id).catch(() => undefined);
};

const persistPendingUpload = async (record: PendingUpload) => {
    try {
        await storageSet(PENDING_UPLOAD_PREFIX + record.id, JSON.stringify(record));
    } catch (e) {
        console.error('Could not persist pending conversation save', e);
    }
};

const clearPendingUpload = (record: PendingUpload) => {
    // only the exact record that was acknowledged; a newer save for the same chat stays pending
    if (pendingUploads.get(record.id) === record) {
        pendingUploads.delete(record.id);
        storageRemove(PENDING_UPLOAD_PREFIX + record.id).catch(() => undefined);
    }
};

const sendUpload = async (record: PendingUpload, expectedVersion: number | null, forcePresignedAtBytes = LARGE_UPLOAD_THRESHOLD_BYTES): Promise<UploadResult> => {
    const compressedBytes = JSON.stringify(record.compressed).length;
    if (compressedBytes >= forcePresignedAtBytes) {
        return uploadConversationViaPresignedUrl(record.id, record.compressed, record.folder, expectedVersion);
    }
    const result = await doRequestOp({
        method: 'PUT',
        path: URL_PATH,
        op: "/upload",
        data: {
            conversation: record.compressed,
            conversationId: record.id,
            folder: record.folder,
            expectedVersion,
        },
        service: SERVICE_NAME
    });
    return {
        success: !!result?.success,
        version: typeof result?.version === 'number' ? result.version : undefined,
        reason: result?.reason,
        message: result?.message,
    };
};

/**
 * Uploads a large conversation directly to S3 using a presigned PUT URL,
 * bypassing the request body limits of the API.
 *
 * Flow:
 *  1. Ask our backend for a short-lived presigned S3 PUT URL  (tiny request, no payload; the
 *     conflict check happens here)
 *  2. PUT the full conversation JSON straight to S3           (no API Gateway involved)
 */
const uploadConversationViaPresignedUrl = async (
    conversationId: string,
    compressedConversation: any,
    folder: any,
    expectedVersion: number | null
): Promise<UploadResult> => {
    try {
        const queryParams: { [key: string]: string } = { conversationId };
        if (expectedVersion !== null) queryParams.expectedVersion = String(expectedVersion);
        const urlResult = await doRequestOp({
            method: 'GET',
            path: URL_PATH,
            op: "/get-upload-url",
            queryParams,
            service: SERVICE_NAME
        });
        if (!urlResult?.success || !urlResult.presignedUrl) {
            console.error("Failed to get presigned upload URL:", urlResult?.message);
            return { success: false, reason: urlResult?.reason, message: urlResult?.message };
        }

        const body = JSON.stringify({ conversation: compressedConversation, folder: folder });
        const s3Response = await fetch(urlResult.presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        if (!s3Response.ok) {
            console.error("S3 presigned PUT failed:", s3Response.status, s3Response.statusText);
            return { success: false, message: `S3 upload failed (${s3Response.status})` };
        }
        // direct S3 write: the new version is unknown here, so the next save has no baseline
        return { success: true };
    } catch (error) {
        console.error("Error uploading large conversation via presigned URL:", error);
        return { success: false, message: String(error) };
    }
};

const sameMessage = (a: any, b: any) => {
    if (a?.id !== undefined && b?.id !== undefined) return a.id === b.id && a.role === b.role;
    return a?.role === b?.role && a?.content === b?.content;
};

// True when the server copy is what we had before our newest edits: its messages are the same as, or the
// beginning of, ours. Then the "conflict" is only our own earlier save (e.g. its response was lost, or a newer
// save of ours was queued behind it) and our version can simply be written over it.
const isSameOrExtendedBy = (remote?: Conversation, ours?: Conversation) => {
    if (!remote || !ours) return false;
    const r = remote.messages ?? [];
    const o = ours.messages ?? [];
    if (r.length > o.length) return false;
    return r.every((message, i) => sameMessage(message, o[i]));
};

type ConflictResolution = { action: 'retry' } | { action: 'done'; ok: boolean };

// The server says the chat changed since we loaded it.
const resolveSaveConflict = async (record: PendingUpload, mustFork: boolean): Promise<ConflictResolution> => {
    const id = record.id;
    const ours = uncompressConversation(record.compressed);
    if (!ours) return { action: 'done', ok: false };

    const remote = await fetchRemoteConversationWithVersion(id);
    // Could not look at the other copy (offline / error): do not guess; the save stays queued and is retried.
    if (!remote) return { action: 'done', ok: false };

    if (!mustFork && isSameOrExtendedBy(remote.conversation, ours)) {
        remoteVersions.set(id, remote.version ?? null);
        return { action: 'retry' };
    }

    // Someone else really changed this chat. Keep the user's version as its own chat.
    // A copy that itself conflicts is left queued (retried later) instead of being copied again.
    if (conflictCopyIds.has(id)) return { action: 'done', ok: false };
    const copyId = conflictCopies.get(id) ?? uuidv4();
    conflictCopyIds.add(copyId);
    const firstTime = !conflictCopies.has(id);
    conflictCopies.set(id, copyId);
    const suffix = ' (conflicted copy)';
    const copy: Conversation = {
        ...ours,
        id: copyId,
        name: ours.name?.endsWith(suffix) ? ours.name : `${ours.name}${suffix}`,
        isLocal: false,
        codeInterpreterRecordId: undefined,
    };
    // pendingUploads still holds `record` for the original id; replace the original's pending save
    // with the copy's, which is uploaded through the normal queue (retry + persistence).
    clearPendingUpload(record);
    remoteVersions.delete(id);
    const saved = await uploadConversation(copy, record.folder ? [record.folder] : []);
    if (saved && firstTime && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CONVERSATION_SAVE_CONFLICT_EVENT, { detail: { originalId: id, copy } }));
    }
    toast.error(
        `"${ours.name}" was changed on another device or tab. Your version was saved as a separate chat: "${copy.name}".`,
        { id: `conversation-conflict-${id}`, duration: 12000 }
    );
    return { action: 'done', ok: saved };
};

const REFUSAL_MESSAGES: { [reason: string]: string } = {
    EMPTY_OVERWRITE: 'A chat could not be saved because the saved cloud copy has more content than this one. Reload the chat to continue.',
    INVALID_ID: 'A chat could not be saved to the cloud because its id is not accepted by the server. Keep it in local storage or export it.',
    INVALID_PAYLOAD: 'A chat could not be saved to the cloud because the server could not read it. Please export it as a backup.',
};

const attemptUpload = async (id: string, maxAttempts: number): Promise<boolean> => {
    let conflictRetries = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const record = pendingUploads.get(id);
        if (!record) return true; // acknowledged (or superseded and handled) in the meantime

        // `null` in remoteVersions means "unknown baseline": send no check rather than a stale one
        const expected = remoteVersions.has(id) ? (remoteVersions.get(id) ?? null) : (record.expectedVersion ?? null);
        const result = await sendUpload(record, expected, attempt >= 1 ? PRESIGNED_RETRY_MIN_BYTES : LARGE_UPLOAD_THRESHOLD_BYTES);

        if (result.success) {
            // a presigned upload does not report the new version; do not keep the old one as a baseline
            remoteVersions.set(id, result.version ?? null);
            clearPendingUpload(record);
            toast.dismiss(`conversation-save-failed-${id}`);
            return true;
        }
        if (result.reason === 'CONFLICT') {
            const resolution = await resolveSaveConflict(record, conflictRetries >= 2);
            if (resolution.action === 'retry') {
                conflictRetries++;
                attempt--; // not a failed attempt: the baseline was refreshed, send again
                continue;
            }
            return resolution.ok;
        }
        if (result.reason && NON_RETRYABLE_REASONS.has(result.reason)) {
            console.error(`Cloud save refused for conversation ${id}: ${result.reason}`);
            clearPendingUpload(record);
            toast.error(REFUSAL_MESSAGES[result.reason] ?? 'A chat could not be saved to the cloud.',
                { id: `conversation-save-refused-${id}`, duration: 10000 });
            return false;
        }
        if (attempt < maxAttempts - 1) await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
    }
    return false;
};

export interface UploadOptions {
    // The chat id may have been deleted earlier in this session (e.g. moving a chat from cloud to
    // local and back); a deliberate re-upload must not be dropped as "resurrecting a deleted chat".
    recreate?: boolean;
}

export const uploadConversation = async (conversation: Conversation, folders: FolderInterface[], abortSignal = null, options: UploadOptions = {}): Promise<boolean> => {
    installListeners();

    const redirectedId = conflictCopies.get(conversation.id);
    if (redirectedId) {
        // This chat already forked after a conflict: keep updating the copy so we never overwrite the other change.
        conversation = { ...conversation, id: redirectedId };
    }

    const id = conversation.id;
    if (options.recreate) {
        recentlyDeleted.delete(id);
        pendingDeletes.delete(id);
        storageRemove(PENDING_DELETE_PREFIX + id).catch(() => undefined);
    } else if (recentlyDeleted.has(id) || pendingDeletes.has(id)) {
        // The user deleted this chat (possibly while it was still streaming): do not bring it back.
        return false;
    }

    // always ensure isLocal is false just in case
    conversation.isLocal = false;

    // A chat that is known to be blank and not in the cloud yet is only held locally (see "Held blank chats").
    if (isKnownBlankChat(conversation) && !pendingUploads.has(id) && !remoteVersions.has(id)) {
        await holdBlankConversation(conversation);
        return true;
    }
    // It has (or had) content: no longer a placeholder, the real save below creates the cloud object.
    if (heldBlankChats.has(id)) releaseHeldBlankConversations([id]);

    if (!currentSyncUser) {
        // not signed in yet: the request would fail, and a stored record would not belong to any account
        deferredUploads.set(id, { conversation, folders, options });
        return false;
    }

    // the "known blank" marker is about the stub in the list, it must not be stored with a chat that has messages
    const compressedConversation = compressConversation(
        conversation.messageCount === undefined ? conversation : { ...conversation, messageCount: undefined });
    if (!compressedConversation) {
        console.error("Failed to compress conversation for upload", id);
        return false;
    }
    const folder = conversation.folderId ? folders.find((f: FolderInterface) => conversation.folderId === f.id) ?? null : null;

    const record: PendingUpload = {
        id,
        compressed: compressedConversation,
        folder,
        expectedVersion: remoteVersions.get(id) ?? null,
        savedAt: Date.now(),
        user: currentSyncUser,
    };
    const seq = (uploadSeq.get(id) ?? 0) + 1;
    uploadSeq.set(id, seq);
    pendingUploads.set(id, record);
    await persistPendingUpload(record);

    return runExclusive(id, async () => {
        // A newer save was queued behind us: it carries the newer content, no need to send this one.
        if (uploadSeq.get(id) !== seq) return true;
        const ok = await attemptUpload(id, RETRY_DELAYS_MS.length + 1);
        if (!ok && pendingUploads.has(id)) {
            // a chat without messages holds nothing the user could lose: retry quietly
            if ((conversation.messages?.length ?? 0) > 0 || (conversation.compressedMessages?.length ?? 0) > 0) {
                toast.error(`Couldn't save "${conversation.name}" to the cloud. We'll keep trying; please don't close this tab yet.`,
                    { id: `conversation-save-failed-${id}`, duration: 8000 });
            }
            scheduleBackgroundRetry();
        }
        return ok;
    });
};

/**
 * Re-sends saves / deletes that were never acknowledged (the page was closed, the network was down).
 * Call once on startup, after login.
 */
export const replayPendingConversationSync = async (): Promise<void> => {
    installListeners();
    // Records are tied to the account that made them; without a known account nothing is replayed
    if (!currentSyncUser) return;
    // housekeeping: forgets held blank chats nobody wrote in for 30 days
    getHeldBlankConversationIds().catch(() => undefined);

    const uploadKeys = await storageKeys(PENDING_UPLOAD_PREFIX);
    // saves that failed earlier in THIS session are still in memory but are no longer running
    const ids = Array.from(new Set<string>(uploadKeys.map((k) => k.substring(PENDING_UPLOAD_PREFIX.length)).concat(Array.from(pendingUploads.keys()))));
    for (const id of ids) {
        try {
            if (recentlyDeleted.has(id) || chains.has(id)) continue; // deleted, or a request is already running for it
            if (!pendingUploads.has(id)) {
                const raw = await storageGet(PENDING_UPLOAD_PREFIX + id);
                if (!raw) continue;
                const record = JSON.parse(raw) as PendingUpload;
                if (!record?.id || !Array.isArray(record.compressed)) { await storageRemove(PENDING_UPLOAD_PREFIX + id); continue; }
                if (!belongsToCurrentUser(record.user)) continue; // another account's unsent chat: leave it alone
                // the user may have saved this chat again while the record was being read: never replace newer data
                if (pendingUploads.has(id) || chains.has(id)) continue;
                pendingUploads.set(id, record);
            }
            const seq = (uploadSeq.get(id) ?? 0) + 1;
            uploadSeq.set(id, seq);
            await runExclusive(id, async () => {
                if (uploadSeq.get(id) !== seq) return true;
                return attemptUpload(id, 1);
            });
        } catch (e) {
            console.error('Could not replay pending conversation save', id, e);
        }
    }

    const deleteKeys = await storageKeys(PENDING_DELETE_PREFIX);
    for (const key of deleteKeys) {
        const id = key.substring(PENDING_DELETE_PREFIX.length);
        const owner = await readDeleteOwner(key);
        if (!belongsToCurrentUser(owner)) continue;
        pendingDeletes.add(id);
        await runExclusive(id, () => attemptDelete(id, 1));
    }

    if (pendingUploads.size > 0 || pendingDeletes.size > 0) scheduleBackgroundRetry();
};

const readDeleteOwner = async (key: string): Promise<string | null> => {
    try {
        const raw = await storageGet(key);
        const parsed = raw ? JSON.parse(raw) : null;
        return typeof parsed?.user === 'string' ? parsed.user : null;
    } catch {
        return null;
    }
};

/** Ids whose deletion has not been confirmed by the server yet; a sync must not bring them back. */
export const getPendingDeleteIds = async (): Promise<Set<string>> => {
    const ids = new Set<string>(pendingDeletes);
    recentlyDeleted.forEach((id) => ids.add(id));
    try {
        for (const key of await storageKeys(PENDING_DELETE_PREFIX)) {
            if (belongsToCurrentUser(await readDeleteOwner(key))) ids.add(key.substring(PENDING_DELETE_PREFIX.length));
        }
    } catch { /* storage unavailable: fall back to the in-memory view */ }
    return ids;
};

// Loads the freshest locally held version of a chat whose save was not acknowledged yet
const getUnsavedConversation = async (conversationId: string): Promise<Conversation | undefined> => {
    const inMemory = pendingUploads.get(conversationId);
    if (inMemory) return uncompressConversation(inMemory.compressed);
    try {
        const raw = await storageGet(PENDING_UPLOAD_PREFIX + conversationId);
        if (raw) {
            const record = JSON.parse(raw) as PendingUpload;
            if (belongsToCurrentUser(record.user)) return uncompressConversation(record.compressed);
            return undefined;
        }
    } catch {
        return undefined;
    }
    // a blank chat that was never sent to the cloud lives only here
    return (await readHeldBlank(conversationId))?.conversation;
};

/** Unsent local versions for the given chat ids (id -> full conversation). Used before reading the cloud copy for a move/export. */
export const getUnsavedConversations = async (ids: string[]): Promise<Map<string, Conversation>> => {
    const found = new Map<string, Conversation>();
    for (const id of ids) {
        const conversation = await getUnsavedConversation(id);
        if (conversation) found.set(id, conversation);
    }
    return found;
};

const fetchRemoteConversationWithVersion = async (conversationId: string): Promise<{ conversation: Conversation; version?: number } | null> => {
    const result = await doRequestOp({
        method: 'GET',
        path: URL_PATH,
        op: "/get",
        queryParams: { "conversationId": conversationId },
        service: SERVICE_NAME
    });
    if (!result?.success) return null;
    const conversation = uncompressConversation(result.conversation);
    if (!conversation) return null;
    return { conversation, version: typeof result.version === 'number' ? result.version : undefined };
};

export const fetchRemoteConversation = async (conversationId: string, conversations?: Conversation[] | (() => Conversation[]), dispatch?: any, silent = false) => {
    // Our own newest, not-yet-acknowledged copy beats whatever the server has
    const unsaved = await getUnsavedConversation(conversationId);
    if (unsaved) return unsaved;

    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
        queryParams: { "conversationId": conversationId },
        service: SERVICE_NAME
    };
    let result = await doRequestOp(op);
    if (result.success) {
        if (typeof result.version === 'number' && !pendingUploads.has(conversationId)) {
            remoteVersions.set(conversationId, result.version);
        }
        return uncompressConversation(result.conversation);
    }

    // Chats saved through the presigned path can be too large for the /get response (Lambda payload limit).
    // /get/multiple hands out presigned download links instead, so try that before giving up.
    if (result.type !== NO_SUCH_KEY_ERROR) {
        try {
            const viaLinks = await fetchMultipleRemoteConversations([conversationId]);
            const found = viaLinks?.data?.[0];
            if (found) {
                if (!pendingUploads.has(conversationId)) remoteVersions.set(conversationId, null);
                return found as Conversation;
            }
        } catch (e) {
            console.error('Fallback download of conversation failed', e);
        }
    }

    console.error("Error fetching conversation: ", result.message);
    if (result.type === NO_SUCH_KEY_ERROR && dispatch && conversations) { //remove conv from history
        // read the list at this moment: the caller's snapshot is from before the request
        const current = typeof conversations === 'function' ? conversations() : conversations;
        const updatedConversations = current.filter((c: Conversation) => c.id !== conversationId);
        dispatch({ field: 'conversations', value: updatedConversations });
        saveConversations(updatedConversations);
    }
    if (!silent) {
        let message = "Unfortunately, we are unable to get your cloud-stored conversation at this time. Please try again later...";
        if (result.type === NO_SUCH_KEY_ERROR) {
            message = "This conversation is no longer accessible, it has been made private in another browser or has been removed by another device.";
        }
        alert(message);
    }
    return null;
};

// only used for the initial sync conversations 
export const fetchAllRemoteConversations = async (days?: number) => {
    try {
        const op = {
            method: 'GET',
            path: URL_PATH,
            op: "/get/all",
            service: SERVICE_NAME,
            queryParams: {},
        };
        if (days) {
            console.log(`Fetching all remote conversations within ${days} days`);
            op.queryParams = { "days": days.toString() };
        }

        const result = await doRequestOp(op);

        // Check if the request was successful
        if (result.success) {
            if (result.truncated) {
                // the server could not list everything within its time limit and returned the newest chats
                toast('Only your most recent cloud conversations were loaded. Older ones are still saved; use "Load older chats" to try again.', { id: 'cloud-list-truncated', duration: 10000 });
            }
            if (!result.presignedUrls) return [];
            return await fetchConversationPresignedUrls(result.presignedUrls);

        } else {
            console.error("Error fetching presigned URL: ", result.message);
            return null;
        }
    } catch (error) {
        console.error("Error during fetch: ", error);
        return null;
    }
};

export const fetchEmptyRemoteConversations = async (abortSignal = null) => {
    try {
        const op = {
            method: 'GET',
            path: URL_PATH,
            op: "/get/empty",
            service: SERVICE_NAME
        };

        const result = await doRequestOp(op);

        // Check if the request was successful
        if (result.success) {
            if (!result.presignedUrls) return { data: null };
            const conversations = await fetchConversationPresignedUrls(result.presignedUrls);
            return { data: conversations, nonEmptyIds: result.nonEmptyIds }

        } else {
            console.error("Error fetching presigned URL: ", result.message);
            return { data: null };
        }
    } catch (error) {
        console.error("Error during fetch: ", error);
        return { data: null };
    }
};

export const fetchMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null) => {
    if (conversationIds.length === 0) return { data: [] };

    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get/multiple",
        data: { conversationIds: conversationIds },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    if (result.success) {
        const conversationData = await fetchConversationPresignedUrls(result.presignedUrls);
        if (!conversationData) return { data: null };
        return {
            data: conversationData.map((c: number[]) => uncompressConversation(c)).filter((c: Conversation | undefined) => c !== undefined),
            failedByNoSuchKey: result.noSuchKeyConversations,
            failed: result.failed
        };

    } else {
        console.error("Error fetching presigned URL: ", result.message);
        return { data: null };
    }
};

// Chunks are independent S3 GETs, so download them concurrently (bounded) instead of one after
// another. Results keep their original order, and any failed chunk fails the whole read, as before.
const PRESIGNED_FETCH_CONCURRENCY = 6;

const fetchConversationPresignedUrls = async (presignedUrls: string[]): Promise<any> => {
    const chunks: any[][] = new Array(presignedUrls.length);
    let nextIndex = 0;
    let failed = false;

    const worker = async () => {
        while (!failed) {
            const i = nextIndex++;
            if (i >= presignedUrls.length) return;
            try {
                const response = await fetch(presignedUrls[i], {
                    method: 'GET',
                    signal: null,
                });

                if (!response.ok) {
                    console.error("Error fetching presigned at index:", i);
                    failed = true;
                    return;
                }
                chunks[i] = await response.json();
            } catch (error) {
                console.error("Error fetching presigned at index:", i, error);
                failed = true;
                return;
            }
        }
    };

    const workerCount = Math.min(PRESIGNED_FETCH_CONCURRENCY, presignedUrls.length);
    await Promise.all(Array.from({ length: workerCount }, worker));

    if (failed) return null;
    // One concatenation at the end rather than re-spreading the accumulator per chunk.
    return ([] as any[]).concat(...chunks);
}

const attemptDelete = async (id: string, maxAttempts: number): Promise<boolean> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const result = await doRequestOp({
            method: 'DELETE',
            path: URL_PATH,
            op: "/delete",
            queryParams: { "conversationId": id },
            service: SERVICE_NAME
        });
        // "not found" also means the chat is gone, which is what we want
        if (result?.success || result?.error === NO_SUCH_KEY_ERROR || result?.error === 'InvalidConversationId') {
            pendingDeletes.delete(id);
            storageRemove(PENDING_DELETE_PREFIX + id).catch(() => undefined);
            return true;
        }
        if (attempt < maxAttempts - 1) await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
    }
    return false;
};

export const deleteRemoteConversation = async (conversationId: string, abortSignal = null): Promise<boolean> => {
    installListeners();
    recentlyDeleted.add(conversationId);
    pendingDeletes.add(conversationId);
    deferredUploads.delete(conversationId);
    releaseHeldBlankConversations([conversationId]);
    remoteVersions.delete(conversationId);
    conflictCopies.delete(conversationId);
    // Any queued/unsent save of this chat is moot now
    uploadSeq.set(conversationId, (uploadSeq.get(conversationId) ?? 0) + 1);
    const pendingSave = pendingUploads.get(conversationId);
    if (pendingSave) clearPendingUpload(pendingSave);
    storageRemove(PENDING_UPLOAD_PREFIX + conversationId).catch(() => undefined);
    try {
        // remembered until the server confirms, so a failed delete cannot bring the chat back on the next sync
        await storageSet(PENDING_DELETE_PREFIX + conversationId, JSON.stringify({ at: Date.now(), user: currentSyncUser }));
    } catch (e) {
        console.error('Could not persist pending conversation delete', e);
    }

    const ok = await runExclusive(conversationId, () => attemptDelete(conversationId, RETRY_DELAYS_MS.length + 1));
    if (!ok) {
        console.error(`Could not delete cloud conversation ${conversationId} yet; will retry`);
        scheduleBackgroundRetry();
    }
    return ok;
};

export const deleteMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null): Promise<boolean> => {
    if (conversationIds.length === 0) return true;
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete_multiple",
        data: { conversationIds: conversationIds },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    return !!result?.success;
};

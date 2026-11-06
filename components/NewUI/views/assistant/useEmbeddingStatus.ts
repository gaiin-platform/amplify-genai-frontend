/**
 * useEmbeddingStatus — embedding/RAG status for an assistant's already-saved data
 * sources, plus the "regenerate" action.
 *
 * The classic `ExistingFileList` fetched this once on render and showed it as a badge;
 * the card grid dropped it, so a user could not tell whether a file had actually been
 * indexed. Same endpoint (`embeddingDocumentStatus`, 25 keys per call) and the same
 * reprocess + polling helpers (`utils/app/files`) — only the presentation is new.
 *
 * Only sources the server already knows about are queried: a file added in this editing
 * session has no embedding record until the assistant is saved, and asking would just
 * report `not_found`. The caller says which ones qualify via `isEligible`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttachedDocument } from '@/types/attacheddocument';
import { embeddingDocumentStatus } from '@/services/adminService';
import {
    disableSupportReprocess,
    extractKey,
    isRecentlyReprocessed,
    shouldShowReprocessButton,
    startFileReprocessingWithPolling,
} from '@/utils/app/files';
import type { EmbeddingMetadata } from './dataSourceGroupingModel';

/** The endpoint's keys per request — larger batches are rejected. */
const CHUNK_SIZE = 25;

type StatusMap = { [key: string]: any } & { metadata?: { [key: string]: EmbeddingMetadata } };

export interface EmbeddingStatusApi {
    /** Raw status for a source (`completed`, `failed`, …) or undefined if unknown / not queried. */
    statusOf: (ds: AttachedDocument) => string | undefined;
    metadataOf: (ds: AttachedDocument) => EmbeddingMetadata | undefined;
    /** True while a regenerate is running or a recent run has not settled. */
    isWorking: (ds: AttachedDocument) => boolean;
    /** True when the "regenerate" button should be offered. */
    canReprocess: (ds: AttachedDocument) => boolean;
    reprocess: (ds: AttachedDocument) => Promise<void>;
}

export function useEmbeddingStatus(
    sources: AttachedDocument[],
    isEligible: (ds: AttachedDocument) => boolean,
    groupId?: string,
): EmbeddingStatusApi {
    const [statuses, setStatuses] = useState<StatusMap>({});
    const [pollingFiles, setPollingFiles] = useState<Set<string>>(new Set());
    const requested = useRef<Set<string>>(new Set());
    const mounted = useRef(true);
    // The latest predicate, so the effect below depends on the sources and not on a new closure each render.
    const eligibleRef = useRef(isEligible);
    eligibleRef.current = isEligible;

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        const fresh: Array<{ key: string; type: string }> = [];
        for (const ds of sources) {
            if (!eligibleRef.current(ds)) continue;
            const key = extractKey(ds);
            if (!key || requested.current.has(key)) continue;
            requested.current.add(key);
            fresh.push({ key, type: ds.type });
        }
        if (fresh.length === 0) return;

        for (let i = 0; i < fresh.length; i += CHUNK_SIZE) {
            const chunk = fresh.slice(i, i + CHUNK_SIZE);
            embeddingDocumentStatus(chunk)
                .then((response: any) => {
                    if (!mounted.current) return;
                    if (response?.success && response?.data) {
                        setStatuses((prev) => ({
                            ...prev,
                            ...response.data,
                            ...(response.metadata && { metadata: { ...prev.metadata, ...response.metadata } }),
                        }));
                    } else {
                        // Not an answer — let a later change to the list ask again.
                        chunk.forEach(({ key }) => requested.current.delete(key));
                    }
                })
                .catch((error: unknown) => {
                    console.error('Failed to fetch embedding status:', error);
                    chunk.forEach(({ key }) => requested.current.delete(key));
                });
        }
    }, [sources]);

    const statusOf = useCallback((ds: AttachedDocument): string | undefined => {
        const key = extractKey(ds);
        return key ? statuses[key] : undefined;
    }, [statuses]);

    const metadataOf = useCallback((ds: AttachedDocument): EmbeddingMetadata | undefined => {
        const key = extractKey(ds);
        return key ? statuses.metadata?.[key] : undefined;
    }, [statuses]);

    const createdAtOf = (ds: AttachedDocument): string => ds.metadata?.createdAt || new Date().toISOString();

    const isWorking = useCallback((ds: AttachedDocument): boolean => {
        const key = extractKey(ds);
        if (!key) return false;
        if (pollingFiles.has(key)) return true;
        const status = statuses[key];
        return !!status && isRecentlyReprocessed(createdAtOf(ds), status, statuses.metadata?.[key]);
    }, [statuses, pollingFiles]);

    const canReprocess = useCallback((ds: AttachedDocument): boolean => {
        if (disableSupportReprocess(ds.type)) return false;
        const key = extractKey(ds);
        const status = key ? statuses[key] : undefined;
        if (!key || !status || status === 'not_found') return false;
        if (pollingFiles.has(key) || isRecentlyReprocessed(createdAtOf(ds), status, statuses.metadata?.[key])) return false;
        return shouldShowReprocessButton(createdAtOf(ds), status, statuses.metadata?.[key]);
    }, [statuses, pollingFiles]);

    const reprocess = useCallback(async (ds: AttachedDocument): Promise<void> => {
        const key = extractKey(ds);
        if (!key) return;
        await startFileReprocessingWithPolling({
            key,
            fileType: ds.type,
            setPollingFiles,
            setEmbeddingStatus: setStatuses as (updater: (prev: any) => any) => void,
            // A file taken from a group assistant may not carry the group; the editor knows it.
            groupId: ds.groupId || groupId,
        });
    }, [groupId]);

    return { statusOf, metadataOf, isWorking, canReprocess, reprocess };
}

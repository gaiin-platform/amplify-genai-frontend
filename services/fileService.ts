import { AttachedDocument } from "@/types/attacheddocument";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/files";
const SERVICE_NAME = "file";

const uploadFileToS3 = (
    file: File,
    presignedUrl: string,
    onProgress?: (progress: number) => void,
    mimeType?: string
) => {
    const xhr = new XMLHttpRequest();
    const abortController = new AbortController();
    let lastReported = -1; // Track last reported progress

    const result = new Promise((resolve, reject) => {
        // Event listener for upload progress
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const rawProgress = (event.loaded / event.total) * 95; // Cap at 95%
                // Only report progress in 2% increments to smooth it out
                const smoothedProgress = Math.floor(rawProgress / 2) * 2;
                
                // Only report if progress has increased by at least 2%
                if (smoothedProgress >= lastReported + 2) {
                    lastReported = smoothedProgress;
                    onProgress(smoothedProgress);
                }
            }
        });

        // Event listener for request completion
        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(true); // Resolve the promise when the file is successfully uploaded
            } else {
                const errorMessage = xhr.getResponseHeader('x-amz-error-message');
                reject(new Error(`Upload failed with status code: ${xhr.status}, error: ${errorMessage}, body: ${xhr.responseText}`));
            }
        };

        // Event listener for request error
        xhr.onerror = () => reject(new Error('Network error occurred during file upload.'));
        xhr.onabort = () => reject(new Error('Abort'));

        // Set up and send the request
        xhr.open('PUT', presignedUrl);

        // Add the Content-Type header with the computed MIME type
        const contentType = mimeType || file.type || "application/octet-stream";
        console.log(`[S3 UPLOAD DEBUG] Using Content-Type: "${contentType}"`);
        xhr.setRequestHeader("Content-Type", contentType);

        xhr.send(file);
    });

    // Connect the abort controller to the XHR abort
    abortController.signal.addEventListener('abort', () => {
        xhr.abort();
    });

    return { response: result, abortController };
}

/**
 * Poll a presigned metadata URL until the processed file's metadata object exists.
 *
 * Requests run one at a time (the next is scheduled only after the previous settles),
 * back off from 0.5 s towards 3 s, and are skipped while the tab is hidden. A single
 * abort listener cancels the in-flight XHR and stops the loop.
 */
export function checkContentReady(url: string, maxSeconds: number, abortController?: AbortController): Promise<any> {
    const startTime = Date.now();
    const INITIAL_DELAY_MS = 500;
    const MAX_DELAY_MS = 3000;
    const REQUEST_TIMEOUT_MS = 15000;

    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
        let currentXhr: XMLHttpRequest | null = null;
        let settled = false;
        let delay = INITIAL_DELAY_MS;

        const signal = abortController?.signal;

        const finish = (action: () => void) => {
            if (settled) return;
            settled = true;
            if (timer !== undefined) clearTimeout(timer);
            if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
            signal?.removeEventListener('abort', onAbort);
            action();
        };

        function onAbort() {
            currentXhr?.abort();
            finish(() => reject(new Error('Abort')));
        }

        const schedule = () => {
            if (settled) return;
            timer = setTimeout(attempt, delay);
            delay = Math.min(Math.round(delay * 1.5), MAX_DELAY_MS);
        };

        const attempt = () => {
            if (settled) return;

            if (signal?.aborted) {
                finish(() => reject(new Error('Abort')));
                return;
            }

            if (Date.now() - startTime >= maxSeconds * 1000) {
                finish(() => reject(new Error('Timeout reached')));
                return;
            }

            // Nothing to gain from polling a background tab; check again shortly after it returns.
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                schedule();
                return;
            }

            const xhr = new XMLHttpRequest();
            currentXhr = xhr;
            xhr.open('GET', url);
            // A request that never answers must not stall the loop; a timeout surfaces as a
            // finished request with status 0, which is handled like any other "not ready yet".
            xhr.timeout = REQUEST_TIMEOUT_MS;
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                currentXhr = null;
                if (xhr.status === 200) {
                    console.log("File ready for chat");
                    let metadata: any = null;
                    try {
                        metadata = JSON.parse(xhr.responseText);
                    }
                    catch (e) {
                        console.log("Error parsing content metadata response", e);
                    }
                    finish(() => resolve({ success: true, metadata: metadata }));
                    return;
                }
                // Not there yet (404 until processing finishes) — wait, then try again.
                schedule();
            };
            xhr.send();
        };

        signal?.addEventListener('abort', onAbort);
        // The overall limit is enforced by its own timer, not only between attempts, so it holds
        // even while a request is outstanding.
        deadlineTimer = setTimeout(() => {
            currentXhr?.abort();
            finish(() => reject(new Error('Timeout reached')));
        }, maxSeconds * 1000);
        schedule();
    });
}

export const addFile = async (metadata: AttachedDocument, file: File, onProgress?: (progress: number) => void, ragEnabled: boolean = true, tags: string[] = [], abortSignal: AbortSignal | null = null) => {
    const requestBody = {
        data: {
            actions: [],
            type: metadata.type,
            name: metadata.name,
            knowledgeBase: "default",
            tags: tags,
            data: metadata.data,
            groupId: metadata.groupId,
            ragOn: ragEnabled
        }
    };
    
    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`Failed to get presigned url: ${response.status}`);
    }

    const result = await response.json();

    // console.log("result", result);

    const key = result.key;
    const uploadUrl = result.url;
    const contentUrl = result.contentUrl || null;
    const statusUrl = result.statusUrl || null;
    const metadataUrl = result.metadataUrl || null

    // console.log("contentUrl", contentUrl);
    // console.log("statusUrl", statusUrl);
    // console.log("metadataUrl", metadataUrl);

    const { response: uploadResponse, abortController } = uploadFileToS3(file, uploadUrl, (progress: number) => {
        if (onProgress) {
            onProgress(progress);
        }
    }, metadata.type);

    return {
        key: key,
        contentUrl: contentUrl,
        metadataUrl: metadataUrl,
        statusUrl: statusUrl,
        response: uploadResponse,
        abortController: abortController
    };
};

export type PageKey = {
    createdAt: string;
    id: string;
}

export type FileQuery = {
    startDate?: string;
    sortIndex?: string;
    pageSize?: number;
    pageKey?: PageKey | null;
    namePrefix?: string | null;
    createdAtPrefix?: string | null;
    typePrefix?: string | null;
    types?: string[];
    tags?: string[];
    pageIndex?: number;
    forwardScan?: boolean;
    tagFilterList?: string[];
    filters?: {
        attribute: string;
        operator: string;
        value: string;
    }[];
}

export type FileRecord = {
    knowledgeBase: string;
    data: Record<string, any>; // or a more specific type if the structure of `data` is known
    updatedAt: string; // can also be represented as `Date` depending on how you want to use it
    createdAt: string; // can also be represented as `Date` depending on how you want to use it
    updatedBy: string;
    id: string;
    createdBy: string;
    name: string;
    tags: string[];
    type: string;
    totalTokens?: number;
    totalItems?: number;
    hash?: string;
};

export type DeleteTagsResult = {
    success: boolean;
    message: string;
}

export type ListTagsResult = {
    success: boolean;
    data: {
        tags: string[];
    };
}

export type FileUpdateTagsResult = {
    success: boolean;
    message: string;
};

export type FileQueryResult = {
    success: boolean;
    data: {
        items: FileRecord[];
        pageKey?: PageKey;
    };
};

export const getFileDownloadUrl = async (key: string, groupId: string | undefined) => {

    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/download",
        data: {
            key: key,
            groupId: groupId
        },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return { success: result.success, key: key, downloadUrl: result.downloadUrl };
}

export const deleteTags = async (tags: string[]) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/tags/delete",
        data: { tags: tags },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const listTags = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/tags/list",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const setTags = async (file: FileRecord) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/set_tags",
        data: {
            id: file.id,
            tags: file.tags
        },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const queryUserFiles = async (query: FileQuery, abortSignal: AbortSignal | null = null) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/query",
        data: { ...query },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const renameFile = async (id: string, name: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/rename",
        data: { id, name },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const deleteFile = async (key: string) => {
    console.log("Delete File function, Service Name:", SERVICE_NAME);
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete",
        data: {
            key: key,
        },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


export const reprocessFile = async (key: string, groupId?: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/reprocess/rag",
        data: { key, groupId },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


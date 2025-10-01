import { AttachedDocument } from "@/types/attacheddocument";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/files";
const SERVICE_NAME = "file";

const uploadFileToS3 = (
    file: File,
    presignedUrl: string,
    onProgress?: (progress: number) => void
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

        // Add the Content-Type header with the file's MIME type
        if (file.type) {
            console.log("file type", file.type);
            xhr.setRequestHeader("Content-Type", file.type); // Ensure the Content-Type header is set
        } else {
            console.log("file type", "application/octet-stream");
            // If the file.type is not defined, you may choose to set a generic binary type, or
            // if your backend service requires a specific type, you'll need to provide it accordingly.
            xhr.setRequestHeader("Content-Type", "application/octet-stream");
        }

        xhr.send(file);
    });

    // Connect the abort controller to the XHR abort
    abortController.signal.addEventListener('abort', () => {
        xhr.abort();
    });

    return { response: result, abortController };
}

export function checkContentReady(url: string, maxSeconds: number, abortController?: AbortController): Promise<any> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const intervalId = setInterval(() => {
            // Check if aborted
            if (abortController?.signal?.aborted) {
                clearInterval(intervalId);
                reject(new Error('Abort'));
                return;
            }

            // Check if timeout reached
            if (Date.now() - startTime >= maxSeconds * 1000) {
                clearInterval(intervalId);
                reject(new Error('Timeout reached'));
                return;
            }

            const xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            
            // Add abort handling for the individual XHR request
            if (abortController) {
                abortController.signal.addEventListener('abort', () => xhr.abort());
            }
            
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        console.log("File ready for chat");
                        let metadata = null;
                        try {
                            metadata = JSON.parse(xhr.responseText);
                        }
                        catch (e) {
                            console.log("Error parsing content metadata response", e);
                        }
                        clearInterval(intervalId);
                        resolve({ success: true, metadata: metadata });
                    }
                    // else if (xhr.status !== 404) {
                    //     clearInterval(intervalId);
                    //     reject(new Error(`Unexpected status code: ${xhr.status}`));
                    // }
                }
            };
            xhr.send();
        }, 500);
    });
}

export const addFile = async (metadata: AttachedDocument, file: File, onProgress?: (progress: number) => void, ragEnabled: boolean = true, tags: string[] = [], abortSignal: AbortSignal | null = null) => {
    console.log('Rag Enabled', ragEnabled);

    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
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
    });

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


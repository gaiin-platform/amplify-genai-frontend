import { Conversation } from "@/types/chat";
import { FolderInterface } from "@/types/folder";
import { compressConversation, saveConversations, uncompressConversation } from "@/utils/app/conversation";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/state/conversation";
const NO_SUCH_KEY_ERROR = 'NoSuchKey';
const SERVICE_NAME = "conversation";

// Conversations with raw JSON larger than this threshold are uploaded via presigned
// S3 PUT URL to bypass the API Gateway 10 MB request body hard limit.
// We measure the RAW json size (before LZW compression) because:
//   - compressConversation() returns a number[] which serializes small
//   - requestOp.ts then LZW compresses it again — making size unpredictable
//   - Raw JSON size is a reliable indicator: LZW compresses random text ~2x,
//     so a 4 MB raw conversation could still produce a large enough payload
const LARGE_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4 MB raw JSON

export const uploadConversation = async (conversation: Conversation, folders: FolderInterface[], abortSignal = null) => {
    // always ensure isLocal is false just in case
    conversation.isLocal = false;
    const compressedConversation = compressConversation(conversation);
    const folder = conversation.folderId ? folders.find((f: FolderInterface) => conversation.folderId === f.id) : null;

    // Measure the RAW conversation JSON size BEFORE compression
    // This is the most reliable way to detect large conversations
    const rawJson = JSON.stringify(conversation);
    const rawBytes = new TextEncoder().encode(rawJson).length;

    console.log(`[uploadConversation] Raw size: ${(rawBytes / 1024 / 1024).toFixed(2)} MB, threshold: ${(LARGE_UPLOAD_THRESHOLD_BYTES / 1024 / 1024).toFixed(0)} MB`);

    if (rawBytes >= LARGE_UPLOAD_THRESHOLD_BYTES) {
        console.log(`[uploadConversation] Large conversation detected — using presigned S3 URL`);
        // --- Large conversation: upload directly to S3 via presigned PUT URL ---
        return await uploadConversationViaPresignedUrl(
            conversation.id,
            compressedConversation,
            folder
        );
    }

    // --- Normal (small) conversation: go through API Gateway as before ---
    const op = {
        method: 'PUT',
        path: URL_PATH,
        op: "/upload",
        data: {
            conversation: compressedConversation,
            conversationId: conversation.id,
            folder: folder
        },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    return result.success;
};

/**
 * Uploads a large conversation directly to S3 using a presigned PUT URL,
 * bypassing API Gateway's 10 MB request body limit.
 *
 * Flow:
 *  1. Ask our backend for a short-lived presigned S3 PUT URL  (tiny request, no payload)
 *  2. PUT the full conversation JSON straight to S3           (no API Gateway involved)
 */
const uploadConversationViaPresignedUrl = async (
    conversationId: string,
    compressedConversation: any,
    folder: any
): Promise<boolean> => {
    try {
        // Step 1 – get a presigned PUT URL from the backend
        const urlOp = {
            method: 'GET',
            path: URL_PATH,
            op: "/get-upload-url",
            queryParams: { conversationId },
            service: SERVICE_NAME
        };

        const urlResult = await doRequestOp(urlOp);
        if (!urlResult.success || !urlResult.presignedUrl) {
            console.error("Failed to get presigned upload URL:", urlResult.message);
            return false;
        }

        // Step 2 – PUT the conversation body directly to S3
        const body = JSON.stringify({ conversation: compressedConversation, folder: folder });
        const s3Response = await fetch(urlResult.presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        if (!s3Response.ok) {
            console.error("S3 presigned PUT failed:", s3Response.status, s3Response.statusText);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error uploading large conversation via presigned URL:", error);
        return false;
    }
};

export const fetchRemoteConversation = async (conversationId: string, conversations?: Conversation[], dispatch?: any) => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
        queryParams: { "conversationId": conversationId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    if (result.success) {
        return uncompressConversation(result.conversation);
    } else {
        console.error("Error fetching conversation: ", result.message);
        let message = "Unfortunately, we are unable to get your cloud-stored conversation at this time. Please try again later...";
        if (result.type === NO_SUCH_KEY_ERROR) {
            message = "This conversation is no longer accessible, it has been made private in another browser or has been removed by another device.";

            if (dispatch && conversations) { //remove conv from history 
                const updatedConversations = conversations.filter((c: Conversation) => c.id !== conversationId);
                dispatch({ field: 'conversations', value: updatedConversations });
                saveConversations(updatedConversations);
            }
        }
        alert(message);
        return null;
    }
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

const fetchConversationPresignedUrls = async (presignedUrls: string[]) => {
    let conversationData: any = [];

    for (let i = 0; i < presignedUrls.length; i++) {
        const presigned_url = presignedUrls[i];
        const response = await fetch(presigned_url, {
            method: 'GET',
            signal: null,
        });

        if (!response.ok) {
            console.error("Error fetching presigned at index:", i);
            return null; //   continue;

        }

        const chunkData = await response.json();
        conversationData = [...conversationData, ...chunkData];
    }
    return conversationData;
}

export const deleteRemoteConversation = async (conversationId: string, abortSignal = null) => {

    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/delete",
        queryParams: { "conversationId": conversationId },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    return result.success;
};

export const deleteMultipleRemoteConversations = async (conversationIds: string[], abortSignal = null) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete_multiple",
        data: { conversationIds: conversationIds },
        service: SERVICE_NAME
    };

    const result = await doRequestOp(op);
    return result.success;
};

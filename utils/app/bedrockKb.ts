import { AttachedDocument } from '@/types/attacheddocument';
import { DataSource } from '@/types/chat';
import { doRequestOp } from '@/services/doRequestOp';

export const BEDROCK_KB_TYPE = 'bedrock/knowledge-base';
export const BEDROCK_KB_PREFIX = 'bedrock-kb://';

export const isBedrockKbDatasource = (ds: any): boolean => {
    return ds.type === BEDROCK_KB_TYPE ||
           ds.id?.startsWith(BEDROCK_KB_PREFIX) ||
           ds.contentKey?.startsWith(BEDROCK_KB_PREFIX) ||
           ds.key?.startsWith(BEDROCK_KB_PREFIX);
};

export const extractKbId = (ds: any): string => {
    return ds.metadata?.knowledgeBaseId ||
           ds.key?.replace(BEDROCK_KB_PREFIX, '') ||
           ds.contentKey?.replace(BEDROCK_KB_PREFIX, '') ||
           ds.id?.replace(BEDROCK_KB_PREFIX, '') || '';
};

export const createBedrockKbDatasource = (knowledgeBaseId: string, displayName?: string): AttachedDocument => {
    return {
        id: `${BEDROCK_KB_PREFIX}${knowledgeBaseId}`,
        name: displayName || knowledgeBaseId,
        raw: null,
        type: BEDROCK_KB_TYPE,
        data: null,
        metadata: {
            knowledgeBaseId,
            type: BEDROCK_KB_TYPE,
            totalTokens: 0,
        },
    };
};

/** Validates a Bedrock Knowledge Base ID (10-char uppercase alphanumeric) */
export const validateKbId = (kbId: string): { valid: boolean; error?: string } => {
    if (!kbId || kbId.trim().length === 0) {
        return { valid: false, error: 'Knowledge Base ID is required.' };
    }
    if (!/^[A-Za-z0-9]+$/.test(kbId.trim())) {
        return { valid: false, error: 'Knowledge Base ID must be alphanumeric.' };
    }
    return { valid: true };
};

/** Extract filename from an S3 URI (e.g., "guide.pdf" from "s3://bucket/docs/guide.pdf") */
export const extractFileNameFromS3Uri = (s3Uri: string): string => {
    if (!s3Uri) return 'Unknown file';
    const parts = s3Uri.split('/');
    return parts[parts.length - 1] || 'Unknown file';
};

/** Extract download info from a RAG source citation */
export const getDownloadInfoFromSource = (source: any): { knowledgeBaseId: string; s3Uri: string } | null => {
    if (!isBedrockKbDatasource(source)) return null;

    const kbId = extractKbId(source);
    const s3Uri = source.locations?.[0]?.source;

    if (!kbId || !s3Uri || !s3Uri.startsWith('s3://')) return null;

    return { knowledgeBaseId: kbId, s3Uri };
};

/** Download a source file from a Bedrock Knowledge Base via presigned URL */
export const downloadBedrockKbFile = async (knowledgeBaseId: string, s3Uri: string): Promise<boolean> => {
    try {
        const result = await doRequestOp({
            method: 'POST',
            path: '/bedrock-kb',
            op: '/download',
            data: { knowledgeBaseId, s3Uri },
            service: 'bedrock-kb',
        });

        if (result.success && result.downloadUrl) {
            window.open(result.downloadUrl, '_blank');
            return true;
        } else {
            console.error('Bedrock KB download failed:', result.message);
            return false;
        }
    } catch (error) {
        console.error('Error downloading Bedrock KB file:', error);
        return false;
    }
};

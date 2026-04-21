/**
 * Knowledge Base Service
 *
 * Manages office knowledge bases, documents, events, and integrations.
 * This service communicates with the backend Lambda functions.
 */

import { doRequestOp } from './doRequestOp';
import {
  OfficeKnowledgeBase,
  KBDocument,
  OfficeEvent,
  IntegrationConnection,
  KBStats,
  IntegrationProvider,
  SyncLogEntry,
} from '@/types/knowledgeBase';

const URL_PATH = '/knowledge-base';
const SERVICE_NAME = 'knowledge-base';

// ============================================================================
// Knowledge Base CRUD
// ============================================================================

export const getKnowledgeBases = async (): Promise<OfficeKnowledgeBase[]> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: '/list',
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : [];
};

export const getKnowledgeBase = async (id: string): Promise<OfficeKnowledgeBase | null> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: `/get/${id}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : null;
};

export const createKnowledgeBase = async (
  data: Partial<OfficeKnowledgeBase>
): Promise<OfficeKnowledgeBase | null> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: '/create',
    data,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : null;
};

export const updateKnowledgeBase = async (
  id: string,
  data: Partial<OfficeKnowledgeBase>
): Promise<boolean> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: `/update/${id}`,
    data,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

export const deleteKnowledgeBase = async (id: string): Promise<boolean> => {
  const op = {
    method: 'DELETE',
    path: URL_PATH,
    op: `/delete/${id}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

export const getKnowledgeBaseStats = async (id: string): Promise<KBStats | null> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: `/stats/${id}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : null;
};

// ============================================================================
// Documents
// ============================================================================

export const getDocuments = async (knowledgeBaseId: string): Promise<KBDocument[]> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: `/documents/${knowledgeBaseId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : [];
};

export const uploadDocument = async (
  knowledgeBaseId: string,
  file: File,
  tags: string[] = []
): Promise<KBDocument | null> => {
  // First get a presigned URL
  const presignOp = {
    method: 'POST',
    path: URL_PATH,
    op: '/documents/presign',
    data: {
      knowledgeBaseId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      tags,
    },
    service: SERVICE_NAME,
  };

  const presignResponse = await doRequestOp(presignOp);
  if (!presignResponse.success) {
    console.error('Failed to get presigned URL:', presignResponse);
    return null;
  }

  const { uploadUrl, fileKey, documentId } = presignResponse.data;

  // Upload to S3
  try {
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    // Confirm upload and trigger processing
    const confirmOp = {
      method: 'POST',
      path: URL_PATH,
      op: '/documents/confirm',
      data: { documentId, knowledgeBaseId },
      service: SERVICE_NAME,
    };

    const confirmResponse = await doRequestOp(confirmOp);
    return confirmResponse.success ? confirmResponse.data : null;
  } catch (error) {
    console.error('Error uploading document:', error);
    return null;
  }
};

export const deleteDocument = async (
  knowledgeBaseId: string,
  documentId: string
): Promise<boolean> => {
  const op = {
    method: 'DELETE',
    path: URL_PATH,
    op: `/documents/${knowledgeBaseId}/${documentId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

// ============================================================================
// Events
// ============================================================================

export const getEvents = async (knowledgeBaseId: string): Promise<OfficeEvent[]> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: `/events/${knowledgeBaseId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : [];
};

export const createEvent = async (
  knowledgeBaseId: string,
  event: Partial<OfficeEvent>
): Promise<OfficeEvent | null> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: '/events/create',
    data: { ...event, knowledgeBaseId },
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : null;
};

export const updateEvent = async (
  eventId: string,
  event: Partial<OfficeEvent>
): Promise<boolean> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: `/events/update/${eventId}`,
    data: event,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

export const deleteEvent = async (eventId: string): Promise<boolean> => {
  const op = {
    method: 'DELETE',
    path: URL_PATH,
    op: `/events/${eventId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

// ============================================================================
// Integrations
// ============================================================================

export const getIntegrations = async (
  knowledgeBaseId: string
): Promise<IntegrationConnection[]> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: `/integrations/${knowledgeBaseId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : [];
};

export const connectIntegration = async (
  knowledgeBaseId: string,
  provider: IntegrationProvider,
  config: Record<string, any>
): Promise<{ success: boolean; authUrl?: string; integration?: IntegrationConnection }> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: '/integrations/connect',
    data: { knowledgeBaseId, provider, config },
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return {
    success: response.success,
    authUrl: response.data?.authUrl,
    integration: response.data?.integration,
  };
};

export const disconnectIntegration = async (integrationId: string): Promise<boolean> => {
  const op = {
    method: 'DELETE',
    path: URL_PATH,
    op: `/integrations/${integrationId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

export const syncIntegration = async (integrationId: string): Promise<boolean> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: `/integrations/sync/${integrationId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

export const getSyncLogs = async (integrationId: string): Promise<SyncLogEntry[]> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: `/integrations/logs/${integrationId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success ? response.data : [];
};

// ============================================================================
// Sync All
// ============================================================================

export const syncAllIntegrations = async (knowledgeBaseId: string): Promise<boolean> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: `/sync-all/${knowledgeBaseId}`,
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

// ============================================================================
// Access Control
// ============================================================================

export const addManager = async (
  knowledgeBaseId: string,
  email: string
): Promise<boolean> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: '/managers/add',
    data: { knowledgeBaseId, email },
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

export const removeManager = async (
  knowledgeBaseId: string,
  email: string
): Promise<boolean> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: '/managers/remove',
    data: { knowledgeBaseId, email },
    service: SERVICE_NAME,
  };
  const response = await doRequestOp(op);
  return response.success;
};

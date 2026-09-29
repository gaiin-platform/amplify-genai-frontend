/**
 * presentationApi — calls to the amplify-presentation-agent service, which builds
 * decks on Amazon Bedrock AgentCore Runtime from the admin PowerPoint templates.
 *
 * Lives in NewUI/shared (not services/) per NEW_UI_GUIDE §1.
 */

import { doRequestOp } from '@/services/doRequestOp';

const PATH = '/presentation';
const SERVICE = 'presentation';

export type PresentationJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface PresentationResult {
  downloadUrl: string;
  fileName: string;
  slideCount: number;
  /** Presigned JPEG previews, one per slide. */
  slides: string[];
  reviewScores: number[];
}

export interface PresentationJob {
  jobId: string;
  status: PresentationJobStatus;
  stage: string;
  progress: number;
  message?: string;
  templateName?: string;
  title?: string;
  error?: string;
  result?: PresentationResult;
}

export interface StartPresentationRequest {
  templateName: string;
  content: string;
  title?: string;
  instructions?: string;
  conversationId?: string;
  accountId?: string;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export const startPresentation = async (
  request: StartPresentationRequest,
): Promise<ApiResult<{ jobId: string }>> => {
  // Strip empty optional fields: the backend schema rejects unknown/invalid values.
  const data = Object.fromEntries(
    Object.entries(request).filter(([, v]) => v !== undefined && v !== ''),
  );
  return doRequestOp({ method: 'POST', path: PATH, op: '/start', data, service: SERVICE });
};

export const getPresentationStatus = async (
  jobId: string,
  abortSignal: AbortSignal | null = null,
): Promise<ApiResult<PresentationJob>> =>
  doRequestOp(
    { method: 'GET', path: PATH, op: '/status', queryParams: { jobId }, service: SERVICE },
    abortSignal,
  );

export type TemplateAnalysisStatus = {
  status: 'not_analyzed' | 'queued' | 'running' | 'completed' | 'failed';
  message?: string;
  updatedAt?: string;
};

export const analyzePresentationTemplate = async (
  templateName: string,
): Promise<ApiResult<{ jobId: string }>> =>
  doRequestOp({ method: 'POST', path: PATH, op: '/template/analyze', data: { templateName }, service: SERVICE });

export const getTemplateAnalysisStatus = async (): Promise<ApiResult<Record<string, TemplateAnalysisStatus>>> =>
  doRequestOp({ method: 'GET', path: PATH, op: '/template/status', service: SERVICE });

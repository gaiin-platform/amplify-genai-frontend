import { getFileDownloadUrl } from '@/services/fileService';
import { imageResponseToObjectUrlWithBytes } from './attachmentTypes';

export type LibraryPreviewKind = 'image' | 'text' | 'pdf';

export type LibraryPreviewResult =
  | {
      kind: 'image' | 'pdf';
      objectUrl: string;
      bytes: number;
    }
  | {
      kind: 'text';
      fullText: string;
      bodyPreview: string;
      lineCount: number;
      bytes: number;
    };

type PreviewRequest = {
  key: string;
  kind: LibraryPreviewKind;
  mime?: string;
};

const inFlight = new Map<string, Promise<LibraryPreviewResult>>();
const completed = new Map<string, LibraryPreviewResult>();
let cacheGeneration = 0;

function cacheKey({ key, kind, mime }: PreviewRequest): string {
  return `${kind}:${mime || ''}:${key}`;
}

async function fetchPreview({ key, kind, mime }: PreviewRequest): Promise<LibraryPreviewResult> {
  const response = await getFileDownloadUrl(key, undefined);
  if (!response.success || !response.downloadUrl) {
    throw new Error('Preview URL unavailable');
  }

  const content = await fetch(response.downloadUrl);
  if (!content.ok) throw new Error(`Preview request failed: ${content.status}`);

  if (kind === 'image') {
    const { objectUrl, bytes } = await imageResponseToObjectUrlWithBytes(content);
    return { kind, objectUrl, bytes };
  }

  if (kind === 'pdf') {
    const payload = await content.arrayBuffer();
    const contentType = content.headers.get('content-type') || '';
    const rawText = new TextDecoder().decode(payload).trim();
    let candidate = rawText;
    if (contentType.includes('json')) {
      try {
        const parsed = JSON.parse(rawText);
        candidate = typeof parsed === 'string' ? parsed : parsed?.data ?? parsed?.body ?? rawText;
      } catch {
        // Fall back to the raw bytes.
      }
    }
    const base64 = candidate.includes(',') ? candidate.slice(candidate.indexOf(',') + 1) : candidate;
    if (base64 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64.replace(/\s/g, ''))) {
      try {
        const decoded = window.atob(base64.replace(/\s/g, '').padEnd(Math.ceil(base64.length / 4) * 4, '='));
        const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
        return {
          kind,
          objectUrl: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })),
          bytes: bytes.byteLength,
        };
      } catch {
        // Fall back to the raw bytes.
      }
    }
    return {
      kind,
      objectUrl: URL.createObjectURL(new Blob([payload], { type: 'application/pdf' })),
      bytes: payload.byteLength,
    };
  }

  const fullText = await content.text();
  return {
    kind,
    fullText,
    bodyPreview: fullText.slice(0, 400),
    lineCount: fullText ? fullText.split('\n').length : 0,
    bytes: new TextEncoder().encode(fullText).byteLength,
  };
}

/**
 * Load a library preview on demand. Concurrent callers for the same stable key
 * share both the signed-URL request and the content fetch.
 */
export function loadLibraryPreview(request: PreviewRequest): Promise<LibraryPreviewResult> {
  const normalized = { ...request, key: request.key.replace(/^s3:\/\//, '') };
  const key = cacheKey(normalized);
  const cached = completed.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const generation = cacheGeneration;
  const requestPromise = fetchPreview(normalized)
    .then((result) => {
      if (generation === cacheGeneration) completed.set(key, result);
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, requestPromise);
  return requestPromise;
}

/** Release a completed preview and its object URL, if it owns one. */
export function releaseLibraryPreview(request: PreviewRequest): void {
  const key = cacheKey({ ...request, key: request.key.replace(/^s3:\/\//, '') });
  const result = completed.get(key);
  if (result && (result.kind === 'image' || result.kind === 'pdf')) URL.revokeObjectURL(result.objectUrl);
  completed.delete(key);
}

/** Clear all completed previews owned by a Library view instance. */
export function releaseAllLibraryPreviews(): void {
  completed.forEach((result) => {
    if (result.kind === 'image' || result.kind === 'pdf') URL.revokeObjectURL(result.objectUrl);
  });
  completed.clear();
}

/** Test-only reset; does not cancel requests already in progress. */
export function resetLibraryPreviewCache(): void {
  releaseAllLibraryPreviews();
  cacheGeneration += 1;
  inFlight.clear();
}

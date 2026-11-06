/**
 * First-page PDF thumbnails, rendered with pdf.js to a still image.
 *
 * Why not an <iframe>/<embed>/<object>: those hand the file to the *browser's*
 * PDF viewer, which paints its own chrome (zoom out / zoom in / fit / download)
 * and sits in a separate compositing layer that ignores the card's clip,
 * transform and opacity. A thumbnail must be a plain bitmap. The native viewer
 * is allowed in exactly one place — the full-screen `AttachmentPreview`.
 *
 * pdf.js is the copy already vendored for text extraction
 * (`components/Chat/JsPDF.js`, 3.10.111). It is loaded lazily, only when a
 * thumbnail is first needed, and its worker is the matching
 * `public/pdfjs/pdf.worker.min.js`.
 *
 * No React imports.
 */

/** Must be the same pdf.js version as `components/Chat/JsPDF.js`. */
export const PDF_WORKER_SRC = '/pdfjs/pdf.worker.min.js';
/** Beyond this the download costs more than the glyph is worth. */
export const MAX_THUMBNAIL_BYTES = 25 * 1024 * 1024;
/** Sharp on 2×/3× screens without ballooning the bitmap. */
const MAX_DEVICE_PIXEL_RATIO = 3;
/** Concurrent renders; a chat with many PDFs must not parse them all at once. */
const MAX_CONCURRENT_RENDERS = 2;
/** Finished thumbnails kept per session (≈ tens of KB each). */
const MAX_CACHED_THUMBNAILS = 60;
const JPEG_QUALITY = 0.9;

export type PdfThumbnailFailure =
  /** Password-protected — we deliberately never prompt from a thumbnail. */
  | 'encrypted'
  /** Not a readable PDF. */
  | 'corrupt'
  /** Could not be fetched (network, expired link). Worth retrying later. */
  | 'unavailable'
  | 'too-large';

export class PdfThumbnailError extends Error {
  reason: PdfThumbnailFailure;
  constructor(reason: PdfThumbnailFailure, message?: string) {
    super(message ?? reason);
    this.name = 'PdfThumbnailError';
    this.reason = reason;
  }
}

export interface PdfThumbnail {
  /** JPEG data URL — self-contained, so there is no object URL to revoke. */
  dataUrl: string;
  pageCount: number;
  /** Width / height of the *rendered bitmap* (the visible, cropped area). */
  bitmapAspect: number;
  /** Height / width of page 1, uncropped. */
  pageAspect: number;
}

export interface ThumbnailOptions {
  cardWidth: number;
  cardHeight: number;
  devicePixelRatio?: number;
}

export interface ThumbnailPlan {
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
}

/** Map pdf.js' error classes onto what the UI can say about them. */
export function classifyPdfError(error: unknown): PdfThumbnailFailure {
  if (error instanceof PdfThumbnailError) return error.reason;
  const name = String((error as { name?: unknown } | null)?.name ?? '');
  if (name === 'PasswordException') return 'encrypted';
  if (name === 'MissingPDFException' || name === 'UnexpectedResponseException') return 'unavailable';
  return 'corrupt';
}

/**
 * Scale so page 1 fills the card's WIDTH at the screen's pixel density, and
 * keep only as many rows as the card can show — a tall page is cropped from
 * the top, never rendered in full.
 */
export function planThumbnail(
  pageWidth: number,
  pageHeight: number,
  { cardWidth, cardHeight, devicePixelRatio = 1 }: ThumbnailOptions,
): ThumbnailPlan {
  if (!(pageWidth > 0) || !(pageHeight > 0) || !(cardWidth > 0) || !(cardHeight > 0)) {
    throw new PdfThumbnailError('corrupt', 'Page has no usable size');
  }
  const dpr = Math.min(
    MAX_DEVICE_PIXEL_RATIO,
    Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1),
  );
  const canvasWidth = Math.max(1, Math.round(cardWidth * dpr));
  const scale = canvasWidth / pageWidth;
  const canvasHeight = Math.max(1, Math.min(Math.round(pageHeight * scale), Math.round(cardHeight * dpr)));
  return { scale, canvasWidth, canvasHeight };
}

// ─── pdf.js access (injectable for tests) ────────────────────────────────────

interface PdfPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: { canvasContext: unknown; viewport: unknown }): { promise: Promise<void> };
  cleanup?: () => void;
}
interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
export interface PdfLib {
  getDocument(params: Record<string, unknown>): { promise: Promise<PdfDocument>; destroy?: () => Promise<void> };
  GlobalWorkerOptions: { workerSrc: string };
}
export interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d'): any;
  toDataURL(type: string, quality?: number): string;
}
export interface PdfThumbnailDeps {
  loadLib: () => Promise<PdfLib>;
  createCanvas: (width: number, height: number) => CanvasLike;
}

let libPromise: Promise<PdfLib> | null = null;

async function loadPdfLib(): Promise<PdfLib> {
  if (!libPromise) {
    libPromise = import('@/components/Chat/JsPDF')
      .then((mod: any) => {
        const lib: PdfLib = typeof mod?.getDocument === 'function' ? mod : mod?.default;
        lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        return lib;
      })
      .catch((error) => {
        libPromise = null; // allow a later retry
        throw error;
      });
  }
  return libPromise;
}

const defaultDeps: PdfThumbnailDeps = {
  loadLib: loadPdfLib,
  createCanvas: (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas as CanvasLike;
  },
};

/**
 * Render page 1 of `data` to a JPEG. Throws `PdfThumbnailError`.
 * `data` is consumed (pdf.js transfers the buffer to its worker).
 */
export async function renderPdfThumbnail(
  data: Uint8Array,
  options: ThumbnailOptions,
  deps: PdfThumbnailDeps = defaultDeps,
): Promise<PdfThumbnail> {
  let pdf: PdfDocument | null = null;
  try {
    const lib = await deps.loadLib();
    const task = lib.getDocument({
      data,
      // No password prompt: an encrypted file simply gets the file-card fallback.
      verbosity: 0,
      isEvalSupported: false,
    });
    pdf = await task.promise;
    const page = await pdf.getPage(1);
    const natural = page.getViewport({ scale: 1 });
    const plan = planThumbnail(natural.width, natural.height, options);
    const viewport = page.getViewport({ scale: plan.scale });

    const canvas = deps.createCanvas(plan.canvasWidth, plan.canvasHeight);
    const context = canvas.getContext('2d');
    if (!context) throw new PdfThumbnailError('corrupt', 'No canvas context');
    // JPEG has no alpha; an unpainted PDF background would come out black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, plan.canvasWidth, plan.canvasHeight);
    // The canvas is shorter than the viewport on a tall page: pdf.js paints
    // from the top-left and the rest falls off the canvas — the crop.
    await page.render({ canvasContext: context, viewport }).promise;
    page.cleanup?.();

    return {
      dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
      pageCount: pdf.numPages,
      bitmapAspect: plan.canvasWidth / plan.canvasHeight,
      pageAspect: natural.height / natural.width,
    };
  } catch (error) {
    throw error instanceof PdfThumbnailError ? error : new PdfThumbnailError(classifyPdfError(error));
  } finally {
    // Frees the worker-side document; the thumbnail is already a plain string.
    pdf?.destroy().catch(() => undefined);
  }
}

// ─── Concurrency + cache ─────────────────────────────────────────────────────

let active = 0;
const waiting: Array<() => void> = [];

async function withRenderSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active < MAX_CONCURRENT_RENDERS) {
    active += 1;
  } else {
    // The releasing task hands its slot straight to us, so `active` never dips.
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

const cache = new Map<string, Promise<PdfThumbnail>>();

/** The sizing inputs are part of the key: a 2× screen must not reuse a 1× bitmap. */
export function thumbnailCacheKey(sourceId: string, o: ThumbnailOptions): string {
  const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, Math.ceil(o.devicePixelRatio ?? 1)));
  return `${sourceId}|${Math.round(o.cardWidth)}x${Math.round(o.cardHeight)}@${dpr}`;
}

/**
 * Thumbnail for `sourceId`, fetching bytes only if it is not already cached or
 * in flight. Concurrent callers share one fetch + render. A *permanent*
 * failure (encrypted / corrupt) is cached so scrolling past the card does not
 * re-download it; a transient one is forgotten so the next view retries.
 */
export function loadPdfThumbnail(
  sourceId: string,
  getBytes: () => Promise<Uint8Array>,
  options: ThumbnailOptions,
  deps?: PdfThumbnailDeps,
): Promise<PdfThumbnail> {
  const key = thumbnailCacheKey(sourceId, options);
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = withRenderSlot(async () => {
    let bytes: Uint8Array;
    try {
      bytes = await getBytes();
    } catch (error) {
      throw error instanceof PdfThumbnailError ? error : new PdfThumbnailError('unavailable');
    }
    if (bytes.byteLength > MAX_THUMBNAIL_BYTES) throw new PdfThumbnailError('too-large');
    return renderPdfThumbnail(bytes, options, deps);
  });

  cache.set(key, promise);
  promise.catch((error) => {
    if (classifyPdfError(error) === 'unavailable' && cache.get(key) === promise) cache.delete(key);
  });
  if (cache.size > MAX_CACHED_THUMBNAILS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return promise;
}

/** Test-only. */
export function resetPdfThumbnailCache(): void {
  cache.clear();
  libPromise = null;
}

import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CanvasLike,
  MAX_THUMBNAIL_BYTES,
  PdfLib,
  PdfThumbnailDeps,
  PdfThumbnailError,
  classifyPdfError,
  loadPdfThumbnail,
  planThumbnail,
  renderPdfThumbnail,
  resetPdfThumbnailCache,
  thumbnailCacheKey,
} from '../pdfThumbnail';

afterEach(() => {
  resetPdfThumbnailCache();
  vi.restoreAllMocks();
});

const CARD = { cardWidth: 200, cardHeight: 150 };

function fakeDeps(page: { width: number; height: number }, opts: { numPages?: number; fail?: unknown } = {}) {
  const canvas = {
    width: 0,
    height: 0,
    ctx: { fillStyle: '', fillRect: vi.fn() },
    getContext() { return this.ctx; },
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,AAAA'),
  };
  const destroy = vi.fn(() => Promise.resolve());
  const render = vi.fn(() => ({ promise: Promise.resolve() }));
  const lib: PdfLib = {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(() => ({
      promise: opts.fail
        ? Promise.reject(opts.fail)
        : Promise.resolve({
            numPages: opts.numPages ?? 3,
            getPage: async () => ({
              getViewport: ({ scale }: { scale: number }) => ({ width: page.width * scale, height: page.height * scale }),
              render,
            }),
            destroy,
          }),
    })),
  };
  const deps: PdfThumbnailDeps = {
    loadLib: async () => lib,
    createCanvas: (w, h) => { canvas.width = w; canvas.height = h; return canvas as unknown as CanvasLike; },
  };
  return { deps, canvas, lib, destroy, render };
}

describe('planThumbnail', () => {
  it('fills the card width and crops a tall page to the card height', () => {
    // US Letter portrait at 1×: width 200 → full height 259, cropped to 150.
    const plan = planThumbnail(612, 792, CARD);
    expect(plan.canvasWidth).toBe(200);
    expect(plan.canvasHeight).toBe(150);
    expect(plan.scale).toBeCloseTo(200 / 612);
  });

  it('keeps a wide page whole — shorter than the card, not stretched', () => {
    const slide = planThumbnail(1280, 720, CARD); // 16:9
    expect(slide.canvasWidth).toBe(200);
    expect(slide.canvasHeight).toBe(113);
    // US Letter landscape is 155px tall at this width → trimmed to the card.
    expect(planThumbnail(792, 612, CARD).canvasHeight).toBe(150);
  });

  it('renders at the device pixel ratio so high-DPI screens stay sharp', () => {
    const plan = planThumbnail(612, 792, { ...CARD, devicePixelRatio: 2 });
    expect(plan.canvasWidth).toBe(400);
    expect(plan.canvasHeight).toBe(300);
  });

  it('clamps the ratio: a bogus or huge value cannot request a giant bitmap', () => {
    expect(planThumbnail(612, 792, { ...CARD, devicePixelRatio: 10 }).canvasWidth).toBe(600);
    expect(planThumbnail(612, 792, { ...CARD, devicePixelRatio: NaN }).canvasWidth).toBe(200);
    expect(planThumbnail(612, 792, { ...CARD, devicePixelRatio: 0.5 }).canvasWidth).toBe(200);
  });

  it('rejects a page with no size as corrupt', () => {
    expect(() => planThumbnail(0, 792, CARD)).toThrow(PdfThumbnailError);
  });
});

describe('classifyPdfError', () => {
  it('maps pdf.js exceptions to a reason the UI can use', () => {
    expect(classifyPdfError({ name: 'PasswordException' })).toBe('encrypted');
    expect(classifyPdfError({ name: 'InvalidPDFException' })).toBe('corrupt');
    expect(classifyPdfError({ name: 'MissingPDFException' })).toBe('unavailable');
    expect(classifyPdfError(new Error('boom'))).toBe('corrupt');
    expect(classifyPdfError(null)).toBe('corrupt');
    expect(classifyPdfError(new PdfThumbnailError('too-large'))).toBe('too-large');
  });
});

describe('renderPdfThumbnail', () => {
  it('paints white, renders page 1 into a cropped canvas and reports the page count', async () => {
    const { deps, canvas, render, destroy } = fakeDeps({ width: 612, height: 792 }, { numPages: 12 });
    const thumb = await renderPdfThumbnail(new Uint8Array([1]), { ...CARD, devicePixelRatio: 2 }, deps);

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
    expect(canvas.ctx.fillStyle).toBe('#fff');
    expect(canvas.ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(render).toHaveBeenCalledTimes(1);
    expect(thumb.pageCount).toBe(12);
    expect(thumb.dataUrl.startsWith('data:image/jpeg')).toBe(true);
    expect(thumb.bitmapAspect).toBeCloseTo(400 / 300);
    expect(destroy).toHaveBeenCalled();
  });

  it('turns a password-protected file into an `encrypted` failure and still cleans up', async () => {
    const { deps } = fakeDeps({ width: 1, height: 1 }, { fail: { name: 'PasswordException' } });
    await expect(renderPdfThumbnail(new Uint8Array([1]), CARD, deps)).rejects.toMatchObject({ reason: 'encrypted' });
  });

  it('turns an unreadable file into a `corrupt` failure', async () => {
    const { deps } = fakeDeps({ width: 1, height: 1 }, { fail: { name: 'InvalidPDFException' } });
    await expect(renderPdfThumbnail(new Uint8Array([1]), CARD, deps)).rejects.toMatchObject({ reason: 'corrupt' });
  });

  it('asks pdf.js for no password prompt and no eval', async () => {
    const { deps, lib } = fakeDeps({ width: 612, height: 792 });
    await renderPdfThumbnail(new Uint8Array([1]), CARD, deps);
    const params = (lib.getDocument as any).mock.calls[0][0];
    expect(params.isEvalSupported).toBe(false);
    expect(params.password).toBeUndefined();
  });
});

describe('loadPdfThumbnail', () => {
  it('shares one fetch and render between concurrent callers and then caches', async () => {
    const { deps } = fakeDeps({ width: 612, height: 792 });
    const getBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const [a, b] = await Promise.all([
      loadPdfThumbnail('doc-1', getBytes, CARD, deps),
      loadPdfThumbnail('doc-1', getBytes, CARD, deps),
    ]);
    await loadPdfThumbnail('doc-1', getBytes, CARD, deps);
    expect(a).toBe(b);
    expect(getBytes).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a 1× bitmap for a 2× screen', () => {
    expect(thumbnailCacheKey('d', { ...CARD, devicePixelRatio: 1 })).not.toBe(
      thumbnailCacheKey('d', { ...CARD, devicePixelRatio: 2 }),
    );
  });

  it('remembers a permanent failure (encrypted) so scrolling past does not re-download', async () => {
    const { deps } = fakeDeps({ width: 1, height: 1 }, { fail: { name: 'PasswordException' } });
    const getBytes = vi.fn(async () => new Uint8Array([1]));
    await expect(loadPdfThumbnail('locked', getBytes, CARD, deps)).rejects.toMatchObject({ reason: 'encrypted' });
    await expect(loadPdfThumbnail('locked', getBytes, CARD, deps)).rejects.toMatchObject({ reason: 'encrypted' });
    expect(getBytes).toHaveBeenCalledTimes(1);
  });

  it('forgets a transient failure (network) so the next view retries', async () => {
    const { deps } = fakeDeps({ width: 612, height: 792 });
    const getBytes = vi
      .fn<() => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(new Uint8Array([1]));
    await expect(loadPdfThumbnail('flaky', getBytes, CARD, deps)).rejects.toMatchObject({ reason: 'unavailable' });
    await Promise.resolve(); // let the cache eviction handler run
    await expect(loadPdfThumbnail('flaky', getBytes, CARD, deps)).resolves.toMatchObject({ pageCount: 3 });
    expect(getBytes).toHaveBeenCalledTimes(2);
  });

  it('refuses an oversized file without handing it to pdf.js', async () => {
    const { deps, lib } = fakeDeps({ width: 612, height: 792 });
    const huge = { byteLength: MAX_THUMBNAIL_BYTES + 1 } as unknown as Uint8Array;
    await expect(loadPdfThumbnail('huge', async () => huge, CARD, deps)).rejects.toMatchObject({ reason: 'too-large' });
    expect(lib.getDocument).not.toHaveBeenCalled();
  });

  it('renders at most two PDFs at a time', async () => {
    let running = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const deps: PdfThumbnailDeps = {
      loadLib: async () => ({
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument: () => ({
          promise: (async () => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise<void>((resolve) => releases.push(resolve));
            running -= 1;
            return {
              numPages: 1,
              getPage: async () => ({
                getViewport: () => ({ width: 100, height: 100 }),
                render: () => ({ promise: Promise.resolve() }),
              }),
              destroy: async () => undefined,
            };
          })(),
        }),
      }),
      createCanvas: () => ({
        width: 0, height: 0,
        getContext: () => ({ fillRect: () => undefined }),
        toDataURL: () => 'data:image/jpeg;base64,AA',
      }),
    };
    const all = ['a', 'b', 'c', 'd'].map((id) =>
      loadPdfThumbnail(id, async () => new Uint8Array([1]), CARD, deps),
    );
    for (let i = 0; i < 20; i += 1) {
      await Promise.resolve();
      releases.splice(0).forEach((release) => release());
    }
    await Promise.all(all);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

// The reported bug: the browser's own PDF viewer (zoom / fit / download bar)
// showed up in the chat because a PDF thumbnail was an <iframe>. Native-viewer
// elements are allowed in exactly one New UI file — the full-screen preview.
describe('no native PDF viewer in the New UI message list', () => {
  const ROOT = path.resolve(__dirname, '../..');
  const ALLOWED = new Set([path.join('shared', 'AttachmentPreview.tsx')]);
  const NATIVE_VIEWER = /<\s*(iframe|embed|object)[\s>]/;
  // Code only: a comment explaining why there is no <iframe> must not trip the guard.
  const code = (file: string) =>
    readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (entry === '__tests__' || entry === 'node_modules') return [];
      return statSync(full).isDirectory() ? walk(full) : /\.tsx$/.test(entry) ? [full] : [];
    });
  }

  it('only shared/AttachmentPreview.tsx may embed a viewer element', () => {
    const offenders = walk(ROOT)
      .filter((file) => !ALLOWED.has(path.relative(ROOT, file)))
      .filter((file) => NATIVE_VIEWER.test(code(file)))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('the transcript PDF thumbnail renders the shared still-image face', () => {
    const file = path.join(ROOT, 'chat', 'NewUITranscriptPdfThumbnail.tsx');
    expect(code(file)).toContain('PdfThumbnailFace');
    expect(code(file)).not.toMatch(NATIVE_VIEWER);
  });
});

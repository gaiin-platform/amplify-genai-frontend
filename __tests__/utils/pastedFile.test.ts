import { describe, it, expect } from 'vitest';
import { generatePastedFileName, normalizePastedFile, sniffFileType } from '@/utils/fileHandler';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];

const fileOf = (bytes: number[] | string, name: string, type: string) =>
    new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name, { type });

describe('sniffFileType', () => {
    it('recognises common image and PDF signatures', () => {
        expect(sniffFileType(new Uint8Array(PNG))).toEqual({ mime: 'image/png', ext: 'png' });
        expect(sniffFileType(new Uint8Array(JPEG))).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
        expect(sniffFileType(new Uint8Array(GIF))).toEqual({ mime: 'image/gif', ext: 'gif' });
        expect(sniffFileType(new Uint8Array(WEBP))).toEqual({ mime: 'image/webp', ext: 'webp' });
        expect(sniffFileType(new Uint8Array(PDF))).toEqual({ mime: 'application/pdf', ext: 'pdf' });
    });

    it('does not mistake a RIFF container that is not WebP for an image', () => {
        const wav = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45];
        expect(sniffFileType(new Uint8Array(wav))).toBeNull();
    });

    it('returns null for plain text and empty input', () => {
        expect(sniffFileType(new TextEncoder().encode('hello world'))).toBeNull();
        expect(sniffFileType(new Uint8Array(0))).toBeNull();
    });
});

describe('generatePastedFileName', () => {
    it('keeps a name that already has an extension', () => {
        expect(generatePastedFileName(fileOf('x', 'image.png', 'image/png'))).toBe('image.png');
    });

    it('adds an extension to an extensionless name', () => {
        expect(generatePastedFileName(fileOf('x', 'screenshot', 'image/jpeg'))).toBe('screenshot.jpg');
    });

    it('prefers the sniffed extension over the declared type', () => {
        const name = generatePastedFileName(fileOf('x', '', ''), { mime: 'image/png', ext: 'png' });
        expect(name).toMatch(/^pasted-\d+\.png$/);
    });

    it('falls back to the declared type, then to txt', () => {
        expect(generatePastedFileName(fileOf('x', '', 'image/svg+xml'))).toMatch(/^pasted-\d+\.svg$/);
        expect(generatePastedFileName(fileOf('x', '', ''))).toMatch(/^pasted-\d+\.txt$/);
    });
});

describe('normalizePastedFile', () => {
    it('gives an unnamed, untyped clipboard image its real name and MIME type', async () => {
        const out = await normalizePastedFile(fileOf(PNG, '', ''));
        expect(out.type).toBe('image/png');
        expect(out.name).toMatch(/^pasted-\d+\.png$/);
        expect(out.size).toBe(PNG.length);
    });

    it('corrects a wrong declared type (screenshot tool labelled a JPEG as text)', async () => {
        const out = await normalizePastedFile(fileOf(JPEG, '', 'text/plain'));
        expect(out.type).toBe('image/jpeg');
        expect(out.name).toMatch(/\.jpg$/);
    });

    it('returns the same File when name and type are already right', async () => {
        const file = fileOf(PNG, 'image.png', 'image/png');
        expect(await normalizePastedFile(file)).toBe(file);
    });

    it('keeps pasted text files as text', async () => {
        const out = await normalizePastedFile(fileOf('just some text', '', 'text/plain'));
        expect(out.type).toBe('text/plain');
        expect(out.name).toMatch(/^pasted-\d+\.txt$/);
    });

    it('still names the file when the bytes cannot be read', async () => {
        const file = fileOf('x', '', 'image/png');
        (file as any).slice = () => { throw new Error('unreadable'); };
        const out = await normalizePastedFile(file);
        expect(out.name).toMatch(/^pasted-\d+\.png$/);
    });
});

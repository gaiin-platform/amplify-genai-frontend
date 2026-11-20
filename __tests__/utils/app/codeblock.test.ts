import { describe, expect, it } from 'vitest';

import { extractCodeBlocksAndText, findEntryHtml } from '@/utils/app/codeblock';

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Demo</title><style>body{color:#222}</style></head>
<body><h1>Hello</h1><script>document.title = 'x';</script></body>
</html>`;

describe('extractCodeBlocksAndText', () => {
  describe('a web page written as plain HTML (no code fences)', () => {
    it('is one html file named index.html instead of text', () => {
      const blocks = extractCodeBlocksAndText(PAGE);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({ language: 'html', filename: 'index.html', extension: '.html', code: PAGE });
    });

    it('ignores whitespace around the document', () => {
      const blocks = extractCodeBlocksAndText(`\n\n   ${PAGE}\n\n`);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe(PAGE);
    });

    it('accepts a document that starts with <html> and no doctype, in any case', () => {
      const blocks = extractCodeBlocksAndText('<HTML lang="en"><body>Hi</body></HTML>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('html');
    });
  });

  describe('content that must keep its existing behaviour', () => {
    it('keeps a fenced html block as a block, with no forced filename', () => {
      const blocks = extractCodeBlocksAndText('```html\n<p>hi</p>\n```');
      expect(blocks).toEqual([{ language: 'html', filename: '', extension: '.html', code: '<p>hi</p>' }]);
    });

    it('keeps a fenced html block that already names itself', () => {
      const blocks = extractCodeBlocksAndText('```html\n<!-- index.html -->\n<p>hi</p>\n```');
      expect(blocks[0].filename).toBe('index.html');
    });

    it('keeps a markdown document as text', () => {
      const blocks = extractCodeBlocksAndText('# Title\n\nSome text about <html> pages.');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('txt');
    });

    it('does not treat a page that appears after other text as a plain html document', () => {
      const blocks = extractCodeBlocksAndText(`Here is the page:\n\n${PAGE}`);
      expect(blocks.every((b) => b.language === 'txt')).toBe(true);
    });

    it('does not rewrite a document that also contains code fences', () => {
      const blocks = extractCodeBlocksAndText(`${PAGE}\n\n\`\`\`js\nconsole.log(1)\n\`\`\``);
      expect(blocks.some((b) => b.language === 'js')).toBe(true);
      expect(blocks.some((b) => b.filename === 'index.html')).toBe(false);
    });

    it('returns no blocks for an empty string', () => {
      expect(extractCodeBlocksAndText('')).toEqual([]);
    });
  });
});

describe('findEntryHtml', () => {
  const html = (filename: string, code = '<p>x</p>') => ({ language: 'html', filename, extension: '.html', code });
  const css = { language: 'css', filename: 'styles.css', extension: '.css', code: 'p{}' };
  const text = { language: 'txt', filename: 'text_1.txt', extension: '.txt', code: 'notes' };

  it('prefers the block named index.html', () => {
    expect(findEntryHtml([html('about.html', 'a'), html('index.html', 'b')])?.code).toBe('b');
  });

  it('uses the first html block when none is named index.html (the unnamed block case)', () => {
    expect(findEntryHtml([css, html('', 'first'), html('', 'second')])?.code).toBe('first');
  });

  it('returns undefined when there is no html block', () => {
    expect(findEntryHtml([css, text])).toBeUndefined();
    expect(findEntryHtml([])).toBeUndefined();
  });

  it('opens a plain-html artifact as the page (what the vanilla preview does)', () => {
    expect(findEntryHtml(extractCodeBlocksAndText(PAGE))?.code).toBe(PAGE);
  });

  it('opens an unnamed fenced html block as the page', () => {
    expect(findEntryHtml(extractCodeBlocksAndText('```html\n<p>hi</p>\n```'))?.code).toBe('<p>hi</p>');
  });
});

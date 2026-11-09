/**
 * User-bubble fenced code blocks must render as ONE <pre> (no <pre><pre>), keep
 * their text verbatim (indentation, blank lines), and leave inline code alone.
 * Regression guard for the "box inside a box inside the bubble" bug caused by
 * the `code` override returning a <pre> while react-markdown already wraps
 * block code in one.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { USER_MD_COMPONENTS } from '@/components/NewUI/chat/NewUIUserMessageMarkdownLayer';

const render = (md: string) =>
  renderToStaticMarkup(
    <ReactMarkdown components={USER_MD_COMPONENTS as any}>{md}</ReactMarkdown>,
  );

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('user message fenced code block', () => {
  it('renders exactly one <pre> with no nested <pre>', () => {
    const html = render('```\nconst a = 1;\n```');
    expect(count(html, '<pre')).toBe(1);
    expect(html).toContain('class="new-ui-user-code-block"');
    expect(html).not.toMatch(/<pre[^>]*>\s*<pre/);
  });

  it('preserves indentation and blank lines, dropping only the trailing newline', () => {
    const html = render('```\nfunction f() {\n    return 1;\n\n}\n```');
    expect(html).toContain('<code>function f() {\n    return 1;\n\n}</code>');
  });

  it('works for indented (4-space) code and for text before/after a block', () => {
    expect(count(render('    indented code'), '<pre')).toBe(1);
    const html = render('before\n\n```js\nx\n```\n\nafter');
    expect(count(html, '<pre')).toBe(1);
    expect(html.indexOf('before')).toBeLessThan(html.indexOf('<pre'));
    expect(html.indexOf('after')).toBeGreaterThan(html.indexOf('</pre>'));
  });

  it('keeps the copy button icon-only (no text leaks into copied message text)', () => {
    const html = render('```\nx\n```');
    const btn = /<button[^>]*>(.*?)<\/button>/.exec(html)!;
    expect(btn).not.toBeNull();
    expect(btn[1].replace(/<svg.*?<\/svg>/g, '')).toBe('');
  });

  it('renders inline code as a plain <code> with the inline class and no <pre>', () => {
    const html = render('use `foo()` here');
    expect(html).toContain('<code class="new-ui-user-inline-code">foo()</code>');
    expect(count(html, '<pre')).toBe(0);
  });
});

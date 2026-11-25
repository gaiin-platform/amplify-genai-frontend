import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  hasLatex,
  processLatex,
  processLatexFull,
} from '@/components/Chat/ChatContentBlocks/latexPreprocess';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('processLatex', () => {
  it('converts $$..$$ to display math', () => {
    expect(processLatex('a $$x^2$$ b')).toBe('a <math-display>x^2</math-display> b');
  });

  it('converts \\[..\\] to display math, across lines', () => {
    expect(processLatex('\\[\na + b\n\\]')).toBe('<math-display>\na + b\n</math-display>');
  });

  it('converts \\(..\\) to inline math', () => {
    expect(processLatex('see \\(y = mx\\) here')).toBe('see <math-inline>y = mx</math-inline> here');
  });

  it('converts $..$ to inline math', () => {
    expect(processLatex('so $E = mc^2$ holds')).toBe('so <math-inline>E = mc^2</math-inline> holds');
  });

  it('leaves plain dollar amounts alone', () => {
    expect(processLatex('costs $5 now')).toBe('costs $5 now');
    expect(processLatex('from $1,200.50 to $3')).toBe('from $1,200.50 to $3');
    expect(processLatex('between $5$ and $10$')).toBe('between $5$ and $10$');
  });

  it('does not convert LaTeX inside fenced code blocks', () => {
    const input = 'before\n```\nconst s = "$x$" + "\\\\(y\\\\)";\n```\nafter $z$';
    expect(processLatex(input)).toBe(
      'before\n```\nconst s = "$x$" + "\\\\(y\\\\)";\n```\nafter <math-inline>z</math-inline>'
    );
  });

  it('does not convert LaTeX inside inline code', () => {
    expect(processLatex('run `let $x = y` and $a$')).toBe(
      'run `let $x = y` and <math-inline>a</math-inline>'
    );
    expect(processLatex('use `\\[x\\]` literally')).toBe('use `\\[x\\]` literally');
  });
});

describe('processLatex fast path', () => {
  const inputs = [
    '',
    'plain text',
    'line one\nline two\n\n- list item\n- another',
    '# Heading\n\n**bold** and _italic_ and [link](https://example.com)',
    'inline `code` and more `code here`',
    '```js\nconst a = 1;\nconsole.log(a);\n```',
    '```\nunterminated fence',
    'a ``` b `c` d ``` e `f',
    'snake_case_name and __dunder__ and ___triple___',
    'unicode: π ≈ 3.14, ∑ x², café, 你好',
    '<div style="color: red">html</div>',
    '| a | b |\n|---|---|\n| 1 | 2 |',
    'percent 50% and caret x^2 and braces {a}',
  ];

  it.each(inputs)('returns the same string as the full path for %j', (input) => {
    expect(processLatex(input)).toBe(processLatexFull(input));
    expect(processLatex(input)).toBe(input);
  });

  // The full path leaves a __CODE_BLOCK_n__ / __INLINE_CODE_n__ placeholder or
  // misplaced code in these; the fast path returns them unchanged.
  it.each([
    'press the ` key, then\n```\ncode\n```\nand ` again',
    '__INLINE_CODE_0__ `x`',
  ])('returns %j unchanged where the full path misplaces code', (input) => {
    expect(processLatexFull(input)).not.toBe(input);
    expect(processLatex(input)).toBe(input);
  });

  it('runs no string replacement for text without "$" or backslash', () => {
    const replace = vi.spyOn(String.prototype, 'replace');
    processLatex('some `code` and ```\nblock\n``` text');
    expect(replace).not.toHaveBeenCalled();
  });

  it('still runs the full path when the text has "$" or a backslash', () => {
    const replace = vi.spyOn(String.prototype, 'replace');
    processLatex('price $5');
    expect(replace).toHaveBeenCalled();
    replace.mockClear();
    processLatex('path C:\\temp');
    expect(replace).toHaveBeenCalled();
  });
});

describe('hasLatex', () => {
  it('detects each LaTeX form', () => {
    expect(hasLatex('$$x$$')).toBe(true);
    expect(hasLatex('\\[x\\]')).toBe(true);
    expect(hasLatex('\\(x\\)')).toBe(true);
    expect(hasLatex('$x$')).toBe(true);
  });

  it('ignores LaTeX inside code and text without delimiters', () => {
    expect(hasLatex('`$x$`')).toBe(false);
    expect(hasLatex('```\n$$x$$\n```')).toBe(false);
    expect(hasLatex('plain text')).toBe(false);
  });
});

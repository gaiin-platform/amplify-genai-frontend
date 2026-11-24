// @vitest-environment jsdom
/**
 * react-markdown mounts each `components` entry as a React component. A `code` renderer
 * written inline is a new function on every render, so without help every code block in a
 * message is unmounted and mounted again each time the message re-renders, which while a
 * reply streams is once per token (#361, item 2). `useStableCodeRenderer` keeps plain code
 * blocks mounted.
 *
 * These tests drive the real react-markdown with an inline renderer that has the branches
 * the chat's renderers have (streaming cursor, special block, code block, inline code), and
 * a stand-in CodeBlock that counts its mounts and renders. The last group mounts
 * PromptStatusDetails, one of the four components that use the hook.
 */
import React from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';

const counts = vi.hoisted(() => ({
  codeBlockMounts: 0,
  codeBlockRenders: [] as string[],
  specialMounts: 0,
}));

vi.mock('@/components/Markdown/CodeBlock', async () => {
  const React = await import('react');
  const CountingCodeBlock = ({ language, value }: { language: string; value: string }) => {
    counts.codeBlockRenders.push(value);
    React.useEffect(() => {
      counts.codeBlockMounts++;
    }, []);
    return React.createElement('div', { className: 'codeblock', 'data-lang': language }, value);
  };
  return { CodeBlock: React.memo(CountingCodeBlock) };
});

// PromptStatusDetails imports these; none of them is rendered here.
vi.mock('@/components/Chat/ChatContentBlocks/MermaidBlock', () => ({ default: () => null }));
vi.mock('@/components/Chat/ChatContentBlocks/AssistantBlock', () => ({ default: () => null }));
vi.mock('@/components/Chat/ChatContentBlocks/VegaVisBlock', () => ({ default: () => null }));
vi.mock('@/components/Chat/ExpansionComponent', () => ({ default: () => null }));

import { CodeBlock } from '@/components/Markdown/CodeBlock';
import { useStableCodeRenderer } from '@/components/Markdown/useStableCodeRenderer';
import { PromptStatusDetails } from '@/components/Status/PromptStatusDetails';
import { Status } from '@/types/workflow';

/** Stands in for Mermaid, Vega and the other special blocks, which have their own state. */
const Special: React.FC<{ text: string }> = ({ text }) => {
  React.useEffect(() => {
    counts.specialMounts++;
  }, []);
  return <div className="special">{text}</div>;
};

/** The chat appends this, wrapped in backticks, to a reply that is still streaming. */
const CURSOR = '▍';

/** A message component with the same shape of inline `code` renderer the chat uses. */
const Message: React.FC<{ text: string; stable: boolean; label?: string }> = ({ text, stable, label = '' }) => {
  const stabilizeCode = useStableCodeRenderer();
  const components = {
    code({ node, inline, className, children, ...props }: any) {
      if (children.length) {
        if (children[0] == CURSOR) {
          return <span className="cursor">{CURSOR}</span>;
        }
        children[0] = (children[0] as string).replace('`' + CURSOR + '`', CURSOR);
      }
      const match = /language-(\w+)/.exec(className || '');
      if (!inline && match && match[1] === 'special') {
        return <Special text={String(children)} />;
      }
      return !inline ? (
        <CodeBlock language={((match && match[1]) || '') + label} value={String(children).replace(/\n$/, '')} {...props} />
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };
  return <ReactMarkdown components={stable ? stabilizeCode(components) : components}>{text}</ReactMarkdown>;
};

let host: HTMLElement;
let root: Root;

/** Renders into the root and waits until React has run the effects of that render. */
const renderElement = async (element: React.ReactElement) => {
  await act(async () => {
    root.render(element);
  });
};

const render = (text: string, stable: boolean, label?: string) =>
  renderElement(<Message text={text} stable={stable} label={label} />);

const renderStrict = (text: string, stable: boolean) =>
  renderElement(
    <React.StrictMode>
      <Message text={text} stable={stable} />
    </React.StrictMode>,
  );

/** A reply arriving in pieces: one fenced block that grows, as it does while streaming. */
const STREAM = [
  '```python\ndef f(',
  '```python\ndef f(n):',
  '```python\ndef f(n):\n    return n',
  '```python\ndef f(n):\n    return n\n```',
];

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  counts.codeBlockMounts = 0;
  counts.codeBlockRenders = [];
  counts.specialMounts = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.innerHTML = '';
});

describe('an inline code renderer without the wrapper', () => {
  it('mounts the code block again on every re-render of the message', async () => {
    for (const text of STREAM) await render(text, false);

    expect(counts.codeBlockMounts).toBe(STREAM.length);
  });
});

describe('useStableCodeRenderer', () => {
  it('mounts a code block once while its message keeps growing', async () => {
    for (const text of STREAM) await render(text, true);

    expect(counts.codeBlockMounts).toBe(1);
    expect(host.querySelector('.codeblock')?.textContent).toBe('def f(n):\n    return n');
  });

  it('mounts a code block once while the streaming cursor moves through the reply', async () => {
    const cursor = '`' + CURSOR + '`';
    const block = 'Here it is:\n\n```python\ndef f(n):\n    return n\n```';

    // The cursor on its own, before any code block exists.
    await render('Here it is:' + cursor, true);
    expect(host.querySelector('.cursor')).not.toBeNull();

    // The cursor inside the fence that is still open.
    await render('Here it is:\n\n```python\ndef f(' + cursor, true);
    await render('Here it is:\n\n```python\ndef f(n):\n    return n' + cursor, true);
    expect(host.querySelector('.cursor')).toBeNull();

    // The cursor in its own paragraph after the closed block: it remounts on each render
    // while the block next to it stays mounted.
    await render(block + '\n\nDone' + cursor, true);
    await render(block + '\n\nDone.' + cursor, true);
    expect(host.querySelector('.cursor')).not.toBeNull();
    expect(counts.codeBlockMounts).toBe(1);

    await render(block + '\n\nDone.', true);
    expect(counts.codeBlockMounts).toBe(1);
    expect(host.querySelector('.cursor')).toBeNull();
    expect(host.querySelector('.codeblock')?.textContent).toBe('def f(n):\n    return n');
  });

  it('mounts a code block once under StrictMode, where every render runs twice', async () => {
    for (const text of STREAM) await renderStrict(text, true);

    // StrictMode runs the mount effect twice for the one real mount.
    expect(counts.codeBlockMounts).toBe(2);
    expect(host.querySelector('.codeblock')?.textContent).toBe('def f(n):\n    return n');
  });

  it('does not render an earlier block again when only later text changes', async () => {
    const first = '```python\nprint(1)\n```\n\n';
    await render(first + 'Some', true);
    await render(first + 'Some more', true);
    await render(first + 'Some more text\n\n```js\nlet a\n```', true);

    expect(counts.codeBlockRenders.filter((value) => value === 'print(1)')).toHaveLength(1);
    expect(counts.codeBlockMounts).toBe(2);
  });

  it('calls the latest inline renderer, so it sees current props', async () => {
    await render('```python\nx\n```', true, '-a');
    await render('```python\nx = 1\n```', true, '-b');

    expect(counts.codeBlockMounts).toBe(1);
    expect(host.querySelector('.codeblock')?.getAttribute('data-lang')).toBe('python-b');
  });

  it('keeps an inline code element as the same DOM node', async () => {
    await render('Use `n` here', true);
    const before = host.querySelector('code');
    await render('Use `n` here and there', true);

    expect(before).not.toBeNull();
    expect(host.querySelector('code')).toBe(before);
  });

  it('remounts any other block on each re-render', async () => {
    const texts = ['```special\na', '```special\nab', '```special\nabc\n```'];
    for (const text of texts) await render(text, true);

    expect(counts.specialMounts).toBe(texts.length);
    expect(host.querySelector('.special')?.textContent).toBe('abc\n');
  });

  it('switches cleanly between a special block and a plain one at the same position', async () => {
    await render('```special\na\n```', true);
    await render('```python\na\n```', true);
    await render('```special\na\n```', true);

    expect(host.querySelector('.special')?.textContent).toBe('a\n');
    expect(host.querySelector('.codeblock')).toBeNull();
    expect(counts.specialMounts).toBe(2);
    expect(counts.codeBlockMounts).toBe(1);
  });

  it('leaves a components object without a code renderer untouched', async () => {
    let result: unknown;
    const Probe: React.FC = () => {
      const stabilizeCode = useStableCodeRenderer();
      const components = { p: 'p' } as any;
      result = stabilizeCode(components) === components;
      return null;
    };
    await renderElement(<Probe />);

    expect(result).toBe(true);
  });
});

describe('PromptStatusDetails', () => {
  const status = (message: string): Status => ({ id: 's1', summary: '', message, type: 'info', inProgress: true });

  it('mounts a code block once while the status message keeps growing', async () => {
    for (const text of STREAM) await renderElement(<PromptStatusDetails status={status(text)} />);

    expect(counts.codeBlockMounts).toBe(1);
    expect(host.querySelector('.codeblock')?.textContent).toBe('def f(n):\n    return n');
  });
});

import React, { isValidElement, useRef } from 'react';
import type { Options } from 'react-markdown';
import { CodeBlock } from '@/components/Markdown/CodeBlock';

type MarkdownComponents = NonNullable<Options['components']>;
type CodeRenderer = (props: any) => React.ReactNode;

// Gives everything that is not a plain code block a new key on each render.
let remountCounter = 0;

/**
 * Keeps plain code blocks mounted while a markdown message re-renders.
 *
 * react-markdown mounts every entry of `components` as a React component. A `code` renderer
 * written inline in JSX is a new function on each render, so React takes it for a new
 * component type and remounts everything under it whenever the markdown re-renders, which
 * while a reply streams is once per token. Each remount of a code block runs its syntax
 * highlighting again and attaches a new MutationObserver (#361, item 2).
 *
 * `const stabilizeCode = useStableCodeRenderer()` returns a function for wrapping the
 * `components` object. It swaps `code` for a wrapper whose identity never changes and which
 * calls the latest inline renderer, so that renderer still sees current props and state.
 *
 * - When the renderer returns a plain <CodeBlock>, the block stays mounted: an unchanged
 *   block is skipped by CodeBlock's memo, and the block being written just updates. An
 *   inline <code> element stays mounted too; it has no state to lose.
 * - Anything else it returns (Mermaid, Vega, artifact and agent blocks, the streaming
 *   cursor) gets a new key on each render, so it is remounted every time. That is how an
 *   inline renderer behaves without this hook, and those blocks are left that way.
 *
 * The inline renderer is called as a plain function, so it must not use hooks.
 */
export function useStableCodeRenderer() {
  const latestRenderer = useRef<CodeRenderer | null>(null);
  const stableRenderer = useRef<CodeRenderer | null>(null);

  if (!stableRenderer.current) {
    stableRenderer.current = function StableCode(props: any) {
      const rendered = latestRenderer.current ? latestRenderer.current(props) : null;
      if (isValidElement(rendered) && (rendered.type === CodeBlock || rendered.type === 'code')) return rendered;
      return <React.Fragment key={++remountCounter}>{rendered}</React.Fragment>;
    };
  }

  return function stabilizeCode(components: MarkdownComponents): MarkdownComponents {
    if (typeof components.code !== 'function') return components;
    latestRenderer.current = components.code as CodeRenderer;
    return { ...components, code: stableRenderer.current as MarkdownComponents['code'] };
  };
}

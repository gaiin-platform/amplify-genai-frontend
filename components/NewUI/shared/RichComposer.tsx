/**
 * RichComposer — a contentEditable-based composer that supports inline code blocks.
 *
 * Behaviour:
 *   - Normal text input: works exactly like a textarea
 *   - Three backticks (```) + Shift+Enter → inserts a full-width code block between
 *     the current text and a continuation line (matches the screenshot reference)
 *   - Enter (no shift) → calls onSend with the full markdown string
 *   - Shift+Enter inside normal text → newline
 *   - Shift+Enter inside a code block → newline inside the block
 *   - Escape while inside a code block → moves cursor to the line after the block
 *   - Paste → strips rich formatting, inserts plain text
 *
 * Output (getMarkdown): converts the DOM back to a markdown string:
 *   - Regular divs → their text
 *   - .rich-code-block divs → wrapped in ``` ... ```
 *
 * This is a REUSABLE component — used by NewHome; can be used anywhere a
 * markdown-aware composer is needed.
 */
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

// ── Constants ──────────────────────────────────────────────────────────────

const CODE_BLOCK_CLS = 'rich-code-block';
const ZWS = '​'; // zero-width space used to anchor cursor inside empty blocks

/**
 * 4,000 characters — see attachmentTypes.ts PASTE_AS_FILE_THRESHOLD for rationale.
 * Intentionally duplicated here so RichComposer has zero dependency on the attachment
 * system; the parent wires them together via the onLargePaste prop.
 */
const PASTE_AS_FILE_THRESHOLD = 4_000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface RichComposerHandle {
  clear: () => void;
  focus: () => void;
  getValue: () => string;
}

interface RichComposerProps {
  onSend: (markdown: string) => void;
  /** Called every time the content changes (with the current raw text value) */
  onChange?: (value: string) => void;
  /**
   * Called when the user pastes text that exceeds PASTE_AS_FILE_THRESHOLD (4,000 chars).
   * When this fires, the composer is NOT updated — the text is intercepted and the parent
   * should convert it to an attachment card (spec §6).
   */
  onLargePaste?: (text: string) => void;
  /**
   * Called when the user pastes an image (any clipboard item with type starting 'image/').
   * The composer never tries to insert image data as text — always intercepted and forwarded.
   */
  onImagePaste?: (file: File) => void;
  placeholder?: string;
  /** Additional className for the editable div */
  editorClassName?: string;
  autoFocus?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Walk a node up to (but not including) rootNode, return first ancestor matching predicate */
function findAncestor(
  node: Node | null,
  rootNode: Node,
  predicate: (n: Node) => boolean
): HTMLElement | null {
  let cur = node;
  while (cur && cur !== rootNode) {
    if (predicate(cur)) return cur as HTMLElement;
    cur = cur.parentNode;
  }
  return null;
}

/** Find the direct child of editor that contains (or is) `node` */
function topLevelChild(node: Node | null, editor: HTMLElement): Node | null {
  let cur = node;
  while (cur && cur.parentNode !== editor) {
    cur = cur.parentNode;
  }
  return cur;
}

/** Extract markdown from the editor's current DOM.
 *  Three node kinds:
 *  - .rich-code-block div  → ```\ncontent\n```
 *  - any other div         → its innerText (may span multiple lines via \n)
 *  - bare text node        → its textContent (occurs when user hasn't triggered a block yet)
 */
function domToMarkdown(editor: HTMLElement): string {
  const parts: string[] = [];
  const clean = (s: string) => s.replace(new RegExp(ZWS, 'g'), '');

  editor.childNodes.forEach((node) => {
    if (node instanceof HTMLElement && node.classList.contains(CODE_BLOCK_CLS)) {
      const content = clean(node.innerText || '');
      parts.push('```\n' + content + '\n```');
    } else if (node instanceof HTMLElement) {
      // innerText handles nested <br> → '\n' correctly
      const text = clean(node.innerText || '');
      if (text) parts.push(text);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = clean(node.textContent || '');
      if (text) parts.push(text);
    }
  });

  return parts.join('\n').trim();
}

/** Place cursor at the start of `el` */
function setCursorAtStart(el: Node) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  // If element is empty or only has a <br>, place cursor at position 0 in the element
  const firstChild = el.firstChild;
  if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
    range.setStart(firstChild, 0);
  } else {
    range.setStart(el, 0);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Get text on the current line before the cursor (within a text node) */
function lineBeforeCursor(range: Range): string {
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType !== Node.TEXT_NODE) return '';
  const text = startContainer.textContent ?? '';
  const before = text.slice(0, startOffset);
  const nlIdx = before.lastIndexOf('\n');
  return nlIdx >= 0 ? before.slice(nlIdx + 1) : before;
}

// ── Component ──────────────────────────────────────────────────────────────

export const RichComposer = forwardRef<RichComposerHandle, RichComposerProps>(
  ({ onSend, onChange, onLargePaste, onImagePaste, placeholder = 'Ask anything…', editorClassName = '', autoFocus = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [hasContent, setHasContent] = useState(false);

    // Expose imperative handle so parent can clear/focus/get value
    useImperativeHandle(ref, () => ({
      clear: () => {
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
          setHasContent(false);
        }
      },
      focus: () => editorRef.current?.focus(),
      getValue: () => (editorRef.current ? domToMarkdown(editorRef.current) : ''),
    }));

    // Auto-focus on mount
    useEffect(() => {
      if (autoFocus) editorRef.current?.focus();
    }, [autoFocus]);

    // Keep track of whether editor has visible content (for placeholder visibility)
    // Also fires the optional onChange callback so parents can react to content changes.
    const updateHasContent = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const text = (editor.textContent ?? '').replace(new RegExp(ZWS, 'g'), '').trim();
      setHasContent(text.length > 0);
      onChange?.(text);
    }, [onChange]);

    // ── Paste: strip formatting; intercept large pastes + images (spec §6) ──
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      // 1. Check clipboard items for image data first
      if (onImagePaste) {
        const items = Array.from(e.clipboardData.items);
        const imageItem = items.find((item) => item.type.startsWith('image/'));
        if (imageItem) {
          e.preventDefault();
          const file = imageItem.getAsFile();
          if (file) onImagePaste(file);
          return;
        }
      }

      const text = e.clipboardData.getData('text/plain');

      // 2. Large-paste interception: measure BEFORE inserting (spec §6.1)
      if (onLargePaste && text.length >= PASTE_AS_FILE_THRESHOLD) {
        e.preventDefault(); // never let the text land in the textarea
        onLargePaste(text);
        return;
      }

      // 3. Normal paste: strip rich formatting, insert plain text
      e.preventDefault();
      document.execCommand('insertText', false, text);
      updateHasContent();
    }, [updateHasContent, onLargePaste, onImagePaste]);

    // ── Insert code block ──────────────────────────────────────────────────
    // SURGICAL approach — never rebuild the entire DOM.
    // Only modifies the current line and inserts two new nodes after it.
    // This preserves all existing code blocks and surrounding text untouched.
    //
    // Steps:
    //   1. Strip the trailing ``` from the current text node
    //   2. Find (or create) the top-level block containing the cursor
    //   3. Wrap bare text nodes in a <div> so we have a stable insertion anchor
    //   4. Insert [div.rich-code-block] immediately after the current line
    //   5. Insert an empty [div] continuation line after the code block
    //   6. Place cursor inside the code block
    const insertCodeBlock = useCallback((range: Range) => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel) return;

      const { startContainer, startOffset } = range;

      // --- 1. Strip the ``` from the text node in place ---
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const tn = startContainer as Text;
        const before = tn.textContent?.slice(0, startOffset) ?? '';
        const after  = tn.textContent?.slice(startOffset) ?? '';
        // Remove trailing ``` (and any spaces before the cursor)
        tn.textContent = before.replace(/```\s*$/, '').trimEnd() + after;
      }

      // --- 2. Find the top-level child of editor holding the cursor ---
      const rawTop = topLevelChild(startContainer, editor);

      // --- 3. Ensure we have a proper block-level element as anchor ---
      // If it's a bare text node at the root, wrap it in a <div> first.
      let currentLine: HTMLElement;
      if (rawTop && rawTop.nodeType === Node.TEXT_NODE) {
        const wrapper = document.createElement('div');
        editor.insertBefore(wrapper, rawTop);
        wrapper.appendChild(rawTop);
        currentLine = wrapper;
      } else if (rawTop instanceof HTMLElement) {
        currentLine = rawTop;
      } else {
        // Fallback: append a new empty div
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<br>';
        editor.appendChild(wrapper);
        currentLine = wrapper;
      }

      // If the current line is now completely empty, give it a <br> so it
      // keeps its height and the user can still click onto it.
      const lineText = (currentLine.textContent ?? '').replace(new RegExp(ZWS, 'g'), '').trim();
      if (!lineText) {
        currentLine.innerHTML = '<br>';
      }

      // --- 4. Build and insert the code block right after the current line ---
      const codeBlock = document.createElement('div');
      codeBlock.className = CODE_BLOCK_CLS;
      codeBlock.setAttribute('spellcheck', 'false');
      codeBlock.setAttribute('data-placeholder', 'Type code here…');
      codeBlock.textContent = ZWS;
      currentLine.after(codeBlock);

      // --- 5. Insert an empty continuation line after the code block ---
      const afterDiv = document.createElement('div');
      afterDiv.innerHTML = '<br>';
      codeBlock.after(afterDiv);

      // --- 6. Place cursor inside the code block (after the ZWS) ---
      const newRange = document.createRange();
      const firstChild = codeBlock.firstChild;
      if (firstChild?.nodeType === Node.TEXT_NODE) {
        newRange.setStart(firstChild, 1); // skip the ZWS anchor
      } else {
        newRange.setStart(codeBlock, 0);
      }
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      updateHasContent();
    }, [updateHasContent]);

    // ── Move cursor after a code block (Escape) ────────────────────────────
    const escapCodeBlock = useCallback((block: HTMLElement) => {
      const sel = window.getSelection();
      if (!sel) return;

      // Use the existing sibling after the block or create one
      let target = block.nextSibling as HTMLElement | null;
      if (!target || (target instanceof HTMLElement && target.classList.contains(CODE_BLOCK_CLS))) {
        const newLine = document.createElement('div');
        newLine.innerHTML = '<br>';
        block.after(newLine);
        target = newLine;
      }

      setCursorAtStart(target);
    }, []);

    // ── keydown handler ────────────────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        // --- Escape: exit code block ---
        if (e.key === 'Escape') {
          const block = findAncestor(
            range.startContainer,
            editorRef.current!,
            (n) => n instanceof HTMLElement && (n as HTMLElement).classList.contains(CODE_BLOCK_CLS)
          );
          if (block) {
            e.preventDefault();
            escapCodeBlock(block);
          }
          return;
        }

        // --- Enter (no Shift): send ---
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const editor = editorRef.current;
          if (!editor) return;
          const md = domToMarkdown(editor);
          if (md.trim()) {
            onSend(md);
            editor.innerHTML = '';
            setHasContent(false);
          }
          return;
        }

        // --- Shift+Enter ---
        if (e.key === 'Enter' && e.shiftKey) {
          // If already inside a code block, allow native newline
          const inBlock = findAncestor(
            range.startContainer,
            editorRef.current!,
            (n) => n instanceof HTMLElement && (n as HTMLElement).classList.contains(CODE_BLOCK_CLS)
          );
          if (inBlock) return; // let browser insert \n inside the block

          // Check if current line ends with ``` (may have text before the backticks)
          const lineBefore = lineBeforeCursor(range);
          if (lineBefore.trimEnd().endsWith('```')) {
            e.preventDefault();
            insertCodeBlock(range);
            return;
          }

          // Normal shift+enter: let browser insert a newline
          return;
        }
      },
      [onSend, insertCodeBlock, escapCodeBlock]
    );

    return (
      <div className="relative">
        {/* Placeholder — shown when editor is empty */}
        {!hasContent && (
          <div
            className="absolute top-0 left-0 right-0 pointer-events-none select-none
                       text-[16px] leading-[1.5] text-[--text-muted]"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}

        {/* The actual editable surface */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={updateHasContent}
          onPaste={handlePaste}
          spellCheck
          className={`outline-none text-[16px] leading-[1.5] text-[--text-primary]
                      min-h-[1.5em] break-words ${editorClassName}`}
          aria-multiline="true"
          aria-label="Message input"
          role="textbox"
        />

        {/* Scoped styles for code blocks rendered inside this editor */}
        <style>{`
          .${CODE_BLOCK_CLS} {
            display: block;
            background: var(--bg-active, #3A3A38);
            border-radius: 8px;
            padding: 10px 14px;
            margin: 8px 0;       /* spacing above and below so it doesn't touch adjacent lines */
            font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
            font-size: 13.5px;
            line-height: 1.6;
            color: var(--text-primary, #FAF9F5);
            min-height: 2em;
            white-space: pre-wrap;
            word-break: break-all;
            cursor: text;
            position: relative;
          }
          .${CODE_BLOCK_CLS}:empty::before,
          .${CODE_BLOCK_CLS}:has(> br:only-child)::before {
            content: attr(data-placeholder);
            color: var(--text-muted, #8A8780);
            pointer-events: none;
            position: absolute;
            top: 10px;
            left: 14px;
          }
          /* Light mode override */
          :root:not(.dark) .${CODE_BLOCK_CLS} {
            background: var(--bg-active, #e2e2e0);
          }
        `}</style>
      </div>
    );
  }
);

RichComposer.displayName = 'RichComposer';
export default RichComposer;

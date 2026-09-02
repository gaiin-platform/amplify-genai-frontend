/**
 * Strict allowlist-based HTML sanitizer for untrusted server-generated HTML
 * (e.g. data-disclosure documents derived from PDF extraction).
 *
 * Works in both Node.js (SSR) and browser contexts — no DOM APIs required.
 *
 * Strategy
 * --------
 * 1. Strip dangerous block-level tags (script, style, iframe, …) and their
 *    entire content first.
 * 2. Walk every remaining tag through an allowlist; discard any tag not on
 *    the list.
 * 3. For allowed tags, walk their attributes through a per-tag allowlist;
 *    discard event-handler attributes (on*) and validate URL values so that
 *    javascript:/data:/vbscript: schemes cannot sneak through.
 * 4. Always attach rel="noopener noreferrer" to <a> elements.
 */

// Tags whose entire subtree (including inner text) must be removed.
const BLOCK_REMOVE_TAGS = [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'link',
    'meta',
    'base',
] as const;

// Self-closing / void tags whose content-stripping regex differs slightly.
const VOID_REMOVE_TAGS = ['embed', 'link', 'meta', 'base'] as const;

// Tags that are allowed to pass through (lowercased).
const ALLOWED_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'b', 'i', 'strong', 'em', 'u', 's', 'sub', 'sup',
    'code', 'pre', 'samp', 'kbd',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'a',
    'blockquote',
    'div', 'span', 'section', 'article',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'caption', 'colgroup', 'col',
]);

// Per-tag attribute allowlists.  Tags not present here get zero attributes.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a:    new Set(['href', 'target', 'rel', 'title']),
    td:   new Set(['colspan', 'rowspan', 'align', 'valign', 'style']),
    th:   new Set(['colspan', 'rowspan', 'align', 'valign', 'scope', 'style']),
    col:  new Set(['span']),
    // layout elements: class + id + style (for typography from backend-generated documents)
    div:  new Set(['class', 'id', 'style']),
    span: new Set(['class', 'id', 'style']),
    p:    new Set(['class', 'style']),
    // headings can carry class + style for formatting
    h1: new Set(['class', 'style']), h2: new Set(['class', 'style']), h3: new Set(['class', 'style']),
    h4: new Set(['class', 'style']), h5: new Set(['class', 'style']), h6: new Set(['class', 'style']),
    // list items and blockquote can carry style
    li: new Set(['style']), blockquote: new Set(['style']),
};

// Attribute values that contain dangerous schemes.
const DANGEROUS_URL_RE = /^\s*(javascript|data|vbscript|blob)\s*:/i;

/**
 * Allowlist of safe CSS property names for the `style` attribute.
 * Any property not on this list is silently dropped.
 */
const SAFE_CSS_PROPS = new Set([
    'text-align', 'text-decoration', 'text-indent', 'text-transform',
    'color', 'background-color',
    'font-size', 'font-family', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'letter-spacing', 'word-spacing',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-color', 'border-style', 'border-width', 'border-radius',
    'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height',
    'display', 'vertical-align', 'white-space',
    'list-style', 'list-style-type',
]);

// CSS patterns that are dangerous regardless of property name
const DANGEROUS_CSS_RE = /expression\s*\(|javascript\s*:|behavior\s*:|url\s*\(/i;

/**
 * Sanitize a CSS `style` attribute value, stripping any dangerous
 * declarations while preserving safe layout/typography properties.
 */
function sanitizeStyleValue(raw: string): string | null {
    if (!raw) return null;
    // Immediate reject for any dangerous pattern in the whole string
    if (DANGEROUS_CSS_RE.test(raw)) return null;

    // Parse individual declarations and filter by property allowlist
    const safe = raw
        .split(';')
        .map(decl => decl.trim())
        .filter(Boolean)
        .filter(decl => {
            const colon = decl.indexOf(':');
            if (colon < 0) return false;
            const prop = decl.slice(0, colon).trim().toLowerCase();
            const val  = decl.slice(colon + 1).trim();
            // Drop the declaration if the property is not on the allowlist
            // or the value itself contains dangerous patterns
            return SAFE_CSS_PROPS.has(prop) && !DANGEROUS_CSS_RE.test(val);
        })
        .join('; ');

    return safe || null;
}

function sanitizeAttrValue(tag: string, attrName: string, value: string): string | null {
    const name = attrName.toLowerCase();

    // Block all event handlers regardless of tag.
    if (name.startsWith('on')) return null;

    if (name === 'href' || name === 'src' || name === 'action') {
        if (DANGEROUS_URL_RE.test(value)) return null;
    }

    if (tag === 'a') {
        if (name === 'target') return '_blank';          // always safe open
        if (name === 'rel')    return 'noopener noreferrer';
    }

    // Disallow CSS expressions in class attributes
    if (name === 'class') {
        if (/expression\s*\(|javascript\s*:/i.test(value)) return null;
    }

    // Style attributes get full declaration-level sanitization
    if (name === 'style') {
        return sanitizeStyleValue(value);
    }

    return value;
}

/**
 * Sanitize an HTML string using a strict allowlist.
 *
 * @param html - Untrusted HTML (e.g. from a server-generated data disclosure).
 * @returns    Sanitized HTML safe to pass to dangerouslySetInnerHTML.
 */
export function sanitizeHtml(rawHtml: string): string {
    if (!rawHtml) return '';

    let result = rawHtml;

    // ── Step 1: Remove dangerous block tags and all their content ─────────
    for (const tag of BLOCK_REMOVE_TAGS) {
        // Paired tags: remove opening tag through closing tag (greedy-safe with [\s\S]*?)
        const paired = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
        result = result.replace(paired, '');
    }
    // Also strip any remaining self-closing / orphaned void remove-tags
    for (const tag of VOID_REMOVE_TAGS) {
        const self = new RegExp(`<${tag}[^>]*?>`, 'gi');
        result = result.replace(self, '');
    }
    // Remove SVG blocks (can contain script / event handlers)
    result = result.replace(/<svg[\s\S]*?<\/svg\s*>/gi, '');
    // Remove HTML comments (can carry IE conditional code)
    result = result.replace(/<!--[\s\S]*?-->/g, '');

    // ── Step 2 & 3: Process remaining tags through the allowlist ──────────
    result = result.replace(
        /<(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)\s*\/?>/g,
        (_match, slash, rawTagName, rawAttrs) => {
            const tag = rawTagName.toLowerCase();

            if (!ALLOWED_TAGS.has(tag)) {
                return '';  // discard disallowed tag (keep inner text)
            }

            if (slash === '/') {
                return `</${tag}>`;
            }

            // Build sanitized attribute list
            const allowedAttrsForTag = ALLOWED_ATTRS[tag] ?? new Set<string>();
            const safeAttrs: string[] = [];

            if (rawAttrs && allowedAttrsForTag.size > 0) {
                // Match: name="value", name='value', name=value, or bare name
                const attrRe = /([a-zA-Z][a-zA-Z0-9\-_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']*)))?/g;
                let m: RegExpExecArray | null;
                while ((m = attrRe.exec(rawAttrs)) !== null) {
                    const attrName = m[1].toLowerCase();
                    const attrValue = m[2] ?? m[3] ?? m[4] ?? '';

                    if (!allowedAttrsForTag.has(attrName)) continue;

                    const safe = sanitizeAttrValue(tag, attrName, attrValue);
                    if (safe !== null) {
                        safeAttrs.push(`${attrName}="${safe}"`);
                    }
                }
            }

            // Anchors must always carry rel="noopener noreferrer"
            if (tag === 'a') {
                if (!safeAttrs.some(a => a.startsWith('rel='))) {
                    safeAttrs.push('rel="noopener noreferrer"');
                }
                if (!safeAttrs.some(a => a.startsWith('target='))) {
                    safeAttrs.push('target="_blank"');
                }
            }

            const attrStr = safeAttrs.length ? ' ' + safeAttrs.join(' ') : '';
            return `<${tag}${attrStr}>`;
        },
    );

    return result;
}

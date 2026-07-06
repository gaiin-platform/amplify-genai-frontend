// Registered model names are often raw Bedrock model IDs
// (e.g. "us.anthropic.claude-sonnet-4-6-20250514-v1:0"). Turn those into a
// human label ("Claude Sonnet 4.6") for dropdowns and cards. Names that don't
// look like Bedrock IDs (e.g. "gemma-3-27b-it" from openai-compatible) are
// returned unchanged — we can't safely guess their formatting.
const REGION_PREFIX = /^(us|eu|apac|global)\./;
const VENDOR_PREFIX = /^[a-z0-9]+\./;
const VERSION_SUFFIX = /-v\d+(:\d+)?$/;

export const formatModelName = (name: string): string => {
    let s = name.trim();
    const looksBedrock = REGION_PREFIX.test(s) || VENDOR_PREFIX.test(s) || VERSION_SUFFIX.test(s);
    if (!looksBedrock) return name;

    s = s.replace(REGION_PREFIX, '');
    // Vendor is dropped — the model family name already identifies it
    // ("Claude…", "Titan…", "Nova…").
    s = s.replace(VENDOR_PREFIX, '');
    s = s.replace(VERSION_SUFFIX, '');
    // Trailing release date stamp: claude-sonnet-4-6-20250514 → claude-sonnet-4-6
    s = s.replace(/-\d{8}$/, '');
    // Adjacent single version digits read as a dotted version: 4-6 → 4.6,
    // 3-5 → 3.5. The lookahead keeps parameter counts intact (llama3-70b
    // must not become llama3.70b).
    s = s.replace(/(\d)-(\d)(?!\d)/g, '$1.$2');

    const label = s
        .split(/[-_]/)
        .filter(Boolean)
        .map((w) => {
            if (/^\d+b$/i.test(w)) return w.toUpperCase(); // 70b → 70B
            if (/^\d/.test(w)) return w; // keep 3.5 / 2402 as-is
            return w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(' ');

    return label || name;
};

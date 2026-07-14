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

// The same model can end up registered more than once (e.g. provider sync plus
// a manual add). Pickers should show each distinct provider/type/name once —
// the first registration wins, so existing references stay valid.
export const dedupeModels = <
    T extends { name: string; provider?: string | null; type?: string | null },
>(
    models: T[],
): T[] => {
    const seen = new Set<string>();
    return models.filter((m) => {
        const key = `${m.provider ?? ''}|${m.type ?? ''}|${m.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

// Canonical list preparation for every model picker: dedupe, then sort by the
// human label. All registered models of the requested type are shown, whatever
// their provider — pickers previously disagreed (some bedrock-only, some not),
// so the same deployment showed different model lists page to page.
export const prepareModelOptions = <
    T extends { name: string; provider?: string | null; type?: string | null },
>(
    models: T[],
): T[] =>
    dedupeModels(models).sort((a, b) =>
        formatModelName(a.name).localeCompare(formatModelName(b.name)),
    );

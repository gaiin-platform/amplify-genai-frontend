// Which transformations a non-admin user may run.
//
// Managing transformations (create/edit/delete) is admin-only, but *running*
// them against a source is open to any authenticated user server-side
// (open-notebook `POST /sources/{id}/insights` and `GET /transformations` have
// no admin gate). So without a client-side filter a non-admin sees every
// transformation, including custom admin-authored ones. Per product decision,
// regular users are offered only the seeded/curated set; admins keep the full
// list.
//
// Matched against the seeded transformations
// (open_notebook/database/migrations/5.surrealql) by BOTH title and name,
// because a couple of seeds differ between the two (name "Analyze Paper" has
// title "Paper Analysis"; name "Reflections" has title "Reflection Questions").
// The picker displays the title; the backend stores insights under the title.
// Comparison is case-insensitive + trimmed so minor formatting drift still
// matches. If an admin renames one of these it would need updating here
// (accepted trade-off vs. a backend flag).
export const USER_ALLOWED_TRANSFORMATIONS: readonly string[] = [
    // Paper Analysis
    'Paper Analysis',
    'Analyze Paper',
    // Dense Summary
    'Dense Summary',
    // Key Insights
    'Key Insights',
    // Reflections
    'Reflection Questions',
    'Reflections',
    // Simple Summary
    'Simple Summary',
    // Table of Contents
    'Table of Contents',
];

const normalizedAllowed = new Set(
    USER_ALLOWED_TRANSFORMATIONS.map((t) => t.trim().toLowerCase()),
);

const norm = (s?: string | null): string => (s ?? '').trim().toLowerCase();

export const isUserAllowedTransformation = <
    T extends { title?: string | null; name?: string | null },
>(
    t: T,
): boolean => normalizedAllowed.has(norm(t.title)) || normalizedAllowed.has(norm(t.name));

// Admins get the full list; non-admins are restricted to the curated subset.
export const filterTransformationsForRole = <
    T extends { title?: string | null; name?: string | null },
>(
    transformations: T[],
    isAdmin: boolean,
): T[] => (isAdmin ? transformations : transformations.filter(isUserAllowedTransformation));

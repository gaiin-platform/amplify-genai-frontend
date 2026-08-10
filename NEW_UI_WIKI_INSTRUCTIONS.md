# Wiki Instructions — How to Use and Maintain NEW_UI_DOCS.md

> This file explains the purpose, structure, and maintenance rules for `NEW_UI_DOCS.md`.
> Read this before working on the Amplify new UI in any session.

---

## 1. What This Wiki Is

`NEW_UI_DOCS.md` is a **persistent, compounding knowledge base** for the Amplify new UI project. It is not a README or a changelog. It is a living document that accumulates everything learned, built, and decided across every working session — so that no future session ever has to re-explore the codebase from scratch.

The pattern is: **the LLM writes and maintains the wiki; the human directs the work.** You (the human) source the requirements and ask questions. The AI does the cross-referencing, filing, and bookkeeping that makes the knowledge base useful over time.

---

## 2. The Core Contract

> **Every session that touches the new UI must read `NEW_UI_DOCS.md` first and update it before finishing.**

This is not optional. The file is what makes continuity across sessions possible. If you make changes without updating the doc, the next session starts blind and may undo, duplicate, or contradict your work.

Specifically, at the **start** of a session:
1. Read `NEW_UI_DOCS.md` in full before writing any code
2. Check the Implementation Progress section to understand what is done and what is next
3. Check the Component Registry to know what reusable components already exist before building new ones

At the **end** of a session (or after any meaningful change):
1. Update the Implementation Progress section
2. Update the Component Registry if new components were added
3. Update the "DO NOT CHANGE" section if any boundaries were clarified or moved
4. Add any new architectural decisions, patterns, or gotchas discovered

---

## 3. The Two Files

| File | Purpose |
|---|---|
| `NEW_UI_DOCS.md` | **The wiki itself.** All knowledge: architecture, component registry, design tokens, progress, patterns, constraints. |
| `NEW_UI_WIKI_INSTRUCTIONS.md` | **This file.** Explains how to maintain the wiki. Contains the schema and rules. |

These two files together are the schema layer — equivalent to a `CLAUDE.md` or `AGENTS.md` in the LLM Wiki pattern. They tell any AI agent how to operate on this codebase as a disciplined maintainer rather than a generic code-writer.

---

## 4. What Goes in the Wiki (NEW_UI_DOCS.md)

The wiki has these sections. Keep them in order and keep them current:

### Section 1 — Project Overview
Repo path, branch, stack. Update if the branch or stack changes.

### Section 2 — Core Architecture (DO NOT CHANGE)
The backend-facing code that must never be modified. Entry points, global state shape, context handlers, auth, services, in-app routing, feature flag system. **This section is a constraint boundary.** If you discover a new boundary, add it here. If a previously listed boundary turns out to be safe to modify, update the note.

### Section 3 — Current Layout Architecture
The old layout (TabSidebar) and the new target layout (NewSidebar). Update if the layout strategy changes.

### Section 4 — Theme System
How dark/light mode works, the CSS variable tokens, where they live. Update whenever new design tokens are added to `globals.css`.

### Section 5 — New UI Components (The Registry)
**This is the most important ongoing section.** Lists every component in `components/NewUI/`, what it does, what props it accepts, and what it is reusable for. Format:

```
ComponentName.tsx  ← REUSABLE / SPECIFIC
  Purpose: one sentence
  Props: list key props
  Used by: list consumers
  Notes: any gotchas
```

**Rule: before building any new component, check this registry.** If something similar already exists, extend it. Only create new files for genuinely new patterns.

### Section 6 — CSS Files
Lists all CSS files that affect the new UI and what each one does. Update when new CSS files are created.

### Section 7 — New UI / Old UI Toggle
How the preference banner works, what the `amplify_new_ui_preference` localStorage key means, how the cookie works for future load-balancer routing, how `uiPreference` state in `home.tsx` gates the two layouts.

### Section 8 — Files Safe to Modify
The explicit allowlist of files that can be edited for UI changes.

### Section 9 — Files DO NOT CHANGE
The explicit blocklist of backend/service files.

### Section 10 — Chat Component Notes
What in `Chat.tsx` can be styled vs. what must not be touched.

### Section 11 — Responsive Breakpoints
The three viewport tiers and expected sidebar behavior at each.

### Section 12 — Implementation Progress
**Chronological phases with checkboxes.** Completed items get `[x]`. New phases are appended. Never delete old phases — they are a record of what was built and when.

Format:
```
### Phase N — Title ✅ COMPLETE / (IN PROGRESS) / (NEXT)
- [x] Done thing — brief description
- [ ] Pending thing
```

### Section 13 — Key Patterns and Conventions
The "always do / never do" rules. Coding patterns, dark mode conventions, event bus usage. Update whenever a new pattern is established or an old one is revised.

### Section 14 — Sidebar Spec Reference
Pointer to the design spec file. Update the path if the spec moves.

### Section 15 — UI Preference and Load Balancer Notes
Technical details on the cookie mechanism for future LB routing.

---

## 5. Update Rules

### When to update
- After adding any new component → update Section 5 (Component Registry)
- After adding new CSS tokens → update Section 4 (Theme System)
- After completing a phase → mark `[x]` in Section 12, add next phase items
- After discovering a new architectural constraint → update Section 2 or 8/9
- After any design decision that affects future work → add a note in Section 13

### How to write entries
- **Be specific about file paths.** "The sidebar component" is useless. `components/NewUI/sidebar/NewSidebar.tsx` is useful.
- **State the why, not just the what.** "We use `data-new-ui='true'` on the chat shell because CSS scoping lets us override Chat.tsx styles without touching its logic" is better than "we added a data attribute."
- **Flag gotchas.** If something surprised you (a bug, a quirk, a non-obvious behavior), write it down so the next session doesn't hit it again.
- **Keep entries short.** One sentence per item in the registry. Expand in a note only when it matters.

### What NOT to put in the wiki
- Raw code (use file paths instead)
- Information that's already in the spec files (`sidebar-shell-spec.md`, `conversation-view-spec.md`, `settings-spec.md`) — reference those files by path instead
- Temporary debugging notes (clean those up before ending a session)

---

## 6. The Ingest Pattern (Adding New Features)

When a new feature is requested:

1. **Read the wiki first** — does this overlap with anything already built?
2. **Check the Component Registry** — can an existing component be extended?
3. **Check the spec files** — is there a design spec for this?
4. **Build the feature** — following the patterns in Section 13
5. **Update the wiki** — registry, progress, any new patterns or constraints

For large features, add a new phase to Section 12 before starting, with `[ ]` items. Check them off as each piece lands.

---

## 7. The Query Pattern (Understanding Existing Code)

When you need to understand how something works before changing it:

1. Check Section 5 (Component Registry) for the component
2. Check Section 2 (Core Architecture) for state/context details
3. Check Section 8/9 (Safe / Do Not Change) to confirm the file is safe to modify
4. **Then** look at the actual file

The wiki should answer "where is X" and "how does Y work" for everything in the new UI. If it doesn't, that's a gap — fill it after you've found the answer.

---

## 8. The Lint Pattern (Keeping the Wiki Healthy)

Periodically (every 3-5 sessions), check the wiki for:

- **Stale progress entries** — phases marked `(NEXT)` that are actually done
- **Orphan components** — files in `components/NewUI/` not listed in the registry
- **Missing constraints** — boundaries discovered in recent sessions not yet documented in Section 2/8/9
- **Contradictions** — a pattern in Section 13 that conflicts with how something was actually built
- **Missing cross-references** — a component described in progress but not in the registry

Run this check and update the wiki before starting major new work.

---

## 9. Non-Negotiable Rules for All Sessions

1. **Never start coding without reading `NEW_UI_DOCS.md`**
2. **Never finish a session without updating `NEW_UI_DOCS.md`**
3. **Never create a new component without checking if one already exists**
4. **Never touch files in Section 9 (DO NOT CHANGE)**
5. **Every new component must be listed in the registry with path, purpose, and props**
6. **Dark mode support (`dark:` Tailwind variant or CSS variable) is required on every new UI element**
7. **Reusable components live in `components/NewUI/shared/` — put them there, not inline**
8. **⛔ THE ONE-DIRECTORY RULE: never modify any file outside `components/NewUI/` for UI purposes** — see below
9. **When wrapping old components in a new-UI modal, add `className="text-neutral-900 dark:text-white"` to the outermost content div.** Old components often rely on an inherited base text color set by their original parent wrapper. Without this, elements that only set `dark:text-*` have no light-mode fallback and will be invisible on the white/light-gray modal background. See `NewAdminModal` and Section 13 ("Light-mode gotcha") for details.

---

## 9a. The One-Directory Rule (Critical)

The entire reason we have `components/NewUI/` is to **preserve both UIs simultaneously** until the new UI is complete and battle-tested. The moment we modify an old-UI component to add new-UI behavior — even conditionally — we start coupling the two UIs together and risk breaking the classic UI.

### The rule
**Every line of new UI code lives inside `components/NewUI/`.** The only exceptions are:
- `pages/api/home/home.tsx` — the layout render section only (the `uiPreference === 'new'` block, lines ~1617+)
- `styles/globals.css` — adding new CSS design tokens (never removing old ones)
- `tailwind.config.js` — adding new theme keys (never removing old ones)

### When you need something from the old UI

**Case 1 — You need a modal/dialog that already exists (e.g. `AssistantModal`, `PromptModal`)**
→ You may *import* it into your new component in `components/NewUI/`. This is fine because you're consuming, not modifying.

**Case 2 — You need a feature that has a full old-UI component (e.g. the Chatbar conversation list)**
→ Build a new implementation inside `components/NewUI/`. It can call the same utilities (`utils/`, `services/`, `types/`) but must be its own fresh component file. Check `NEW_UI_PORTING_STATUS.md` first — the feature may already be ported.

**Case 3 — You need a feature that would take too long to reimplement right now**
→ As a temporary measure, you may copy the minimal logic into a new file inside `components/NewUI/`. Add a clearly visible comment:
```tsx
// PORT: Copied from components/OldDir/OldComponent.tsx
// TODO: Replace with proper new-UI implementation. This is a placeholder.
```
And add an entry to `NEW_UI_PORTING_STATUS.md` under "Partially ported" with a 🚧 marker.

**Case 4 — The old component fires custom events (e.g. `openLayeredBuilderTrigger`)**
→ Dispatch those events from your new-UI code. That's the correct pattern — the old modal listens and opens. No modification needed.

### Why this matters
If we start editing `IndividualAssistantsGallery.tsx` or `GroupAssistantsGallery.tsx` to add new-UI features, then:
- Classic UI users see those changes (may break their experience)
- When we eventually cut over to new UI only, cleanup becomes: "which parts of this file were added for new UI vs old UI?"
- Git history becomes confusing

Keep them separate. Always.

---

## 9b. The Porting Status Document

`NEW_UI_PORTING_STATUS.md` is the third document in this set. It tracks:
1. What old-UI features are still pending a port to the new UI
2. What features are intentionally removed (will never return)
3. Future ideas to suggest to the team after the rewrite is complete

**Update it** whenever:
- You port a feature from old to new (mark ✅)
- You partially port something (mark 🚧 + add a TODO note)
- You intentionally skip/remove something (add to Section 8 with rationale)
- A new future idea comes up (add to Section 9)

---

## 10. File Locations Quick Reference

| File | Purpose |
|---|---|
| `/Users/maxmoundas/Amplify/amplify-genai-frontend/NEW_UI_DOCS.md` | **The wiki** — read first, update last |
| `/Users/maxmoundas/Amplify/amplify-genai-frontend/NEW_UI_WIKI_INSTRUCTIONS.md` | **This file** — schema and maintenance rules |
| `/Users/maxmoundas/Amplify/amplify-genai-frontend/NEW_UI_PORTING_STATUS.md` | **Migration tracker** — what's ported, removed, and future ideas |
| `/Users/maxmoundas/Downloads/sidebar-shell-spec.md` | Sidebar design spec |
| `/Users/maxmoundas/Downloads/conversation-view-spec.md` | Chat view design spec |
| `/Users/maxmoundas/Downloads/settings-spec.md` | Settings modal design spec |
| `components/NewUI/` | All new UI components — the only directory we modify |
| `styles/globals.css` | Design tokens + global styles |
| `styles/conversation-view.css` | Scoped chat overrides |
| `pages/api/home/home.tsx` | Root component — layout switching lives here (render section only) |

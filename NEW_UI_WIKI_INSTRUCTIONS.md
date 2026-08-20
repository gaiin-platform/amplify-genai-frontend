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

| Section | Purpose — update when… |
|---|---|
| 1 — Project Overview | Repo path, branch, stack — update if branch/stack changes |
| 2 — Core Architecture (DO NOT CHANGE) | Backend boundaries, entry points, global state — add new boundaries here |
| 3 — Current Layout Architecture | Old vs new layout target |
| 4 — Theme System | CSS tokens, dark/light — update when new tokens added to `globals.css` |
| **5 — Component Registry** | **Every component in `components/NewUI/` — path, purpose, props, consumers. Most important section.** |
| 6 — CSS Files | All CSS files affecting new UI |
| 7 — New UI / Old UI Toggle | Preference banner, localStorage key, cookie, `uiPreference` gating |
| 8 — Files Safe to Modify | Explicit allowlist |
| 9 — Files DO NOT CHANGE | Explicit blocklist |
| 10 — Chat Component Notes | What in Chat.tsx can be styled vs. not |
| 11 — Responsive Breakpoints | Three viewport tiers |
| 12 — Implementation Progress | Phases with checkboxes. `[x]` = done. Never delete phases. |
| 13 — Key Patterns and Conventions | Always/never rules, gotchas — update when new pattern established |
| 14 — Sidebar Spec Reference | Path to design spec |
| 15 — UI Preference and Load Balancer Notes | Cookie mechanism |

**Registry format (Section 5):**
```
ComponentName.tsx  ← REUSABLE / SPECIFIC
  Purpose: one sentence
  Props: list key props
  Used by: list consumers
  Notes: any gotchas
```
Before building any new component, check this registry. Only create new files for genuinely new patterns.

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

*(Sections 6 and 7 removed — covered by Section 9 rules and the standard session preamble.)*

## 6. The Lint Pattern (Keeping the Wiki Healthy)

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
10. **Before writing a CSS override rule that targets an id or class found inside a protected/shared component (e.g. `components/Chat/ExpansionComponent.tsx`), grep for every consumer of that component first.** Several protected components hardcode the SAME id/class across many unrelated call sites (`ExpansionComponent.tsx`'s `id="expandComponent"` alone has ~20 call sites: Sources, Agent Log, RAG Evaluation, Generated Files, MCP Tool Result, and more, in addition to the reasoning block). An unscoped `[data-new-ui="true"] #someSharedId` selector will silently restyle every one of those unrelated call sites, not just the one you meant. Always add a selector prefix scoped to a class/wrapper that is unique to the ONE call site you're targeting. See NEW_UI_DOCS.md §13 "Shared-id/shared-class CSS scoping gotcha" (discovered and fixed in Phase 28) for the concrete example and fix pattern.

### Per-Component Accessibility Rules (established in A11y Pass 1, 2026-08-14)

These rules are standing requirements for all future sessions:

11. **Every `IconButton` MUST have an accessible name.** Pass `aria-label` (preferred) or `title` (fallback). `IconButton.tsx` now propagates `aria-label` — always pass it when the button has no visible text.

12. **Every modal/dialog MUST implement a focus trap.** Pattern: (a) `role="dialog" aria-modal="true" aria-labelledby="<heading-id>"` on the panel div; (b) `tabIndex={-1}` + `panelRef` on the panel; (c) `useEffect` that calls `panelRef.current?.focus()` on open and traps Tab/Shift-Tab within `querySelectorAll(<FOCUSABLE_SELECTOR>)`. See `NewSettingsModal.tsx` for the reference implementation.

13. **Every `role="menu"` popover MUST move focus to the first menu item on open.** The AccountMenu pattern (focus first `[role="menuitem"]:not([disabled])` on open, return focus to trigger on Escape) is the standing pattern.

14. **Never use `--text-muted` for normal-size body text or interactive labels.** It has been tuned to pass 4.5:1 on all surfaces, but use `--text-secondary` for anything that's primary informational content. `--text-muted` is for timestamps, captions, placeholders, and secondary decorative text only.

15. **Every streaming/loading state change that users need to know about MUST use `aria-live="polite"`.** If the element is inside a DO-NOT-CHANGE component, inject the attribute via a DOM effect in the nearest new-UI shell component (same pattern as the `ConversationViewShell` aria-live injection for PromptStatus).

16. **Every `role="tablist"` MUST have `aria-label`.** `SegmentedControl.tsx` now accepts an `aria-label` prop and defaults to the item labels joined. Always provide a meaningful label when instantiating `SegmentedControl`.

17. **Every CSS transition or animation MUST have a `@media (prefers-reduced-motion: reduce)` override.** For new animations, add the override in the same CSS block. The `@keyframes attachMenuEnter` and `modelPickerEnter` are defined in component `<style>` blocks and overridden in `conversation-view.css` — follow this pattern for any future inline `@keyframes`.

18. **Standing Rule — Accent Color is Blue, Always (established Phase 50, 2026-08-19)**

    The accent color for the new UI is the Majk blue:
    - Light mode: `#3b82f6` (`--accent`, same as `--color-primary-500`)
    - Dark mode:  `#006FEE` (`--accent`)

    **NEVER** use orange (`#D97757` or any similar warm orange), purple, indigo, or violet as an interactive accent. Do not hardcode these hex values. Always use `var(--accent)` for:
    - Primary action buttons (send, save, create, connect)
    - Active/selected state borders and indicators
    - Loading dots and breathing animations
    - Info callout left borders
    - Badge/pill backgrounds for primary states
    - Upload progress bar fill

    For text or icons placed **ON TOP OF** an `--accent` background, always use `var(--accent-fg)` (white `#ffffff` in both modes). **Never** use `#2A1710` or other warm darks on a blue background — that combination was chosen for orange and has insufficient contrast on blue.

19. **Standing Rule — Modal close buttons belong in a header row, never inside the scroll container (established Phase 53, 2026-08-20)**

    A modal's `×` button MUST live in a flex header row that is a **sibling above** the scrollable
    content, not a `position: sticky` element inside it:

    ```
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'20px 24px 16px 24px', flexShrink:0 }}>
        <h2 id="<heading-id>" style={{ fontSize:'18px', fontWeight:700, margin:0 }}>{title}</h2>
        <button aria-label="Close" …><IconX size={20} stroke={2} /></button>
      </div>
      <div ref={contentRef} style={{ flex:1, minHeight:0, overflowY:'auto', padding:'0 24px 40px' }}>
        {content}
      </div>
    </div>
    ```

    - The header row's horizontal padding MUST match the content div's, or the title will not
      align with the content beneath it.
    - `minHeight: 0` on both the column and the scroll child is required — without it the flex
      child refuses to shrink and the scroll container overflows the panel.
    - Attach the scroll-position ref (`contentRef`) to the **inner** div; it is the scroll container.
    - The old anti-pattern (`position:sticky; top:20px` + `marginBottom:-20px` +
      `pointerEvents:none` wrapper, with `paddingRight:'44px'` on the heading to dodge the button)
      is retired. It made the × float over scrolling content and never share a baseline with the title.
    - Close buttons in a header row are borderless/transparent (`--text-secondary` → hover
      `--text-primary` + `--bg-hover`). The bordered `--bg-raised` treatment existed only to keep a
      *floating* button legible over scrolling content — don't carry it into a header row.
    - `aria-label="Close"` (not "Close settings" / "Close admin panel") — the dialog's
      `aria-labelledby` already supplies the context.

20. **Standing Rule — Don't force a shared shell across two modals that differ in close/Escape semantics (established Phase 53, 2026-08-20)**

    Before extracting a shared modal shell, check the **close and Escape flows first** — they are
    the thing that most often makes extraction unclean. Concretely, stop and keep the duplication if:
    - Either modal needs Escape to be a **no-op while its `×` still works** (e.g. a
      `hasChildModalOpen` guard). This cannot be expressed through an `onClose` prop, so the shell
      would have to special-case the flow.
    - Either modal runs a confirm/interstitial on close that the other doesn't.
    - The shell would need more than ~4 props beyond `title / onClose / leftRail / children /
      onOverlayClick` (differing `zIndex`, rail width, `aria-labelledby` target, content
      className, or a `title` that must widen from `string` to `ReactNode` all count).

    `NewSettingsModal` + `NewAdminModal` were evaluated against exactly this and the extraction was
    **deferred** — see NEW_UI_DOCS.md Phase 53 Fix 3 for the itemized reasoning. Two readable files
    with a duplicated 30-line frame beat one shell with six escape hatches. When you apply a fix to
    both by hand instead, say so explicitly in the phase entry so the next session knows the
    duplication is deliberate rather than an oversight.

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

**Case 5 — You want to add a Step 0 wizard before an old modal (e.g. type selector before AssistantModal)**
→ Create a new `components/NewUI/views/SomethingSelector.tsx` that renders as `position:fixed` with
`role="dialog" aria-modal="true"`, focus trap, and Escape handling. Call the old modal's entry point
from the selector's `onConfirm`. Do NOT modify the old modal. See `NewAssistantTypeSelector.tsx`
as the reference implementation. Key constraint: the old modal's internal state runs its own
initialization effects on mount — you can pre-set props (e.g. `definition.astPath`) but cannot
pre-set state that the old modal resets via its own effects. Document any such limitations inline.

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

# New UI — Task Tracker (Roadmap Management Layer)

> **What this file is:** a management layer sitting *above* `NEW_UI_DOCS.md` (the wiki) and
> `NEW_UI_PORTING_STATUS.md` (the migration tracker). Those two files record what *has been built*.
> This file tracks the 9 outstanding initiatives you (Max) are steering, their completion %, what's
> blocking them, and the exact prompts to hand to an implementation session.
>
> **Maintained by:** this chat, on your request. I update status/% here as you report back on
> implementation sessions or as I inspect the codebase. I do not write code from this file directly —
> I write the *prompts* that an implementation session (a fresh Claude Code chat) will execute.
>
> **Standing prompt preamble** — every implementation prompt I hand you starts with the same
> "read the three docs first" block used at the top of this conversation. I won't repeat it in full
> below each task; I'll just say "(standard preamble)" and give the task-specific instructions after it.
> The preamble is:
>
> ```
> Before doing anything else, read these three files in full:
> 1. /Users/maxmoundas/Amplify/amplify-genai-frontend/NEW_UI_DOCS.md
> 2. /Users/maxmoundas/Amplify/amplify-genai-frontend/NEW_UI_WIKI_INSTRUCTIONS.md
> 3. /Users/maxmoundas/Amplify/amplify-genai-frontend/NEW_UI_PORTING_STATUS.md
>
> After reading all three files:
> - Check the Component Registry (Section 5 of the wiki) before creating any new component
> - Check the One-Directory Rule (Section 9a of the wiki instructions) before touching ANY file
>   outside components/NewUI/
> - Check the DO NOT CHANGE section (Section 9 of the wiki) before touching any file
> - Check Implementation Progress (Section 12 of the wiki) to understand where things stand
> - Check NEW_UI_PORTING_STATUS.md to see if the feature you are about to build is already tracked
>
> When the work is done, update all three documents as needed:
> - NEW_UI_DOCS.md: mark completed items [x], add new components to the registry, record new
>   patterns or constraints
> - NEW_UI_PORTING_STATUS.md: mark newly ported features done, add partial-port notes with TODO
>   markers, update any status that changed
> - NEW_UI_WIKI_INSTRUCTIONS.md: only if a new rule or pattern was established that should govern
>   future sessions
>
> The repo is at /Users/maxmoundas/Amplify/amplify-genai-frontend on branch new-ui.
> ```

---

## Legend

| Status | Meaning |
|---|---|
| ⬜ Not started | No implementation work has begun |
| 🚧 In progress | Partially done — see notes |
| ✅ Done | Complete and verified |
| ⏸ Deferred | Intentionally postponed (with reason) |

Recommended sequencing is roughly the numbered order below, **except Memory, which is deliberately
last** per your direction (it needs backend work and is the most architecturally novel item).

---

## 1. Logic Testing Pass — chats loading, admin check, model loading, feature flags

**Status:** ✅ Done
**% complete:** 100%
**Type:** QA / verification (ran as a static code-comparison review, not runtime/browser testing).

### Outcome (session dated 2026-08-10)
Fixed 3 real gaps found by diffing classic-UI consumers against new-UI consumers of the same
load-time state, all within `components/NewUI/` per the One-Directory Rule:
1. **Hidden prompts/assistants leak** — `NewAssistantsView.tsx` + `AttachMenu.tsx`'s assistant
   picker didn't respect `prompt.data?.hidden` / `featureFlags.overrideInvisiblePrompts` like classic
   `Promptbar.tsx` does. Fixed; admin management actions still get the unfiltered object so hidden
   assistants stay manageable by admins.
2. **`supportsImages` capability icon missing** in `ModelPicker.tsx` (both primary menu and "More
   models" submenu) vs. classic `ModelSelect.tsx`. Fixed.
3. **Chats & Tasks search didn't match message content** — `ChatsListView.tsx` now searches
   decompressed local-conversation message text, mirroring `Chatbar.tsx` (including its
   known "remote messages aren't searchable" limitation). Fixed.

**Deferred (see Task 1b below — new task spun out of this finding):**
4. **RAG / Web Search toggle wiring gap** — investigation showed the RAG toggle issue isn't a
   missing control; it's a deeper wiring gap. Also surfaced that the **already-shipped Web Search
   toggle has the same defect**: it persists to `conversation.data` but never actually reaches the
   outgoing request. Root cause requires touching `Chat.tsx`'s local `plugins` state, which is a
   DO-NOT-CHANGE file — needs a deliberate, scoped fix session (Task 1b) rather than a quick patch.

Docs updated: `NEW_UI_DOCS.md` (new Phase 24 + §13 technical note on the RAG/Web-Search gap),
`NEW_UI_PORTING_STATUS.md` (rows updated, Web Search row flagged), and a new standalone
`NEW_UI_LOAD_STATE_AUDIT_2026-08-10.md` audit doc with full details + 6 lessons learned.

---

## 1b. Fix: Web Search / RAG Toggle Not Wired to Actual Request (NEW — spun out of Task 1)

**Status:** ✅ Done
**% complete:** 100%
**Type:** Bug fix — functional defect, not cosmetic.

### Outcome (session dated 2026-08-11)
Root cause was more specific than the Task 1 audit guessed: New UI's per-message write
(`conversation.data.webSearchEnabled` → `message.data.enableWebSearch`) was already correct. The
missing piece was `Chat.tsx`'s separate session-level `plugins` array — `useChatSendService.ts`
ANDs both signals, and for `PluginID.WEB_SEARCH` specifically `getActivePlugins()` always defers to
the global `localStorage`-persisted `settings.featureOptions.includeWebSearch`, which New UI never
touched.

**Fix, no `Chat.tsx` edits:** new `components/NewUI/shared/webSearchPreference.ts` uses the
already-sanctioned `getSettings`/`saveSettings` utilities to force that setting on. Wired into
`ConversationComposer.tsx`, `NewHome.tsx` (on toggle-on), and `ConversationViewShell.tsx` (revived
two previously-dead `amplify_pending_web_search`/`amplify_pending_skills` sessionStorage keys for
brand-new conversations).

**Known residual limitation (documented, not fixed — would require a Chat.tsx exception):** the
very first message in an *already-open* conversation immediately after first flipping the toggle in
a session may still miss the plugin; every subsequent/new/reloaded conversation works correctly.

**RAG:** re-confirmed there is no RAG toggle anywhere in `components/NewUI/` — "Add from library" is
just a file/document picker, not a toggle, writes nothing to `conversation.data`. Not built (per
prior sign-off); `NEW_UI_PORTING_STATUS.md` corrected to describe it as not-yet-built rather than
broken, pointing at `webSearchPreference.ts` as the template if/when it is built.

Docs updated: `NEW_UI_DOCS.md` (new component registry entry, new Phase 25, §13 note marked
resolved for Web Search), `NEW_UI_PORTING_STATUS.md` (Web Search row updated, RAG row corrected).
`tsc --noEmit` / `eslint` clean.

---

## 2. Inside Chat View Improvement — chat-pane-migration-spec.md work (2026-08-11 → 2026-08-13)

**Status:** 🚧 In progress — nearly complete; one known open spacing bug (see below)
**% complete:** ~90% (Phases 26–37 complete; one open issue remains)
**Type:** Feature build.

### What happened — full history

Guided by `/Users/maxmoundas/Downloads/chat-pane-migration-spec.md` (12-item spec). Implemented
across Phases 26–37 via multiple sequential fix sessions (see `NEW_UI_CHAT_PANE_MIGRATION_PROMPTS.md`
for the prompt archive). All 12 spec items were addressed. Known open issue documented below.

**Phases completed:**
- Phase 26/27: ChatLoader replaced, branding sweep, response-cutoff fix, old-UI flash fix
- Phase 28: Full hover action rows rewrite (user + assistant), reasoning block redesign (chevron,
  "Thought process" placeholder — blocked on `reasoning.summary` backend field)
- Phase 29: Markdown in user messages + long-message collapse
- Phase 30: Typography (serif Chat font), send/voice slot, share button, alignment, bubble width,
  pending asterisk, palette
- Phase 31–37: Multiple bug-fix passes on action row positioning, spacing, icon size, mask issues,
  jump-button bar, brand mark swap (✳ → icon2.png in sidebar, home, and chat bottom)

### Known open issue (intentionally deferred — 2026-08-13)
**Vertical gap between AI response and its hover action row** — after many iterative reductions
(36px → 20px → 8px → 2px, GAP constant 14px → 6px → 2px → 1px), the user still perceives the
spacing as too large. User-message spacing (36px padding + 2px GAP) is confirmed correct; only
assistant messages remain. Root cause may be that `chatHover.offsetHeight` for assistant messages
includes invisible trailing DOM elements (e.g. empty `DataSourcesBlock`, `AgentLogBlock`,
`RemovedDataSourcesBlock`) that push the anchor bottom lower than the visible text. Next
implementation session should investigate whether the anchor should target the last *visible* child
of `#chatHover` rather than `#chatHover` itself, and/or add `padding-bottom: 0` to those trailing
blocks via new-UI CSS to collapse their DOM footprint.

**Filed as a known issue; will be addressed in a future small fix session.**

---

## 2b. Chat Pane — Visual Defect Fixes (Loading Alignment, Model Selector Flash, Old Animations)

**Status:** ✅ Done
**% complete:** 100%
**Type:** Bug fix — visual defects reported 2026-08-14.

- **Bug 1 ✅** (Phase 38) — ChatLoader alignment: avatar wrapper div (40px + 8px gap) hidden via child-combinator selector specific to ChatLoader's DOM shape; dot now at prose left edge.
- **Bug 2 ✅** (Phase 38) — Model selector flash: `[data-new-ui="true"] #overflowScroll { display: none !important }`.
- **Bug 3 ✅** (Phase 40b + Phase 43) — Loading text + old spinners: PromptStatus text hidden; `l-ping` and `l-quantum` elements hidden via element-type selectors in `conversation-view.css`.

---

## 3. Assistant Creation Interface Overhaul

**Status:** ✅ Done
**% complete:** 100%
**Type:** Feature build.

### Outcome (Phases 46–48, implemented after 2026-08-19 orchestrator session)
- **Phase 46:** `NewAssistantTypeSelector.tsx` step-0 wizard (Private / Managed / Collaborative cards, Card 2 gated by `assistantPathPublishing`, Card 3 by `assistantAdminInterface`). 5-tab assistants view overhaul: "Shared with Me" tab added as first-class top-level tab; "My Assistants" simplified to canEdit=true only; "Teams" renamed from "Group Assistants". Access-type badges (Private/Shared/URL) on My Assistants rows.
- **Phase 47:** AssistantModal new-UI CSS styling via `[data-new-ui-assistants="true"]` scope. Card 3 overhauled: "Use existing team" / "Create new team" flow (async `createAstAdminGroup` + `updateGroupMembers`). All three cards now call `onConfirm` → all paths lead to AssistantModal.
- **Phase 48:** `InfoFloatCard.tsx` hover-preview cards on assistant rows (name, access pill, description, instructions preview, tags, model, tool count) and model rows (name, description, capability pills, context window). `menuPositioning.ts` Floating UI config for nested submenus. Submenu positioning converted from measured-top to `useFloating` in both `AttachMenu.tsx` and `ModelPicker.tsx`.

---

## 4. New Logic Bundle

Four sub-features. Tracked individually since they have very different scope/risk.

### 4a. Memory (implement per the LLM Wiki concept)

**Status:** ⏸ Deferred — intentionally last in sequence per your direction
**% complete:** 0%
**Type:** Full-stack feature (frontend + backend). **This is the only task in this list that requires
backend work**, which puts it outside the pure frontend `amplify-genai-frontend` new-UI effort scope
described in the standard preamble — will need an `amplify-genai-backend` session too.

**Concept, per your direction:** model Amplify's user-facing "Memory" on the same pattern this very
project uses for `NEW_UI_DOCS.md` — the [Karpathy "LLM Wiki" pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
a persistent, compounding, *LLM-maintained* knowledge base that accumulates facts about the user/
their work across conversations, rather than a simple flat key-value memory store. Concretely this
likely means:
- A per-user (or per-assistant?) markdown-like memory document, stored server-side
- The model reads relevant memory context at the start of a conversation and can *propose edits* to
  its own memory file over the course of a conversation (the way this chat updates NEW_UI_DOCS.md)
- User-visible surface to view/edit/clear their memory (old UI's `MemoryDialog` — Porting Status §7,
  currently ❌ not surfaced — is the closest existing reference point, but per your note this is a
  redesign, not a straight port)

**Open design questions to resolve before scoping a backend prompt:**
- Storage: DynamoDB item per user? Per user+assistant? Size limits?
- Update trigger: does the model propose edits every turn, end of conversation, or on an explicit
  "remember this" action?
- Injection: prepended to system prompt? Retrieved via RAG-style lookup for relevance?
- Editability: can the user directly edit the memory doc, or only steer it via conversation?

**Next step when we get here:** I'll help you draft the design doc for these open questions first
(this is a "needs to be designed" item, not "spec exists"), then split into a backend-implementation
prompt (`amplify-genai-backend` session) and a frontend-surfacing prompt (this repo, new UI settings
section + composer affordance).

---

### 4b. Deep Research

**Status:** ⏸ Deferred — backend work required first
**% complete:** 0%
**Type:** New feature (frontend + backend). **Backend prerequisite — deferred as a backend TODO after
the UI rework is complete.** Deep research requires backend orchestration (multi-step search, source
fetching, synthesis) that does not yet exist. Once the backend capability is built, the frontend
entry point is straightforward: a toggle in AttachMenu (same pattern as the Web Search toggle,
Group 3). No frontend work should start until backend confirms the capability exists.

*(Prompt intentionally withheld until backend is ready. See `NEW_UI_PORTING_STATUS.md` §9 for
the feature description.)*

---

### 4c. Amplify HELPER Assistants (easy access + admin-configurable)

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Feature build, frontend + admin panel wiring.

**What this covers:**
- Surface a curated set of "how do I do X in Amplify" helper assistants prominently/easily (e.g.
  pinned entry point in sidebar, or a dedicated section in NewHome or AttachMenu's "Add assistant").
- Make the *set* of helper assistants easily configurable from the admin panel (`NewAdminModal.tsx` —
  wiki Section 5, Phase 21) rather than hardcoded.

### Dependencies
Admin panel (`NewAdminModal.tsx`) already has a tab-tab structure (Configurations, Feature Flags,
Feature Data, etc.) — likely the right home is a new admin tab or an extension of "Feature Data."
Investigate whether "helper assistants" could just be a specially-tagged/flagged subset of regular
assistants (folderId or a new metadata field) rather than a wholly separate concept.

### Suggested prompt
```
(standard preamble)

Feature: "Amplify Helper" assistants — easily-discoverable, admin-configurable how-to assistants.

Step 0 — investigate: check whether assistants already support any admin-curated tagging/pinning
concept (search AssistantDefinition type, GroupAccessType, and NewAdminModal's existing tabs). Prefer
extending an existing mechanism over inventing a new one.

Step 1 — admin config: add a way for admins to mark specific assistants as "Helper" assistants and
control their order/visibility, surfaced in NewAdminModal.tsx (new tab or extend an existing one per
findings above — check Component Registry / wiki Section 5 before adding a new admin tab component).

Step 2 — frontend surfacing: add a prominent, easy-access entry point for helper assistants — e.g.
a "Get Help" section in NewSidebar or NewHome, or a pinned group at the top of AttachMenu's
"Add assistant" submenu. Keep it lightweight — this should feel like a fast lookup, not a full gallery
browse.

Update NEW_UI_DOCS.md and NEW_UI_PORTING_STATUS.md.
```

---

### 4d. Usage (cost/token consumption display)

**Status:** ⏸ Deferred — backend work required first
**% complete:** ~5% (placeholder section exists in `NewSettingsModal.tsx`; no data plumbed)
**Type:** Feature build — requires backend work before UI can be built.

`NewSettingsModal.tsx` has a placeholder "Usage" nav section. However, displaying useful per-user
cost and token consumption data requires a backend endpoint that does not yet exist or is not
confirmed to be in shape for this. **Deferred as a backend TODO after the UI rework is complete.**
Once backend confirms the data API, the frontend task is straightforward: build a stat-tile / chart
view inside the existing placeholder section using the same `NewLibraryView`-style visual language.

*(Prompt withheld until backend work is confirmed done.)*

---

## 5. Accessibility Standards Compliance (Pass 1)

**Status:** ✅ Done
**% complete:** 100%
**Type:** Audit + remediation.

### Outcome (session dated 2026-08-14)
8 Critical + 5 Major issues fixed; 4 Major deferred (see wiki §13b for full list).

Critical: `--text-muted` contrast raised (`#6E6E6E` / `#9E9C96`); focus traps added to NewSettingsModal + NewAdminModal + AttachmentPreview; ConversationComposer textarea `aria-label` added; AccountMenu focus-on-open fixed; PromptStatus `aria-live` injected via MutationObserver in ConversationViewShell; IconButton `aria-label` prop added.

Major: `prefers-reduced-motion` block added to `conversation-view.css`; ModelPicker/SegmentedControl `aria-label` props added; AttachMenu badge `aria-hidden`; Skills submenu `aria-live` added.

Deferred: screen-reader "Reasoning" announcement; AttachmentRail roving tabindex; old-UI wrapped components in settings; NewScheduledTasksView/NewLibraryView/NewAssistantsView keyboard audit.

Docs updated: `NEW_UI_DOCS.md` §13b added; `NEW_UI_WIKI_INSTRUCTIONS.md` §9 aria-label rule added.

---

## 6. Model Info Page / Comparison

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** New feature build.

Show more info about models, or a dedicated page comparing what each model offers (context window,
capabilities, cost tier, reasoning support, etc.).

### Suggested prompt
```
(standard preamble)

Feature: a models info/comparison surface.

Step 0 — investigate: check types/model.ts and the SupportedModels admin tab (NewAdminModal) for
what metadata already exists per model (description, capabilities, context window, reasoning
support, cost). ModelPicker.tsx (wiki Section 5, Phase 8) already has a modelDescription() helper —
reuse/extend rather than duplicate.

Step 1 — decide surface: either (a) enrich ModelPicker's existing model rows with more detail on
hover/expand, or (b) add a dedicated "Models" info page (new page= state value, following the
existing full-pane view pattern used by NewLibraryView/NewAssistantsView) that lists all available
models in a comparison-table or card-grid layout. Prefer (b) if there's meaningfully more info to
show than fits in a picker row — ask the user which they'd prefer if genuinely ambiguous after
investigation.

Update NEW_UI_DOCS.md (registry + progress) and NEW_UI_PORTING_STATUS.md if applicable (this is a
net-new feature, not a port, so it likely belongs as a new row in Porting Status Section 1 or a new
section entirely).
```

---

## 7. LEARN Page

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** New feature build.

Two components:
1. Chat-with-AI-about-Amplify-concepts interface
2. Access point for existing documentation & videos

### Suggested prompt
```
(standard preamble)

Feature: a "Learn" page/section.

Step 0 — investigate: check AccountMenu.tsx's existing "Documentation" link (wiki Phase 5:
links to https://www.vanderbilt.edu/agi/platforms/resources/) and confirm what documentation/video
assets already exist and where they're hosted, so this page can link out / embed rather than
duplicate content.

Step 1 — build: add a new full-pane view (new page= state value, following the NewLibraryView/
NewAssistantsView full-pane pattern) with two areas:
  (a) A chat interface scoped to "how do I use Amplify" style Q&A — likely the cleanest
      implementation is a dedicated conversation seeded with a Helper-style assistant/system prompt
      (see task 4c above — check if this should reuse the "Amplify Helper" assistant concept rather
      than building a separate chat pipeline)
  (b) A documentation/video index — links to existing docs (see investigation) and any video
      resources, presented as a simple resource list/grid using new-UI list-row conventions
      (reference NewLibraryView.tsx row styling).

Add a "Learn" nav item to NewSidebar.tsx following the existing SidebarNavItem pattern.

Update NEW_UI_DOCS.md (registry + progress) and NEW_UI_PORTING_STATUS.md (new feature, likely its
own new section since it doesn't map to an old-UI equivalent).
```
*Note: this task has a natural dependency on task 4c (Helper assistants) — consider sequencing
Learn Page after 4c so the chat-with-AI half can reuse that work instead of building a parallel
mechanism.*

---

## 8. Sharing Overhaul (send + receive)

**Status:** 🚧 Old modal still in use, no new-UI redesign
**% complete:** ~10%
**Type:** UX redesign + implementation.

Per `NEW_UI_PORTING_STATUS.md` §2/§7: the Share button in `ConversationHeader.tsx` exists and
triggers the old `ShareAnythingModal` — functional but not redesigned. There is currently **no
dedicated "view what was shared with you" surface** in the new UI at all.

### Suggested prompt
```
(standard preamble)

Feature: redesign sharing — both the "send a share" flow and the "view what's been shared with me"
flow. Both are currently old-UI (ShareAnythingModal for sending; no new-UI surface exists for
receiving/viewing shares at all).

Step 0 — investigate: find the backend/service layer for shares (search services/ for share-related
calls — read-only, do not modify) to understand what data is available: what can be shared
(conversations? assistants? both?), what metadata exists (sender, timestamp, message), and how
"received shares" are currently surfaced in the OLD ui (if at all) so you know the full scope.

Step 1 — send flow: replace the ConversationHeader.tsx trigger's destination — instead of opening
old ShareAnythingModal directly, build a new-UI-styled share flow in components/NewUI/ (either a
new modal or inline panel) that calls the same underlying share service. Do not modify
ShareAnythingModal.tsx itself.

Step 2 — receive flow: design and build a new full-pane or panel view for "things shared with me" —
likely a new sidebar nav item + full-pane view following the established pattern (NewLibraryView-
style list rows: who shared it, what, when, action to open/accept).

This is a good candidate for a design pass before implementation — consider using the Plan agent or
asking me (the tracker chat) for a UX outline first, since there's no existing new-UI reference
pattern for "receive" flows to copy from.

Update NEW_UI_DOCS.md and NEW_UI_PORTING_STATUS.md (Section 2/7 rows, plus registry).
```

---

## 9. Accessibility Scan — Version 2 (Follow-up Pass)

**Status:** ⏸ Deferred — depends on Task 5 landing first
**% complete:** 0%
**Type:** Audit (follow-up).

This is the second/confirmation accessibility pass after Task 5's remediation is implemented and
after several of the other feature tasks (2, 3, 4, 6, 7, 8) have landed new surfaces that also need
checking. Re-run the same audit methodology as Task 5 across the full new-UI surface area at that
point, specifically re-verifying fixed items and covering anything net-new since Task 5.

**Do not schedule this until Task 5 is done and at least tasks 2/3/8 have landed**, since running it
earlier just produces a stale report.

---

## 10. Standalone Assistant Page

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Feature build — new surface.

The app already has `pages/assistants/[assistantSlug].tsx` as a URL-based route (wiki §2.6). When
an assistant is published to a URL, this is the page the recipient sees. It currently renders in the
old UI. Needs a new-UI-styled version.

### What to build
A clean, minimal landing page at `/assistants/[slug]` that:
- Shows the assistant's name, icon, and description
- Has a single composer (same `NewHome`-style composer) for starting a conversation with the assistant
- Handles both "click to open in app" (for authenticated users) and "converse inline" (if the page
  itself is meant to be interactive) — investigate what the current page does before assuming

### Suggested prompt
```
(standard preamble)

Feature: new-UI version of the standalone assistant page (`pages/assistants/[assistantSlug].tsx`).

Step 0 — investigate: read `pages/assistants/[assistantSlug].tsx` (read-only) to understand what it
currently does — does it render a full chat, just show info, or redirect to the main app? What data
does it receive from the URL/props? What authentication state does it check?

Step 1 — build: inside `components/NewUI/` (new component, e.g. `components/NewUI/assistant-page/`)
create a new-UI version of whatever the page does, consistent with the new design language
(NewHome-style composer if there's chat, NewAssistantsView-style headers if it's info-only).
Wire it into `pages/assistants/[assistantSlug].tsx` via the same `uiPreference` toggle pattern
used in `home.tsx` — new-UI users get the new page, classic users get the old one. Per the
One-Directory Rule, do NOT modify the old page component directly.

Update NEW_UI_DOCS.md (new phase + registry) and NEW_UI_PORTING_STATUS.md (new row under Section 1).
```

---

## 11. Adjustable Sidebar Width

**Status:** ✅ Done
**% complete:** 100%
**Type:** Feature build.

### Outcome (Phase 44, implemented after 2026-08-19 orchestrator session)
Implemented entirely in `components/NewUI/sidebar/NewSidebar.tsx`. Drag handle on right edge;
min 220px, max 480px, default 310px. Direct DOM updates per pixel (zero React re-renders during
drag); `sidebarWidth` state committed only on mouseup. Persisted to `localStorage` key
`amplify_sidebar_width`. Collapsed 52px icon-rail completely unaffected (separate code path).
A `ResizeObserver` on `.chatcontainer` was also added to `NewUIMessageActionsLayer.tsx` so
action row positions recompute after a sidebar drag (flex-1 content area changes width).

---

## 12. User Message Edit UI — New UI Treatment

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Bug fix / feature — visual regression.

When the user clicks to edit a previously sent message, the old UI's `UserMessageEditor` renders.
Two problems reported:
1. The edit area still uses old-UI styling (mismatched with new UI chrome)
2. The editing area is too narrow/tall — "skinny, tall, and makes it harder to read/see"

### What exists
`UserMessageEditor` is inside the old `ChatMessage.tsx` (DO-NOT-CHANGE). It renders an
`<textarea>` with id `#editResponse` inside the user bubble. Phase 29's `NewUIUserMessageMarkdownLayer`
already has an edit-mode guard that hides the markdown host when `#editResponse` is present. So the
architecture for detecting edit-mode already exists — it just needs CSS treatment.

### Suggested prompt
```
(standard preamble)

Bug: when a user edits a previously sent message, the edit UI uses old styling — it looks out of
place in the new UI and the textarea becomes narrow and tall, making it hard to read.

The edit UI lives inside `UserMessageEditor` (nested in `ChatMessage.tsx` — both DO-NOT-CHANGE,
read only). It renders a `<textarea id="editResponse">` and Save/Cancel buttons inside the user
message's `#chatHover` bubble container. Style it via `conversation-view.css` only.

Target styling (CSS-only, scoped to `[data-new-ui="true"]`):
- The `#editResponse` textarea: full-width of the bubble, auto-height (min ~3 lines), Inter font
  at 16px, `--bg-app` background, `--border-subtle` border (1px, 8px radius), `--text-primary`
  text, comfortable padding (12px). Remove any fixed-height constraint that is making it
  unreasonably tall/narrow. Use `resize: vertical` so users can adjust.
- Save/Cancel button row: styled consistently with the new UI (small, `--bg-raised` secondary
  button style for Cancel, `--accent` filled style for Save). Reference the existing action-row
  button styles already in `conversation-view.css` for the button appearance.
- While in edit mode (`.user-message:has(#editResponse)`): hide the bubble's right-align
  `margin-left:auto` so the edit textarea can expand to full column width rather than being
  constrained to 85% bubble max-width. This is the root cause of the "skinny" problem.

After implementing: verify by code-trace that the `.user-message:has(#editResponse)
.new-ui-user-md-host { display:none }` guard from Phase 29 still works (it should — you're not
touching it).

Update NEW_UI_DOCS.md (add to Phase 38 or a new Phase 39) and NEW_UI_PORTING_STATUS.md
(update the "Conversation rename (inline in header)" → this is the user-message edit row in §2).
```

---

## 13. Sidebar Conversation Three-Dot Menu: Pin + Share + Collapsible Sections

**Status:** ⬜ Not started
**% complete:** ~50% (rename ✅ already exists; pin / share / collapse ❌ not yet)
**Type:** Small feature — UX enhancement.

The `ConversationRow.tsx` hover ⋯ menu currently has Rename and Delete (wiki Phase 2).

### What's being asked for (updated 2026-08-19)
1. **Three-dot menu items:** Rename | Delete | Share | Pin (showing "Unpin" when already pinned).
   Menu order: Rename at top, then Pin/Unpin, then Share, then Delete at bottom (destructive last).
2. **Pinned section:** When a conversation is pinned it appears in a "Pinned" section **just
   above** Recents in the sidebar. If nothing is pinned, the Pinned section is hidden entirely.
3. **Collapsible sections:** Both the "Pinned" section and the "Recents" section should have a
   small chevron arrow next to their heading that collapses/expands the section's contents.
   Collapse state persisted to localStorage so it survives reload. This requires adding a
   `collapsible` capability to `SidebarSection.tsx`.

### Suggested prompt
```
(standard preamble)

Feature: upgrade the sidebar conversation three-dot menu and add collapsible sections.

**Step 0 — investigate (read-only, no edits):**
1. Read `types/` for the `Conversation` type: does a `pinned` boolean field exist? If not, note it
   — the implementer must decide whether to add it to the type or use a local store.
2. Read `home.context.tsx` and `home.tsx` (read-only): does `handleUpdateConversation` support
   updating a `pinned` field? Will setting it persist via the existing remote conversation sync
   pipeline (`services/remoteConversationService.ts` — read-only)?
3. Read `components/NewUI/sidebar/ConversationRow.tsx`: understand the exact current menu structure
   (Rename, Delete), the isMenuOpen state pattern, and how actions call context handlers.
4. Read `components/NewUI/sidebar/SidebarSection.tsx`: understand its current props. It does NOT
   currently support collapse — note what props to add.
5. Read `components/NewUI/chat/ConversationHeader.tsx`: find how the Share button there triggers
   the share flow (likely a callback prop or event dispatch). That is the pattern to replicate
   from the three-dot menu.

Report the answers to these five questions as a brief list before writing any code.

---

**Step 1 — upgrade the ⋯ menu in `ConversationRow.tsx`:**

Add these items to the existing Rename/Delete menu (use `handleUpdateConversation` from context
for state updates; follow the existing Rename/Delete patterns exactly):
- **Pin / Unpin**: `IconPin` / `IconPinnedOff`. Toggle `conversation.pinned`. If `pinned` doesn't
  exist on the type, add it as `pinned?: boolean` in the local Conversation type extension
  (DO NOT MODIFY `types/` directly — if the field is missing from the canonical type, use a
  type assertion or data field in your component, and leave a TODO comment noting the type
  should be updated when backend confirms support).
- **Share**: `IconShare`. Use whatever mechanism `ConversationHeader.tsx`'s share button uses
  (found in Step 0 item 5). Do NOT build a new share flow — just trigger the same existing one.
- Menu order (top → bottom): Rename | Pin (or Unpin) | Share | Delete.
- Delete remains destructive (keep the same confirm pattern it currently has).

---

**Step 2 — add collapsible support to `SidebarSection.tsx`:**

Add two optional props:
- `isCollapsible?: boolean` — when true, renders a small chevron (`IconChevronDown` /
  `IconChevronRight`, 14px, `--text-muted`) in the heading row, right of the label.
- `storageKey?: string` — localStorage key for persisting collapsed state across reloads.
  When absent, state is local (non-persisted) and defaults to expanded.

Behavior:
- Clicking anywhere on the section heading row (not just the chevron) toggles collapsed/expanded.
- When collapsed: the `children` div is `max-height: 0; overflow: hidden` (animated,
  `prefers-reduced-motion` gated).
- Do NOT change behavior of existing SidebarSection uses that don't pass `isCollapsible`.

---

**Step 3 — add Pinned section to `NewSidebar.tsx`:**

- Above the existing time-bucketed Recents groups, add a "Pinned" section using
  `<SidebarSection label="Pinned" isCollapsible storageKey="amplify_sidebar_pinned_collapsed">`.
- Only render it when `pinnedConversations.length > 0` (derive this from the conversations list
  in context: `conversations.filter(c => c.pinned)`).
- Each row is a standard `<ConversationRow>` (same as Recents rows — the three-dot menu now
  shows "Unpin" instead of "Pin" for conversations where `c.pinned === true`).

- The Recents section heading should also gain `isCollapsible storageKey="amplify_sidebar_recents_collapsed"`.
  (The Recents section already has a heading via `SidebarSection` — just pass the new props.)

---

**Files to change:** `components/NewUI/sidebar/ConversationRow.tsx`,
`components/NewUI/sidebar/SidebarSection.tsx`, `components/NewUI/sidebar/NewSidebar.tsx`.
No changes outside `components/NewUI/` are needed (One-Directory Rule).

**After implementing:** update `NEW_UI_DOCS.md` (Phase N, registry notes for
SidebarSection collapsible props, ConversationRow menu update) and
`NEW_UI_PORTING_STATUS.md` §1 (add "Conversation pinning" row → ✅,
update "Conversation sharing" row to note sidebar entry point added).
```

---

## 14. Attachment Preview in Chat History + Image Passing Bug

**Status:** ✅ Done (Sub-problems A and B)
**% complete:** 100% (core fixes done; one pending UX enhancement — see Task 14b below)
**Type:** Critical bug + feature build.

### Outcome (session dated 2026-08-18)

**Sub-problem A — images not reaching backend:** Root cause found: `doc.raw` is always `""` (empty string) — image content is stored in S3, never in `raw`. The real bug was that `ConversationViewShell.tsx` was calling `removeItem()` on `amplify_pending_docs` but never reading it — so all attached docs (with valid S3 `doc.key` references) were silently discarded. Fix: new PATH A in `ConversationViewShell.tsx` reads the pending docs, builds a full `ChatRequest`, and calls `useSendService().handleSend()` directly (same hook `Chat.tsx` uses), bypassing the `#sendMessage` DOM click for sends with attachments.

**Sub-problem B — pasted images were cosmetic only:** `ConversationComposer.tsx`'s `addImageToRail` only created a visual `UIAttachment` with an object-URL thumbnail but never uploaded to S3. Fix: `addImageToRail` now also calls `handleFile` to start an S3 upload. A sentinel-ID pattern links the `UIAttachment` to the resulting `AttachedDocument`. `canSend` blocks send while uploads are in progress.

**Sub-problem B display — image thumbnails in chat history:** `DataSourcesBlock` (which old UI already used to render attachment thumbnails in sent messages) is now restyled for the new UI: 200×200 cards → 88×88, `shadow-lg` removed, `--border-subtle` border added, "Included documents:" label hidden. No portal component needed — presigned S3 URL fetch mechanism was already working.

**Remaining UX gap → Task 14b:** `canSend` blocks the entire send until upload completes. User wants a different UX: go to chat view immediately, but delay the actual API call until images finish uploading, with a visible loading indicator. See Task 14b below.

Two related problems:
1. **No attachment preview in chat history** ✅ Fixed — thumbnails shown via restyled DataSourcesBlock
2. **Images not passing through** ✅ Fixed — S3 path correctly wired via direct useSendService call

---

## 14b. Pending Upload UX — Go to Chat View Immediately, Delay Send Until Images Ready

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** UX enhancement — continuation of Task 14.

### What's needed
Currently `canSend` blocks the entire send (and the transition to chat view) until image uploads complete. The desired UX is:
- User hits Send → **immediately** navigate to the chat view (show their message in the pending state)
- The actual API call does NOT go out until all uploads are finished
- A subtle, unobtrusive loading indicator shows that uploads are in progress (not a blocking spinner — something ambient like a small progress bar or pulsing dots on the send button or inside the pending message bubble)
- Once uploads complete, the API call fires automatically — no user action needed

### Context
- `ConversationComposer.tsx` has PATH A (direct `useSendService` call for sends with attachments) from Task 14
- The "pending" message shown before a real API response is the asterisk-pulse animation from Phase 30
- The `canSend` guard needs to be split: "can navigate to chat view" (immediate) vs "can fire API call" (when uploads done)

### Suggested prompt
```
(standard preamble)

Feature: change the pending-upload UX so that the user is taken to the chat view immediately when they hit Send, even while image uploads are still in progress. The actual API call should wait for all uploads to finish before firing.

Read `components/NewUI/chat/ConversationComposer.tsx` (the Task 14 implementation of PATH A) and `components/NewUI/shared/` to understand the current upload state tracking. Then:

Step 1 — decouple "navigate to chat view" from "fire API": split the `canSend` guard:
  - "can navigate": always true once the user has typed text (or a text message + any attachments)
  - "can fire API": true only when all uploads are complete
  On Send: navigate to chat view immediately (existing bridge pattern), but queue the API call. If uploads are still pending, set a flag/state that triggers the API call automatically when the last upload resolves.

Step 2 — pending upload indicator: while the API call is queued (waiting for uploads), show a subtle ambient loading state in the chat view. Options in order of preference:
  (a) A small, pulsing progress indicator inside or below the pending message bubble (where the asterisk currently shows)
  (b) A progress bar on the send button area  
  The indicator should disappear the moment the API call fires. Use CSS animation; do NOT use a blocking full-screen spinner.

Step 3 — error handling: if an upload fails, show a small inline error on the affected attachment card in the pending message bubble, with a "Retry upload" option. Do not automatically cancel the whole send.

Changes allowed: `ConversationComposer.tsx`, `ConversationViewShell.tsx`, `conversation-view.css`, and any new helper component in `components/NewUI/chat/`. Do NOT modify `Chat.tsx` or `AttachFile.tsx`.

Update NEW_UI_DOCS.md (extend the existing Task 14 phase entry) and NEW_UI_PORTING_STATUS.md §2.
```

---

## 15. Accent Color Consistency — Switch to Blue

**Status:** ✅ Done
**% complete:** 100%
**Type:** Visual polish — global token change.

### Outcome (Phase 50, implemented after 2026-08-19 orchestrator session)
`--accent` updated in `globals.css`: light `#D97757` → `#3b82f6`, dark `#D97757` → `#006FEE`.
New `--accent-fg: #ffffff` companion token added. Send button glyph `#2A1710` → `var(--accent-fg)`
in `NewHome.tsx` and `ConversationComposer.tsx`. Scrollbar thumbs updated to blue in
`conversation-view.css`. Zero hardcoded orange/purple/indigo hits found in `components/NewUI/`.
Standing rule added to `NEW_UI_WIKI_INSTRUCTIONS.md` §9 rule 18 locking blue as the accent color
for all future sessions.

**Type:** Visual polish — global token change.

---

## 16. Custom Instructions Overhaul — Multiple Named Sets

**Status:** ⬜ Not started
**% complete:** ~10% (single-value save exists; not wired into conversations)
**Type:** Feature build — enhancement of existing placeholder.

### Current state
`NewSettingsModal.tsx` → Customize → Custom Instructions has a single 4000-char textarea that saves
to `localStorage` key `amplify_custom_instructions`. The saved value is **never read back into any
conversation** — Phase 19 TODO "wire into handleNewConversation" was never done.

### What's needed
1. **Multiple named instruction sets** — users can create, name, edit, and delete instruction sets
   (like saved presets). Each has a name and a body (≤4000 chars). Stored in localStorage as a JSON
   array under `amplify_custom_instruction_sets`.
2. **Active-set selector** — a clear UI control (radio/select) for choosing which set is currently
   active. The active set's id stored in `amplify_active_custom_instructions`.
3. **"Applied everywhere" messaging** — UI must clearly state that the active instruction set is
   appended to ALL chats, including those started with assistants or with other features active.
   A visible callout/banner in the settings section.
4. **Wire into conversations** — the active custom instructions are injected into new conversations
   as a system prompt or prepended to `DEFAULT_SYSTEM_PROMPT` via `handleNewConversation` in
   `home.tsx`. This is the ONE permitted edit outside `components/NewUI/` per the layout-section
   exception in the One-Directory Rule (wiki §8). Reading a localStorage value and prepending to
   the system prompt is minimal and low-risk.

### Suggested prompt
```
(standard preamble)

Feature: overhaul Custom Instructions into a multi-set named system.

The existing single-value implementation is in `components/NewUI/settings/NewSettingsModal.tsx`
under the "Custom Instructions" section of the Customize nav group. The `amplify_custom_instructions`
localStorage key currently holds a plain string. The value is never injected into conversations.

Step 1 — data model: define a new localStorage schema for multiple named sets:
  Key: `amplify_custom_instruction_sets`
  Value: JSON array of `{ id: string, name: string, body: string }` objects
  Key: `amplify_active_custom_instructions_id` (id of the active set, or "" for none)
  Migration: on first load, if `amplify_custom_instructions` has a non-empty value, create a
  single default set from it named "Default" and remove the old key. This preserves any existing
  saved instructions.

Step 2 — update the settings UI in `NewSettingsModal.tsx` (the Custom Instructions section):
  - List of saved sets: each row shows the name and a character count; clicking selects/edits it.
  - "Active" indicator: a clear radio or "Set as active" button on each row; active set is
    highlighted.
  - Edit panel: name input + body textarea (4000 char limit + counter). Save / Cancel / Delete
    buttons.
  - "New set" button to create an empty set.
  - Prominent info callout: "The active instruction set is appended to all of your conversations,
    including those using assistants or other features." Style the callout using the existing
    `--bg-raised` + `--border-subtle` + `--text-secondary` pattern used in other info cards.

Step 3 — wire into new conversations: in `pages/api/home/home.tsx`, in the `handleNewConversation`
function (layout section, lines ~1600+), read `amplify_active_custom_instructions_id` and look up
the corresponding body from `amplify_custom_instruction_sets`. If a non-empty body is found,
prepend it to the conversation's `systemPrompt` field (or append to `DEFAULT_SYSTEM_PROMPT`,
depending on how the field is used — read the existing code before deciding). This is the permitted
touch-point outside `components/NewUI/` per the One-Directory Rule (layout/render section only).

Update NEW_UI_DOCS.md (new phase + updated registry entry for the settings section, updated §13
"Custom Instructions" pattern note) and NEW_UI_PORTING_STATUS.md §4 (Custom Instructions row).
```

---

## 17. "Setting Up Amplify" Loading Animation — Replace with New Design

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Feature polish — animation replacement.

The "Setting up Amplify" screen (shown on first load while home.tsx initialises, feature flags fetch,
models load, etc.) displays an old-style loading animation that doesn't match the new UI's visual language.
Needs to be replaced with a cleaner, more polished animation.

### What exists
Read `components/Spinner.tsx` and/or `components/Loading.tsx` (DO NOT CHANGE — read only) to find
the current "Setting up Amplify" element. Check `pages/index.tsx` and `pages/api/home/home.tsx`
to find exactly where this loading screen is gated (the `!isLoading` / `serverSideApiKeyIsSet` checks).

### What to build
A new loading screen component in `components/NewUI/` (e.g. `NewUILoadingScreen.tsx`) that renders
when the app is in its loading state. Design goals:
- Clean, minimal, brand-appropriate: show the Amplify icon (`/icon2.png`), the word "Amplify", and a
  smooth subtle animation (breathing/pulse on the icon, or a thin progress bar, or a shimmer effect)
- No spinning wheels or old-style loading bars
- Match the new UI's color system (`--bg-app`, `--text-primary`, `--accent`)
- Must be gated by the same condition as the current loading screen — should not be visible for more than
  a few seconds on a normal connection

### Suggested prompt
```
(standard preamble)

Feature: replace the old "Setting up Amplify" loading animation with a new design that matches the new UI.

Step 0 — investigate: read `components/Spinner.tsx`, `components/Loading.tsx` (DO NOT CHANGE), and
`pages/api/home/home.tsx` to find exactly what renders during the loading state and under what condition.
Look for the "Setting up Amplify..." text specifically — what component renders it and what state gates it.

Step 1 — build: create `components/NewUI/NewUILoadingScreen.tsx` with a clean loading design:
  - Center the Amplify logo (`/icon2.png`, ~48px) with a smooth breathing/pulse animation
  - The word "Amplify" below in --text-primary, appropriate size
  - A subtle, thin progress/shimmer bar below the logo in `--accent` color with a smooth indeterminate
    animation (no spinning, no bouncing — calm and premium)
  - Background: `--bg-app`. No borders, no cards. Just the mark + wordmark + progress indicator, centered.

Step 2 — wire: in `pages/api/home/home.tsx` (layout section), when `uiPreference === 'new'` and the
loading condition is true, render `<NewUILoadingScreen />` instead of the old loading component.

Do NOT modify the old `Spinner.tsx` / `Loading.tsx` components — wrap at the page layout level only.

Update NEW_UI_DOCS.md (new component in registry, new phase entry).
```

---

## 18. Library — Image/File Preview + Filter + Sort

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Feature build — enhancement of existing NewLibraryView.

### What's needed
1. **File preview** — when a user clicks a file/image in the library, show a preview (full-size image
   or a document preview panel). Currently `NewLibraryView.tsx` shows file rows but no preview.
2. **Filter** — allow filtering by file type (image, PDF, doc, etc.) or by date range.
3. **Sort** — allow sorting by name, date uploaded, type, size.

### Suggested prompt
```
(standard preamble)

Feature: add file preview, filtering, and sorting to `components/NewUI/library/NewLibraryView.tsx`.

Step 0 — investigate: read `NewLibraryView.tsx` (DO NOT CHANGE — read only to understand current structure)
and the data model for library items (check what fields each item has: name, type, size, date, URL, etc.).
Also check if `AttachmentPreview.tsx` (wiki §5, Phase 18) can be reused for in-library preview — it already
handles images; check if it supports documents.

Step 1 — file preview: wire up a click handler on each library row to open `AttachmentPreview.tsx` (if
reusable) or a new `NewUILibraryPreview.tsx` component. For images: full-size with zoom. For documents
(PDF, docx): show metadata (name, size, date, type) and a "Download" link if direct content preview is
not available via the existing service.

Step 2 — filter bar: add a filter row above the library list with type-based chips (All | Images | PDFs |
Documents | Other) and a date-range picker (Today / Last 7 days / Last 30 days / All time). Filter state
is local (not persisted). Use the existing `SegmentedControl.tsx` (wiki §5, Phase 11) for the type chips.

Step 3 — sort control: a "Sort by" dropdown (Name ↑↓ / Date ↑↓ / Size ↑↓ / Type) using the existing
`ModelPicker`-style popover pattern. Default: Date ↓ (newest first).

All changes in `components/NewUI/library/` + `conversation-view.css` only.
Update NEW_UI_DOCS.md (extend the NewLibraryView registry entry, new phase) and NEW_UI_PORTING_STATUS.md §5.
```

---

## 19. Sidebar Three-Dot Menu — Delete Button Disappears on Hover

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Bug fix — hover/UX regression.

When the user clicks the ⋯ button on a conversation row, then moves their mouse toward the Delete option,
the menu dismisses before they can click Delete. The delete button disappears mid-path as the mouse leaves
the conversation row's hover area.

### Root cause hypothesis
`ConversationRow.tsx` shows the ⋯ button and possibly the dropdown on `:hover` state. When the user moves
the mouse from the ⋯ button to the dropdown menu, they briefly exit the conversation row's hover area if
the dropdown is positioned outside the row's bounding box. The `mouseLeave` event fires on the row,
hiding both the ⋯ button and the dropdown together.

### Suggested prompt
```
(standard preamble)

Bug: in `components/NewUI/sidebar/ConversationRow.tsx`, when the user clicks the ⋯ button and then moves
their mouse toward the dropdown menu (Rename / Delete), the menu disappears before they can click the
delete button.

Step 0 — investigate: read `ConversationRow.tsx` to understand exactly how the dropdown is shown/hidden.
Is it controlled by hover state (`onMouseEnter`/`onMouseLeave` on the row element)? By a click toggle?
By a CSS `:hover` rule in `conversation-view.css`? The fix depends on the mechanism.

If hover-controlled: the fix is to keep the dropdown visible as long as the mouse is over EITHER the
row OR the dropdown itself. The standard pattern is: when the dropdown is open (after a click on ⋯),
lock visibility with a React `isMenuOpen` boolean state that only closes on (a) clicking an action,
(b) pressing Escape, or (c) clicking outside. This decouples the menu from the row's hover state once
it's been explicitly opened.

If click-controlled but the menu is dismissing on mouse-out of the row: the dropdown is likely positioned
absolutely outside the row element, so `onMouseLeave` on the row fires even when the mouse is still inside
the dropdown. Fix: add `onMouseLeave` guard that checks `relatedTarget` to see if the mouse moved into
the dropdown, not away from it. Or, use a `useClickOutside` / `FocusScope` approach so the menu only
closes on a genuine outside click.

Fix in `ConversationRow.tsx` only. Do NOT touch any other sidebar components.
Update NEW_UI_DOCS.md (Phase N note on the fix).
```

---

## 20. Settings — Account, Storage, Connectors New-UI Redesign

**Status:** ✅ Done
**% complete:** 100%
**Type:** Feature build — visual redesign of three settings sections.

### Outcome (Phase 45, implemented after 2026-08-19 orchestrator session)
Three new files created: `NewAccountSection.tsx` (self-loading accounts, MTD cost card, rate-limit
banner, add/edit/delete, save wired), `NewStorageSection.tsx` (four styled radio cards, pending
callout, progress bar, save with confirm), `NewConnectorsSection.tsx` (SegmentedControl tabs:
Integrations + Tool API Keys; OAuth popup connect/disconnect, per-integration spinners, CSS
overrides for Tool API Keys tab). `NewSettingsModal.tsx` updated to import and use all three.
Zero changes outside `components/NewUI/` (One-Directory Rule observed).

---

## 21. Workflows View

**Status:** ✅ Done
**% complete:** 100%
**Type:** Feature build — new full-pane view.

### Outcome (Phase 49, implemented after 2026-08-19 orchestrator session)
`NewWorkflowsView.tsx` created in `components/NewUI/views/`. Two-pane layout: 340px left list
(search, template cards with step-count/base/public badges, hover edit/delete, delete confirm),
right detail pane (read-only: name/desc, Inputs table, Steps list, "Edit Workflow" button).
`AssistantWorkflowBuilder` reused unchanged inside a `.new-ui-workflow-editor-modal` wrapper div
for CSS scoping. Sidebar nav entry added (`IconPuzzle`, gated by
`featureFlags.createAssistantWorkflows`). `home.tsx` render case added.
`conversation-view.css` builder overrides block added.

---

## Phase 51 — Hover Row Gap Root-Cause Fix (Task 2 final open issue)

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Bug fix — spacing regression confirmed still present (2026-08-19).

### What's wrong
Three distinct issues (user-confirmed still present as of 2026-08-19 — not fixed by Phases 33–37):
1. **Too much gap between end of AI response and its hover action row** — the row appears further
   below the last line of prose than it should.
2. **New gap between "Thought process" disclosure and AI prose response** — a visible blank space
   has appeared between the "Thought process" dropdown button and the assistant response body
   beneath it.
3. **Hover row hangs so low it overlaps the next conversation turn** — when a turn is followed by
   a user message, the action row overlays the top of that next turn.

### Root cause hypothesis (from Task 2 notes)
`chatHover.offsetHeight` for assistant messages may include invisible trailing DOM elements
(`DataSourcesBlock`, `AgentLogBlock`, `RemovedDataSourcesBlock`, etc.) that have non-zero height
even when empty, pushing the anchor bottom lower than the visible text bottom. Phase 35 set
`assistant-message` `padding-bottom: 8px` then Phase 36 reduced it to `2px` — the row's `GAP`
is `assistant: 1` — yet the gap persists. The overlap with the next turn suggests the combined
in-flow `padding-bottom` reserve + GAP may exceed the reserved `padding-bottom` on
`.enhanced-chat-message.assistant-message`.

### Suggested prompt
```
(standard preamble)

Bug fix: three persistent hover-row spacing issues in the chat pane. All three are confirmed still
present as of 2026-08-19 despite the Phase 33–37 fix passes. This is a focused investigation-first
task — read the current CSS and component state BEFORE writing any fix.

**Issue 1 — gap between AI response end and hover action row.**
Read the current values of:
- `.enhanced-chat-message.assistant-message { padding-bottom }` in `conversation-view.css`
- `GAP` constant for `assistant` role in `NewUIMessageActionsLayer.tsx`
- Any trailing DOM blocks inside a typical assistant `.enhanced-chat-message` that have non-zero
  height when empty: `DataSourcesBlock`, `AgentLogBlock`, `RemovedDataSourcesBlock` (all inside
  `.enhanced-chat-message` but after `.assistantContentBlock`).
If those trailing blocks have non-zero default height, add `conversation-view.css` rules to zero
them out when empty: `[data-new-ui="true"] .enhanced-chat-message [class*="DataSources"]:empty,
... { display: none }` (or `height: 0; overflow: hidden` if `:empty` doesn't match — read the
actual rendered class names first). The action row's `computePosition()` uses `#chatHover.offsetHeight`
as its anchor; every invisible pixel of height below the prose pushes the row down.

**Issue 2 — gap between "Thought process" disclosure and AI prose.**
The `.text-sm\!important.opacity-70` reasoning wrapper (which contains the "Thought process"
`#expandComponent` button) has `margin-bottom` set in Phase 33 (`10px`). If a gap is appearing
*below* the "Thought process" button and *above* the prose that follows it, the problem is likely
that `margin-bottom` value on the reasoning wrapper — reduce it or zero it if the expanded block
has its own padding. CSS-only fix in `conversation-view.css`.

**Issue 3 — hover row overlaps the next conversation turn.**
This happens when the row's vertical position (`top = anchorBottom + GAP`) plus the row's own
height (~24px) exceeds the next `.enhanced-chat-message`'s `top`. The in-flow `padding-bottom`
on `.enhanced-chat-message.assistant-message` is supposed to reserve that space. Check: is the
current `padding-bottom` value (set in Phase 35/36) actually large enough to contain
`GAP(1) + row_height(~24px)` = ~25px? If `padding-bottom` is `2px`, it clearly is not. Raise it
to at least `28px` to reserve the row's footprint. Counter-check: does raising `padding-bottom`
re-introduce the "too much gap" from Issue 1? It should not, because padding-bottom appears BELOW
the row (not above it) — it's the next-turn clearance, not the "gap from prose to row" gap.

**Fix approach:**
- CSS-only where possible (`conversation-view.css`).
- If adjusting GAP or anchor logic is needed, change `NewUIMessageActionsLayer.tsx`.
- Do NOT touch any protected files.

Verify by code-trace that after your changes:
- A typical assistant message with no reasoning block: GAP from last prose line to row top ≤ 8px.
- A message with "Thought process" showing: no extra blank space between the disclosure button
  and the prose below it.
- The hover row is fully contained within its message's padding-bottom reserve and does not
  visually overlap the next turn.

Update `NEW_UI_DOCS.md` (Phase 51, note the CSS values changed) and
`NEW_UI_PORTING_STATUS.md` §2 (hover action row row → mark fully ✅ when all three resolved).
```

---

## Suggested Sequencing Summary

> **Current state as of 2026-08-19 (updated by orchestrator):**
> Phases 1–50 complete. The "prompts written, not yet run" block from the previous orchestrator
> session is now fully executed. Tasks 11, 15, 20, 21 and Task 3 (Phases 46–48) are all ✅ Done.

**Immediate — open bugs:**
1. **Phase 51** — Hover row gap root-cause fix (three spacing issues; user-confirmed still present)
2. **Task 19** — Three-dot delete button disappears on hover (ConversationRow.tsx bug)

**Next feature — ready now:**
3. **Task 13** — Sidebar three-dot menu: Rename | Delete | Share | Pin + collapsible Pinned/Recents sections (prompt ready above)

**Short-term features (in recommended order):**
4. **Task 12** — User message edit UI (CSS-only, fast)
5. **Task 14b** — Pending upload UX refinement
6. **Task 17** — "Setting up Amplify" loading animation replacement
7. **Task 18** — Library preview + filter/sort
8. **Task 16** — Custom Instructions overhaul (multiple named sets + wire into new conversations)

**Longer horizon:**
- **Task 4c** (Helper assistants) → **Task 7** (Learn page) — natural pair
- **Task 6** (Model info page)
- **Task 8** (Sharing overhaul — UX design pass first)
- **Task 10** (Standalone assistant page)
- **Task 9** (a11y pass 2 — after more features land)
- **Task 4a** (Memory — intentionally last; needs design doc first)

**Backend prerequisites (do not start frontend work until backend is ready):**
- Task 4b (Deep Research) — needs backend orchestration built first
- Task 4d (Usage) — needs backend cost/token data API confirmed first

**Recently completed (since last orchestrator session, 2026-08-19):**
- Phase 43 ✅ — Dual loading-dot fix + "Thinking…" animated text (ConversationViewShell + CSS)
- Phase 44 ✅ — User-resizable sidebar width (Task 11, NewSidebar.tsx)
- Phase 45 ✅ — Settings Account/Storage/Connectors new-UI redesign (Task 20)
- Phase 46 ✅ — Assistant creation type selector + 5-tab assistants view overhaul (Task 3 Prompt A)
- Phase 47 ✅ — AssistantModal CSS styling + team creation + all cards → modal (Task 3 cont.)
- Phase 48 ✅ — Hover-preview info cards + Floating UI submenu positioning (Task 3 Prompt B)
- Phase 49 ✅ — Workflow Templates full-pane view + sidebar nav entry (Task 21)
- Phase 50 ✅ — Blue accent color pass (Task 15): `--accent` → `#3b82f6`/`#006FEE`, standing rule added

---

## Change Log

- **Created** — initial tracker seeded from your 9-item task list, cross-referenced against
  `NEW_UI_DOCS.md` (through Phase 23) and `NEW_UI_PORTING_STATUS.md`.
- **2026-08-10** — Task 1 marked ✅ Done; spun out Task 1b (Web Search/RAG wiring bug) from its findings.
- **2026-08-11** — Task 1b marked ✅ Done. Task 2 rescoped against chat-pane-migration-spec.md.
- **2026-08-11 → 2026-08-13** — Task 2: Phases 26–37 completed. All 12 spec items addressed. One known
  open issue remains (hover row spacing). Task 2 marked 🚧 90% complete.
- **2026-08-13** — Orchestrator conversation ended. New orchestrator chat started.
- **2026-08-14** — Task 5 (a11y pass 1) ✅ Done. 8 Critical + 6 Major issues fixed; 4 Major deferred.
  Task 2b added for ChatLoader alignment + old-UI model selector flash bugs.
- **2026-08-14** — Task 2b: Bug 2 (model flash) ✅ fixed. Bug 1 (ChatLoader alignment) ✅ fixed. Bug 3
  (old-UI ldrs spinners during pre-response window) discovered and queued.
- **2026-08-18** — Task 2c (scroll jumping) ✅ Phase 39. Task 14 (attachment passing + thumbnails) ✅
  Phase 40. Phase 40b (CSS polish + 4 bug fixes) ✅. Phase 41 (scroll anchoring + streaming fade) ✅.
  Phase 42 (deferred upload send + UploadPendingIndicator) ✅. New tasks added: 10, 11, 12, 13, 14, 14b,
  15, 16, 17, 18, 19. Hover row gap + loading animation issues queued as Phase 43/44.
- **2026-08-19** — Orchestrator session ended. Prompts written for Phase 43, Phase 44 (hover row gap),
  Task 11, 15, 20, 21, Task 3 Prompt A/B. All queued as "not yet run".
- **2026-08-19** — (New orchestrator session) Major tracker update: all "not yet run" prompts from
  previous session were actually run and completed. Wiki audit confirms Phases 43–50 all ✅ Done.
  Tasks 11, 15, 20, 21, Task 3 (all phases) marked ✅ Done. Phase 44 in the wiki is sidebar resize
  (not hover row gap — those sessions ran in a different order than the tracker expected). Hover row
  gap confirmed still present by user; queued as Phase 51 with new prompt. Task 13 description and
  prompt fully updated with new requirements: Rename | Delete | Share | Pin menu items + collapsible
  Pinned and Recents sections with chevron arrows + localStorage persistence for collapse state.
  Sequencing summary rewritten to reflect current reality. Tasks 20 and 21 given proper sections.

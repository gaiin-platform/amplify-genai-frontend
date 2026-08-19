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

### Why this jumps the queue
This was discovered during Task 1, not on the original 9-item list. It's a **real functional bug in
an already-shipped, user-facing feature** (Web Search toggle in `AttachMenu.tsx` — wiki Phase 9,
marked ✅ in `NEW_UI_PORTING_STATUS.md`): the toggle saves state and shows as "on" in the UI, but the
setting never reaches the backend request, so the feature silently does nothing. The RAG toggle has
the identical defect. Because this actively misleads users (UI says a feature is active when it
isn't), it's being prioritized ahead of Task 2's cosmetic work — recommended, not mandatory; see
sequencing note.

### The core problem (per audit findings)
`Chat.tsx` (DO-NOT-CHANGE) holds its own local `plugins` state that actually gets sent with the
request. New-UI toggles (Web Search, RAG) currently only write to `conversation.data` — a
side-channel `Chat.tsx` never reads for this purpose. Needs a bridge pattern (similar in spirit to
the existing Pending-Message Bridge / sessionStorage handoff patterns already documented in wiki
§13) that gets the toggle state into whatever `Chat.tsx` already reads to build its request-time
plugin list — without editing `Chat.tsx` itself.

### Suggested prompt
```
(standard preamble)

This is a bug-fix task, not new feature work. Read
/Users/maxmoundas/Amplify/amplify-genai-frontend/NEW_UI_LOAD_STATE_AUDIT_2026-08-10.md in full first
— it documents the exact root cause of this bug and why it wasn't fixed in the session that found it.

Bug: the Web Search toggle in AttachMenu.tsx (and the RAG/"Add from library" data-source toggle,
same defect) persists its on/off state to conversation.data, but Chat.tsx (a DO-NOT-CHANGE file)
builds its actual outgoing request from its own local `plugins` state, which never reads
conversation.data for this purpose. Result: the UI shows the toggle as active, but the backend
request never actually includes the web-search or RAG plugin. This is a silent functional failure,
not a visual bug — users believe a feature is active when it is doing nothing.

Goal: find the mechanism Chat.tsx already uses to seed its local `plugins` state (check how it
reads from `selectedConversation` / conversation.data on mount or on conversation switch — there may
already be a read path that just isn't populated correctly, rather than a total absence of one).
Determine the correct way to get the new-UI toggle state into that mechanism WITHOUT editing
Chat.tsx — options to investigate: whether plugins are already read from conversation.data under a
different key/shape than what the new-UI toggles write, whether there's an existing event/handler
(e.g. handleUpdateConversation) that Chat.tsx reacts to, or whether the pending-message
sessionStorage bridge pattern (documented in wiki §13) needs to be extended to carry plugin state
for NEW conversations specifically (vs. toggling on an existing conversation, which may be a
different code path).

Fix both the Web Search toggle (AttachMenu.tsx / ConversationComposer.tsx / NewHome.tsx as
applicable) and the RAG toggle using the same mechanism once found. Do not modify Chat.tsx.

If, after investigation, there is truly no way to make this work without touching Chat.tsx, stop and
report back precisely what minimal read-only addition to Chat.tsx would be required (e.g. "read an
additional key from conversation.data on mount") — do NOT make the edit yourself; flag it for a
human decision since it would be the first exception to the DO-NOT-CHANGE list.

Update NEW_UI_DOCS.md (mark the §13 technical note resolved, add to Phase 24 or a new phase) and
NEW_UI_PORTING_STATUS.md (remove the warning flag on the Web Search row; update RAG row).
```

---

### What this covers
Verify the new UI hasn't silently broken any of the load-time logic that lives in `home.tsx` /
`home.context.tsx` (both DO-NOT-CHANGE per wiki Section 2/9):
- Conversations load correctly on boot (sync, folders, ordering)
- Admin check (`featureFlags.adminInterface` gate + actual admin API call) resolves correctly
- Correct models load into `availableModels` / `defaultModelId`
- Feature flags fetch completes and gates the right components
- Any other on-load fetches in `home.tsx` (groups, prompts, settings)

### Why it matters
This is pure regression-testing of Section 2 (Core Architecture) — the new UI reads all of this
state but never should have altered how it's fetched. A silent break here (e.g. a race condition
introduced by new-UI mount timing) would be invisible visually but would corrupt behavior.

### Dependencies / blockers
None — can run anytime, ideally now since a lot has been built on top of this state already.

### Suggested prompt (send as new implementation session)
```
(standard preamble)

This is a verification/QA task, not a feature build. Do NOT write new UI components for this.

Goal: confirm that all pre-existing load-time logic in home.tsx / home.context.tsx still behaves
correctly when the new UI (uiPreference === 'new') is active. Specifically verify:

1. Conversations load on boot — correct list, correct ordering, folders resolve, no duplicate or
   missing conversations vs. classic UI.
2. Admin check — featureFlags.adminInterface is fetched and gates admin entry points correctly;
   the actual AdminUI/NewAdminModal tab data loads without errors for an admin user.
3. Model loading — availableModels / defaultModelId populate correctly; ModelPicker and NewHome's
   model selection reflect the right list, hiddenModelIds filtering still works.
4. Feature flags — full featureFlags fetch resolves before dependent new-UI components render
   (or that they handle the flags-not-yet-loaded state gracefully); spot check 3-4 flag-gated
   features (e.g. scheduledTasks, uploadDocuments, webSearch) actually toggle their UI correctly
   when flipped in the admin panel.
5. Any other on-load state (groups, prompts, settings) that new-UI components consume.

Use the `verify` skill/pattern: actually run the app and exercise these flows, don't just read code.
Report findings as a list: what works, what's broken, what's suspicious but unconfirmed. Do not fix
bugs found unless they are trivial one-line issues — instead report them clearly so they can be
triaged into their own task.
```

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

**Status:** 🚧 In progress — Bug 1 ✅, Bug 2 ✅, Bug 3 pending (queued for next session)
**% complete:** 85%
**Type:** Bug fix — visual defects reported 2026-08-14.

### Issues to fix

**Bug 1 — Thinking/loading circle misaligned when message is first sent**
When the user sends a prompt, the spinning/animating "AI is thinking" indicator (the PromptStatus
element rendered while the response is generating) appears at the wrong horizontal position —
not vertically/horizontally in line with where the "Thought process" disclosure and AI prose
response will ultimately appear (the message column left edge). Root cause hypothesis: the
PromptStatus container (`.rounded-xl.shadow-lg` or `.mt-0.ml-3`) may be affected by the column
constraint rules in `conversation-view.css` but its internal layout (the spinner/dot + step-line
row) may have a left offset that doesn't match the prose left edge. Check how `PromptStatus.tsx`
renders its "thinking" state (the `.mt-0.ml-3` row, which is what the Phase 26 shimmer-dot attaches
to) and verify that row's left position in the new-UI column CSS matches the `.assistantContentBlock`
prose left edge exactly. Fix via `conversation-view.css` scoping rules only — do NOT touch
`PromptStatus.tsx` (protected).

**Bug 2 — Old-UI model selector briefly flashes after user sends a message** ✅ Fixed (Phase 38)
Root cause: `#overflowScroll` (Chat.tsx's empty-conversation panel) rendered when `messages.length === 0`
during the 150–300ms window before the bridge injected the first message. Fix: `[data-new-ui="true"] #overflowScroll { display: none !important }`.

**Bug 3 — "Amplify Assistant is responding" placeholder text + old blinking cursor visible during pre-response window** 🔴 Pending
Two separate elements still showing before the AI response streams in:
1. The text "the 'Amplify Assistant' is responding" — comes from `PromptStatus.tsx` (protected) which renders
   this string in one of its status states. This text looks like a placeholder and should be hidden/replaced
   by the new-UI shimmer animation instead.
2. A blinking cursor or blinking-rectangle animation below it — this is an old-UI animated element (likely
   a separate `div` or `span` in Chat.tsx or ChatMessage.tsx) that renders in the pre-streaming state. Must
   be hidden via a `[data-new-ui="true"]` rule in `conversation-view.css`.
Investigation needed: read `PromptStatus.tsx` (DO NOT CHANGE) to find the exact DOM structure and class
names for both elements, then add targeted hide rules.

### Suggested prompt

<details>
<summary>Original (superseded) framing — kept for history</summary>

### Sub-items
| Item | Status | Notes |
|---|---|---|
| Loading/reasoning animation | ✅ Done (Phase 26/27, small slice) | Calm shimmer added to PromptStatus + ChatLoader; reasoning block itself still needs the full spec §3 rework (prose summary, chevron logic) |
| Remove old logos/things | 🚧 Partial (Phase 26/27) | ChatLoader avatar + ArtifactsBlock logo swatch hidden; spec's other branding/typography items (§6, §9) still open |

</details>

### Why it matters
Chat view is the core surface; this spec is the highest-fidelity design reference we have for it.

### Dependencies / blockers
None — but **strongly recommend running these as 3 separate sessions**, checking in between each,
rather than one combined prompt. The spec's own "Build order" note (top of the doc) already
recommends this sequencing.

### Suggested prompts (run sequentially, verify between each) — historical archive; all batches completed

**Batch 1 — Hover action rows + reasoning block (spec §1, §2, §3 — "the ones you'll feel"):**
```
(standard preamble)

Read /Users/maxmoundas/Downloads/chat-pane-migration-spec.md in full — it is the authoritative source
for this task. Implement ONLY sections 1, 2, and 3 of that spec in this session (hover action rows
for user + assistant messages, and the reasoning block redesign). Do not start on sections 4+ even if
time/context remains — those are separate follow-up sessions by design, to avoid an unscoped,
runaway session.

Existing partial implementation to build on/replace: components/NewUI/chat/NewUIMessageActionsLayer.tsx
(event-delegation pattern, do not touch ChatMessage.tsx/Chat.tsx) and
components/NewUI/chat/ChatContentBlocks equivalents for reasoning
(components/Chat/ChatContentBlocks/AssistantReasoningMessage.tsx is DO-NOT-CHANGE — read only;
style via components/NewUI/ + conversation-view.css CSS-scoping as already established in Phase 12/26).

Key acceptance checks to self-verify before finishing (spec's own "Acceptance checks" §1-8):
- Hovering a user message reveals a right-aligned row: timestamp · retry · edit · copy, right edge on
  the bubble's right edge.
- Hovering an assistant message reveals a left-aligned bare-icon row (no bordered box) ending in the
  timestamp.
- Last assistant turn's row is always visible; other turns are hover/focus-only.
- Tabbing (:focus-within) reveals the row with NO layout shift (reserve height via `visibility`, not
  `display`).
- No assistant turn shows the literal word "Reasoning" anywhere.
- A turn with no reasoning and no tool use shows no summary line at all.
- A turn whose reasoning has no expandable body shows summary text with no chevron, not focusable.

Note: reasoning.summary as a per-turn field must come from the orchestration/backend layer per the
spec (§3.1) — if that field genuinely does not exist yet on the message/turn payload, STOP and report
this precisely rather than fabricating a client-side summary; this may need a backend companion task.
Check message.data.state (and any reasoning-related fields already present) thoroughly before
concluding it's missing.

Update NEW_UI_DOCS.md (new phase, be specific about what shipped vs what's stubbed/blocked) and
NEW_UI_PORTING_STATUS.md. Do NOT write a large end-of-session investigation report in place of
progress — checkpoint the wiki incrementally if the session runs long.
```

**Batch 2 — Markdown + collapse in user messages (spec §4, §5):**
```
(standard preamble)

Read /Users/maxmoundas/Downloads/chat-pane-migration-spec.md in full. Implement ONLY sections 4 and 5
of that spec in this session (markdown rendering in user messages with fenced code as an inset panel;
collapsing long user messages past ~380px with a "Show more" control). Do not start on other sections.

User message content currently renders as raw whitespace-pre-wrap text — see
components/Chat/ChatMessage.tsx line ~708 (id="userMessage", DO NOT CHANGE — read only). Render
markdown via new-UI-side wrapping/CSS per the One-Directory Rule; scope deliberately per spec §4 —
paragraphs, line breaks, fenced code, inline code, lists, bold, italic ONLY (no headings/tables/images
in a user bubble). Bubble text must stay sans face regardless of any serif "Chat font" setting from a
later batch.

For collapse (§5): measure via scrollHeight on rendered content, not character count. Match the exact
target values: 380px threshold, mask-image fade, left-aligned plain-text "Show more"/"Show less"
toggle (not a styled button), 240ms ease-out expand animation, per-message non-persisted state.

Acceptance checks to self-verify (spec's Acceptance checks §8-9):
- A user message with a fenced code block renders an inset panel; no literal backticks visible.
- A 60-line pasted user message collapses to ~380px with a fade and a left-aligned "Show more".

Update NEW_UI_DOCS.md and NEW_UI_PORTING_STATUS.md.
```

**Batch 3 — Everything else (spec §6-12, the "one-line changes"):**
```
(standard preamble)

Read /Users/maxmoundas/Downloads/chat-pane-migration-spec.md in full. Implement sections 6 through 12
in this session — assistant body typography (serif "Chat font" setting), send button/voice-mode
cross-fade slot, composer text alignment (pixel-exact per the CSS variables given in spec §8), share
button restyle, user bubble max-width (72%→85%), pending-asterisk position + two-state animation, and
the dark token palette swap (spec §12, using merged-shell-spec.md §3 if that file is available in the
same Downloads location — check for it; if absent, use the token values already given inline in spec
§12 and existing globals.css tokens as the base to extend, do not invent new ones ad hoc).

These are individually small (S/XS sized per the spec's own summary table) — do them one at a time,
verify each against its acceptance check before moving to the next, rather than batch-editing
everything then debugging at the end.

Acceptance checks to self-verify (spec's Acceptance checks §10-12):
- Composer placeholder and assistant prose paragraph share the same left x-coordinate (verify by
  overlay/screenshot comparison, not by eye).
- Empty composer shows a voice button in the send slot; typing cross-fades to accent-filled send with
  zero layout shift.
- Timestamps render in the specified relative ladder and sub-hour ones update without reload (this
  depends on Batch 1's timestamp work already being in place — sequence after Batch 1).

Update NEW_UI_DOCS.md and NEW_UI_PORTING_STATUS.md.
```

*Explicitly out of scope per the spec itself (do not let any of the 3 sessions touch these):
attachment cards/preview overlay, model picker's two states, attach menu groups/toggles, sidebar,
settings modal, landing page, header title control, disclaimer copy, jump-to-latest button.*

---

## 3. Assistant Creation Interface Overhaul

**Status:** ⬜ Not started (current creation flow is Phase 16/17's basic AssistantModal port)
**% complete:** ~15% (creation exists and works — Porting Status §3 shows assistant CRUD ✅ — but the *access-model* UX described here does not exist yet)
**Type:** Feature build — UX design + implementation.

### What's being asked for
1. When creating an assistant, ask the user to choose an access model:
   - **Shared assistant** — multiple people can access AND edit
   - **Managed-by-me, usable-by-others** — owner manages; others get access via individual emails,
     a group, or a public URL
   - **Private** — only the creator has access
2. When an assistant is attached to a chat, give the user a way to see more info about it on hover
   (e.g. owner, access level, description, tools/data sources it uses).

### Current state to build on
- `NewAssistantsView.tsx` (wiki Section 5, Porting Status §3) already has 4 tabs and creation flows
  via `AssistantModal` / `PromptModal` / `openLayeredBuilderTrigger`.
- Group-assistant admin access already exists (`featureFlags.assistantAdminInterface` + `GroupAccessType`),
  so some backend plumbing for "group access" likely already exists — needs investigation, not
  necessarily a new backend feature.
- `AttachMenu.tsx` "Add assistant ›" submenu (Phase 9) is the existing hover point for assistant chips
  in the composer — that's the natural place to add the hover-info affordance.

### Dependencies / blockers
Needs investigation into whether the backend `AssistantDefinition` / group-access model already
supports "individual emails" and "public URL" sharing, or if this requires backend changes (which
would be out of scope for a frontend-only new-UI session — flag if so).

### Suggested prompt
```
(standard preamble)

Feature: rework the assistant creation flow's access-control UX, and add a hover info-card for
assistant chips.

Step 0 — investigate before building: read AssistantModal (old UI, safe to import/reference but not
modify), assistantService.ts (DO NOT CHANGE, read-only), and types/ related to AssistantDefinition
and GroupAccessType to determine what access-control primitives the backend ALREADY supports
(individual email sharing? group-based access? public URL access?). Report back what exists vs.
what would need backend work before writing any UI code — if backend work is required, stop and
flag it rather than half-implementing a UI for a capability the backend can't fulfill.

Step 1 — creation flow: inside components/NewUI/ (new component, or extend AssistantModal's *wrapper*
if one already exists in NewUI — check registry first), add a step to the assistant creation flow
that asks the user to choose one of three access models:
  (a) Shared — multiple people can access AND edit
  (b) Managed by me, usable by others — list individual emails OR select/create a group OR generate
      a public URL
  (c) Private — only the creator has access
This must not modify AssistantModal.tsx itself (One-Directory Rule) — wrap or extend via a new-UI
component that sits in front of / around the existing modal, following the same pattern used for
other old-modal wrapping in the wiki.

Step 2 — hover info card: wherever an assistant is shown as an attached chip in the composer
(AttachMenu.tsx's active-chip rendering, ConversationHeader's assistant chip), add a hover
tooltip/popover showing: assistant name, owner, access level (from step 1), short description,
and any tools/data sources attached. Use Floating UI (already a dependency per ModelPicker/AttachMenu)
for positioning.

Update NEW_UI_DOCS.md (new phase + registry entries) and NEW_UI_PORTING_STATUS.md Section 3.
```

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
8 Critical issues fixed, 6 Major issues fixed, 4 Major findings deferred (documented in
NEW_UI_DOCS.md §13b). Specifically:

**Critical fixes applied:**
1. `--text-muted` contrast — light `#888888` → `#6E6E6E` (5.02:1 ✅), dark `#8A8780` → `#9E9C96`
   (5.04:1+ ✅). Applied in `globals.css`.
2. NewSettingsModal — no focus trap — Added `panelRef`, Tab/Shift-Tab cycling, focus on open,
   `aria-labelledby="settings-modal-heading"`.
3. NewAdminModal — no focus trap — Same pattern.
4. AttachmentPreview — Tab not cycling inside modal — Fixed.
5. ConversationComposer textarea — no label — Added `aria-label="Message input"` +
   `aria-multiline="true"`.
6. AccountMenu — popover opened without moving focus — First `[role="menuitem"]` now focused on open.
7. PromptStatus — no aria-live for streaming — `ConversationViewShell.tsx` injects
   `aria-live="polite"` via MutationObserver DOM effect on `.rounded-xl.shadow-lg` (no protected
   file touched).
8. IconButton — no aria-label prop — Added `aria-label` prop with `title` fallback.

**Major fixes applied:**
- `prefers-reduced-motion` comprehensive block added to `conversation-view.css` covering
  AttachmentRail, menus, action rows, composer cross-fade, message collapse, hover transitions,
  spinner rotation.
- ModelPicker primary panel `aria-label="Select model"` added.
- SegmentedControl `aria-label` prop added.
- AttachMenu badge dot `aria-hidden="true"` added.
- Skills submenu loading state `aria-live="polite"` + `aria-busy` added.

**Deferred findings (documented in NEW_UI_DOCS.md §13b):**
- "Reasoning" → "Thought process" CSS substitution still announced incorrectly by screen readers
  (needs touching protected component to fix properly).
- AttachmentRail roving tabindex not fully implemented (current behavior is accessible).
- Old-UI wrapped components inside settings (SkillsLibrary, IntegrationTabs, etc.).
- NewScheduledTasksView/NewLibraryView/NewAssistantsView full keyboard audit deferred to Pass 2.

Docs updated: `NEW_UI_DOCS.md` (new §13b "Accessibility Findings — Pass 1" subsection;
`NEW_UI_WIKI_INSTRUCTIONS.md` Section 9 updated with aria-label standing rule for IconButton).

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

Currently `NewSidebar` has a fixed 310px width. Users should be able to drag the right edge to
resize it within a sensible min/max range.

### Suggested prompt
```
(standard preamble)

Feature: user-resizable sidebar width via drag handle on the right edge of `NewSidebar.tsx`.

Requirements:
- Drag handle: 4–6px wide, positioned on the right edge of the sidebar (inside NewSidebar.tsx,
  per the One-Directory Rule). On hover: cursor `col-resize`, subtle highlight.
- Resize range: min 220px, max 480px. Default 310px (current fixed width).
- Persistence: save to `localStorage` key `amplify_sidebar_width` so it survives reload.
- On mount: read from localStorage, fall back to 310px.
- Collapsed state (the existing icon-rail mode) is not affected by drag-resize — it has its own
  fixed 52px collapsed width. The drag handle is only active when the sidebar is expanded.
- Smooth: no jank. Use `document` mousemove/mouseup listeners during the drag (not React state
  per-pixel — just update a CSS variable or inline style directly on the sidebar element until
  mouseup, then commit to React state + localStorage). This avoids React re-rendering on every
  pixel of mouse movement.
- The main content area must flex to fill the remaining space as the sidebar resizes.

Implement entirely within `components/NewUI/sidebar/NewSidebar.tsx` (and its CSS in
`conversation-view.css` or a new `sidebar-resize.css` if the rule count warrants it). Do NOT
modify `home.tsx` layout structure unless strictly necessary.

Update NEW_UI_DOCS.md (registry entry for the drag-handle behavior) and NEW_UI_PORTING_STATUS.md.
```

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
1. **No attachment preview in chat history** ✅ Fixed — thumbnails now shown via restyled DataSourcesBlock
2. **Images not passing through** ✅ Fixed — S3 path correctly wired via direct useSendService call

### What exists
- `AttachmentRail` + `AttachmentCard` handle pre-send display (wiki Phase 18) ✅
- `AttachmentPreview` handles pre-send preview overlay ✅
- The issue is the *post-send* display: once a message is in the chat history, there's no
  rendering of attached images in the message bubble.
- The wiki notes `Image/SVG/HTML artifact rendering 🚧` and `Attachment rail (pre-send cards) ✅`
  but these are separate concerns.
- The pending-message bridge (`ConversationViewShell.tsx`) hands off docs via sessionStorage to
  `Chat.tsx`'s hidden input. The question is whether image binary data is correctly preserved
  through that bridge.

### Suggested prompt
```
(standard preamble)

Critical bug + feature: images attached in the new UI are not shown in chat history after sending,
and may not be reaching the backend at all. Fix both the functional bug (images not passing through)
and the missing display (no thumbnails in sent messages).

This is an investigation-first task. Two sub-problems:

---

Sub-problem A — are images actually reaching the backend?

Read (DO NOT CHANGE) in order:
1. `components/Chat/AttachFile.tsx` — understand exactly what an `AttachedDocument` looks like
   when it has image data. Specifically: after `handleFile`, is the image binary stored in
   `doc.raw`? Or somewhere else? Check the `raw` field wipe issue documented in wiki §13
   "Image Thumbnail Gotcha".
2. `ConversationViewShell.tsx` — the pending-message bridge. Check how `amplify_pending_docs`
   is serialized into sessionStorage (JSON.stringify) and deserialized. JSON cannot encode binary
   data (ArrayBuffer, Uint8Array, base64 strings can survive but raw binary cannot). If `doc.raw`
   for an image is binary, it will be silently lost in the JSON round-trip.
3. `hooks/useChatSendService.ts` — check how `AttachedDocument.raw` is used when building the
   request. Does it expect base64-encoded image data? Raw bytes? A URL?
4. The old UI's path: check how classic `ChatInput.tsx` / `AttachFile.tsx` handles images in the
   EXISTING (non-new-UI) flow — what shape does image data take by the time `handleSend` is
   called? That is the ground truth for what the new UI must replicate.

Report findings before writing any fix. If the bridge is silently dropping image binary data,
propose a fix that correctly preserves it (e.g. base64-encoding before sessionStorage, or finding
an alternative hand-off path that doesn't serialize through JSON).

---

Sub-problem B — show image thumbnails in chat history (post-send).

Once a message containing an image is in the chat history, the user bubble should show a thumbnail.
Read `ChatMessage.tsx` (DO NOT CHANGE) to find where `message.attachedDocuments` or similar is
rendered inside the user bubble. If the old UI already renders something here, it may just need
CSS styling. If nothing is rendered at all, you'll need a portal-based approach like
`NewUIUserMessageMarkdownLayer` — a new component in `components/NewUI/chat/` that scans user
messages for attached image documents and injects thumbnails into the bubble.

Fix / implement in `conversation-view.css` + `components/NewUI/` only. Do NOT modify
`ChatMessage.tsx`.

---

Update NEW_UI_DOCS.md (new phase + registry if a new component is needed) and
NEW_UI_PORTING_STATUS.md §2 (update "Image/SVG/HTML artifact rendering" row).
```

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

**Type:** Visual polish — global token change (original description below).

Currently `--accent: #D97757` (orange) in `globals.css` is used for interactive elements (send
button, active nav highlights, badges, spinner, etc.) but several components use purple or indigo
independently. The app should use a single consistent blue accent everywhere.

### The target blue (from Majk repo, `/Users/maxmoundas/majk`)
Confirmed by reading `/Users/maxmoundas/majk/renderer/config/themes.ts` (the `buttonPrimaryBg`
value, which sets `--nextui-primary` — the color used for sidebar selected-state active items):
- **Dark mode:** `#006FEE` (NextUI primary blue)
- **Light mode:** `#3b82f6` (Tailwind blue-500)

### What needs to change
1. `styles/globals.css` — change `--accent` in both `:root` (light) and `.dark` to the new blues
   above. The `--accent` token is what drives the send button, active-state indicators,
   accent-colored badges, and the spinner.
2. Audit every hardcoded purple/indigo/orange value in `components/NewUI/**` that should be accent
   and replace with `var(--accent)`.
3. The inline code color `#D9776A` / `--code-fg` in `conversation-view.css` is intentionally
   warm (it's a syntax-highlight color, not an interactive accent) — leave it alone.

### Suggested prompt
```
(standard preamble)

Task: make the accent color consistent across the new UI. Replace the current orange `#D97757`
with blue, matching the Majk app's primary interactive color.

Target values (verified by reading `/Users/maxmoundas/majk/renderer/config/themes.ts`):
- Light mode `--accent`: `#3b82f6`  (Tailwind blue-500; used in Majk light theme `buttonPrimaryBg`)
- Dark mode `--accent`:  `#006FEE`  (NextUI primary blue; used in Majk dark-obsidian `buttonPrimaryBg`,
  which ThemeContext sets as `--nextui-primary` for sidebar selected states)

Step 1 — update `styles/globals.css`: change `--accent` in `:root` to `#3b82f6` and in `.dark`
to `#006FEE`. Also update the `--accent`-derived glyph color used on the send button (dark ink on
the blue background — check if `#2A1710` still has sufficient contrast against `#3b82f6` / `#006FEE`;
if not, switch to white `#ffffff` which will definitely pass).

Step 2 — audit `components/NewUI/**` for hardcoded purple/indigo/orange accent colors that should
be `var(--accent)` instead. Common offenders: `bg-indigo-*`, `bg-purple-*`, `text-indigo-*`,
`text-purple-*`, any hardcoded `#` values that are clearly interactive-state highlights rather than
semantic/informational colors. Replace with `bg-[var(--accent)]` / `text-[var(--accent)]` etc.
Do NOT change colors that are intentionally semantic (error=red, success=green, warning=amber).

Step 3 — spot-check in `conversation-view.css`: the `--accent` var is used in the pending asterisk
(`content: url('/icon2.png')` — actually image-based now, no color change needed there) and in the
thinking-shimmer animation. Confirm both still look reasonable with the new blue.

Do NOT change `--code-fg` (`#D9776A`) — that is an intentional warm syntax-highlight color,
not an interactive accent.

Update NEW_UI_DOCS.md §4 (update the design token table with new --accent values) and note the
change in Phase N. Update NEW_UI_PORTING_STATUS.md if any rows are affected.
```

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

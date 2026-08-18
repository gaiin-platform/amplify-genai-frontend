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

## 2b. Chat Pane — Two Targeted Fixes: Thinking Indicator Alignment + Old-UI Model Selector Flash

**Status:** 🚧 In progress — Bug 2 ✅ done; Bug 1 ✅ done (alignment fixed); Bug 3 (duplicate old-UI loading animations) pending
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

**Bug 2 — Old-UI model selector briefly flashes after user sends a message**
When a message is sent, before the AI response starts streaming in, the old-UI model selector
(`ModelSelect` component — likely the `#modelSelectButton` or `.model-select` element that lives
inside Chat.tsx's original toolbar/ChatInput) briefly becomes visible. This is the classic-UI
element that `conversation-view.css` should be hiding. Root cause hypothesis: the hide rule for
Chat's own header/toolbar is applied to `.sticky.top-0.z-10` and `.px-20.absolute.bottom-0` (Phase
11 CSS), but the model selector element may live in a slightly different location or have a
different class that's not captured by those rules — or the element briefly mounts into a DOM
position not covered by the existing `display:none !important` rules during the initial streaming
setup phase. Fix via `conversation-view.css` — inspect the exact class/structure of the flashing
element and add a targeted `display:none !important` rule scoped to `[data-new-ui="true"]`.

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

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Feature build.

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

## 13. Sidebar Conversation Three-Dot Menu: Add Pin

**Status:** ⬜ Not started
**% complete:** ~50% (rename ✅ already exists; pin ❌ not yet)
**Type:** Small feature — UX enhancement.

The `ConversationRow.tsx` hover ⋯ menu currently has Rename and Delete (wiki Phase 2). The user
wants to also add **Pin** (which would move the conversation to a "Pinned" section at the top of
the sidebar, using the `pinned` flag already mentioned in `NEW_UI_PORTING_STATUS.md` §9 Future Ideas
as "Data model supports it with `pinned` flag; UI not wired").

### Suggested prompt
```
(standard preamble)

Feature: add a "Pin" option to the ConversationRow three-dot menu in the sidebar.

Step 0 — investigate: check `types/` for the `Conversation` type to confirm a `pinned` (or
similar) field exists on the data model. Check `home.context.tsx` and `home.tsx` for whether a
`handleUpdateConversation` or similar handler would naturally persist a `pinned` flag, and whether
any remote storage service (check `services/remoteConversationService.ts` read-only) would need
to be called to persist it server-side. Determine if "pin" can be purely local-state (persists via
the existing state-save pipeline) or requires a dedicated service call.

Step 1 — add Pin to the ⋯ menu: in `components/NewUI/sidebar/ConversationRow.tsx`, add a "Pin"
menu item (IconPin, "Pin" label) and "Unpin" (for already-pinned conversations) to the existing
rename/delete menu. On click, call the appropriate context handler to toggle `conversation.pinned`.

Step 2 — surface pinned conversations: in `components/NewUI/sidebar/NewSidebar.tsx`, add a "Pinned"
section above the time-bucketed "Today/Yesterday" recents groups showing pinned conversations (with
an unpin option). The `SidebarSection.tsx` component is already designed for this. If no
conversations are pinned, the section collapses to 0 height.

Update NEW_UI_DOCS.md (registry entry for the new behavior, Phase N) and
NEW_UI_PORTING_STATUS.md §1 (add "Conversation pinning" row → ✅ when done).
```

---

## 14. Attachment Preview in Chat History + Image Passing Bug

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Critical bug + feature build.

Two related problems:
1. **No attachment preview in chat history** — when a message is sent with images, only the text
   appears in the chat history. No thumbnail/preview of the attached image is shown.
2. **Images may not be passing through** — anecdotal evidence suggests images attached in the new
   UI are not actually being sent to the backend. The old UI's attachment mechanism may have been
   bypassed or broken.

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

## 15. Accent Color Consistency — Switch to Blue

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Visual polish — global token change.

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

## Suggested Sequencing Summary

**Immediate (bug fixes, high visibility):**
1. **Task 2b** — remaining: old-UI duplicate loading animations ← queued, run next
2. **Task 2c** — scroll/layout jumping during response generation ← quick CSS/layout fix
3. **Task 12** — user message edit UI (new UI styling) ← purely CSS, fast
4. **Task 15** — accent color to blue ← globals.css token swap + audit, fast
5. **Task 14** — attachment preview + image passing bug ← CRITICAL functional bug, do early

**Short-term features:**
6. **Task 13** — sidebar pin conversation ← small self-contained feature
7. **Task 11** — adjustable sidebar width ← medium complexity, high UX value
8. **Task 3** — assistant creation overhaul (= item 8 in user list) ← investigation-first
9. **Task 8** — sharing overhaul (= item 9 in user list) ← UX design pass first
10. **Task 10** — standalone assistant page ← investigation-first

**Longer horizon (unchanged from original plan):**
11. **Task 16** (Custom Instructions overhaul — multiple named sets, active selection, wired into new conversations)
12. **Task 4c** (Helper assistants) → **Task 7** (Learn page)
13. **Task 6** (Model info page)
14. **Task 9** (a11y pass 2 — after more features land)
15. **Task 4a** (Memory — last, needs design doc first)

**Backend prerequisites (do not start frontend work until backend is ready):**
- Task 4b (Deep Research) — needs backend orchestration built first
- Task 4d (Usage) — needs backend cost/token data API confirmed first

---

## Change Log

- **Created** — initial tracker seeded from your 9-item task list, cross-referenced against
  `NEW_UI_DOCS.md` (through Phase 23) and `NEW_UI_PORTING_STATUS.md`.
- **2026-08-10** — Task 1 marked ✅ Done; spun out Task 1b (Web Search/RAG wiring bug) from its findings.
- **2026-08-11** — Task 1b marked ✅ Done. Task 2 rescoped against chat-pane-migration-spec.md.
- **2026-08-11 → 2026-08-13** — Task 2: Phases 26–37 completed across many sequential implementation
  sessions. All 12 spec items addressed. One known open issue remains (assistant hover row spacing —
  see Task 2 "Known open issue" above). Task 2 marked 🚧 90% complete.
- **2026-08-13** — Orchestrator conversation ended. New orchestrator chat started from handoff prompt
  (see bottom of this file). Recommended next tasks per original sequencing plan: Task 5 (a11y pass),
  then Task 3 (assistant creation overhaul), then Tasks 4c/7/4d/8/6 in order.
- **2026-08-14** — Task 5 (a11y pass 1) marked ✅ Done. 8 Critical + 6 Major issues fixed; 4 Major
  findings deferred. New Task 2b added for two visual bugs reported post-a11y-session: (1) thinking
  indicator misaligned horizontally on message send, (2) old-UI model selector briefly flashing
  before first streaming response.
- **2026-08-14** — Task 2b session 1: Bug 2 (model selector flash) ✅ fixed via
  `#overflowScroll { display: none !important }`. Bug 1 (ChatLoader alignment) improved but still
  slightly too far right — ChatLoader's column constraint was added but `margin-left: auto` may be
  overriding the left-edge alignment. Residual fix prompt queued.
- **2026-08-14** — Task 2b session 2: Bug 1 (ChatLoader alignment) ✅ fixed — avatar wrapper div
  (`.min-w-[40px]` + 8px gap = 48px) was still alive as a flex item even though the Amplify avatar
  inside was `display:none`. New rule hides the avatar wrapper div via triple child-combinator selector
  specific to ChatLoader's DOM shape. Bug 3 discovered: old-UI loading animations (two of them) are
  still visible alongside the new-UI ones during the pre-response window. Queued.
- **2026-08-18** — Documentation updates from user review: responsive breakpoints marked ✅ done;
  Notebook new-UI styling marked out of scope; Import/Export/Clear conversations moved to §8
  Intentionally Removed; Usage (Task 4d) and Deep Research (Task 4b) both deferred as backend
  prerequisites — no frontend work until backend is confirmed ready; Task 16 added (Custom
  Instructions overhaul — multiple named sets, active selection, wired into handleNewConversation);
  Custom Instructions row in porting status updated to 🚧 with full description of what's needed.
- **2026-08-18** — New tasks added from user review session: Task 10 (standalone assistant page),
  Task 11 (adjustable sidebar width), Task 12 (user message edit UI new-UI styling), Task 13
  (sidebar pin conversation), Task 14 (attachment preview in chat + image passing bug — CRITICAL),
  Task 15 (accent color → blue, matching Majk #3b82f6 light / #006FEE dark). Sequencing summary
  rewritten to reflect new priorities. Items 8 (assistant creation) and 9 (sharing) in user's list
  map to existing Tasks 3 and 8 respectively. Item 5 (hover row spacing) is the existing Task 2
  known open issue.

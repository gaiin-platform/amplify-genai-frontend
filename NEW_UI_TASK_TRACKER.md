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

## 2. Inside Chat View Improvement — SUPERSEDED by chat-pane-migration-spec.md (2026-08-11)

**Status:** 🚧 In progress — rescoped, much larger than originally tracked
**% complete:** ~15% (Phase 26/27 covered a fraction of this — see below)
**Type:** Feature build.

### What happened
The original vague "loading animation + remove old logos" framing (below, struck through) is
superseded by a precise migration spec Max found: `/Users/maxmoundas/Downloads/chat-pane-migration-spec.md`.
It documents 12 concrete gaps between the current chat pane and the target design, several of which
are real, verified-missing features — not cosmetic tweaks. Phase 26/27 (thinking-animation shimmer,
old ChatLoader/branding sweep, cutoff fixes) covered small slices of items #3 and #12 only; items
#1, #2, #4, #5, #6, #7, #9, #10, #11 are **fully unaddressed**, confirmed by direct code inspection:
- `NewUIMessageActionsLayer.tsx` exists but lacks timestamps, retry, feedback (good/bad), `···`
  overflow menu, keyboard (`:focus-within`) accessibility, persistent-on-last-turn behavior, and
  correct icon ordering/alignment per spec §1-2.
- Reasoning block still shows the literal word "Reasoning" + old triangle — no per-turn prose
  summary field consumed anywhere (spec §3).
- User messages render as raw `whitespace-pre-wrap` text (`ChatMessage.tsx:708`) — no markdown, so
  fenced code shows literal backticks (spec §4). No confirmed.
- No message-collapse logic for long user messages exists anywhere (spec §5).
- Assistant body is still sans-face, loose line-height; no serif "Chat font" setting exists (spec §6).
- Send button doesn't cross-fade to a voice-mode slot when empty (spec §7); composer alignment,
  share button style, bubble max-width, and pending-asterisk position are all still pre-spec values
  (spec §8-11).

**Given the size (12 items) and the fact that a single loosely-scoped prompt already produced one
runaway/incomplete session, this is being split into 3 sequential implementation prompts following
the spec's own stated build order, rather than one big prompt.** See "Suggested prompts" below.

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

### Suggested prompts (run sequentially, verify between each)

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

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** New feature build (frontend surfacing at minimum; may need backend orchestration).
**Note:** logged only as a 💡 Future Idea in `NEW_UI_PORTING_STATUS.md` Section 9 — this was NOT a
ported-from-old-UI feature; it's a net-new capability. Elevating it out of "future idea" status.

### Suggested prompt (once scoped)
```
(standard preamble)

Before building anything, investigate: does amplify-genai-backend already have any deep-research /
multi-step web-search-and-synthesize orchestration capability (check amplify-agent-loop-lambda docs:
AGENT_FRAMEWORK.md, BUILDING_AGENTS.md) that could back a "Deep Research" mode, or does this need
net-new backend work? Report findings before writing frontend code — this may need a companion
backend session.

If frontend-only scope is confirmed (i.e. backend agent/tool support already exists and just needs
a UI entry point): add a "Deep Research" toggle/mode to AttachMenu.tsx's toolbar group (same pattern
as the existing Web Search toggle in Group 3) that routes the query through the deep-research-capable
backend path instead of the standard chat path. Follow the AttachMenu extension pattern already
documented in wiki Section 5.
```
*(This prompt is intentionally conditional — send the investigation half first as its own short
session before committing to a build.)*

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

**Status:** 🚧 Placeholder exists
**% complete:** ~10%
**Type:** Feature build — porting existing old-UI capability into new UI.

Per wiki Phase 19 TODO and Porting Status §4/§7: `NewSettingsModal.tsx` already has a placeholder
"Usage" nav section; the old UI's `UserCostBreakdownModal` is the component to port from.

### Suggested prompt
```
(standard preamble)

Feature: port cost/token usage display into the new UI Settings → Usage section.

NewSettingsModal.tsx already has a placeholder "Usage" section (see wiki Section 5 / Phase 6 & 19).
The old UI's UserCostBreakdownModal component (and its underlying service calls — check services/
for the relevant read-only cost/usage endpoint, likely in the Ops or billing-related service files)
is the reference implementation. Per the One-Directory Rule, do NOT modify UserCostBreakdownModal
directly — either import it as-is into the Usage section wrapper, or build a fresh new-UI-styled
component in components/NewUI/settings/ that calls the same underlying service functions.

Design should match the clean list/stat-tile visual language already used elsewhere in new UI
(reference NewLibraryView.tsx's list-row + StatusBadge patterns for visual consistency). If this
involves any chart/graph rendering (e.g. cost over time), use the dataviz skill for chart design
guidance before writing chart code.

Update NEW_UI_DOCS.md Section 12 (mark Phase 19's Usage item done) and NEW_UI_PORTING_STATUS.md
Section 4 + Section 7 (Usage section, User cost breakdown rows).
```

---

## 5. Accessibility Standards Compliance (Pass 1)

**Status:** ⬜ Not started
**% complete:** 0%
**Type:** Audit + remediation.

Per your clarification: "Accessibility scan version 2" refers to your boss's shorthand for a
WCAG 2.x-style / axe-core-style automated + manual accessibility check — not a redo of a prior
scan. Treating this as the **first formal accessibility pass** on the new UI. Item 6 below
("Accessibility scan version 2") is the planned *follow-up* pass after remediation lands.

### Suggested prompt
```
(standard preamble)

Task: accessibility audit of the new UI (WCAG 2.1/2.2 AA target), components/NewUI/ only.

Use axe-core (or equivalent automated tooling available in this repo/environment) plus manual
keyboard-navigation and screen-reader spot checks across the main new-UI surfaces: NewSidebar,
NewHome, ConversationViewShell + ConversationHeader + ConversationComposer, NewAssistantsView,
NewLibraryView, NewScheduledTasksView, NewSettingsModal, NewAdminModal, and the shared/ primitives
(AttachMenu, ModelPicker, AttachmentPreview, etc.).

Check specifically:
- Color contrast (light AND dark mode) against the --text-*/--bg-* token pairs in globals.css
- Keyboard navigation and focus order through every interactive flow (composer, menus, modals)
- Focus traps in modals (AttachmentPreview claims one per wiki Section 5 — verify it)
- ARIA roles/labels on icon-only buttons (IconButton.tsx, action pills in
  NewUIMessageActionsLayer.tsx)
- Reduced-motion support (wiki Phase 19 flags this as entirely unimplemented — confirm and fix
  where reasonable)
- Screen reader announcements for streaming/loading states

Do NOT touch any file outside components/NewUI/ (+ globals.css/tailwind.config.js per the
One-Directory Rule) to fix issues found in old-UI-derived wrapped components — flag those
separately as "inherited from old UI, needs upstream fix" rather than patching them via new-UI CSS
hacks unless a clean CSS-scoping fix is available.

Deliverable: a findings report (severity-ranked) plus fixes applied for anything low-risk/
high-confidence. Update NEW_UI_DOCS.md Section 13 with any new accessibility patterns established
(e.g. a standard aria-label convention for IconButton).
```

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

## Suggested Sequencing Summary

1. **Task 1** (logic QA) — do first, cheap, de-risks everything built on top
2. **Task 2** (chat view polish) — high visibility, low complexity
3. **Task 5** (a11y pass 1) — do early so subsequent UI work can bake in fixes rather than retrofit
4. **Task 3** (assistant creation overhaul) — needs backend investigation step first
5. **Task 4c** (Helper assistants) → **Task 7** (Learn page) — sequential, 7 depends on 4c
6. **Task 4d** (Usage) — straightforward port, can slot in anytime
7. **Task 8** (Sharing overhaul) — needs a UX design pass, no existing pattern to copy
8. **Task 6** (Model info page) — independent, can slot in anytime
9. **Task 4b** (Deep Research) — needs backend investigation first
10. **Task 9** (a11y pass 2) — after 5 + a batch of the above land
11. **Task 4a** (Memory) — **last**, full-stack, needs its own design doc first per your direction

---

## Change Log

- **Created** — initial tracker seeded from your 9-item task list, cross-referenced against
  `NEW_UI_DOCS.md` (through Phase 23) and `NEW_UI_PORTING_STATUS.md`.
- **2026-08-10** — Task 1 marked ✅ Done; spun out Task 1b (Web Search/RAG wiring bug) from its
  findings.
- **2026-08-11** — Task 1b marked ✅ Done (Web Search fixed via `webSearchPreference.ts`
  settings-bridge; RAG confirmed not-yet-built, not broken). Next up: **Task 2** (chat view polish).

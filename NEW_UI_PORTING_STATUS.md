# New UI — Porting Status

> This document tracks the migration state of every meaningful feature from the classic Amplify UI
> into the new UI. It is the authoritative record for three questions:
>
> 1. **What still needs to be ported?** (features used in the old UI that are absent in the new one)
> 2. **What was intentionally removed?** (never coming back — deliberate product decision)
> 3. **What new ideas should be considered after the rewrite is complete?**
>
> Update this file whenever a feature is ported, deliberately dropped, or newly imagined.
> Cross-reference `NEW_UI_DOCS.md` for implementation details on anything that IS ported.

---

## Quick Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Ported — fully functional in new UI |
| 🚧 | Partially ported / placeholder present |
| ❌ | Not yet ported |
| 🚫 | Intentionally removed — will not return |
| 💡 | Future idea — not on the current roadmap |

---

## 1. Core Navigation & Layout

| Feature | Status | Notes |
|---------|--------|-------|
| Unified sidebar (chats + nav + account) | ✅ | `NewSidebar.tsx` |
| New chat button | ✅ | Sidebar top row |
| Conversation list with time bucketing | ✅ | Today / Yesterday / Older, archive-aware |
| Sidebar collapse to icon rail | ✅ | Collapses to 52px; full icon-rail at 760–1099px is Phase 17 |
| Search → Chats & Tasks full-pane view | ✅ | Search button in header dispatches `page='chats'` |
| Chats & Tasks full list view | ✅ | `ChatsListView.tsx`. Search now matches message content for local conversations (via `uncompressMessages`), not just conversation name — matches classic `Chatbar.tsx:181-197` search behavior including its "remote messages are unsearchable" limitation. |
| Library view (data sources) | ✅ | `NewLibraryView.tsx` — new-UI reimplementation with list rows, file icons, status badges, search, upload, batch delete |
| Home landing page | ✅ | `NewHome.tsx` |
| UI preference banner (new vs classic) | ✅ | `UIPreferenceBanner.tsx` |
| Off-canvas drawer <760px | ✅ | Resolved |
| Responsive icon rail 760–1099px | ✅ | Resolved |
| User-resizable sidebar width | ✅ | Drag handle on right edge; min 220px, max 480px, default 310px; persisted to `localStorage` key `amplify_sidebar_width`; collapsed 52px rail unaffected. See `NewSidebar.tsx` + NEW_UI_DOCS.md Phase 44. |

---

## 2. Chat Interface

| Feature | Status | Notes |
|---------|--------|-------|
| Chat message rendering | ✅ | Via `ConversationViewShell` wrapping existing `Chat.tsx` |
| User message bubbles (right-aligned) | ✅ | CSS-scoped in `conversation-view.css`. Max-width bumped to 85% (was 72%) per spec §10. |
| Markdown in user messages (§4) | ✅ | `NewUIUserMessageMarkdownLayer.tsx` — portal-based ReactMarkdown render inside each user bubble; hides raw `#userMessage` text via `.new-ui-has-markdown` CSS class. Scope: paragraphs, line breaks, fenced code (inset panel: `--bg-app` bg, `1px --border-subtle`, `12px radius`), inline code (`--bg-active`/`#D9776A`), lists, bold, italic. No headings/tables/images per spec. Bubble always sans face. |
| Long user message collapse (§5) | ✅ | `NewUIUserMessageMarkdownLayer.tsx` — collapses at 380px scrollHeight threshold; bottom fade mask-image (72px); plain-text "Show more"/"Show less" left-aligned; 240ms ease-out expand animation; per-message non-persisted state. |
| Assistant prose (no bubble) | ✅ | §6: Serif Chat font (Newsreader, 17px/1.62) by default. Sans option available via Settings → General → Chat font. Code/tables always sans regardless of Chat font setting. |
| Code block styling | ✅ | |
| Table styling | ✅ | |
| Reasoning / thinking disclosure block | 🚧 | `AssistantReasoningMessage` styled via CSS (chevron replaces triangle, literal "Reasoning" text hidden/replaced — Phase 28, chat-pane-migration-spec.md §3). **Blocked on backend**: no `reasoning.summary` field exists in the data model (confirmed by direct investigation), so the disclosure currently shows a neutral placeholder ("Thought process") instead of the spec's real per-turn prose summary ("Calculated recovery window..."). Also can't fully implement "omit line for no-reasoning-and-no-tool-use" since no structured tool-use flag exists either. See NEW_UI_DOCS.md §12 Phase 28 for the full blocker writeup and backend recommendation. This block still only mounts once streaming is complete (`ChatMessage.tsx` gates it on `!messageIsStreaming`) — it's never shown "live" while thinking. Phase 26 added a 0.35s settle-in transition (`prefers-reduced-motion`-gated) so its post-stream arrival doesn't pop in abruptly. |
| PromptStatus in-stream step lines | ✅ | Phase 26: added a calm streaming-in-progress animation — breathing accent dot + gradient text shimmer sweep, both `prefers-reduced-motion`-gated (no animation at all when the user prefers reduced motion). This is the actual "live thinking" indicator, since it's the only element present in the DOM while `status.inProgress` is true. |
| Accent / interactive color consistency | ✅ | **Phase 50 (2026-08-19):** `--accent` changed from orange `#D97757` to Majk blue (`#3b82f6` light / `#006FEE` dark). New `--accent-fg: #ffffff` token added for text/icons on accent backgrounds. Send button glyph updated `#2A1710` → `var(--accent-fg)` in `NewHome.tsx` and `ConversationComposer.tsx`. Scrollbar thumbs in `conversation-view.css` changed to `#93c5fd`/`#60a5fa` (blue-300/400). Global scrollbar in `globals.css` was already blue (`--color-primary-400`). All breathing dots, upload bar, info callout borders automatically inherited the change via `var(--accent)`. Hardcoded orange/purple/indigo/violet audit: **zero hits** across all `components/NewUI/` files. |
| Composer (new chat + in-conversation) | ✅ | `NewHome.tsx` + `ConversationComposer.tsx`. §7: send/voice/stop cross-fade in one slot (no layout shift). §8: 74ch column width for exact text alignment. |
| Model picker | ✅ | `ModelPicker.tsx` — family-aware, effort levels. `supportsImages` capability icon added (camera icon, both primary-menu rows and "More models" submenu) to match classic `ModelSelect.tsx`. **Phase 48:** hovering *any* model row — the recommended Opus/Sonnet/Haiku rows in the primary panel **and** the "More models ›" submenu rows — shows a detail card (name, description, Vision/Reasoning/Large-context capability pills, context window) — 250ms hover-in / 200ms hover-out, built on the shared `InfoFloatCard.tsx`. Model id and provider are deliberately omitted (Phase 48b product decision — they read as debug output). Everything shown comes off the `Model` object; confirmed there is no static per-model metadata table anywhere in `utils/` to enrich from. Also Phase 48: the effort + more-models submenus are now positioned by Floating UI (`menuPositioning.ts`: `right-start` + `flip` → left/bottom/top + `shift`) instead of `position: absolute` with a measured `top`, so they no longer clip on small windows or near the viewport edge. **Phase 48b:** the tall "More models" panel needed `flip({ crossAxis: false })` to pick its side correctly — with flip's default, vertical overflow disqualifies every placement and the tie-break returns a horizontally-clipped one (this is why Effort flipped correctly and More models did not, on identical middleware). Also Phase 48b: the ⓘ tooltips on the effort options are now portalled + Floating-UI-positioned, so their text is no longer truncated by `EffortMenu`'s `overflow: hidden`. |
| Attach menu (⊕) | ✅ | `AttachMenu.tsx` — files, library, skills, connectors, web search. **Phase 48:** every submenu that renders a panel (skills, connectors, assistant) is now positioned by Floating UI (`menuPositioning.ts`) instead of `position: absolute` + a measured `top`, so panels flip left / drop below rather than clipping at a viewport edge. "Add from library" is not a panel (action row → closes menu), so it was left alone. Submenus deliberately keep `strategy: 'absolute'` and stay DOM children of the primary panel — `useDismiss` decides "outside press" by DOM containment, and portalling them out would make the Skills checkbox rows close the whole menu. Web search toggle now bridges into `Chat.tsx`'s request-time `plugins` array via the shared `getSettings`/`saveSettings` utilities (see `components/NewUI/shared/webSearchPreference.ts`) — see NEW_UI_DOCS.md §13 "RAG / Web Search Wiring Gap — Web Search Fixed". Known remaining edge case: the very first message sent in an *already-open* conversation immediately after flipping the toggle on may still miss the plugin (Chat.tsx doesn't re-derive `plugins` until its next mount); every new/reopened/reloaded conversation after that first toggle works correctly. |
| Pending-message bridge (home → chat) | ✅ | sessionStorage injection |
| Conversation header (title + share) | ✅ | `ConversationHeader.tsx`. §9: Share button is label-only (no icon), 30px, `--bg-active`, hover `#45443F`. |
| Stop generating button | ✅ | In `ConversationComposer.tsx` |
| Scroll-to-latest button | ✅ | |
| Hover action row (full spec §1/§2) | ✅ | `NewUIMessageActionsLayer.tsx` — Phase 28 full rewrite; Phase 31/32 bug-fix passes; **Phase 33 positioning rewrite**. User: `timestamp · retry · edit · copy`, right-aligned. Assistant: `copy · read aloud · good · bad · retry · timestamp`, left-aligned, bare icons. **Phase 33: rows are now `position:absolute` children of an overlay `createPortal`'d into `.chatcontainer` (the scroller) — they scroll in perfect lock-step with content, NO scroll listeners / rAF / per-frame state (the old `position:fixed` + getBoundingClientRect + rAF model lagged ≥1 frame on scroll). Position = offsetTop/offsetLeft chain from `#chatHover` to `.chatcontainer` + 6px GAP, computed only in `scan()`. `.chatcontainer` made `position:relative`; `.enhanced-chat-message` gets `padding-bottom:36px` for the in-flow row.** Phase 33 §2: the always-visible last-assistant row was REMOVED per user request — rows now appear on hover/`:focus-within` only, for every message including the last. Phase 33 §3: `pointermove` 60px keep-alive removed; hide grace timer 600ms→200ms (row is now adjacent in DOM). Earlier fixes retained: retry "Try again" only (3 retry-menu variants + `···` overflow not built), good/bad rating persists to `message.data.newUiRating`/`newUiFeedback`, "Thought process" reasoning label left-aligned. **Phase 35 bug-fix pass:** (1) hover row no longer disappears when moving between icon buttons — the container-level `onMouseOut` delegation ignores events originating inside `.new-ui-actions-overlay`, and row-exit is now driven by the row container's non-bubbling `mouseleave` (clears immediately, no timer); (2) icon-cluster horizontal gaps already tightened in Phase 34; (3) "Thought process" label alignment made exact (`#expandComponent` margin-left/gap zeroed + `.font-medium` margin-left zeroed → lands at prose left edge, replacing Phase 32's overshooting `-18px`); (4) assistant message `padding-bottom` 20px→8px; (5) `.chatcontainer` bottom mask fade removed (was reading as a bar covering text near the jump button). |
| Attachment rail (pre-send cards) | ✅ | `AttachmentRail` + `AttachmentCard` — 160×160 cards above textarea, image/file/paste variants; circular spinner overlay during upload |
| Attachment preview overlay | ✅ | `AttachmentPreview` — centered FLIP animation (separate centering wrapper), image/CSV/text panels, unavailable states, ← / → nav. A11y Pass 1: focus trap Tab-cycling completed. |
| Large-paste capture (≥4k chars) | ✅ | `RichComposer.onLargePaste` + `ConversationComposer` `onPaste` — paste becomes attachment card |
| Image paste (clipboard/screenshot) | ✅ | `RichComposer.onImagePaste` + `ConversationComposer` `onPaste` — pasted images appear as thumbnail cards in the rail AND are uploaded to S3 (Phase 40 fix: `addImageToRail` now calls `handleFile`, not just creates a visual UIAttachment). Phase 42: **two-phase send** — user can click Send while uploads are in progress; API call fires automatically when all uploads complete (see below). |
| Upload-while-sending deferred send | ✅ | **Phase 42**: `ConversationComposer` removed the `allImagesUploaded` gate from `canSend`. New mechanism: `PendingUploadSend` ref stores the ChatRequest context at send time; `handleDocSetKey` accumulates newly-uploaded docs; a `useEffect` fires PATH A when `done ≥ total`. Ambient `UploadPendingIndicator` (thin progress bar + label + Cancel) shown in composer card. 90-second stall detection marks stuck uploads `status:'failed'`; `AttachmentCard` shows Retry button (`onRetry` prop). Cancel restores message text. Asterisk pulses softly via `[data-upload-pending]` CSS attribute. |
| Image thumbnails on attachment cards | ✅ | `addFileToRail()` generates `URL.createObjectURL` before `handleFile` runs (doc.raw is "" after handleFile) |
| Images/docs actually reaching backend (NewHome flow) | ✅ | Phase 40 fix: `ConversationViewShell` pending-message bridge now reads `amplify_pending_docs` and calls `useSendService().handleSend()` directly with the docs when they have S3 keys — previously the key was stored but never consumed. |
| Image thumbnails in sent messages (post-send) | ✅ | `DataSourcesBlock.tsx` already renders thumbnails from `message.data.dataSources` (presigned S3 URLs). Phase 40: restyled via `conversation-view.css` to 88×88 compact cards matching new-UI design tokens. |
| Artifacts panel | 🚧 | Old `Artifacts` component still opens via event; no new-UI wrapper |
| Conversation rename (inline in header) | ✅ | Via `ConversationHeader.tsx` title dropdown |
| Conversation delete | ✅ | Via `ConversationHeader.tsx` title dropdown + sidebar row |
| Conversation fork | ❌ | Present in old UI ChatMessage; not yet surfaced in new UI |
| Message selection modal | 🚧 | `MesssageSelectModal` exists in old Chat; not surfaced in new UI |
| Image/SVG/HTML artifact rendering | 🚧 | Renders inside chat via old components; no new-UI-specific treatment |
| Code interpreter block | 🚧 | Renders via old components; no new-UI styling pass yet |
| Agent log block | 🚧 | Renders via old components; no new-UI styling pass yet |
| RAG document context manager | ❌ | Old `ConversationContextManager` not surfaced in new UI |
| Conversation sharing (share button) | 🚧 | Share button in header exists; underlying `ShareAnythingModal` is old UI |
| Context window / focused messages | ✅ | Feature flag wired in General settings |
| Prompt highlighter | 🚧 | Feature flag wired; component not new-UI styled |
| Memory presenter | ❌ | Not yet surfaced in new UI |
| RAG toggle (`featureFlags.ragEnabled` / `ragOn` / `PluginID.RAG`) | ❌ | **Confirmed (2026-08-11): there is no RAG toggle UI anywhere in `components/NewUI/` — this is a not-yet-built feature, not a broken existing toggle.** `ragEnabled`/`cachedDocuments`/`ragOn`/`PluginID.RAG` are referenced zero times in any New UI component. "Add from library" in `AttachMenu.tsx` is a document-*picker launcher* only (opens the native file input or bridges into old UI's `#viewFiles` button) — it does not toggle RAG on/off and writes nothing to `conversation.data`. Building a RAG toggle is scoped, new feature work: it would need (a) a toggle UI (mirroring the Web Search `ToggleRow` pattern in `AttachMenu.tsx`), (b) a `conversation.data.ragEnabled`-style persisted field, and (c) a bridge into `Chat.tsx`'s local `plugins` state using the same settings-utility mechanism now proven out for Web Search — see `components/NewUI/shared/webSearchPreference.ts` and NEW_UI_DOCS.md §13 "RAG / Web Search Wiring Gap — Web Search Fixed" for the template to replicate. Not attempted in the 2026-08-11 session (out of scope for a bug-fix task — no toggle existed to fix). |

---

## 3. Assistants

| Feature | Status | Notes |
|---------|--------|-------|
| Assistants view (5 tabs) | ✅ | `NewAssistantsView.tsx` — Phase 46 layout overhaul: My Assistants \| Shared with Me \| Teams \| Layered \| Templates |
| My Assistants list | ✅ | Flat list (canEdit=true only) with Private/Shared/URL access-type badge per row |
| Shared with Me list | ✅ | New top-level tab: canEdit=false individual assistants (was buried as sub-tab) |
| Create new assistant — Step 0 wizard | ✅ | `NewAssistantTypeSelector.tsx` — intercepts "New Assistant" in both My Assistants + Teams tabs. Three cards: Private / Managed (URL slug + access options) / Team (use existing OR create new team with member emails). ALL cards now lead to AssistantModal — Card 3 calls onConfirm(null, null, groupId) instead of dispatching admin interface. |
| Create new assistant | ✅ | `AssistantModal` opened after type selector confirms; restyled with new-UI CSS tokens via `[data-new-ui-assistants]` scope |
| Edit assistant | ✅ | Edit icon on hover → `AssistantModal` |
| Group Assistants list (Teams tab) | ✅ | Grouped by group name, renamed "Teams" in tab bar |
| Group admin access (settings gear) | ✅ | Settings gear on existing row still opens `openAstAdminInterfaceTrigger` for editing; gated by `featureFlags.assistantAdminInterface` + access check |
| Create group assistant (Teams "New Assistant" button) | ✅ | Phase 47: button opens `NewAssistantTypeSelector`. Confirmed team → AssistantModal with `groupId` set. On save: both `prompts` + `groups` state updated so assistant appears in Teams tab immediately. |
| Prompt Templates list | ✅ | Three sections: Quick Actions / System Instructions / Your Templates |
| Create new prompt template | ✅ | `PromptModal` from new view |
| Layered Assistants list | ✅ | Cards with edit/delete |
| Create new layered assistant | ✅ | Dispatches `openLayeredBuilderTrigger` with blank LA |
| Layered assistant builder | 🚧 | Builder is old UI (`LayeredAssistantBuilder`); opens via event |
| Assistant admin interface | 🚧 | `AdminUI` / `openAstAdminInterfaceTrigger`; old UI panel |
| Assistant email events config | ❌ | Not surfaced yet in new UI |
| Assistant picker in composer (⊕ → "Add assistant ›") | ✅ | `AttachMenu.tsx` → `AssistantSubmenu` — searchable list of regular + layered assistants, plus a "Standard conversation" row to clear the selection; selecting one dispatches `selectedAssistant` and stashes any enforced `data.model` for the next conversation. Respects the `data.hidden` / `overrideInvisiblePrompts` filter (see row below). **Phase 48:** hovering an assistant row shows a detail card — name, access pill (**Private** / **Shared** / **Group**, derived as `groupId` → Group, else `astPath` → Shared, else Private), 2-line description, 120-char italic instructions preview, up to 3 tag pills, `Uses: <model name>` (enforced-model id resolved through `availableModels`), and tool count. Layered assistants get the same card with an extra `Layered` pill. Built on the shared `InfoFloatCard.tsx` (250ms hover-in / 200ms hover-out, `right-start` with flip-to-left, `pointer-events: none` so it can't eat a row click). Not shown for the "Standard conversation" row or the empty state. |
| Promptbar folder tree (old sidebar) | 🚫 | Intentionally removed — replaced by flat list in new view |
| Hidden-prompt filter (`data.hidden` / `overrideInvisiblePrompts`) | ✅ | Fixed in load-time state audit (see NEW_UI_DOCS.md §13 "Load-Time State Consumption Audit"). `NewAssistantsView.tsx` (My Assistants, Group Assistants, Prompt Templates tabs) and `AttachMenu.tsx` (assistant selector) now apply the same `!p.data?.hidden` filter (bypassed by `featureFlags.overrideInvisiblePrompts`) that classic `Promptbar.tsx:249-250` always applied. Admin edit actions still pass the *unfiltered* group object so hidden assistants remain manageable. |

---

## 4. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Settings modal (two-column) | ✅ | `NewSettingsModal.tsx`. A11y Pass 1: focus trap added, `aria-labelledby` wired. |
| General — theme toggle | ✅ | |
| General — feature flags | ✅ | |
| General — Chat font (Serif/Sans) | ✅ | Radio toggle in General section. Saves to `amplify_chat_font` localStorage key. Default: Serif (Newsreader 17px/1.62). Sans: Inter 16px/1.7. Wired into `ConversationViewShell` via `data-body-face` attribute + `amplifyChatFontChanged` event. |
| Custom Instructions | 🚧 | Single set saved to `amplify_custom_instructions` localStorage key. **Needs enhancement (Task 16):** users should be able to save, name, and switch between multiple instruction sets; the active set must be wired into `handleNewConversation` so it is actually applied to new conversations. Currently the saved value is NOT injected into new conversations (Phase 19 TODO). |
| Account info | ✅ | `NewAccountSection.tsx` (Phase 45) — full new-UI redesign: self-loading accounts via `getAccounts()`, MTD cost summary card, rate-limit warning, add/edit/delete/default-select, save button, `settingsSave` event wired. Fixes the previous shell which passed empty state without loading. |
| Usage section | ❌ | Placeholder — `UserCostBreakdownModal` not yet ported |
| Storage selection | ✅ | `NewStorageSection.tsx` (Phase 45) — full new-UI redesign: four styled radio-card options with accent left border on selection, pending change callout, migration progress bar, save with confirm dialog, all events wired. |
| API Keys | ✅ | Wraps existing `ApiKeys` |
| Skills | ✅ | Wraps existing `SkillsLibrary` |
| Connectors / Integrations | ✅ | `NewConnectorsSection.tsx` (Phase 45) — full new-UI redesign: `SegmentedControl` tabs (Integrations / Tool API Keys), integration cards with OAuth connect/disconnect, skeleton/empty states, per-integration spinners, token-sharing shortcut. Tool API Keys tab wraps `<ToolApiKeysTab>` with CSS overrides in `conversation-view.css`. |
| MCP Servers | ✅ | Wraps existing `MCPServersTab` |
| Admin Panel | ✅ | `NewAdminModal.tsx` — same two-column shell as settings, all tabs as left-rail nav items; light-mode text inheritance fixed (Phase 22). A11y Pass 1: focus trap added, `aria-labelledby` wired. |
| Capabilities section | ❌ | Placeholder |
| Code section | ❌ | Placeholder |

---

## 5. Scheduled Tasks

| Feature | Status | Notes |
|---------|--------|-------|
| Scheduled Tasks full-pane view | ✅ | `NewScheduledTasksView.tsx` — new-UI reimplementation (list pane + editor/logs detail pane), same clean list-row design as `NewAssistantsView`/`NewLibraryView`. Opened via sidebar "Scheduled" nav item (`page='scheduledTasks'`) or `openScheduledTasksTrigger` event (payload bridged via `sessionStorage` key `amplify_pending_scheduled_task`). Gated by `featureFlags.scheduledTasks`. Old portal-rendered `ScheduledTasks` modal removed from `NewSidebar.tsx`. |
| Task create/edit/delete/run-now/logs | ✅ | Ported 1:1 — same `services/scheduledTasksService.ts` calls, same `types/scheduledTasks.ts` shape |
| Object-selector sub-flow (Assistant/Action/Workflow + inline Action Set builder) | 🚧 | Functionality fully ported; reuses old, unmodified sub-widgets (`CronScheduleBuilder`, `ActionSetList`, `CompositeActionsPanel`, `ApiItemSelector`, `ApiParameterBindingEditor`) wrapped in new-UI containers — these sub-widgets still have old-UI internal styling. TODO: dedicated new-UI visual pass. |
| Scheduler panel (inline) | 🚧 | `SchedulerPanel` is old UI; surfaced via events in other components |

---

## 6. Notebook

| Feature | Status | Notes |
|---------|--------|-------|
| Notebook view | ✅ | `NotebookApp` renders when `page='notebook'`; gated by `featureFlags.notebook` |
| Notebook new-UI styling | 🚫 | **Out of scope for this UI rework** — Notebook is intentionally excluded from the new-UI visual pass. It renders in old styles and that is acceptable. |

---

## 7. Other Old-UI Features

| Feature | Status | Notes |
|---------|--------|-------|
| Import conversations from file | 🚫 | **Intentionally removed** — not included in new UI (see §8) |
| Export data | 🚫 | **Intentionally removed** — not included in new UI (see §8) |
| Clear all conversations | 🚫 | **Intentionally removed** — not included in new UI (see §8) |
| User cost breakdown | ❌ | `UserCostBreakdownModal`; **requires backend work before UI can be built** — deferred as a backend TODO after the UI rework is complete (see §8) |
| Python function modal | ❌ | `PythonFunctionModal`; not surfaced |
| Workflow builder | ✅ | `NewWorkflowsView.tsx` — full-pane view (`page='workflows'`) with left template list, right read-only detail, and `AssistantWorkflowBuilder` opened for create/edit (feature-gated by `featureFlags.createAssistantWorkflows`). Reuses original builder unchanged for CRUD logic. Sidebar nav entry (Workflows, `IconPuzzle`) added. CSS overrides in `conversation-view.css` (.new-ui-workflow-editor-modal) ensure readable text in both modes. TODO: dedicated new-UI styling pass on builder internals in a future phase. |
| Market / template marketplace | ❌ | `Market` components; not reviewed |
| Memory dialog | ❌ | `MemoryDialog`; not surfaced |
| Share anything modal | 🚧 | Triggered by share button in `ConversationHeader`; modal is old UI |
| Data disclosure viewer | ❌ | `DataDisclosureViewer`; not reviewed |
| Pricing modal | ❌ | `Pricing`; not reviewed |

---

## 8. Intentionally Removed from New UI 🚫

These features existed in the old UI and have been **deliberately dropped**. They will not be re-added.

| Feature | Reason |
|---------|--------|
| **PluginSelector floating overlay** | Cluttered the chat interface. Feature flags moved to Settings → General. Skills, web search, and connectors moved to the ⊕ AttachMenu composer toolbar. |
| **Import conversations from file** | Not included in new UI — clean-slate approach; import/export adds complexity without commensurate value in the new design. |
| **Export data** | Not included in new UI — same rationale as import. |
| **Clear all conversations** | Not included in new UI — too destructive a single action to feature prominently; individual delete in sidebar covers the use case. |
| **Old TabSidebar** (3-tab left+right sidebar) | Replaced by unified `NewSidebar`. The dual-sidebar concept with collapsible left/right panels was confusing UX. |
| **Sub-tabs and nested navigation inside the old sidebar** | The old sidebar had complex nested state (e.g. "Chats" tab → folder tree → settings sub-sections). Flattened into a single nav list. |
| **"Chat/Cowork" segmented toggle on home screen** | Was removed — the Cowork concept is not part of the new UI direction. |
| **Quick-action suggestion chips on home screen** | Removed — the blank composer is the right starting point; chips felt promotional/cluttered. |
| **"@Amplify:" prefix label on assistant messages** | Visual decoration with no informational value. Hidden via CSS. |
| **Message animated status card** (wave animation, cover image) | Replaced with a clean muted in-stream step line per spec §4.4. Phase 26 added a *new*, deliberately different calm animation to that step line (breathing dot + text shimmer, no bg-image/ripple) — this is not a reintroduction of the removed wave effect, see Phase 26 notes in `NEW_UI_DOCS.md` §12. |
| **Artifact button logo swatch** (`#artifactsButtonBlock` background-image cover, Amplify/white-label logo) | Hidden via CSS (Phase 26) — same treatment as the old "@Amplify:" prefix label; the artifact button itself was restyled to use design tokens (`--bg-raised`, `--border-subtle`) instead of `bg-yellow-400`/`shadow-lg`. |

---

## 9. Future Ideas 💡

> These are **not on the current roadmap** and will not be tackled during the current rewrite.
> Capture here for future developer discussion.

| Idea | Description |
|------|-------------|
| **Native deep research** | A built-in deep research mode that fans out searches, fetches sources, synthesizes a cited report — comparable to Perplexity or ChatGPT deep research. **Requires backend work first** — deferred as a backend TODO after the UI rework is complete. Frontend UI entry point (e.g. a toggle in AttachMenu) can be built once backend capability is confirmed. |
| **Conversation threading** | Allow branching from any message within a conversation (fork to branch, visualized as a tree). |
| **Inline document editor** | Ability to open and edit attached documents in-app, not just reference them. |
| **Assistant marketplace / discovery** | A curated gallery of shareable, community-created assistants that users can install with one click. |
| **Conversation pinning in sidebar** | Pin frequently used conversations to a persistent "Pinned" section at the top of the sidebar. (Data model supports it with `pinned` flag; UI not wired.) |
| **Keyboard command palette** | A ⌘K command palette for quick navigation, new chat, switch assistant, search — the search button currently links to ChatsListView but a true command palette would be more powerful. |
| **Real-time collaborative chat** | Multiple users in the same conversation thread simultaneously. |
| **Rich media preview in chat** | Inline image preview, PDF viewer, spreadsheet preview without opening a separate artifact panel. |
| **Voice input mode** | Mic button already exists in the composer; a proper voice-first mode with waveform visualization, auto-transcription, and send-on-silence. |
| **Chat export to markdown/PDF** | Export a conversation (or selected messages) as a clean markdown file or formatted PDF. |
| **Notification center** | In-app notification area for scheduled task completions, shared conversation activity, assistant responses to email events. |
| **Custom themes** | User-configurable accent color and sidebar color beyond the current dark/light toggle. Note: the base accent color is now locked as Majk blue (`--accent: #3b82f6` light / `#006FEE` dark) per Phase 50 standing rule. Any custom-themes work would override this token, not `--color-secondary-*`. |

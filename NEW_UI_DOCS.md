# Amplify GenAI Frontend — New UI Documentation

> **Living document** — update this every time you learn something new, add a component, change architecture, or make a design decision. Do NOT start from scratch on new sessions — read this first.

---

## 1. Project Overview

**Repo:** `/Users/maxmoundas/Amplify/amplify-genai-frontend`
**Branch:** `new-ui`
**Stack:** Next.js 14, React 18, TypeScript 4.9, Tailwind CSS 3, `@tabler/icons-react` v2

The app is an enterprise AI chat platform ("Amplify") built on top of AWS/Cognito. We are doing a complete visual redesign to match the clean, minimal, professional style of Claude.ai and ChatGPT — while keeping all backend integration code untouched.

---

## 2. Core Architecture (DO NOT CHANGE)

### 2.1 Entry Point
```
pages/index.tsx             → re-exports from pages/api/home/home.tsx
pages/api/home/home.tsx     → ROOT component (1700+ lines). All state, all on-load fetching, top-level layout
pages/api/home/home.state.tsx → HomeInitialState interface + initialState defaults
pages/api/home/home.context.tsx → HomeContext (React context definition)
```

### 2.2 Global State — HomeContext
All app state lives in a single `useHomeReducer` in `home.tsx`. **Key state fields:**

| Field | Type | Description |
|---|---|---|
| `conversations` | `Conversation[]` | All conversations |
| `selectedConversation` | `Conversation` | Currently open chat |
| `featureFlags` | `Features` | Flat boolean map — gates every feature |
| `lightMode` | `'light'\|'dark'` | Theme; default `'dark'` |
| `page` | `'chat'\|'home'\|'assistantGallery'\|'notebook'` | Active view (in-app routing, NOT URL) |
| `showChatbar` | `boolean` | Left sidebar visibility |
| `showPromptbar` | `boolean` | Right sidebar visibility |
| `folders` | `FolderInterface[]` | Conversation/prompt folders |
| `prompts` | `Prompt[]` | Saved prompts/assistants |
| `availableModels` | `Map` | Model list from API |
| `defaultModelId` | `string` | Default model |
| `selectedAssistant` | `Assistant` | Currently active assistant |
| `layeredAssistants` | `Assistant[]` | Group/layered assistants |
| `groups` | `Group[]` | User groups |
| `messageIsStreaming` | `boolean` | Chat streaming in progress |

### 2.3 Context Handlers (from HomeContext — keep these)
- `handleNewConversation`, `handleSelectConversation`, `handleDeleteFolder`
- `handleCreateFolder`, `handleUpdateFolder`, `handleUpdateConversation`
- `handleUpdateSelectedConversation`, `handleForkConversation`
- `handleConversationAction`, `getCompleteConversation`, `handleAddMessages`
- `clearWorkspace`, `getDefaultModel`, `shouldStopConversation`, `killRequest`
- `setLoadingMessage`, `preProcessingCallbacks`, `postProcessingCallbacks`

### 2.4 Authentication (DO NOT CHANGE)
- NextAuth + AWS Cognito (`/pages/api/auth/[...nextauth].js`)
- Session loaded in `home.tsx` via `useSession()` from `next-auth/react`
- `getServerSideProps` passes `ClientId`, `cognitoDomain`, `cognitoClientId`, `chatEndpoint`

### 2.5 Backend Services (DO NOT CHANGE)
All files in `/services/` communicate with the backend. They use `useFetch` hook and `chatEndpoint` from state. **Leave these completely untouched:**
- `chatService.ts`, `prepareChatService.ts`, `assistantService.ts`
- `remoteConversationService.ts`, `stateService.ts`, `settingsService.ts`
- All other services in `/services/`

### 2.6 In-App Routing
Routing is state-based via `page` field — not URL-based (except `/pages/assistants/[assistantSlug].tsx`).
- `page = 'chat'` → main chat interface
- `page = 'home'` → MyHome component
- `page = 'assistantGallery'` → AssistantGallery
- `page = 'notebook'` → NotebookApp (feature-flagged)

### 2.7 Feature Flag System
`featureFlags: Features` (flat `{[key:string]: boolean}`) is fetched from admin API on load. All new UI features should be gated with a feature flag OR by the new-UI-mode toggle.

---

## 3. Current Layout Architecture

### 3.1 Original Layout (what we're replacing)
```
<main h-screen w-screen flex flex-col>
  <div flex h-full w-full>
    <UserMenu />
    <TabSidebar side="left" w-[280px]>       ← 3 tabs: Chats, Assistants, Settings
      <Tab "Chats">    <Chatbar /></Tab>
      <Tab "Assistants"> <Promptbar /></Tab>
      <Tab "Settings">  <SettingsBar /></Tab>
    </TabSidebar>
    <div id="main-content" flex flex-1>
      {page='chat'}     → <Chat />
      {page='home'}     → <MyHome />
      {page='assistantGallery'} → <AssistantGallery />
      {page='notebook'} → <NotebookApp />
    </div>
  </div>
</main>
```

### 3.2 New Layout Target
```
<div flex h-screen>
  <NewSidebar w-[310px] />       ← ONE unified sidebar (chats + assistants + settings + nav)
  <main flex-1 bg-[--bg-app]>
    {page='chat'}     → <Chat />   (with new ChatInput)
    {page='home'}     → <NewHome greeting + composer />
    {page='assistantGallery'} → <AssistantGallery />
    {page='notebook'} → <NotebookApp />
  </main>
</div>
```

---

## 4. Theme System

### 4.1 How It Works
- `tailwind.config.js` maps `blue-*`, `purple-*`, `green-*` Tailwind classes to CSS variables
- `globals.css` defines `:root` (light) and `.dark` (dark) overrides for these vars
- Dark mode = class-based (`darkMode: 'class'` in tailwind) — add/remove `dark` class on `<html>`
- Theme stored in `lightMode` state field; `ThemeService.getInitialTheme()` reads localStorage on boot

### 4.2 New UI Design Tokens (added to globals.css)
```css
/* New UI tokens (Phase 55 palette) */
:root {
  --bg-app:                  #fcfcfb;   /* chat area background */
  --bg-sidebar:              #fbfbf9;   /* sidebar background */
  --bg-raised:               #f2f2f0;   /* elevated surfaces (user bubbles, modals) */
  --bg-hover:                #ebebeb;
  --bg-active:               #e2e2e0;
  --border-subtle:           #e5e5e4;   /* default border + composer resting edge */
  --bg-composer:             #ffffff;   /* chat input card background */
  --border-composer-active:  #d4d4d1;   /* composer edge on hover + focus */
  --text-primary:   #1a1a1a;
  --text-secondary: #555555;
  --text-muted:     #6E6E6E;
  /* Accent — Majk primary blue. */
  --accent:    #3b82f6;
  --accent-fg: #ffffff;
}
.dark {
  --bg-app:                  #151515;   /* chat area background */
  --bg-sidebar:              #111111;   /* sidebar background */
  --bg-raised:               #30302E;   /* elevated surfaces (user bubbles, code blocks) */
  --bg-hover:                #2F2E2C;
  --bg-active:               #3A3A38;
  --border-subtle:           #363635;   /* default border + composer resting edge */
  --bg-composer:             #20201f;   /* chat input card background */
  --border-composer-active:  #4a4a48;   /* composer edge on hover + focus */
  --text-primary:   #FAF9F5;
  --text-secondary: #C2C0B6;
  --text-muted:     #9E9C96;
  --accent:    #006FEE;
  --accent-fg: #ffffff;
}
```

**Phase 55 palette (2026-08-20):** All main surface tokens updated to a darker, more refined palette. Dark mode is now near-black (`#151515` chat, `#111111` sidebar). Light mode is a warm off-white (`#fcfcfb` chat, `#fbfbf9` sidebar). Two new composer-specific tokens added: `--bg-composer` (the chat input card background, slightly elevated vs `--bg-app` in both modes) and `--border-composer-active` (the card edge color on hover **and** focus).

> **Perception floor — why the active edge is not 1 step from resting.** The original spec set `--border-composer-active` to `#373736` dark / `#e4e4e3` light: exactly 1/255 per channel from `--border-subtle`. That is ≈0.4 ΔE, well under the ~2 ΔE human detection threshold, so hover/focus was reported as "not changing" even though the CSS was firing and `border-color` genuinely recomputed. Widened to `#4a4a48` dark / `#d4d4d1` light (~+20 / −17 per channel) to clear the floor. **Resting `--border-subtle` was not touched.**
>
> Rule for future sessions: when a state change is specified as a near-identical color pair, flag the perception floor *before* implementing rather than shipping an invisible transition. A state token needs ≥ ~8/255 per-channel separation from its resting counterpart to read as a change.

**`--accent` design decision (Phase 50):** Changed from orange `#D97757` to Majk blue (`#3b82f6` light / `#006FEE` dark). All interactive accents automatically inherit the change via `var(--accent)`.

**`--accent-fg`:** Foreground color for text/icons ON TOP of `--accent` backgrounds. Always white (`#ffffff`). White on `#3b82f6` ≈ 3.9:1 ✅; white on `#006FEE` ≈ 4.6:1 ✅.

### 4.3 Typography
- **UI font:** Inter (already loaded via Google Fonts in globals.css)
- **Chat font (assistant prose):** Newsreader serif by default (Phase 30, spec §6), switchable to Inter via Settings → General → Chat font.
  - localStorage key: `amplify_chat_font` (`'serif'` | `'sans'`), default `'serif'`
  - Applied via `data-body-face` attribute on the ConversationViewShell element
  - Event bridge: `window.dispatchEvent(new Event('amplifyChatFontChanged'))` to update without reload
  - Spec values: Newsreader 17px/1.62, paragraph gap 16px. Sans (Inter): 16px/1.7.
  - Code, tables, inline code, UI chrome always stay sans (spec §6: "serif numerals break table alignment")
- **Display/heading font:** Newsreader (loaded via Google Fonts in globals.css — used for greeting + chat prose)
- New UI uses Inter at `-0.005em` tracking for UI chrome

---

## 5. New UI Components

### 5.1 Component Location Convention
All new UI components live in:
```
components/NewUI/
  sidebar/
    NewSidebar.tsx           ← MAIN unified sidebar shell (replaces TabSidebar)
                               Phase 56: sidebarVisibility state (from sidebarVisibility.ts) controls which
                               nav items are shown. navItems array gains visible field + .filter(item=>item.visible).
                               Recents + Pinned sections wrapped in {sidebarVisibility.recents && ...}.
                               Collapsed rail items individually gated by sidebarVisibility.*.
                               Listens for 'amplifySidebarVisibilityChanged' event (re-reads localStorage).
                               Phase 57: auto-collapse at SIDEBAR_AUTO_COLLAPSE_THRESHOLD = 768px.
                               On mount + window resize: if innerWidth < 768 AND sidebar is open → auto-collapse
                               (sets isOpen false, dispatches showChatbar:false, does NOT write localStorage).
                               If innerWidth >= 768 AND sidebar is closed AND wasAutoCollapsedRef is true →
                               auto-expand (restores open state, does NOT write localStorage).
                               wasAutoCollapsedRef distinguishes programmatic from user-initiated state changes:
                               handleToggle sets it to false so user collapses are never auto-undone.
    SidebarHeader.tsx        ← wordmark ✳ + collapse + search buttons (48px)
    SidebarNavItem.tsx       ← REUSABLE nav row (icon + label + rest/hover/active/focus states)
    SidebarSection.tsx       ← REUSABLE section heading ("Pinned", "Recents") with optional right slot
                               Props: label, rightSlot?, className?, isCollapsible?, storageKey?, children?
                               Collapsible (Phase 51): isCollapsible adds a chevron toggle on the heading row;
                               storageKey persists collapsed state to localStorage ("true"=collapsed).
                               Children rendered inside a collapsible body (max-height:0/2000px, 200ms ease-out,
                               motion-safe: gated per wiki §9 rule 17). Non-collapsible usages with no children
                               are backward-compatible — they render only the heading row as before.
    ConversationRow.tsx      ← REUSABLE recent chat row with hover ⋯ menu (rename/pin/share/delete)
                               Phase 51: added Pin/Unpin (IconPin/IconPinnedOff, toggles conversation.data.pinned
                               via handleUpdateConversation; checks both data.pinned and legacy top-level cast)
                               and Share (IconShare, clicks #shareChatUpper after onSelect() — identical to
                               ConversationHeader.tsx share mechanism). Divider separates destructive Delete.
                               TODO: add `pinned?: boolean` to Conversation type in types/chat.ts.
    AccountMenu.tsx          ← bottom account row + upward popover (settings, theme, logout, switch UI)
    SettingsModal.tsx        ← overlay wrapper for existing SettingDialog
  home/
    NewHome.tsx              ← greeting ✳ + composer landing (shown when page=chat and 0 messages)
                               Props: none. Uses availableModels, defaultModelId, featureFlags, ragOn from context.
                               Features: working model dropdown (filtered, sorted, default-labelled), AttachmentRail
                               above textarea (3-band grid: rail|textarea|toolbar), file attachment via addFileToRail()
                               (generates thumbUrl object-URL BEFORE calling handleFile — see Image Thumbnail gotcha below),
                               image paste via RichComposer onImagePaste, large-text paste via onLargePaste → attachment card,
                               sends model + pending message/docs via sessionStorage → handleNewConversation.
  chat/
    ConversationViewShell.tsx ← thin wrapper around Chat.tsx with data-new-ui="true" for CSS scoping
                               Also handles pending-message bridge: reads sessionStorage on mount,
                               injects text into #messageChatInputText via native setter, clicks #sendMessage.
    ConversationHeader.tsx    ← spec §3 compliant 52px sticky header (title menu, share button, assistant chip)
    ConversationComposer.tsx  ← spec §7 docked composer (AttachMenu + ModelPicker + send/stop bridge into Chat's hidden textarea)
                               AttachmentRail above textarea (3-band grid: rail|textarea|toolbar)
                               Image paste: textarea onPaste checks clipboardData.items for image/* first → addImageToRail()
                               Large-text paste: textarea onPaste intercepts text ≥ 4,000 chars → attachment card
                               Thumbnail object-URLs tracked in thumbUrlsRef; revoked on remove
    NewUIUserMessageMarkdownLayer.tsx ← Phase 29: markdown rendering + collapse for user messages
                               (chat-pane-migration-spec.md §4/§5, no props).
                               §4 — Renders ReactMarkdown (react-markdown v8) into a portal host
                               (.new-ui-user-md-host) appended inside each user message's #chatHover
                               bubble container. Adds .new-ui-has-markdown to the .user-message element;
                               conversation-view.css uses this class to hide the original #userMessage
                               (raw whitespace-pre-wrap). Scope: paragraphs, line breaks (via inline
                               remarkInlineBreaks plugin — remark-breaks not installed), fenced code,
                               inline code, lists, bold, italic. Headings downgraded to bold paragraphs.
                               Images omitted. No remark-gfm (user bubbles don't need table rendering).
                               Code renderer: inline → <code class="new-ui-user-inline-code">,
                               fenced → <pre class="new-ui-user-code-block"><code>. CSS provides the
                               inset panel style (--bg-app bg, 1px --border-subtle, 12px radius,
                               16px 18px padding, 13.5px/1.6 mono --text-primary, overflow-x auto).
                               Bubble text forced sans via .new-ui-user-markdown { font-family: Inter }.
                               Skips messages with data.hasLargeText (leave renderMessageWithLargeText output).
                               DOM-based scan: same MutationObserver+debounce+message-count-effect
                               pattern as NewUIMessageActionsLayer. Portal insertion is idempotent.
                               During edit (.user-message:has(#editResponse) .new-ui-user-md-host),
                               the markdown host is hidden so UserMessageEditor shows unobstructed.
                               §5 — Collapse: useLayoutEffect measures scrollHeight after first render.
                               If > 380px: inner wrapper gets max-height:380px + bottom fade mask-image
                               (72px fade). "Show more" / "Show less" button: plain text, left-aligned,
                               15px --text-primary, no background, 14px padding-top below faded edge.
                               Expand: max-height animates to measured content px over 240ms ease-out.
                               Transition suppressed on initial load (only activates after first click).
                               Per-message, non-persisted state (re-collapses on reload).
    NewUIMessageActionsLayer.tsx ← Phase 28 rewrite; Phase 33 positioning rewrite. Full hover-action rows per
                               chat-pane-migration-spec.md §1/§2 (no props). One component with a role-driven
                               side (user rows right-align, assistant rows left-align) rather than two separate
                               components, per spec instruction.
                               User row:      [timestamp] [retry] [edit] [copy] — right edge = bubble right edge
                               Assistant row: [copy] [read aloud] [good] [bad] [retry] [timestamp] — left edge =
                                              assistant text left edge, bare icons, no bordered box
                               POSITIONING (Phase 33): rows are `position: absolute` children of an overlay div
                               (`.new-ui-actions-overlay`, inset:0, pointer-events:none) `createPortal`'d directly
                               INTO `.chatcontainer` (the scroller). Rows scroll in lock-step with content for
                               free — NO scroll listeners, NO rAF, NO per-frame position state (the old
                               `position:fixed` + getBoundingClientRect + rAF model lagged by ≥1 frame on scroll).
                               `.chatcontainer` is `position:relative` (conversation-view.css) so it's the
                               offsetParent. Position = offsetTop/offsetLeft chain from `#chatHover` up to
                               `.chatcontainer` + 6px GAP; computed only in `scan()`, never on scroll.
                               DOM-based message discovery: scans `.chatcontainer` for `.enhanced-chat-message
                               .user-message/.assistant-message` elements, matches back to real `Message` objects
                               by replicating Chat.tsx's exact render filter (`role !== 'tool' && !data.actionResult`)
                               — verified 1:1 correspondence by direct investigation of Chat.tsx's render loop.
                               Rescans via MutationObserver (subtree:true, 120ms debounce, ignores mutations inside
                               the overlay) + message-count/streaming effect fallback + debounced window RESIZE
                               (column-width change, NOT scroll) + 200ms DOM-ready retry on first mount.
                               Visibility (Phase 33 §2): opacity/pointer-events driven by (hover OR native
                               :focus-within) ONLY — the always-visible last-assistant behaviour was removed per
                               user request; rows appear on hover for every message including the last. Never
                               `display:none` — no layout shift, real keyboard tab order (row is a normal focusable
                               DOM subtree inside the overlay portal). Hover grace timer 200ms (down from 600ms);
                               the Phase 32 `pointermove` 60px keep-alive was removed (unnecessary now rows are
                               in-flow 6px below the content). `.enhanced-chat-message` gets `padding-bottom:36px`
                               to reserve the in-flow row's vertical space (assistant reduced to 8px in Phase 35).
                               Phase 35 hover-hide fix: because the overlay is a real DOM child of `.chatcontainer`,
                               `mouseout` events from intra-row button→button travel bubbled to the container-level
                               `onMouseOut` delegation and armed the hide timer (nothing cancelled it — the row's
                               mouseenter/leave don't re-fire for child-to-child moves). Fix: `onMouseOut` now
                               early-returns when target/relatedTarget is inside `.new-ui-actions-overlay`, and
                               `handleRowHoverChange`'s leave branch clears immediately (no timer) since it's now
                               driven by the row container's non-bubbling `mouseleave` (fires only on genuine exit).
                               Retry: DOM bridge only ("Try again" — the spec's 3 additional retry-menu variants
                               are NOT implemented this session, see Phase 28 below). Clicks hidden #editPrompt,
                               waits for #editResponse to mount, appends/removes a trailing space (handleEditMessage
                               only resends if content differs), clicks #saveTextChange. For assistant rows, targets
                               the nearest preceding .user-message sibling.
                               Copy/Read Aloud: same as before (clipboard write / window.speechSynthesis).
                               Good/Bad rating: NEW — persists to `message.data.newUiRating` / `newUiFeedback` via
                               `handleUpdateSelectedConversation` (mutates the matched message by its real array
                               index). Deliberately does NOT call `services/groupAssistantService.ts`'s
                               `saveUserRating` — that endpoint is scoped to the old 5-star widget for
                               group-assistant conversations only (`data.state.currentAssistantId` starts with
                               `astgp`), calling it for every conversation would be a scope violation.
                               Timestamp: `useRelativeTime`/`formatAbsoluteTime` from
                               components/NewUI/shared/relativeTimestamp.ts. Renders '' (nothing) for messages
                               with no `message.timestamp` (older persisted history predating the field) rather
                               than fabricating a value. (Timestamp helper itself lives in shared/ — see below.)
  views/
    NewWorkflowsView.tsx      ← full-pane new-UI view for Assistant Workflow Templates. page='workflows'
                               (gated by featureFlags.createAssistantWorkflows for CRUD; read-only browse
                               mode shown to all users when flag is false).
                               Layout: 52px top bar (back + "Workflows" + "New Workflow" button) |
                               340px left list pane (search, skeleton, template cards, empty states) |
                               flex-1 right detail pane (template name/desc/inputs/steps OR empty state).
                               Template cards: name, 1-line description, step-count badge, base-template +
                               public badges. Hover shows edit (pencil) + delete (trash) icons (feature-
                               flagged). Delete uses an inline confirm dialog before calling
                               deleteAstWorkflowTemplate.
                               Detail pane: read-only sections for Inputs (from inputSchema.properties)
                               and Steps (numbered, collapsible, shows tool code badge + instructions).
                               "Edit Workflow" button at bottom of detail pane triggers the builder.
                               Editor: renders <AssistantWorkflowBuilder isOpen={showEditor} .../> wrapped
                               in a <div className="new-ui-workflow-editor-modal text-neutral-900 dark:text-white">
                               so conversation-view.css can style the inner Modal without touching the
                               builder component. See CSS section "Workflows view — inner builder overrides".
                               Services: listAstWorkflowTemplates(true), deleteAstWorkflowTemplate (same
                               as AssistantWorkflowBuilder — no changes to service layer).
                               Port note: AssistantWorkflowBuilder is reused UNCHANGED. TODO: dedicated
                               new-UI visual pass on the builder's internals in a future phase.
    NewScheduledTasksView.tsx ← full-pane new-UI reimplementation of the old ScheduledTasks modal. page='scheduledTasks'
                               (gated by featureFlags.scheduledTasks). Replaces the lazy-loaded+portal
                               old ScheduledTasks modal that used to render from NewSidebar.
                               Layout: 48px top bar (back + title) | 340px list pane (search, type filter,
                               "New Task" button, grouped-by-type rows) | detail pane (editor or run-logs).
                               Data/services identical to old component — no service/type changes:
                               services/scheduledTasksService.ts (create/get/list/update/delete/executeTask/
                               getTaskExecutionDetails), types/scheduledTasks.ts (ScheduledTask, TASK_TYPE_MAP).
                               PORT: object-selector sub-flow (Assistant/Action/Workflow picker + inline
                               "Create Action Set" builder) reuses old, unmodified sub-widgets wrapped in
                               new-UI containers: CronScheduleBuilder, ActionSetList, CompositeActionsPanel,
                               ApiItemSelector, ApiParameterBindingEditor, AgentLogBlock (for run-result
                               rendering). Each reused-widget wrapper has
                               className="text-neutral-900 dark:text-white" per the light-mode gotcha.
                               TODO: give these sub-widgets a dedicated new-UI visual pass in a future phase.
                               Entry: NewSidebar "Scheduled" nav item (expanded + collapsed rail) → dispatches
                               page='scheduledTasks'. Also listens for the existing openScheduledTasksTrigger
                               event (still dispatched by old-UI ScheduledTaskButton, e.g. from assistant
                               modals) — NewSidebar's listener now stores the prefilled ScheduledTask into
                               sessionStorage key `amplify_pending_scheduled_task` (one-shot handoff, same
                               pattern as the Pending-Message Bridge) and dispatches page='scheduledTasks';
                               NewScheduledTasksView reads+consumes that key on mount via useMemo.
    ChatsListView.tsx        ← full-pane "Chats and tasks" table (search, filter, relative dates). page='chats'
                               Auto-focuses search input on mount (80ms delay).
    LibraryView.tsx          ← (SUPERSEDED) thin wrapper around DataSourcesTable. No longer used in new-UI path.
    NewLibraryView.tsx       ← full-pane new-UI document library. page='library'
                               Design matches NewAssistantsView: clean list rows, design tokens, no MantineReactTable.
                               Columns: file-type icon, name + tags, type, date, status badge, download/delete hover actions.
                               Search: search bar (Enter to commit) with server-side namePrefix query.
                               Upload: "Upload" button (gated by featureFlags.uploadDocuments) via handleFile.
                               Status: StatusBadge per file using getDocumentStatusConfig; refresh/reprocess action buttons.
                               Delete: single row × on hover + batch delete mode (select all / confirm bar).
                               Pagination: "Previous / Next" load-page buttons; skeleton rows while loading.
                               Embedding status fetched in 25-key chunks via embeddingDocumentStatus (same as DataSourcesTable).
    NewAssistantsView.tsx    ← new-UI reimplementation of AssistantGallery. page='assistantGallery' (new UI path only)
                               Four tabs: My Assistants | Shared with Me | Teams | Layered Assistants
                               (Prompt Templates tab removed in Phase 56 — moved to Settings → Customize)
                               My Assistants: canEdit=true individual assistants, access-type badges (Private/Shared/URL),
                               opens NewAssistantTypeSelector before AssistantModal for new creation.
                               Shared with Me: canEdit=false individual assistants (noEdit=true).
                               Teams: existing GroupAssistantsTab content (unchanged, renamed from "Group Assistants").
                               Layered / Prompt Templates: same as before.
                               All creation flows use NewAssistantTypeSelector → AssistantModal / PromptModal / openLayeredBuilderTrigger
                               Group admin actions gate on featureFlags.assistantAdminInterface + GroupAccessType
                               Old AssistantGallery still renders in the classic-UI path — untouched.
    NewAssistantTypeSelector.tsx ← SPECIFIC Step 0 wizard modal for new assistant creation.
                               Props: onClose, onConfirm(astPath, astPathData, groupId?)
                               Three cards: Private (no path) / Managed (path + sub-options) / Collaborative (team).
                               Card 2 gated by featureFlags.assistantPathPublishing; Card 3 gated by
                               featureFlags.assistantAdminInterface + group ADMIN/WRITE access.
                               Card 3 NO LONGER dispatches openAstAdminInterfaceTrigger — it calls onConfirm with
                               groupId so ALL three cards lead to AssistantModal (Phase 47).
                               Card 3 expanded: "Use existing team" (dropdown/auto-select) OR "Create new team"
                               (team name + member emails → async createAstAdminGroup + updateGroupMembers).
                               Focus trap + Escape + keyboard card selection. Blurred backdrop overlay.
                               NOTE: only astPath reliably pre-fills AssistantModal (AssistantModal resets astPathData
                               via its own lookupAssistant effect on mount — see file header for full explanation).
  settings/
    NewSettingsModal.tsx     ← two-column settings modal. Props: onClose, openToSection?:string
                               Panel: maxWidth 1100px, height min(820px, 90dvh) — STANDARDIZED with
                               NewAdminModal (Phase 53). Left rail 210px.
                               Right pane is a flex COLUMN: fixed header row (flexShrink:0,
                               padding 20px 24px 16px) holding [h2#settings-modal-heading ...... ×]
                               above a flex:1/minHeight:0/overflowY:auto content div (contentRef).
                               Phase 53 Fix 4: when showAdminUI is true this component EARLY-RETURNS
                               <NewAdminModal onClose={onClose}/> instead of its own frame — admin
                               replaces settings, never stacks over it. Its focus-trap/Escape effect
                               also early-returns while admin is open so the two modals don't both
                               handle Escape. Do NOT reintroduce a nested <NewAdminModal> render.
    NewAdminModal.tsx        ← two-column admin panel (same shell as NewSettingsModal). Props: onClose, openToTab?:AdminTab
                               Panel: maxWidth 1100px, height min(820px, 90dvh). Left rail 220px.
                               Same flex-column right pane + header row as NewSettingsModal (Phase 53);
                               its h2 additionally renders the inline "● unsaved" badge, and the ×
                               runs the unsaved-changes confirm before onClose.
                               Rendered STANDALONE via NewSettingsModal's early return (Phase 53
                               Fix 4) — it is no longer a child of the settings overlay, so nothing
                               shows behind it. Its onClose is the parent's onClose (unmounts the
                               whole settings tree).
                               NOTE: outer frame is deliberately NOT extracted into a shared shell —
                               see Phase 53 for the rationale (admin's Escape guard + 5 extra props).
    NewAccountSection.tsx    ← SPECIFIC account settings section (Phase 45). No props.
                               Self-loads accounts via getAccounts(). MTD cost card + rate-limit
                               warning banner + add/edit/delete accounts + default selector + save.
                               Inline NewRateLimiter (port of RateLimit.tsx styling — DO NOT MODIFY original).
                               Wires settingsSave event. Used by NewSettingsModal AccountSection.
    NewStorageSection.tsx    ← SPECIFIC storage settings section (Phase 45). No props.
                               Four styled radio-card options (local-only/future-local/cloud-only/future-cloud).
                               Pending change callout + migration progress bar + save with confirm dialog.
                               Wires settingsSave and cleanupApiKeys events. Used by NewSettingsModal StorageSection.
    NewConnectorsSection.tsx ← SPECIFIC connectors settings section (Phase 45). No props.
                               SegmentedControl tabs: "Integrations" | "Tool API Keys".
                               Integrations: flat list of all providers' integrations, skeleton/empty states,
                               connect (OAuth popup) / disconnect (confirm), per-integration spinners,
                               token-sharing shortcut. Tool API Keys: wraps <ToolApiKeysTab> in
                               [data-new-ui="true"] .new-ui-tool-api-keys for CSS scoping.
                               Used by NewSettingsModal SectionContent case 'connectors'.
    PromptTemplatesSection.tsx ← SPECIFIC prompt templates settings section (Phase 56). No props.
                               Extracted from PromptTemplatesTab in NewAssistantsView.tsx — same three-section
                               layout (Quick Actions / System Instructions / Your Templates), same search, same
                               PromptModal open/close flow, same create/edit/cancel handlers.
                               Uses useContext(HomeContext) for prompts, featureFlags, statsService,
                               availableModels, handleNewConversation, dispatch.
                               className="text-neutral-900 dark:text-white" on outermost div (wiki rule 9).
                               Entry: Settings → Customize → Prompt Templates (first item in Customize group).
    SidebarItemsSection.tsx   ← SPECIFIC sidebar visibility settings section (Phase 56). No props.
                               Self-contained — reads/writes localStorage directly (key: amplify_sidebar_items_visible).
                               Toggle rows: Chats list, Assistants, Library, Workflows (featureFlag-gated),
                               Scheduled Tasks (featureFlag-gated), Notebook (featureFlag-gated),
                               Recent conversations. Auto-saves on each toggle change.
                               Dispatches window event `amplifySidebarVisibilityChanged` on change so NewSidebar
                               re-reads state without a page reload.
                               Entry: Settings → Customize → Sidebar Items (last item in Customize group).
                               Left rail: Configurations | Supported Models | Application Variables | OpenAI Endpoints
                                          Feature Flags | Feature Data | Ops | Embeddings
                                          Integrations (conditional) | Critical Errors (conditional)
                               Right pane: same tab components from components/Admin/AdminComponents/ — untouched.
                               Nav items show an accent-orange dot when the tab has unsaved changes.
                               Left-rail footer: Reload button + Save button (active orange when changes pending, dim when none).
                               Save count shown in button label: "Save 3 changes".
                               Escape / overlay-click both confirm before closing when unsaved changes exist.
                               Entry: NewSettingsModal "Admin Panel" nav → renders NewAdminModal above settings modal.
                               Old AdminUI is no longer rendered in the new-UI path (still used in classic-UI path).
                               LIGHT MODE: right content pane has className="text-neutral-900 dark:text-white" — this
                               is the inherited base color for all admin tab child components (mirrors old AdminUI wrapper).
                               Without it, components that only set dark:text-* have no light-mode fallback.
                               Sections: general|account|usage|storage|apikeys|promptTemplates|
                                         customInstructions|skills|connectors|mcp|sidebarItems|admin
                               Entry points: sidebar Customize (→skills), AccountMenu (→general), ⌘, (→general)
                               "Custom Instructions" is the rebrand of the system prompt / custom instructions
                               concept from the old UI. Stored in localStorage key: amplify_custom_instructions
                               Phase 56: added promptTemplates (first in Customize — PromptTemplatesSection)
                               and sidebarItems (last in Customize — SidebarItemsSection). New icons:
                               IconTemplate (for Prompt Templates), IconLayoutSidebar (for Sidebar Items).
                               Phase 56 follow-up: GeneralSection redesigned — appearance icon segmented
                               control (system/light/dark, stores 'amplify_appearance_mode' localStorage key),
                               chat font chromeless dropdown (renders font name in its own face), feature flags
                               use ToggleSwitch rows replacing FlagsMap. FlagsMap component removed as import;
                               Flag type interface kept for typing. Customize sidebar button now opens to
                               'promptTemplates' (was 'skills') in both expanded nav and collapsed rail.
  shared/
    SegmentedControl.tsx     ← REUSABLE segmented tab control (size: sm=sidebar, xs=composer)
    IconButton.tsx           ← REUSABLE 28×28/32×32 icon button with hover ring
    Badge.tsx                ← REUSABLE "Labs"-style pill badge
    ConfirmDialog.tsx        ← REUSABLE confirmation modal for destructive actions (Phase 52)
                               Props: isOpen, title, message (ReactNode), confirmLabel?, cancelLabel?,
                                      onConfirm, onCancel, variant? ('danger'|'warning'|'neutral')
                               variant='danger' (default) → red confirm button.
                               Portalled to document.body. Focus trap, Escape cancels, backdrop-click
                               cancels. Cancel button is focused on open (user must intentionally confirm).
                               Used by: ConversationRow (chat delete), ConversationHeader (header delete),
                                        NewAssistantsView LayeredAssistantsTab (assistant delete).
    relativeTimestamp.ts     ← REUSABLE (Phase 28). `formatRelativeTime(iso, now?)` implements
                               chat-pane-migration-spec.md §2.4's ladder: <60s "just now", <60m "{n}m",
                               <24h "{n} hours ago", <7d weekday name, <1yr "Mon D", else "Mon D, YYYY".
                               `formatAbsoluteTime(iso)` for `title=` tooltips (full localized date+time).
                               `useRelativeTime(iso)` hook re-renders its consumer every 30s while the
                               value is under an hour old (spec: "Live-update sub-hour values on a 30s
                               interval"); no timer scheduled once older, since day/weekday-granularity
                               text doesn't change on that cadence. Returns '' for missing/invalid input —
                               callers render nothing rather than fabricate a timestamp for messages
                               predating the `Message.timestamp` field. Used by NewUIMessageActionsLayer.tsx.
    RichComposer.tsx         ← REUSABLE contentEditable composer with inline code block support
                               Props: onSend(markdown), onChange?(value), onLargePaste?(text), onImagePaste?(file), placeholder, editorClassName, autoFocus
                               Ref handle: clear(), focus(), getValue()
                               Trigger: type ``` then Shift+Enter → inserts styled code block
                               onImagePaste: fires for any clipboard item with type image/* — file is never inserted as text; parent calls addFileToRail(file)
                               onLargePaste: fires when pasted text ≥ 4,000 chars; composer is NOT updated — parent converts to attachment card
                               Paste order: image check → large-text check → normal insert
    webSearchPreference.ts   ← REUSABLE bridge: persistWebSearchPluginPreference(featureFlags)
                               Forces settings.featureOptions.includeWebSearch=true via the shared
                               getSettings/saveSettings utilities (utils/app/settings.ts) so that any
                               FUTURE mount of Chat.tsx picks up PluginID.WEB_SEARCH in its local
                               `plugins` array (getActivePlugins() always overrides WEB_SEARCH from
                               this setting, ignoring localStorage — see Chat.tsx/plugin.ts internals).
                               Does NOT retroactively fix an already-mounted Chat.tsx instance for the
                               conversation open at toggle time — see §13 "RAG / Web Search Wiring Gap".
                               Used by: ConversationComposer.tsx (onToggleWebSearch), NewHome.tsx
                               (onToggleWebSearch), ConversationViewShell.tsx (pending-message bridge,
                               consuming amplify_pending_web_search for brand-new conversations).
    attachmentTypes.ts       ← Shared types + helpers for the attachment rail
                               UIAttachment type, PASTE_AS_FILE_THRESHOLD = 4000
                               createUIAttachmentFromDoc(doc, progress, prebuiltThumbUrl?) → UIAttachment
                                 NOTE: doc.raw is "" by the time handleFile calls onAttach — pass prebuiltThumbUrl
                                 generated from the original File BEFORE calling handleFile (see Image Thumbnail gotcha)
                               createPasteAttachment(text) → UIAttachment
                               derivePasteTitle(text), formatBytes(bytes), getExtBadge(name, mime)
    AttachmentCard.tsx       ← REUSABLE 160×160 attachment tile (image/file/paste variants)
                               Props: attachment, onRemove, onPreview(id, originRect), alwaysShowRemove, enterState
                               Image: thumbnail letterboxed with cross-fade on load, no badge
                               File: wrapping name (4 lines, overflow-wrap: anywhere) + uppercase badge
                               Paste: first ~400 chars faded at bottom + PASTED badge
                               Remove × fades in on hover (sibling button, not nested — valid HTML)
                               Upload progress: centered circular SVG spinner overlay (not a bottom bar)
                                 Determinate: filling arc, transitions smoothly as progress increases
                                 Indeterminate: rotating 25%-arc via @keyframes attachment-spinner
                               Failure state: #6E4540 border, FAILED badge in warm red
    AttachmentRail.tsx       ← REUSABLE horizontal scrolling rail of AttachmentCards
                               Props: attachments, onRemove, onPreview
                               Collapses to 0 height when empty (220ms ease-out), opens to 176px when cards present
                               Entry animation: rail opens t=0, card enters t=60ms (opacity+scale+translateY), stagger +40ms per card (max 5)
                               Roving tabindex keyboard nav (←/→/⌫/Escape), scroll-snap-x
    AttachmentPreview.tsx    ← REUSABLE preview overlay for any UIAttachment
                               Props: attachments[], initialIndex, originRect?, onClose
                               Layout: outer centering wrapper (fixed inset-0 flex center, never transformed) +
                                       inner panel div (FLIP transforms applied here only)
                               FLIP animation: panel expands from card's DOMRect (320ms ease-out); reverse on close (240ms)
                               Falls back to opacity fade when no originRect (e.g. card scrolled out of view)
                               Content panels: image (letterboxed + checkerboard bg), CSV (parsed table, 500 row cap), text (raw monospace pre)
                               Unavailable states: too-large / unsupported / pending / failed — correct copy + optional Download button
                               Navigation: ← / → between attachments, "N of M" counter
                               a11y: role="dialog" aria-modal, focus trap, Escape closes
    AttachMenu.tsx           ← REUSABLE ⊕ attach + tools menu (attach-menu-spec.md)
                               Props: isNewChat, plugins, onAddFiles, onAddFromLibrary,
                                      webSearchEnabled, onToggleWebSearch,
                                      selectedSkillIds, onSkillsChange, chatEndpoint?, composerRef?
                               Exports: AttachMenu (trigger+panel) + AttachMenuChips (active state chips)
                               Group 1: Add files ⌘U, Add from library, Add assistant ›
                               Group 2: Skills › (loads getUserSkills, toggle per skill), Connectors › (→ settings)
                               Group 3: Web search toggle (stays open on activate)
                               Trigger rotates 45° → × while open; badge dot when any toggle active
                               Dispatches openNewUISettingsSection event for "Manage skills…" / "Browse connectors…"
                               Phase 48: assistant rows show a hover-preview card (InfoFloatCard);
                                         all submenus positioned by Floating UI (menuPositioning)
    ModelPicker.tsx          ← REUSABLE spec-compliant model+effort picker (model-picker-spec.md)
                               Props: selectedModelId, selectedEffort: EffortLevel, onModelChange, onEffortChange, composerRef?
                               Three surfaces: trigger → primary menu → effort|more-models submenu
                               Effort levels: 'low'|'medium'|'high'|'off' (maps to REASONING_LEVELS)
                               Uses Floating UI (useFloating) for the primary menu AND both submenus
                                 (Phase 48 — submenus were absolute+measured-top before)
                               Phase 48: "More models" rows show a hover-preview card (InfoFloatCard)
                               Used by: NewHome
                               Enter → sends, Escape inside block → exits to line after
    InfoFloatCard.tsx        ← SHARED hover-preview card shell + hover-intent hook (Phase 48)
                               Exports: useInfoCardHover<T>() → { item, anchor, show, hide, hideNow }
                                        InfoFloatCard (portalled shell: 240px max, --bg-raised,
                                          --border-subtle, 10px radius, 14px pad, 0 4px 16px shadow)
                                        Content primitives: InfoCardTitle / InfoCardText
                                          / InfoCardItalic / InfoCardMeta / InfoCardPills / InfoCardPill
                               Timers: 250ms hover-in, 200ms hover-out (instant swap between rows)
                               Positioning: shares submenuMiddleware() from menuPositioning.ts (gap 12)
                                 → right-start, flip side only, shift for vertical fit
                               strategy 'fixed' + FloatingPortal (submenu panels clip their contents)
                               pointer-events: none — can never eat a row click or trip useDismiss
                               Used by: AttachMenu (assistant rows), ModelPicker (BOTH the recommended
                                 primary-panel rows and the more-models submenu rows)
                               NOT a general tooltip system — menu-row previews only
    sidebarVisibility.ts     ← SHARED type + defaults for sidebar item visibility (Phase 56).
                               Exports: SidebarVisibility interface (6 keys: chats|assistants|library|
                               workflows|notebook|scheduled — Recents is always shown, not toggleable),
                               DEFAULT_SIDEBAR_VISIBILITY (all true), SIDEBAR_VISIBILITY_KEY.
                               Consumed by: SidebarItemsSection.tsx (writer), NewSidebar.tsx (reader).
                               Event bridge: 'amplifySidebarVisibilityChanged' custom event.
    ToggleSwitch.tsx         ← REUSABLE pill-shaped on/off switch (Phase 56).
                               Props: checked, onChange(bool), id?, disabled?, aria-label?, aria-labelledby?
                               Design: 44×24px fully-rounded track; off=--text-muted gray, on=--accent;
                               18px white knob with 3px inset, translateX(20px) when on; 150ms ease
                               transition on both track color and knob position simultaneously.
                               Keyboard: Space/Enter toggles; role="switch" + aria-checked semantics.
                               Focus: focus-visible ring (2px --accent, offset-1).
                               Click: calls e.stopPropagation() so parent row onClick doesn't double-fire.
                               Used by: SidebarItemsSection.tsx toggle rows.
    menuPositioning.ts       ← SHARED Floating UI config for NESTED submenu panels (Phase 48)
                               Exports: SUBMENU_PLACEMENT ('right-start'), submenuMiddleware(gap=4), submenuStyle()
                               Middleware: offset(gap) + flip({crossAxis: false, fallbackPlacements:
                                 ['left-start','bottom-start','top-start']}) + shift({padding: 8})
                               ⚠️ crossAxis:false is load-bearing — with flip's default, TALL panels
                                 (More models, 420px) pick a horizontally-clipped side because vertical
                                 overflow poisons the fit test. Read the file header before touching it.
                               strategy stays 'absolute' ON PURPOSE — panels remain DOM children of the
                                 primary panel so useDismiss reads clicks inside them as "inside"
                                 (Skills checkbox rows depend on the menu NOT closing)
                               submenuStyle() hides the panel until the first computePosition resolves
                               Used by: AttachMenu (skills/connectors/assistant), ModelPicker (effort/models)
```

### 5.2 CSS Files
```
styles/globals.css           ← design tokens (:root + .dark), existing global styles
styles/conversation-view.css ← scoped overrides for [data-new-ui="true"] chat shell
                                Phase 26: thinking/shimmer animation on PromptStatus's step line
                                (breathing dot + gradient text sweep, both prefers-reduced-motion
                                gated) + reasoning-block settle-in transition + old-branding sweep
                                (#artifactsButtonBlock logo swatch hidden/restyled)
                                Phase 28: reasoning-block redesign (chevron replaces triangle, literal
                                "Reasoning" text hidden/replaced) + hover-action-row button styles
                                (.new-ui-action-btn-lg, .new-ui-msg-timestamp, .new-ui-feedback-input).
                                IMPORTANT GOTCHA (see §13): #expandComponent and .border-l.border-gray-300
                                are NOT unique to the reasoning block — ExpansionComponent.tsx hardcodes
                                both on ~20 unrelated call sites (Sources, Agent Log, RAG Evaluation,
                                Generated Files, MCP Tool Result, etc.). Every reasoning-specific rule
                                MUST be scoped through the reasoning wrapper's own class,
                                `.text-sm\!important.opacity-70` (from AssistantReasoningMessage.tsx
                                line 38) — a bare `#expandComponent` or `.border-l` selector silently
                                restyles every other expandable block in the app. Phase 28 fixed this
                                for the reasoning rules it touched AND for the pre-existing Phase 26
                                settle-in-animation rule that had the same bug.
                                Phase 33: `.chatcontainer { position: relative }` (makes it the offsetParent /
                                containing block for NewUIMessageActionsLayer's absolute overlay + rows);
                                `.enhanced-chat-message { padding-bottom: 36px }` (reserves in-flow row space);
                                reasoning wrapper `margin-bottom` 26px→10px; removed the
                                `[data-last-assistant="true"]` resting-opacity rule (always-visible row dropped).
                                Phase 35: `.chatcontainer` mask now TOP-FADE ONLY (bottom fade removed —
                                the semi-transparent bottom band read as a bar covering text next to the
                                jump button); `.assistant-message` padding-bottom 20px→8px; reasoning
                                `#expandComponent` margin-left −18px→0 + gap 6px→0 + new
                                `#expandComponent .font-medium { margin-left: 0 }` rule so "Thought process"
                                aligns exactly with the prose left edge (the −18px derived from the wrong
                                element overshot ~4px left).
styles/sidebar-enhancements.css ← existing sidebar CSS (do not modify)
```

### 5.1a NewSidebar Drag-Resize Pattern
`NewSidebar.tsx` implements a user-resizable width with these key notes for future sessions:
- Width is controlled via **inline `style.width`** (not a Tailwind class) using `displayWidthRef.current + 'px'`.
- During drag, `sidebarRef.current.style.width` is updated directly — **no React state updates per pixel**.
- React state (`sidebarWidth`) is committed **only on mouseup**, triggering a single re-render.
- `displayWidthRef` is the authoritative "live" width; `sidebarWidth` state is the "committed" width.
  Both are equal at rest; they diverge only during an active drag.
- `localStorage` key: `amplify_sidebar_width`. Clamped to [220, 480] on read. Default 310.
- Collapsed mode (52px icon rail) is a separate `if (!isOpen)` return branch — completely immune.
- `transition-colors` (not `transition-all`) prevents CSS from animating the width property.

### 5.2 NewSidebar Layout (3 flex regions)
```
┌─────────────────────────────┐
│ HEADER (flex-shrink:0)      │ ← 48px: wordmark + collapse + search
│ Segmented: Home | Code      │ ← 34px track
│ + New Chat button           │ ← 36px
│ Primary nav (5 items)       │ ← 36px rows
├─────────────────────────────┤
│ Pinned section              │ ← conditional
│ RECENTS (flex:1 overflow)   │ ← scrollable
│   scroll-fade mask bottom   │
├─────────────────────────────┤
│ FOOTER (flex-shrink:0)      │ ← Design row + Account row
└─────────────────────────────┘
```

### 5.3 Design Tokens — Geometry
```
--radius-row:    8px
--radius-button: 10px
--radius-panel:  14px
--row-h:         36px
--row-pad-x:     10px
--sidebar-pad:   10px
--gap-section:   18px
```

---

## 6. New UI / Old UI Toggle

### 6.1 Strategy
- A popup/modal on first load asks the user if they want the new UI
- User preference stored in `localStorage` as `amplify_new_ui_preference` (`'new'` | `'classic'`)
- Also sets a cookie/header (`X-Amplify-UI: new`) to support future load-balancer routing
- `home.tsx` reads this preference and renders either:
  - `<NewSidebar />` + new layout (new UI)
  - `<TabSidebar />` + old layout (classic UI)
- Settings gear icon always allows switching between the two

### 6.2 Header for Load Balancer
When user selects new UI, set:
```js
document.cookie = "X-Amplify-UI=new; path=/; SameSite=Lax";
```
The load balancer's listener rule #3 on port 443 can match this cookie and forward to the new target group.

### 6.3 UIPreferenceBanner Component
Location: `components/NewUI/UIPreferenceBanner.tsx`
- Shows once per session if `localStorage.amplify_new_ui_preference` is not set
- Two buttons: "Try New UI" and "Stay on Classic"
- Semi-modal or dismissible top-banner style

---

## 7. Plugin Selector Removal

The floating `PluginSelector` component (`components/Chat/FeaturePluginSelector/`) overlays the chat interface. In the new UI:
- All feature flags (artifacts, prompt highlighter, memory, etc.) are **ON by default**
- The plugin selector overlay is removed
- Settings live in the SettingsModal (accessible via account menu → Settings)
- Feature toggles remain accessible but are not shown as a floating overlay

---

## 8. Files That Are Safe to Modify (UI Layer)

| File/Folder | What to change |
|---|---|
| `pages/api/home/home.tsx` | Layout/render section only (lines ~1600+); keep all state/handlers |
| `styles/globals.css` | Add new design tokens; keep existing classes |
| `tailwind.config.js` | Add new theme keys safely |

### ⛔ The One-Directory Rule

> **ALL new UI code lives in `components/NewUI/`. Never modify any component outside that directory.**

This is the rule that keeps both UIs functional simultaneously. Violating it means:
- Changes can break the classic UI for users who haven't opted in to the new UI
- The two-UI strategy collapses — we can no longer switch safely
- Future cleanup (removing the classic UI entirely) becomes tangled

**The correct approach for any feature that exists in the old UI:**

1. **Preferred:** Write a new implementation inside `components/NewUI/` that fits the new visual language. It can *import* old utility functions (`utils/`, `types/`, `services/`) and even old modal components that are pure UI (e.g. `AssistantModal`, `PromptModal`) — but it must not *modify* them.

2. **Acceptable (with note):** Copy just the minimal logic you need into a new file inside `components/NewUI/`, clearly mark it as a "port" of the old component, and add a TODO noting it should be improved/revised later.

3. **Never:** Edit old component files (outside `components/NewUI/`) to add new-UI behavior, even conditionally.

The only file outside `components/NewUI/` that may be touched is `pages/api/home/home.tsx` — but only the layout/render section (the part that switches between new-UI and classic-UI rendering at lines ~1600+).

---

## 9. Files — DO NOT CHANGE (Backend Integration)

```
services/                    ← ALL service files
hooks/useChatSendService.ts
hooks/useChatService.ts
hooks/useConversationContextLoader.ts
hooks/useFetch.ts
hooks/useOpsService.ts
hooks/usePromptFinderService.ts
pages/api/chat/proxy.ts
pages/api/auth/[...nextauth].js
pages/api/home/home.state.tsx  (shape of state — do not rename/remove fields)
pages/api/home/home.context.tsx (context interface — do not remove methods)
types/                        ← ALL type files
utils/                        ← ALL utility files
```

---

## 10. Chat Component (Chat.tsx) — Preserve Logic

`components/Chat/Chat.tsx` contains:
- Message streaming logic → DO NOT TOUCH
- Rate limit checking → DO NOT TOUCH
- Model selection logic → DO NOT TOUCH
- `useSendService` / `ChatRequest` hook → DO NOT TOUCH

Visual changes allowed:
- Message bubble styling
- Chat area background
- Empty state design
- ChatInput redesign (new composer)

---

## 11. Responsive Breakpoints

| Viewport | Sidebar behavior |
|---|---|
| ≥768px | Sidebar open (user's persisted preference respected) |
| <768px | Auto-collapses to 52px icon rail — **JS-enforced** via `SIDEBAR_AUTO_COLLAPSE_THRESHOLD = 768` in `NewSidebar.tsx` (Phase 57). No localStorage write on auto-collapse or auto-expand. |

> **Phase 57 JS breakpoint:** `NewSidebar.tsx` listens to `window resize` (passive) and checks `window.innerWidth` against `SIDEBAR_AUTO_COLLAPSE_THRESHOLD = 768` on mount and on every resize event. This replaces the old CSS-only TODO for the 760px breakpoint. The prior "760–1099px icon rail / <760px off-canvas drawer" tiers were the CSS spec target; the implemented behavior is a single 768px cut-point with the existing 52px collapsed rail (the off-canvas drawer tier was not implemented).

---

## 12. Implementation Progress

### Phase 1 — Foundation ✅ COMPLETE
- [x] Create `NEW_UI_DOCS.md` (this file)
- [x] Add new design tokens to `globals.css` (lines 9–54)
- [x] Create `components/NewUI/` directory structure
- [x] Create `UIPreferenceBanner.tsx` — first-load new-UI prompt with cookie setting
- [x] Wire toggle in `home.tsx` — `uiPreference` state, banner shown inside `<main>`, new/classic conditional layout

### Phase 2 — New Sidebar ✅ COMPLETE
- [x] `SidebarNavItem.tsx` — reusable nav row (icon + label, active/hover/focus states)
- [x] `SidebarSection.tsx` — section heading (Pinned, Recents); Phase 51: collapsible with localStorage persistence
- [x] `ConversationRow.tsx` — recent chat with hover ⋯ menu (rename/delete); Phase 51: +Pin/Unpin +Share
- [x] `AccountMenu.tsx` — bottom row + upward popover (settings, theme toggle, logout)
- [x] `SettingsModal.tsx` — wraps existing `SettingDialog` in a new overlay
- [x] `NewSidebar.tsx` — full sidebar: header, nav, recents (time-bucketed: Today/Yesterday/Previous 30 days), account footer
- [x] `SidebarHeader.tsx` — wordmark ✳ + collapse + search buttons

### Phase 3 — Shared Primitives + Home ✅ COMPLETE
- [x] `NewHome.tsx` — greeting ✳ + serif display text + composer + suggestion chips
- [x] `SegmentedControl.tsx` — Chat/Cowork toggle (reusable, parameterized by `size`)
- [x] `IconButton.tsx` — base icon button (28×28 / 32×32 with hover ring)
- [x] `Badge.tsx` — "Labs" style pill badge

### Phase 4 — Chat View & List ✅ COMPLETE
- [x] `ConversationViewShell.tsx` — wraps existing Chat component with `data-new-ui="true"`, scoped CSS applies new styling without touching Chat logic
- [x] `conversation-view.css` — scoped overrides: bg-app bg, 760px column, user bubble (right-aligned, --bg-raised, 16px radius), assistant prose (no bubble), fade masks, code blocks, tables
- [x] `ChatsListView.tsx` — full-pane "Chats and tasks" view (table of all conversations, search, filter, relative timestamps). Opened via "expand" icon in sidebar Recents header
- [x] `NewHome.tsx` (updated) — proper landing with session storage handoff, suggestion chips, send on Enter
- [x] Sidebar: removed Settings from top nav (now only accessible via account menu → Settings)
- [x] Sidebar: fixed Recents showing ALL conversations (was wrongly filtering out folder-based ones)
- [x] Sidebar: conversations sorted newest-first using `date` field (ISO timestamp) with folder-name fallback
- [x] Sidebar: expand arrow icon opens ChatsListView
- [x] home.tsx: landing state = `NewHome` when `page=chat + 0 messages`, chat view when messages exist
- [x] globals.css: added Newsreader font (display serif for greeting/wordmark)

### Phase 5 — Iteration 2 ✅ COMPLETE
- [x] NewHome: removed Chat/Cowork segmented toggle
- [x] NewHome: removed suggestion chips
- [x] NewHome: greeting centered horizontally above composer
- [x] NewHome: model dropdown pulls from `availableModels` state (not hardcoded)
- [x] AccountMenu: added Documentation link → https://www.vanderbilt.edu/agi/platforms/resources/
- [x] AccountMenu: fixed "Switch to Classic UI" (calls `setUIPreference` + page reload)
- [x] Sidebar: added Library nav item (`IconBooks`) → dispatches `page='library'`
- [x] LibraryView: full-pane view wrapping existing `DataSourcesTable` component
- [x] ChatsListView: wired in `home.tsx` via `page='chats'`
- [x] Recents bug fix: removed incorrect folder filter — all conversations are shown
- [x] Recents: skeleton loading rows shown while `syncingConversations=true`
- [x] Recents: "New Conversation" placeholder entries (0 messages) hidden from list
- [x] Recents grouping: uses `conversation.date` → `folder.date` (ISO) → `folder.name` parse

### Phase 6 — Settings & Customize ✅ COMPLETE
- [x] `NewSettingsModal.tsx` — two-column settings modal per settings-spec.md
  - Left rail (210px): search bar + three nav groups (Settings / Customize / Vanderbilt)
  - Right pane: scrollable content with sticky ×, section heading
  - Rail items: General, Account, Usage, Capabilities, Code, Cowork, Skills, Assistants, Connectors, Plugins, Organization
  - Wired sections: General (theme + feature flags), Account, Skills (SkillsLibrary), Connectors (IntegrationTabs), Plugins (MCPServersTab), Storage, API Keys
  - Placeholder sections for: Usage, Capabilities, Code, Cowork, Assistants, Organization
  - Entry point 1: Sidebar "Customize" nav → opens to Skills section
  - Entry point 2: AccountMenu → Settings → opens to General section
  - Entry point 3: ⌘, keyboard shortcut → opens to General section
- [x] Sidebar: added "Customize" nav item (`IconAdjustments`) — opens NewSettingsModal to 'skills'
- [x] Sidebar: "Customize" nav item shows as active (highlighted) while modal is open
- [x] AccountMenu: Settings option opens NewSettingsModal to 'general'
- [x] home.tsx: ⌘, shortcut wired for new UI, renders NewSettingsModal via `newUiSettingsSection` state

### Phase 7 — Functionality Wiring ✅ COMPLETE
- [x] **Model dropdown fully functional** — `NewHome.tsx` now shows all available models from `availableModels` state, filtered by `hiddenModelIds` settings, with a working dropdown sorted alphabetically. Selected model is passed to `handleNewConversation` so the new conversation starts with the right model.
- [x] **Attachment button fully functional** — `NewHome.tsx` now has a hidden `<input type="file">` wired to the `handleFile` service (same code as old `AttachFile` component). Attached files show as chips with upload progress. Files are stored in `sessionStorage` alongside the pending message.
- [x] **Pending message bridge** — `ConversationViewShell.tsx` now reads `sessionStorage` keys (`amplify_pending_message`, `amplify_pending_docs`, `amplify_pending_model_id`) after `Chat` mounts, injects text into `#messageChatInputText` via React's native setter trick, then clicks `#sendMessage`. Zero changes to `Chat.tsx`.
- [x] **Admin Panel in new UI** — `NewSettingsModal.tsx` now has a dynamic "Admin" group in the nav rail (only when `featureFlags.adminInterface === true`). Clicking it opens the existing `AdminUI` as a peer modal on top of the settings modal. Also accessible via sidebar "Admin" nav item (when feature-flagged) and via `AccountMenu` → "Admin Panel" button.
- [x] **Admin entry points wired** — `NewSidebar.tsx` adds "Admin" nav item gated by `featureFlags.adminInterface`, active when `settingsSection === 'admin'`. `AccountMenu.tsx` adds "Admin Panel" menu item (gated by `featureFlags.adminInterface`) that dispatches `openNewUIAdminPanel` custom event. `NewSidebar.tsx` listens for `openNewUIAdminPanel` and sets `settingsSection('admin')`.
- [x] Feature flags admin (create/set/modify flags) is fully accessible via the existing `AdminUI` → Feature Flags tab — no new code needed there, just wiring the entry point (done above).
- [x] Fixed `UIPreferenceBanner.tsx` unescaped apostrophe (build error).

### Phase 7b — Bug Fixes ✅ COMPLETE
- [x] **Admin panel "Unable to fetch" error** — caused by a corrupted `.next` build cache (vendor-chunks directory was empty while `webpack-api-runtime.js` still referenced it). Fixed by clearing `.next`. Re-run `npm run dev` and it rebuilds cleanly.
- [x] **Conversations timezone bucketing bug** — `folder.date` values (YYYY-MM-DD from `addDateAttribute`) were being parsed as UTC midnight by `new Date("2026-08-06")`, placing today's conversations into "Yesterday" in any timezone west of UTC (e.g. US/Central). Fixed with `parseDateForBucket()` helper that detects YYYY-MM-DD strings and parses them as `new Date(year, month-1, day)` (local midnight). Full ISO timestamps still parsed normally.
- [x] **Conversation filter uses chat-type folders only** — `groupConversationsByTime` now receives `chatFolders` (filtered to `type === 'chat'`) so prompt/workflow folders can't accidentally affect bucketing.
- [x] `noFolderConversations` renamed to `filteredConversations` for clarity.

### Phase 8 — Model Picker ✅ COMPLETE
- [x] `ModelPicker.tsx` — spec v2 compliant three-surface model + effort picker (`components/NewUI/shared/ModelPicker.tsx`)
  - **Two states**: `isNewChat=true` → 280px, opens downward, full slate (Opus+Sonnet+Haiku); `isNewChat=false` → 220px, opens upward, current model only
  - Family matching: finds newest/most capable model per family (`opus`, `sonnet`, `haiku`) by matching model `name` or `id` substring, sorts capability-descending by tier
  - Falls back to first 3 models if no family names match (handles custom model naming)
  - `modelDescription()` helper: uses `model.description` if set, falls back to family-appropriate use-case text ("For complex tasks" etc.)
  - Trigger: `[ModelName] [Effort] ⌄` — model name capped at 18ch, effort omitted for non-reasoning models
  - Primary menu: 2-line model rows (48px) + **two dividers** (model block → Effort → More models); single divider when Effort row absent
  - Effort submenu (320px, absolute right-start): consequence header + Low/Medium/High/Off with Default badge + ⓘ tooltips
  - More models submenu (260px, absolute right-start): all models alphabetically, check on active
  - Uses `REASONING_LEVELS` (`low|medium|high|off`) from `types/model.ts` — no Fable constraint
  - Hover-intent: 150ms open, 300ms close — parent row stays `--bg-active` while submenu is open
  - Animation: 120ms opacity+translateY+scale, `transformOrigin` follows resolved side
- [x] `NewHome.tsx` updated — replaces inline dropdown with `ModelPicker`, adds `selectedEffort` state, stores effort in `sessionStorage` alongside pending message
- [x] Send button updated per spec §7: 32×32, radius 8px, `--accent` background, `#2A1710` dark glyph (not white), disabled state uses `--bg-active`
- [x] Mic/send swap per spec §7: cross-fade 120ms — mic shows when input empty, send shows when content present
- [x] `RichComposer.tsx` — added optional `onChange?: (value: string) => void` prop, called on every content change
- [x] `ModelPicker` wired as entry for `composerRef` to restore focus after model/effort selection

### Phase 9 — Attach Menu ✅ COMPLETE
- [x] `AttachMenu.tsx` — spec-compliant ⊕ attach/tools menu (`components/NewUI/shared/AttachMenu.tsx`)
  - Trigger: 30×30, ⊕ glyph, rotates 45°→× over 140ms while open, badge dot when any toggle is active
  - Panel: 246px, Floating UI, flips down (new chat) / up (conversation) — spec §3
  - Group 1: Add files or photos (⌘U, `featureFlags.uploadDocuments`) · Add from library (`featureFlags.dataSourceSelectorOnInput`)
  - Group 2: Skills › (loads skills via `getUserSkills`, per-skill toggle, "Manage skills…" → settings) · Connectors › (→ settings/connectors)
  - Group 3: Web search toggle — `menuitemcheckbox`, stays open on activate, `featureFlags.webSearch + WEB_SEARCH plugin`
  - Two dividers: Group 1 | Group 2 | Group 3 (only rendered when adjacent groups are both present)
  - Hover-intent: 150ms open, 300ms close on submenu rows
  - `AttachMenuChips` exported separately — renders active-toggle chips in toolbar (26px, `--bg-active`, × to dismiss)
  - **Add assistant `›`** — searchable submenu of all assistants + layered/group assistants. Selection dispatches `selectedAssistant` to HomeContext. Active assistant shown as chip (`[🤖 Opus Assistant ×]`); chip × resets to DEFAULT_ASSISTANT.
  - No Projects, no Deep Research, no Screenshots (excluded per product direction)
- [x] `NewHome.tsx` updated — replaces old paperclip button with `AttachMenu`, adds `webSearchEnabled` + `selectedSkillIds` state, stores both in sessionStorage for ConversationViewShell
- [x] `NewSidebar.tsx` — now listens for `openNewUISettingsSection` event (dispatched by AttachMenu "Manage skills…" / "Browse connectors…")
- [x] ⌘U global shortcut wired in NewHome

### Phase 10 — Conversation View (spec §2–§7) ✅ COMPLETE
- [x] `conversation-view.css` — complete rewrite per spec v3
  - Shell bg: `--bg-app` everywhere, all hardcoded dark colors overridden
  - **Header**: 52px sticky, `--bg-app` bg, no border, correct colors on title/icons
  - **Message column**: `min(74ch, 100% - 48px)` centered, `padding: 24px`
  - **Composer/dock**: background gradient fade, max-width = column + 48px (text insets align), 14px radius card
  - **User bubbles** (spec §4.2): right-aligned (`margin-left: auto`), `--bg-raised`, `border-radius: 16px`, `padding: 12px 18px`, `font: 16px/1.65`, `max-width: 72%`, `width: fit-content`
  - **Assistant messages** (spec §4.3): no bubble, no avatar, no name label — `background: transparent`, full column width, `font: 16px/1.7`
  - **Removed old decorations**: `enhanced-chat-message` gradient bg, border-left, `::before` shimmer, icon column, `@Amplify:` prefix label all hidden
  - **Turn spacing** (spec §4.7): 44px between turns via `space-y-8`
  - **Accent asterisk** (spec §6): idle end-of-thread marker via CSS `::after` on the bottom spacer div — `✳`, 22px, `--accent`, 55% opacity
  - **Prose typography** (spec §5): h1/h2/h3, ul/ol markers, blockquote, `a` underline, `code` inline, `strong` letter-spacing
  - **Code blocks** (spec §5): `--bg-sidebar` bg, `border-radius: 12px`, 36px header, `13.5px/1.6` mono body
  - **Tables** (spec §5): `--bg-sidebar` header, `--border-subtle` borders, `border-radius: 10px`
  - **Scroll fade masks** (spec §2): `28px` top, `32px` bottom via `mask-image`
  - **Action row**: icon buttons 28×28 circle, `--text-muted` → `--text-primary` on hover, opacity 0→1 on message hover/focus
  - **Light mode**: explicit `--text-primary` on all prose elements, `prose-invert` override
- [x] `ConversationViewShell.tsx` — added spec §7 disclaimer line: "Amplify can make mistakes. Verify important information." — 11.5px `--text-muted`, centered, positioned above the bottom spacer

### Phase 11 — Conversation View Components ✅ COMPLETE
- [x] `ConversationHeader.tsx` — spec §3 compliant 52px sticky header
  - Left: conversation title as menu trigger (chevron, 15px/500, max 40ch, ellipsis); title dropdown: Rename (inline input, Enter/Escape), Share, Delete
  - Right: filled Share button (--bg-active, 30px, 8px radius, 14px, "Share")
  - Assistant chip when non-default assistant active (✳ name, --bg-raised pill)
  - Overlays Chat.tsx's own header (hidden via CSS)
- [x] `ConversationComposer.tsx` — spec §7 docked composer
  - Fixed two-band rect: textarea (auto-grows to 12 lines) | toolbar (36px)
  - Width matches --dock-w so inner text aligns with message column
  - Bridges into Chat's hidden textarea (#messageChatInputText) + send button (#sendMessage)
  - Toolbar left: AttachMenu ⊕ + active chips
  - Toolbar right: ModelPicker (collapsed/upward per spec §7.3) + mic + send/stop slot
  - Stop button shown while messageIsStreaming (clicks Chat's hidden #stopGenerating)
  - Model changes applied immediately via handleUpdateConversation
  - Web search + skills persisted to conversation.data
  - Disclaimer: "Amplify can make mistakes. Verify important information."
- [x] `ConversationViewShell.tsx` updated — renders ConversationHeader + ConversationComposer as overlays; removed old inline disclaimer
- [x] `conversation-view.css` updated:
  - HIDES Chat's old sticky header (.sticky.top-0.z-10, .sticky.top-4.mt-4)
  - HIDES Chat's old ChatInput dock (.px-20.absolute.bottom-0)
  - HIDES FeaturePlugin floating selector
  - scroll container gets padding-top:52px + padding-bottom:180px for overlays
  - fade masks adjusted: 80px top (after header), 48px bottom (before composer)
  - inline code: warm coral #D9776A per spec §5
  - list indent: 2.2em per spec §5

### Phase 12 — Chat View Interior Styling ✅ COMPLETE
All via `conversation-view.css` additions — zero changes to `ChatMessage.tsx` or any protected files.

- [x] **PromptStatus** (the "Amplify Assistant is responding." card) — old card (bg-image, wave animations, rounded-xl shadow) replaced with spec §4.4 in-stream step line: transparent bg, 14px `--text-muted`, 20px vertical padding, no chrome. Details panel styled as spec §4.5 expandable block (--bg-sidebar, 12px radius, border-left 2px).
- [x] **AssistantReasoningMessage / ExpansionComponent** — styled as spec §4.4 collapsible disclosure: toggle button at 14px `--text-secondary`, 12px chevron; expanded block uses `--bg-sidebar` bg, `border-radius: 12px`, `border-left: 2px --border-subtle`, `13.5px/1.6 --text-muted`, max-height 320px with scroll.
- [x] **Action icons** — moved from old side-rail (fixed/sticky, right of message) to spec §4.6 horizontal row **below** the message content: `position: static`, `flex-direction: row`, 28×28 circle ghost buttons, 4px gap, opacity 0 → 1 on message hover/focus-within.
- [x] **User message icon row** — right-aligned below the bubble via `flex-direction: column + align-items: flex-end`.
- [x] **Assistant message icon row** — left-aligned below the prose via `flex-direction: column` on the containing flex row.

### Phase 13 — Message Action Layer & Layout Polish ✅ COMPLETE
- [x] **`NewUIMessageActionsLayer.tsx`** — new component in `components/NewUI/chat/`. Replaces the old clunky sidebar icon rail entirely. Uses event delegation on `.chatcontainer` (with DOM-ready retry) to track hovered messages. Renders a `position: fixed` floating pill below the hovered message with:
  - **User messages**: Copy (`IconCopy` → `IconCheck` 1.8s) + Edit (`IconEdit` — clicks hidden `#editPrompt` to trigger ChatMessage's existing edit flow, which resends on save)
  - **Assistant messages**: Copy + Read Aloud (`IconVolume` → `IconPlayerStop` while speaking via `window.speechSynthesis`)
  - Pill fades 120ms, right-aligned for user bubbles, left-aligned for assistant prose
  - Clamped so it never overlaps the bottom composer (stays above 220px from bottom)
  - SSR-safe: all `window`/`speechSynthesis` usage guarded by `typeof window !== 'undefined'`
  - Speech cancelled when `messageIsStreaming` becomes true
- [x] **Old `enhanced-chat-icons` hidden** — `[data-new-ui="true"] .enhanced-chat-icons { display: none !important }` in `conversation-view.css`. The big old fixed-position icon sidebar is gone.
- [x] **`ConversationViewShell.tsx`** — imports and renders `<NewUIMessageActionsLayer />` as the 4th child
- [x] **Horizontal breathing room** — `#overflowScroll` padding increased from 24px to 32px per side; user bubble max-width reduced from 72% to 68%; turn spacing increased from 44px to 60px
- [x] **`.new-ui-action-btn`** CSS class added globally (not scoped to `[data-new-ui]`) — 28×28, 6px radius, ghost, `--text-muted` → hover `--bg-hover`+`--text-primary`

### Phase 14 — Layout Geometry Fix ✅ COMPLETE
Addressed all 9 defects from the layout spec. No visual (color/typography) changes — geometry only.

- [x] **Root cause fixed** — messages now have a constrained centered column (`--column-w: min(75ch, 100% - 48px)`) applied directly to every `.enhanced-chat-message`. Previously the max-width rule was targeting the model-settings panel (wrong element).
- [x] **Defect #1 — line length** — 75ch cap on `.enhanced-chat-message`, ~75 chars/line
- [x] **Defect #2 — zero left gutter** — `margin-inline: auto` + min 24px inset on both sides
- [x] **Defect #3 — composer/column misaligned** — `--dock-w: column-w + 48px` (2 × 24px composer pad). Composer uses `min(75ch, calc(100% - 48px)) + 48px`. Text insets now align.
- [x] **Defect #4 — content bottom-anchored** — `#overflowScroll` minHeight/maxHeight (JS-set) overridden to 0/none. Bottom spacer `.h-[300px]` reduced to 48px since composer is now a flex sibling, not overlay. Content top-anchors naturally.
- [x] **Defect #5 — user bubble at viewport edge** — bubble `max-width: 72%`, `margin-right: 0` aligns to column right edge
- [x] **Defect #6 — heavy scrollbar** — `scrollbar-gutter: stable` prevents column shift; `width: 4px` thin overlay scrollbar on `.chatcontainer`
- [x] **Defect #7 — missing scroll-to-latest** — 40px circle button in `ConversationViewShell`, centered on message column via `--dock-w` container, appears when >200px from bottom, `aria-label="Scroll to latest message"`, smooth scroll on click
- [x] **Defect #8 — dock as overlay** — `ConversationComposer` is now a **flex sibling** of the scroll area, not `position: absolute`. Growing the composer shortens the scroller. `ConversationViewShell` restructured: `new-ui-scroll-area (flex:1) + new-ui-dock (flex-shrink:0)`.
- [x] **Defect #9 — vertical rhythm** — turn spacing 60px, well differentiated from within-turn gaps
- [x] **`scrollbar-gutter: stable`** added so the column doesn't shift when a thread becomes scrollable
- [x] `ConversationComposer.tsx` — removed `position: absolute/bottom:0` overlay, now a plain block; updated `max-width` to match 75ch column
- [x] `ConversationViewShell.tsx` — restructured into flex column with scroll-area + dock regions; added scroll-to-latest button; added DOM-ready retry for `.chatcontainer` scroll listener
- [x] `conversation-view.css` — column constraint moved to `.enhanced-chat-message` directly; height chain through `new-ui-scroll-area → .relative.flex-1 → chatcontainer` established; JS-set inline heights overridden with `!important`

### Phase 15 — Wiring, Polish, and Settings Expansion ✅ COMPLETE
- [x] **Scheduled Tasks connected** — `NewSidebar.tsx` now listens for `openScheduledTasksTrigger` events AND the Scheduled nav item directly opens `ScheduledTasks` modal. Uses `React.lazy + createPortal` to render the existing `ScheduledTasks` component (from `components/Agent/ScheduledTasks.tsx`) without touching it. Works whether triggered by the nav item OR by other components dispatching the event (e.g. `ScheduledTaskButton` in assistant modals).
- [x] **Message action pill fixed** — Removed `background: 'var(--bg-app)'`, `border`, and `boxShadow` from the floating pill in `NewUIMessageActionsLayer.tsx`. The action buttons (Copy, Edit, Read Aloud) now appear as bare icon buttons with no card/backdrop behind them. Individual `.new-ui-action-btn` hover states still work via CSS.
- [x] **Reasoning block styling improved** — Enhanced `conversation-view.css`: reasoning toggle label is now 13px muted text with 0.7 opacity chevron; expanded block increases `max-height` from 320px → 480px; added prose sub-selectors for `p` and `code` inside the block for better readability.
- [x] **Custom Instructions in Settings** — Added `CustomInstructionsSection` component to `NewSettingsModal.tsx`. Placed first in the Customize nav group. Features: 8-row textarea, 4000 char limit with counter, Clear + Save buttons with "✓ Saved" flash. Saved to `localStorage` key `amplify_custom_instructions`. Includes a "How it works" info card. **This is the rebranded "System Prompt" / "Custom Instructions" feature** — the field label in the old `SystemPrompt.tsx` component was "Custom Instructions"; here it is surfaced as a first-class settings section under Customize.

### Phase 16 — Search + Full Gallery Creation Buttons ✅ COMPLETE
- [x] **Search button → Chats & Tasks page** — `NewSidebar.tsx` now dispatches `page = 'chats'` when the search icon in the sidebar header is clicked. `ChatsListView.tsx` auto-focuses its search input (80ms delay for mount) so the user can type immediately.
- [x] **Create new assistant in Assistants view** — `IndividualAssistantsGallery.tsx` now has:
  - A "New Assistant" button (indigo, `IconPlus`) in the gallery header next to the search box
  - A "Create your first assistant" button in the empty-state of the "Your Assistants" tab
  - `handleCreateAssistant()` mirrors Promptbar's logic exactly: creates a blank `Prompt` with an empty `AssistantDefinition` via `createEmptyPrompt` + sets `folderId = 'assistants'`
  - Opens the existing `AssistantModal` component with the blank prompt so users get the full assistant-creation experience (name, instructions, data sources, tools, etc.)
  - On cancel: removes the unsaved blank prompt from state + localStorage
  - On save: `handleUpdateAssistantPrompt` persists the new assistant
- [x] **Create new prompt template** — `PromptTemplatesGallery.tsx` — "New Template" button (indigo) in header + empty-state CTA. Uses `createEmptyPrompt` + opens `PromptModal`. Cancel cleans up the unsaved blank from state.
- [x] **Create new layered assistant** — `LayeredAssistantsGallery.tsx` — "New Layered Assistant" button (purple) in search bar row + empty-state CTA. Dispatches `openLayeredBuilderTrigger` with `createLayeredAssistant('New Layered Assistant')` as `initialData` — the existing builder handles the full creation flow.
- [x] **Create new group assistant** — `GroupAssistantsGallery.tsx` — "New Assistant" button (purple) in header, **only visible to users with admin/write access to at least one group** (gated by `hasAccessToGroupAdminInterface`). Dispatches `openAstAdminInterfaceTrigger` with the target group pre-selected (auto-picks the group when user only admins one; otherwise opens admin interface for group selection).

### Phase 17 — Architecture Cleanup + Documentation ✅ COMPLETE
- [x] **One-Directory Rule enforced** — Reverted gallery changes that accidentally modified old-UI files. Rule documented in Section 8 of this file and in `NEW_UI_WIKI_INSTRUCTIONS.md`.
- [x] **`NewAssistantsView.tsx`** — proper new-UI reimplementation of `AssistantGallery` inside `components/NewUI/views/`. Four tabs (My Assistants, Group Assistants, Prompt Templates, Layered Assistants), all with search + create buttons, clean list-row design using new-UI tokens. Old `AssistantGallery` untouched; `home.tsx` now renders `NewAssistantsView` for the new-UI path and `AssistantGallery` for the classic path.
- [x] **`NEW_UI_PORTING_STATUS.md`** created — tracks: (1) features still to port, (2) features intentionally removed forever, (3) future ideas for after the rewrite. Authoritative source for migration status.
- [x] Updated `NEW_UI_WIKI_INSTRUCTIONS.md` with One-Directory Rule.

### Phase 18 — Attachment Rail, Paste Capture, and Preview Overlay ✅ COMPLETE
- [x] `attachmentTypes.ts` — shared types (`UIAttachment`, `PASTE_AS_FILE_THRESHOLD = 4000`) + helpers (`createUIAttachmentFromDoc`, `createPasteAttachment`, `derivePasteTitle`, `formatBytes`)
- [x] `AttachmentCard.tsx` — 160×160 tile with three variants (image/file/paste), hover-reveal × remove, circular SVG spinner overlay, failure state
- [x] `AttachmentRail.tsx` — horizontal scroll rail with enter/exit animations, rail height 0↔176px, roving tabindex keyboard nav, scroll-snap
- [x] `AttachmentPreview.tsx` — FLIP-animated overlay (centering wrapper + panel), image/CSV/text content panels, unavailable-preview states, ←/→ navigation
- [x] `RichComposer.tsx` — added `onLargePaste` + `onImagePaste` props; image paste intercepted before large-text check; pastes ≥ 4,000 chars become attachment cards
- [x] `NewHome.tsx` — replaced old flat chip row with `AttachmentRail`; composer card changed to 3-band grid (rail|textarea|toolbar); `AttachmentPreview` portal added; image paste + large-text paste wired; `addFileToRail()` generates `thumbUrl` object-URL before `handleFile`
- [x] `ConversationComposer.tsx` — added `AttachmentRail` + `AttachmentPreview`; `handleTextareaPaste` checks image clipboard items first, then large-text threshold; `addImageToRail()` builds `UIAttachment` directly with object-URL
- [x] `globals.css` — `@keyframes attachment-spinner` for rotating SVG arc

### Phase 18b — Attachment Polish ✅ COMPLETE
- [x] **Circular spinner** — replaced 2px bottom bar with a centered SVG ring spinner on `AttachmentCard`. Determinate: filling arc. Indeterminate: rotating 25%-arc via CSS animation.
- [x] **Preview centered** — fixed `AttachmentPreview` layout. Root cause: `transform:translate(-50%,-50%)` and FLIP `transform` cannot coexist on the same element. Solution: outer `fixed inset-0 flex items-center justify-center` wrapper handles centering; inner panel ref receives FLIP transforms only.
- [x] **Image thumbnails visible** — root cause: `handleFile` sets `doc.raw = ""` so `URL.createObjectURL` was impossible after the callback. Fix: `addFileToRail()` in `NewHome` calls `URL.createObjectURL(file)` on the original `File` *before* calling `handleFile`, stashes the URL in `thumbUrlsRef`, then passes it into `createUIAttachmentFromDoc` as `prebuiltThumbUrl`. Object-URLs are revoked on remove and on send.
- [x] **Image paste** — `RichComposer` now has `onImagePaste?(file: File)` prop; checks `clipboardData.items` for `image/*` first. `ConversationComposer.handleTextareaPaste` checks the same. Both route to `addFileToRail` / `addImageToRail` so pasted screenshots/images appear in the rail immediately.

### Phase 20 — New Library View ✅ COMPLETE
- [x] **`NewLibraryView.tsx`** — new-UI reimplementation of the Library (Document Library) view
  - Replaces old `LibraryView.tsx` (which was a thin wrapper around `DataSourcesTable` using MantineReactTable)
  - Clean list-row design matching `NewAssistantsView` — uses all new-UI design tokens, Inter font, `--bg-*` variables
  - File type icons: per-MIME Tabler icons (`IconFileTypePdf`, `IconFileTypeCsv`, `IconFileTypeDocx`, etc.)
  - Status badges: `StatusBadge` component using `getDocumentStatusConfig` with warm-color new-UI styling (no Tailwind hardcoded colors)
  - Columns: icon square + name/tags | type | date | status+action | hover actions (download, delete)
  - Search: input field, Enter commits a server-side `namePrefix` query; Escape clears
  - Upload: "Upload" button (gated by `featureFlags.uploadDocuments`) via `handleFile`, multi-file support
  - Embedding status: fetched in 25-key chunks with `embeddingDocumentStatus`; refresh and reprocess action icons per row
  - Batch delete mode: trash-mode toggle shows checkboxes; select-all / confirm bar with ✓/✗ buttons
  - Single-row delete: hover × on each row (no confirmation — matches UX of similar tools)
  - Pagination: "Previous / Next" page buttons + file count footer; skeleton loading rows
  - Wired in `home.tsx`: `NewLibraryView` replaces `LibraryView` for the new-UI path

### Phase 21 — New Admin Modal ✅ COMPLETE
- [x] **`NewAdminModal.tsx`** — new-UI two-column admin panel in `components/NewUI/settings/`
  - Same shell as `NewSettingsModal`: blurred overlay, 1100×820px panel, 220px left rail + scrollable right pane
  - All 10 admin tabs become left-rail nav items (no more horizontal scrolling top-tab bar)
  - Nav items: Configurations | Supported Models | Application Variables | OpenAI Endpoints | Feature Flags | Feature Data | Ops | Embeddings | Integrations (conditional) | Critical Errors (conditional)
  - Each nav item shows an accent-orange dot when the tab has unsaved changes (`adminTabHasChanges`)
  - Left-rail footer: Reload button + Save button; save button shows change count ("Save 3 changes"), dims to gray when no changes
  - Right pane heading shows "● unsaved" indicator when active tab has changes
  - All data-fetching, save, validate, test-endpoint logic is **identical** to `AdminUI.tsx` — no changes to services
  - All tab content components (`ConfigurationsTab`, `SupportedModelsTab`, etc.) rendered unchanged
  - Escape and overlay-click both show confirmation dialog when there are unsaved changes
  - **Wired:** `NewSettingsModal` "Admin Panel" nav item now renders `NewAdminModal` instead of `AdminUI`
  - Entry points unchanged: AccountMenu → "Admin Panel" → `openNewUIAdminPanel` event → `settingsSection='admin'` → `NewAdminModal`
  - Classic-UI path still uses old `AdminUI` — untouched

### Phase 22 — Admin Panel Light Mode Fixes ✅ COMPLETE
- [x] **Root cause fixed** — `NewAdminModal` right content pane now has `className="text-neutral-900 dark:text-white"`. This mirrors the `text-black dark:text-white` wrapper the old `AdminUI` had, giving all admin tab components a correct inherited base text color in light mode.
- [x] **`Configurations.tsx`** — `text-blue-100` cloud icon → `text-blue-500` (was ~1.1:1 contrast on white, now visible); `hover:text-neutral-200` edit-rate-limit button → `hover:text-neutral-700 dark:hover:text-neutral-200` (was near-white on hover in light mode)
- [x] **`SupportedModels.tsx`** — `text-[#0bb9f4]` (bright cyan, ~2.2:1 contrast) → `text-[#0284c7] dark:text-[#38bdf8]` on both the "(* Required)" span and all model-selector labels; readable in both modes
- [x] **`FeatureData.tsx`** — `text-blue-400` plus icon on `bg-blue-100` button (~1.5:1 contrast) → `text-blue-600 dark:text-blue-400`
- [x] **`Ops.tsx`** — `text-neutral-400` "Search by" label (~2.6:1 contrast) → `text-neutral-600 dark:text-neutral-400`
- [x] **`OpenAIEndpoints.tsx`** — delete/remove-model buttons had `dark:text-neutral-100` with no light-mode color → added `text-neutral-700` on both

### Phase 23 — New Scheduled Tasks View ✅ COMPLETE
- [x] **`NewScheduledTasksView.tsx`** — new-UI full-pane reimplementation of the old `ScheduledTasks.tsx` modal, in `components/NewUI/views/`. Same design language as `NewAssistantsView`/`NewLibraryView`: top bar (back + title), 340px search/filter/create list pane on the left grouped by task type (assistant/actionSet/apiTool/workflow), detail pane on the right showing either the task editor form or the run-logs viewer.
- [x] All data/service logic ported 1:1 from the old component — `services/scheduledTasksService.ts` and `types/scheduledTasks.ts` untouched. Includes: create/edit/delete/run-now/poll-for-completion/view-logs/view-execution-details.
- [x] Object-selector sub-flow (choose Assistant / Action [API tool, Action Set, or inline "Create Action Set" builder] / Workflow template) reuses old, unmodified widgets wrapped in new-UI containers: `CronScheduleBuilder`, `ActionSetList`, `CompositeActionsPanel`, `ApiItemSelector`, `ApiParameterBindingEditor`, `AgentLogBlock`. Each wrapper adds `className="text-neutral-900 dark:text-white"` per the light-mode gotcha (Section 13). **TODO:** give these sub-widgets a dedicated new-UI visual pass in a future phase.
- [x] **Wiring change (`NewSidebar.tsx`)**: removed the `React.lazy` + `createPortal` modal wrapper for the old `ScheduledTasks` component entirely (in both the collapsed-rail and expanded-sidebar render paths). The "Scheduled" nav item (in both rail states) now dispatches `page: 'scheduledTasks'` instead of opening a modal — following the same full-pane-view pattern as Assistants/Library/Chats rather than a portal modal.
- [x] **Event bridge preserved**: `openScheduledTasksTrigger` (still dispatched unmodified by old-UI `ScheduledTaskButton`, e.g. from assistant modals) is still listened for in `NewSidebar.tsx`. The handler now writes the prefilled `ScheduledTask` payload into `sessionStorage` key `amplify_pending_scheduled_task` (new one-shot handoff key, same pattern as the Pending-Message Bridge) and dispatches `page: 'scheduledTasks'`. `NewScheduledTasksView` reads+removes that key on mount via a `useMemo`.
- [x] **`home.tsx`** — added import for `NewScheduledTasksView` (next to the other NewUI view imports, ~line 110) and a new render branch `{(page as any) === 'scheduledTasks' && featureFlags.scheduledTasks && (<NewScheduledTasksView />)}` in the new-UI layout switch (~line 1679), following the exact `'chats'`/`'library'` precedent (loose `page: string` field, no union type change needed — confirmed `home.state.tsx` still declares `page: string`).
- [x] `NEW_UI_PORTING_STATUS.md` Section 5 updated: "Scheduled Tasks modal" → "Scheduled Tasks full-pane view", marked ✅ with new component name.

### Phase 24 — Load-Time State Consumption Audit + Fixes ✅ COMPLETE (partial — see RAG note)
A static code-review audit compared how classic UI (TabSidebar/Chatbar/Promptbar/ModelSelect/etc.)
consumes the on-mount state loaded in `home.tsx` (conversations, admin flags, models, feature flags,
groups, prompts, settings) against how `components/NewUI/**` consumes the *same* state — looking for
anything classic checks that new UI silently drops. Findings and fixes:

- [x] **Hidden prompts/assistants leak** — classic `Promptbar.tsx:249-250` filters out
  `prompt.data?.hidden` items unless `featureFlags.overrideInvisiblePrompts` is set; this filter was
  completely absent from new UI. Fixed in:
  - `components/NewUI/views/NewAssistantsView.tsx` — `MyAssistantsTab`, `GroupAssistantsTab`,
    `PromptTemplatesTab` each gained an `isVisible(p)` predicate mirroring the classic check.
    `GroupAssistantsTab`'s `openAdminInterface()` was updated to pass the **original, unfiltered**
    group object (looked up fresh from `groups` context) to the `openAstAdminInterfaceTrigger` event,
    so admins can still see/manage hidden assistants — only the read-only list display filters them.
  - `components/NewUI/shared/AttachMenu.tsx` — `AssistantSubmenu`'s source list (`availableAssistants`)
    now applies the same filter before mapping `Prompt` → `Assistant`.
- [x] **`supportsImages` model capability not surfaced** — classic `ModelSelect.tsx:165` shows a camera
  icon for models that accept image input; `ModelPicker.tsx` never checked this attribute. Added the
  same `IconCamera` (opacity 0.7, `title="Supports images in prompts"`) to both the primary-menu model
  rows and the "More models" submenu rows in `components/NewUI/shared/ModelPicker.tsx`.
- [x] **`ChatsListView` search didn't match message content** — classic `Chatbar.tsx:181-197` searches
  conversation name **and** decompressed message content for local conversations (remote conversations
  are not content-searchable — a pre-existing classic-UI limitation, preserved as-is). New `ChatsListView`
  only matched `conversation.name`. Fixed by importing `isLocalConversation` (`utils/app/conversation.ts`)
  and `uncompressMessages` (`utils/app/messages.ts`) and mirroring the classic filter exactly, including
  its cost profile (LZW decompress + JSON.parse per local conversation, per keystroke — same as classic).
- [ ] **RAG toggle gap — NOT FIXED, deferred by design.** `featureFlags.ragEnabled`/`cachedDocuments`/
  `ragOn`/`PluginID.RAG` have zero references anywhere in `components/NewUI/`. This is a functional gap,
  not cosmetic: `ragOn` gates real behavior in `hooks/useChatSendService.ts:585-595` (whether the RAG
  plugin is included in the outgoing chat request) and `utils/fileHandler.ts`'s `resolveRagConfiguration`
  (per-file embedding/caching behavior on upload). Investigation traced the full mechanism (see the new
  "RAG / Web Search Wiring Gap" note in §13 below) and found that fixing it properly requires either (a)
  bridging into `Chat.tsx`'s local `plugins` state — `Chat.tsx:199`, a **protected DO-NOT-CHANGE file**
  per §10 — or (b) a different architecture entirely. The investigation also surfaced that the
  already-shipped "Web search" toggle (Phase 9/11, marked ✅) has the identical problem: it persists to
  `conversation.data.webSearchEnabled` but that value is never read anywhere that feeds `Chat.tsx`'s
  actual request-time `plugins` array, so it is very likely non-functional today. Both need a dedicated,
  scoped design/implementation task — deliberately not attempted in this session per user decision.
  Tracked in `NEW_UI_PORTING_STATUS.md` §2/§7.

### Phase 25 — Web Search Toggle Bug Fix ✅ COMPLETE (RAG deferred — no existing toggle to fix)
Bug-fix session addressing `NEW_UI_LOAD_STATE_AUDIT_2026-08-10.md`'s finding that the New UI Web
Search toggle persisted to `conversation.data.webSearchEnabled` but never reached `Chat.tsx`'s
actual request-time `plugins` array (a DO-NOT-CHANGE file). Investigation (5 rounds of read-only
research, no Chat.tsx edits) traced the exact mechanism and found a fix requiring zero Chat.tsx
changes:

- [x] **Root cause confirmed**: `useChatSendService.ts:451-458` computes
  `isWebSearchOn = featureFlagEnabled && pluginWebSearch && perMessageWebSearch` — a three-way AND.
  New UI already correctly wrote `perMessageWebSearch` (via `conversation.data.webSearchEnabled` →
  `ChatInput.tsx`'s own `isWebSearchEnabledForConversation` → `message.data.enableWebSearch`). The
  missing piece was `pluginWebSearch` — membership of `PluginID.WEB_SEARCH` in Chat.tsx's **local**
  `plugins` array (`Chat.tsx:199`), populated once per mount from `getActivePlugins()`
  (`utils/app/plugin.ts`). For `WEB_SEARCH` specifically, `getActivePlugins` *always* overrides
  whatever's in `localStorage['enabledPlugins']` with `settings.featureOptions.includeWebSearch`
  (`utils/app/plugin.ts:45-48`, the `settingsDrivenPlugins` override list) — a global, per-user,
  `localStorage['settings']`-persisted value (`utils/app/settings.ts`), never written by New UI.
- [x] **`components/NewUI/shared/webSearchPreference.ts`** (new file) — `persistWebSearchPluginPreference(featureFlags)`
  calls the already-sanctioned `getSettings`/`saveSettings` utilities (Section 2.5's "settings
  load/save via shared getSettings/saveSettings utilities" — not a protected-file edit) to force
  `includeWebSearch: true` whenever `featureFlags.webSearch` (the admin flag) is on. This makes any
  *future* mount of `Chat.tsx` — new conversation, page reload, or conversation switch, all of which
  remount `Chat.tsx` via `key={selectedConversation.id}` in `home.tsx` — pick up `WEB_SEARCH` in its
  initial `plugins` array.
- [x] **`ConversationComposer.tsx`** — `onToggleWebSearch` now calls `persistWebSearchPluginPreference`
  when turning the toggle on (in addition to its existing `conversation.data.webSearchEnabled` write
  in `handleSend`).
- [x] **`NewHome.tsx`** — same fix in its own `onToggleWebSearch`.
- [x] **`ConversationViewShell.tsx` — dead sessionStorage keys revived.** `amplify_pending_web_search`
  and `amplify_pending_skills` (written by `NewHome.tsx` for brand-new conversations, previously only
  ever `removeItem`'d, never read — a genuinely dead bridge) are now read in the pending-message
  bridge effect: if `amplify_pending_web_search === 'true'`, the shell (a) writes
  `webSearchEnabled: true` + the pending `skills`/`skillSelectionMode` onto the freshly-created
  `selectedConversation.data` via `handleUpdateConversation` (mirrors what `ConversationComposer`
  does for existing conversations), and (b) calls `persistWebSearchPluginPreference`. Zero changes to
  `Chat.tsx`.
- [x] **Known, documented limitation** (not fixed, by design — would require touching `Chat.tsx`):
  the very first message sent in an **already-open, already-mounted** conversation immediately after
  flipping the toggle on for the first time in a session may still be sent without the plugin, because
  `Chat.tsx`'s plugin-init effect only re-runs on `featureFlags` reference changes, not on this
  localStorage write. Every conversation opened, reloaded, or created *after* the toggle has been
  flipped once in that browser session works correctly, since `includeWebSearch` is now durably
  `true` in localStorage. This is the same class of limitation the RAG-toggle investigation had
  already flagged as the boundary case requiring a protected-file exception — documented rather than
  worked around, per project governance (§9a "the correct fix touches a protected file is a stop
  signal requiring explicit user sign-off").
- [ ] **RAG toggle — investigated, confirmed NOT to exist anywhere in `components/NewUI/`** (re-verified
  live during this session; matches the 2026-08-10 audit exactly, nothing changed since). "Add from
  library" in `AttachMenu.tsx` is a document-picker launcher only, not a RAG on/off control, and writes
  nothing to `conversation.data`. Per explicit user decision, building a new RAG toggle was ruled
  out-of-scope for this bug-fix session (there is no existing broken toggle to fix — it would be new
  feature work). Tracked as a future feature-build task in `NEW_UI_PORTING_STATUS.md` §2, with the
  `webSearchPreference.ts` mechanism now available as the template to replicate.

### Phase 26 — Chat View Interior Polish: Thinking Animation + Branding Sweep ✅ COMPLETE
All via `styles/conversation-view.css` additions only — zero changes to `ChatMessage.tsx` or any
protected file. Two-part session per user request.

**Part A — Streaming/"thinking" shimmer animation:**
- [x] Investigated where a "live thinking" indicator could attach. Found: `AssistantReasoningMessage`
  (wraps `ExpansionComponent`/`#expandComponent`) is gated by `!messageIsStreaming` in
  `ChatMessage.tsx` — it never mounts while the assistant is actively generating, only after the
  message is complete. `PromptingStatusDisplay`/`PromptStatus.tsx` (spec §4.4 in-stream step line,
  styled in Phase 12) is the only element actually present in the DOM while `status.inProgress` is
  true — this is the correct place to attach a "thinking" animation.
- [x] Added a soft **breathing accent dot** (`::before` on `.rounded-xl.shadow-lg .mt-0.ml-3`, the
  step-line row) — slow 1.8s opacity+scale pulse via `@keyframes new-ui-thinking-pulse`. Static
  (non-animated) 60%-opacity dot always renders; the pulse animation itself is added only inside
  `@media (prefers-reduced-motion: no-preference)`.
- [x] Added a **gradient shimmer sweep** across the status text (`.mt-0.ml-3 .mt-0.pt-0`, the actual
  text node — NOT the `.mt-0.ml-3` row, which only wraps it) via `background-clip: text` +
  `@keyframes new-ui-shimmer-sweep` (2.6s, moving highlight through `--text-muted → --text-primary →
  --text-muted`). Also `prefers-reduced-motion`-gated.
- [x] Added a **calm settle-in transition** (`@keyframes new-ui-reasoning-settle-in`, 0.35s
  opacity+translateY) on `#expandComponent` and the expanded `.border-l` block so the reasoning
  disclosure's arrival (the instant it mounts post-stream) doesn't pop in abruptly. Also
  `prefers-reduced-motion`-gated.
- [x] **Explicitly avoided** the old "wave animation" pattern (radiating ripple circles + gradient
  bars, `renderAnimatedBackground()` in `PromptStatus.tsx`) that was removed per
  `NEW_UI_PORTING_STATUS.md` §8 — no bg-image, no ripple, text-only shimmer + dot instead.
- [x] **`prefers-reduced-motion` now implemented** for this animation (Phase 19 TODO item, closed for
  at least this feature — other existing transitions elsewhere in the codebase are NOT yet audited,
  see updated Phase 19 list below).

**Part B — Old-branding sweep:**
- [x] Audited `components/Chat/ChatMessage.tsx`, `Chat.tsx`, and their reasoning/status
  sub-components for avatars, cover images, logo marks, non-Tabler icon sets. Confirmed avatars
  (`Avatars.tsx`), the `@Amplify:` prefix label, `.enhanced-chat-icons`, and PromptStatus's own
  cover-image column (`.w-14.h-12`) were already hidden by existing Phase 12/13 CSS. No non-Tabler
  icon libraries found anywhere in the chat render tree.
- [x] **New finding:** `components/Chat/ChatContentBlocks/ArtifactsBlock.tsx` (`#artifactsButtonBlock`)
  renders a `.w-14.h-14` `background-image` logo swatch (`/sparc_apple.png` or a white-label
  `/logos/...` path via `getWhiteLabelConfig()`) plus old-UI chrome (`bg-yellow-400 dark:bg-[#B0BEC5]
  shadow-lg`). This was NOT reliably covered by the existing `.rounded-xl.shadow-lg .w-14` rule
  (different component, `h-14` not `h-12`, only accidentally shares ancestor classes). Added explicit
  `[data-new-ui="true"] #artifactsButtonBlock .w-14 { display: none !important }` plus card
  restyling (`--bg-raised` bg, no shadow, `--border-subtle` border, `--text-primary`/`--text-muted`
  text colors) matching the same treatment PromptStatus's card got in Phase 12.

### Phase 28 — Hover Action Rows + Reasoning Block Redesign ✅ SHIPPED (partial — see blocked items)
Implements chat-pane-migration-spec.md §1, §2, §3 ONLY, per explicit session scope (§4+ deliberately
not started — separate follow-up sessions). Zero changes to ChatMessage.tsx, Chat.tsx, or
ExpansionComponent.tsx (all protected). Investigation-first approach: 5 read-only sub-agent
investigations were run before writing any code (data-model check for `reasoning.summary`, retry
mechanism discovery, message-array/DOM correspondence, `message.timestamp` reliability, chevron icon
convention) — see citations inline in code comments.

**Shipped — Hover action rows (§1/§2):**
- [x] `NewUIMessageActionsLayer.tsx` — full rewrite (was: Copy+Edit / Copy+ReadAloud pill from Phase 13/15).
  Now one component, `side` driven by role: user rows right-align `[timestamp][retry][edit][copy]`,
  assistant rows left-align `[copy][read aloud][good][bad][retry][timestamp]` — bare icons, no
  bordered box (spec §2.2's explicit anti-pattern warning honored).
- [x] Spacing per spec: user 20px timestamp→icon gap, 18px icon-to-icon; assistant 22px icon-to-icon,
  8px icon→timestamp gap. 28×28 circular `--bg-hover` behind on hover (`.new-ui-action-btn` changed
  from 6px-radius square to 50%-radius circle — this is a global class, so the sidebar/other consumers
  of `.new-ui-action-btn` also picked up the rounder shape; visually compatible, not flagged as a risk).
- [x] Timestamps: `useRelativeTime`/`formatAbsoluteTime` (new `shared/relativeTimestamp.ts`), full
  spec §2.4 ladder, live 30s tick under 1hr, `title=` absolute time always. Renders nothing (not a
  fabricated value) for messages with no `message.timestamp` — see BLOCKED note below on why this can
  still happen for very old persisted history.
- [x] Visibility: last assistant turn always visible once streaming has finished (checked via
  `messageIsStreaming` so a still-generating answer isn't force-shown with nothing useful yet); all
  other turns opacity 0→1 on hover OR native `:focus-within`. `visibility`/layout-shift concern from
  the spec is moot here — rows are `position:fixed` floating overlays, never in document flow, so
  revealing one can never shift anything; used `opacity`+`pointer-events` instead of `display` for the
  actual toggle, satisfying the acceptance check's intent regardless.
- [x] Retry — **"Try again" only.** Achieved via a DOM bridge (confirmed by investigation: no live
  regenerate button exists anywhere in the current app — `Chat.tsx`'s `onChatRewrite` prop is dead/
  unwired, `ChatInput.tsx`'s regenerate button is commented out). Mechanism: click hidden `#editPrompt`
  on the target user message → wait for `UserMessageEditor` to mount `#editResponse` → toggle a
  trailing space (handleEditMessage in ChatMessage.tsx only resends if content differs) → click
  `#saveTextChange`. This genuinely truncates-and-resends per `Chat.tsx`'s `onEdit`/`routeMessage` path
  (confirmed by investigation, not assumed). For an assistant row, the target user message is the
  nearest preceding `.user-message` DOM sibling.
  **NOT implemented:** the spec's 3 additional retry-menu variants ("Try with a different model" /
  "Add detail" / "Make it shorter") — these would need either a real menu UI (buildable) that appends
  instruction text to the resent message (the one part of the mechanism that DOES support arbitrary
  content changes) OR true per-message model override (confirmed absent from ChatMessage.tsx/ChatInput.tsx
  entirely — not a client trick away). Deferred as a distinct, scoped follow-up rather than half-building
  a menu whose highest-value item (model switch) can't work yet.
- [x] Good/Bad rating — new capability, not in the old pill. Persists to `message.data.newUiRating` /
  `newUiFeedback` via `handleUpdateSelectedConversation`. Bad opens a one-line feedback input per spec
  §2.2. Deliberately does NOT reuse `services/groupAssistantService.ts`'s `saveUserRating` (that
  endpoint + the old 5-star `Stars.tsx` widget are scoped to group-assistant conversations only,
  `data.state.currentAssistantId.startsWith('astgp')` — see ChatMessage.tsx line 1009 for the existing
  gate). Calling it unconditionally would be using an analytics endpoint outside its intended scope;
  flagged here rather than silently deviated from spec wording ("Save-to-library and Report an issue
  go in a `···`") — that `···` overflow menu (with Save-to-library / Report an issue) was also NOT
  built this session; six-visible-controls ceiling is currently met without it (5 assistant icons +
  timestamp), so it's a nice-to-have deferred alongside the retry-menu variants, not a blocker.
- [x] Message↔DOM correspondence verified correct (not assumed): `NewUIMessageActionsLayer` replicates
  `Chat.tsx`'s exact render filter (`role !== 'tool' && !data.actionResult`) so the Nth filtered message
  always matches the Nth rendered `.enhanced-chat-message` element — confirmed via direct investigation
  of `Chat.tsx`'s render loop (`Chat.tsx:1703-1739`), which also confirmed `messageIndex` itself is
  always the true array index (used here as a fallback map, not the primary matching mechanism).

**Shipped — Reasoning block redesign (§3), with one field-level blocker:**
- [x] Chevron replaces triangle (§3.3) — CSS `::before` content, rotation state read off
  `ExpansionComponent`'s own DOM (`.icon-pop-group` wrapper = closed state).
- [x] Literal word "Reasoning" no longer appears — collapsed via `font-size:0` + `::after` replacement
  text (same technique as the Phase 27 ChatLoader `▍`-hiding pattern). **Known residual gap:** this is
  visual-only; a screen reader still announces the original "Reasoning" text content since it's CSS
  generated-content, not a real DOM/aria change (not fixable from CSS alone without touching the
  protected component). Documented, not silently left unmentioned.
- [x] Flush-left alignment (no indent), 26px margin below before the answer, one-line clamp with
  ellipsis (max-width 320px), UI-sans font family even when body is serif — all per spec §3.4/§3.6/§3(font).
- [x] **Bug caught + fixed while implementing this:** `#expandComponent` and `.border-l.border-gray-300`
  (both hardcoded inside `ExpansionComponent.tsx`, itself protected/DO-NOT-CHANGE) are shared by ~20
  unrelated call sites across the assistant message tree (Sources, Agent Log, RAG Evaluation, Generated
  Files, MCP Tool Result, Jupyter Notebook blocks, etc. — full list in code comments). The Phase 12/15/26
  CSS for these selectors was unscoped and was silently restyling/reanimating ALL of those unrelated
  expandable blocks as if they were reasoning output. Fixed by scoping every reasoning-specific rule
  (including the pre-existing Phase 26 settle-in-animation rule) through
  `.text-sm\!important.opacity-70`, the one class that's actually unique to the reasoning wrapper
  (`AssistantReasoningMessage.tsx` line 38). See `styles/conversation-view.css` §"AssistantReasoningMessage
  / ExpansionComponent" for the full scoping note.

**██ BLOCKED ON BACKEND — spec §3.1/§3.2, explicitly flagged rather than fabricated ██**
Investigated thoroughly per instructions (grepped `types/chat.ts`, every `data.state.*` write site in
`hooks/useChatSendService.ts`, and the whole repo for `reasoning.summary`/`reasoningSummary`/similar)
before concluding this:
- **`reasoning.summary` does not exist anywhere in the current data model.** `message.data.state.reasoning`
  (written at `hooks/useChatSendService.ts:1502`) is only ever the full raw reasoning body (a string,
  sometimes lzw-compressed) — there is no sibling summary field, and no other message/turn field carries
  a prose "what was done" sentence. The closest analog, `Status.summary` (`types/workflow.ts`), is
  in-stream-only UI text that disappears once the turn completes (`PromptingStatusDisplay.tsx` only
  renders while `inProgress || sticky`) — it is never persisted onto the `Message`, so it cannot be read
  back after the fact for a completed turn's disclosure line.
  **NOT fabricated client-side, per explicit instruction.** The CSS injects a neutral placeholder,
  "Thought process," which makes no claim about what the model actually did (distinct from making up a
  plausible-sounding summary sentence like "Calculated recovery window..."). Search
  `styles/conversation-view.css` for "Thought process" to find the exact line to change the moment a
  real `reasoning.summary` field ships — the plan is to replace the CSS `::after` with a genuine React
  prop passed down a (still CSS-scoped) small wrapper, at which point this becomes trivial.
- **No "tool use occurred" boolean exists either.** Tool-use signals only exist by parsing rendered
  markdown content blocks at render time (`ChatContentBlock.tsx` dispatching to `AutonomousBlock`/
  `InvokeBlock`/`OpBlock` based on content pattern matching) — there is no structured per-turn flag.
  Spec §3.5's "omit the summary line entirely for turns with no reasoning and no tool use" is therefore
  only PARTIALLY implementable: `AssistantReasoningMessage.tsx` (protected, unchanged) already omits
  itself when `data.state.reasoning` is empty, which correctly covers "no reasoning." The "no tool use"
  half of that OR is not separately checkable without a backend field or a new client-side markdown-
  parsing pass — not attempted this session (would be new, nontrivial logic outside this session's
  explicit §1-3 scope, and duplicating `ChatContentBlock.tsx`'s parsing logic to answer a yes/no question
  is exactly the kind of "fabricate a derived signal" shortcut the task instructions asked to avoid).
- **Spec §3.2's "two variants" (chevron only when body non-empty) cannot currently occur.** Because
  there is only a body field and no separate summary field, `AssistantReasoningMessage.tsx` already
  returns null unless the body itself is non-empty — meaning every reasoning disclosure that renders at
  all currently HAS a body, so the "summary-without-body, no chevron" variant is unreachable with
  today's data. This becomes reachable and meaningful only once `reasoning.summary` exists as an
  independent field.
- **Recommendation for the backend companion task:** add `reasoning.summary: string` (and ideally
  `reasoning.hadToolUse: boolean` or equivalent) to the turn payload emitted by the orchestration layer,
  landing wherever `message.data.state.reasoning` is currently set
  (`hooks/useChatSendService.ts:1502`, `:1644-1650`) or as a sibling key alongside it.

**Manual QA follow-up needed (not completed this session):** no browser automation tool (chromium-cli
etc.) was available in this sandbox and the app requires Cognito login, so the acceptance checks above
were verified by code-trace against the spec and by clean `tsc`/`eslint`/production-build passes, NOT
by an actual rendered screenshot. Recommend a human or a future session with browser access do a visual
pass against chat-pane-migration-spec.md's "Acceptance checks" §1-12 (this phase covers §1-8 only) before
calling this feature fully verified.

### Phase 29 — Markdown in User Messages + Long-Message Collapse ✅ COMPLETE
Implements chat-pane-migration-spec.md §4 and §5 only. Zero changes to
ChatMessage.tsx, Chat.tsx, or any file outside components/NewUI/ (One-Directory
Rule strictly observed).

- [x] **`NewUIUserMessageMarkdownLayer.tsx`** — new component in `components/NewUI/chat/`.
  Portal-based: appends a `.new-ui-user-md-host` div inside each user message's `#chatHover`
  bubble, renders `<UserMsgMarkdown>` into it via `createPortal`. Adds `.new-ui-has-markdown`
  to the `.user-message` element so CSS can hide `#userMessage` (the raw whitespace-pre-wrap text).
- [x] **§4 markdown scope**: paragraphs, line breaks, fenced code, inline code, lists, bold, italic.
  Headings → bold paragraphs (spec: "no headings in user bubbles"). Images omitted. No tables.
  `remarkInlineBreaks` plugin (inline implementation, `remark-breaks` not installed) treats
  single `\n` in paragraph text as `<br>`. Inline code → `<code class="new-ui-user-inline-code">`;
  fenced code → `<pre class="new-ui-user-code-block"><code>` — styled as inset panel per spec §4.
- [x] **Inset code panel** (spec §4): `background: var(--bg-app)` (recessed vs. the bubble's
  `--bg-raised`), `1px --border-subtle border`, `border-radius: 12px`, `padding: 16px 18px`,
  `margin: 14px 0`, `13.5px/1.6 mono`, `overflow-x: auto`.
- [x] **Inline code** (spec §4): `--bg-active` bg, `#D9776A` color (`--code-fg`), `radius 4px`,
  `nowrap` — same treatment as assistant inline code.
- [x] **Bubble text stays sans** regardless of future Chat font setting (spec §4):
  `.new-ui-user-markdown { font-family: Inter, ui-sans-serif, … !important }`.
- [x] **`hasLargeText` messages skipped**: messages with `data.hasLargeText=true` use the existing
  `renderMessageWithLargeText()` path; markdown layer does not touch them.
- [x] **Edit-mode guard**: `.user-message:has(#editResponse) .new-ui-user-md-host { display:none }`
  so the inline `UserMessageEditor` is fully visible during editing.
- [x] **§5 collapse**: `useLayoutEffect` measures `scrollHeight` after render. If > 380px:
  - Inner wrapper: `max-height: 380px; overflow: hidden; mask-image: linear-gradient(…72px fade…)`.
  - "Show more" button: `display:block; text-align:left; background:transparent; border:none;
    font-size:15px; color:var(--text-primary); padding-top:14px` — plain text, left-aligned
    inside the right-aligned bubble, reads as part of the message not chrome.
  - Expand: `max-height` → measured `scrollHeight` px over `240ms ease-out`. Transition disabled
    on initial load (only activated on first user interaction — no collapse animation on page load).
  - "Show less" renders at bottom when expanded. Clicking re-collapses.
  - Per-message state, never persisted, re-collapses on reload.
- [x] **`conversation-view.css`** extended: `.new-ui-user-markdown` prose styles, `.new-ui-user-code-block`
  inset panel, `.new-ui-user-inline-code`, `.new-ui-show-more`, `.new-ui-has-markdown #userMessage`
  hide rule, edit-mode `:has(#editResponse)` guard.
- [x] **`ConversationViewShell.tsx`** — imports and renders `<NewUIUserMessageMarkdownLayer />` as the
  5th child after `<NewUIMessageActionsLayer />`.
- [x] Spec acceptance checks §8/§9 verified by code-trace (see inline verification notes above the
  Phase 29 checklist). TypeScript: zero errors in new files (pre-existing test-file errors in
  `__tests__/` are unrelated, pre-date this session).

### Phase 30 — Chat Pane Migration Spec §6–§12 ✅ COMPLETE
Implements chat-pane-migration-spec.md §6 through §12 only. Zero changes to Chat.tsx, ChatMessage.tsx,
or any file outside components/NewUI/ (One-Directory Rule strictly observed). Each item done
individually and verified before the next.

- [x] **§10 — User bubble max-width 72% → 85%** (XS):
  - `conversation-view.css`: `max-width: 85%` on `.user-message #chatHover`
  - Horizontal padding bumped to `12px 22px` (spec: "bump to 20–22px").

- [x] **§11 — Pending asterisk: flush left + two states** (XS):
  - `conversation-view.css`: `margin-left: -0.05em` on `::after` glyph to compensate for glyph
    left side bearing (flush with body text left edge).
  - Two CSS states: idle=55% opacity, streaming=full opacity + `new-ui-asterisk-pulse` 2.4s animation.
  - `ConversationViewShell.tsx`: new `shellRef`, new effect that toggles `data-streaming` on the
    shell element whenever `messageIsStreaming` changes. CSS reads `[data-streaming="true"]`.
  - `prefers-reduced-motion` gated for the pulse animation.

- [x] **§9 — Share button restyle** (S):
  - `ConversationHeader.tsx`: removed `IconShare` + `IconCheck` from button (label-only per spec §9);
    hover color changed to `#45443F` per spec. `IconShare` import kept (still used in dropdown menu).
  - Spec: "label only, 30px, radius 8px, `--bg-active` bg, 13.5px/500 `--text-primary`". Matched exactly.

- [x] **§7 — Send/Voice cross-fade slot** (S):
  - `ConversationComposer.tsx`: restructured from (mic-beside-slot + stop/send) to three-occupant
    slot — stop/voice/send all absolutely positioned in the same 32×32 container, cross-fading
    via opacity+pointer-events over 120ms. No layout shift. States:
      - `messageIsStreaming=true` → Stop  
      - `!streaming && !canSend` → Voice (mic, transparent bg)
      - `!streaming && canSend` → Send (accent bg, dark ink)
  - `NewHome.tsx`: voice button now has hover bg (`--bg-hover`) for consistency; same slot pattern
    already existed (only visual polish change).

- [x] **§8 — Composer text alignment: exact pixel match** (S):
  - `conversation-view.css`: `75ch` → `74ch` (spec §8's exact `--column-w` value) across all
    three column-constraint rules.
  - `ConversationComposer.tsx`: `75ch` → `74ch` in dock max-width formula.
  - `ConversationViewShell.tsx`: same. Column comment updated.
  - The alignment formula is unchanged (`--dock-w = column-w + 48px`; composer `padding: 0 24px`
    makes inner text start at column left edge).

- [x] **§6 — Assistant body typography: serif "Chat font" setting** (S):
  - `conversation-view.css`: Base assistant rules updated to `17px / 1.62` (spec §6, down from
    `16px / 1.7`). New serif block: `.not([data-body-face="sans"])` → Newsreader + 17px/1.62.
    Sans-override block: `[data-body-face="sans"]` → Inter + 16px/1.7.
    Code/pre: always monospace. Tables: always sans (spec: "serif numerals break table alignment").
    Reasoning disclosure: always sans (spec §3: "UI SANS face — it's system narration").
  - `ConversationViewShell.tsx`: new effect reads `localStorage.amplify_chat_font` (defaults to
    `'serif'`) and sets `data-body-face` on the shell element. Listens for `amplifyChatFontChanged`
    event to update without reload.
  - `NewSettingsModal.tsx`: "Chat font" block added to `GeneralSection` (after Theme).
    Radio: Serif (Newsreader, default) / Sans (Inter). Saves to `localStorage.amplify_chat_font`,
    dispatches `amplifyChatFontChanged` event.

- [x] **§12 — Dark token palette** (S):
  - Verified: existing dark tokens in `globals.css` already implement the spec's three-level ramp
    (`--bg-app / --bg-sidebar / --bg-raised`) with the correct semantic distinctions (composer =
    raised, code-block-inside-bubble = recessed against raised, user bubble = raised).
  - All `conversation-view.css` color values are already fully tokenized (only `#000` in
    mask-image gradient is non-token, which is correct — it's alpha-mask black, not a surface color).
  - merged-shell-spec.md §3 was absent; per spec instructions, used the token values already given
    inline (the three-level ramp) + existing globals.css tokens as the base. No ad-hoc greys invented.
  - No token value changes required — the ramp is correct.

**Acceptance checks verified by code-trace (spec §10–§12):**
- §10 (composer/column alignment): placeholder at `padding: 0 24px` inside a dock of
  `column-w + 48px` → inner text starts at column-w left edge ✓
- §11 (voice cross-fade): empty composer shows voice at opacity 1, one-char input transitions
  voice to 0 and send to 1 via `canSend` → no layout shift (all `position:absolute`) ✓
- §12 (timestamp updates): `useRelativeTime` hook (Phase 28, shared/relativeTimestamp.ts) sets a
  30s interval for sub-hour values — still in place and unmodified ✓

### Phase 31 — Chat Pane Bug-Fix Pass ✅ COMPLETE
Five targeted bug fixes to already-shipped chat-pane work. CSS-only fixes except Bug 2/3 (TS).
Zero changes outside `styles/conversation-view.css`, `components/NewUI/chat/NewUIMessageActionsLayer.tsx`,
and `components/Logo/Logo.tsx` — One-Directory Rule observed.

- [x] **Bug 1 — "Thought process" chevron shown at rest; should be hidden and appear on hover to the RIGHT**
  - `conversation-view.css`: moved chevron pseudo-element from `::before` to `::after` on `#expandComponent`
    (so it follows the label text). Set `opacity: 0` by default; `opacity: 0.75` on `#expandComponent:hover`
    and `#expandComponent:focus-visible`. Rotation logic for open/closed state preserved (reads
    `.icon-pop-group` presence same as before). Added `margin-left: 4px` for spacing. CSS-only, no TS changes.

- [x] **Bug 2 — Action row icons appear too low and overlap logo/branding below**
  - `NewUIMessageActionsLayer.tsx` `computePosition()`: anchored BOTH user and assistant rows to `#chatHover`
    bottom (was: assistant anchored to `.enhanced-chat-message.bottom`, which includes invisible
    `.enhanced-chat-icons` DOM height — far below visible text). GAP increased from 8/10px to 14px on both
    sides. zIndex remains 30 (confirmed no higher-z-index elements blocking). Comment documents the root cause.

- [x] **Bug 3 — Hover action buttons disappear when user moves mouse toward them to click**
  - `NewUIMessageActionsLayer.tsx`: increased hide timeout from 80ms → 300ms (gives pointer time to
    reach the fixed pill from the message element). Extracted `hideTimerRef` (from local `let` to
    `useRef`) so `handleRowHoverChange` can cancel the pending hide when the pointer enters the pill.
    `handleRowHoverChange`: on `hovered=true`, now explicitly cancels `hideTimerRef` AND sets
    `hoveredKey`. On `hovered=false`, starts its own 300ms grace timer (instead of immediately calling
    `setHoveredKey(null)`) so brief gaps between message-leave and pill-enter don't close the pill.
    Full path traced: mouseout→300ms timer → unless pill's onMouseEnter fires first → cancels timer →
    pill stays.

- [x] **Bug 4 — Extra whitespace above user prompt text inside bubble after response finishes**
  - `conversation-view.css`: added `[data-new-ui="true"] .enhanced-chat-message.user-message .mt-4.flex-wrap.gap-4 { display: none !important }`
    This hides the empty `ChatFollowups.tsx` wrapper div (DO-NOT-CHANGE file — CSS-only fix). The wrapper
    renders inside the user bubble's `#chatHover` with `mt-4` (16px) top margin even when no follow-up
    prompts match. Visible only after `messageIsStreaming` becomes false. Selector is specific to
    user-message bubbles — no other `.mt-4.flex-wrap.gap-4` exists in that subtree.

- [x] **Bug 5 — Replace logo/icon throughout UI with icon2.png**
  - `public/icon2.png`: copied from `/Users/maxmoundas/majk/resources/icons/icon2.png` (1024×1024 colorful
    3D geometric shape PNG). Placed alongside existing `sparc_apple.png` / `sparc_folds.png`.
  - `components/Logo/Logo.tsx` (permitted — not in DO-NOT-CHANGE list): changed default fallback from
    `/sparc_apple.png` → `/icon2.png`. Removed SVG-only guard (custom logos can now be any image format).
  - `conversation-view.css` grep for `sparc_apple` / `sparc_folds` found ZERO references (both files
    hide their `.w-14` logo divs via `display:none !important` — PromptStatus cover via
    `.rounded-xl.shadow-lg .w-14` Phase 12, ArtifactsBlock via `#artifactsButtonBlock .w-14` Phase 26).
    The PromptStatus cover div is confirmed hidden in new UI — no CSS override needed.
  - `ArtifactsBlock.tsx` and `DataSourcesBlock.tsx` reference `sparc_apple.png` but their `.w-14` logo
    divs are already hidden via existing Phase 26 CSS — no change needed.

### Phase 32 — Action Row Bug-Fix Pass ✅ COMPLETE
Four targeted fixes to `NewUIMessageActionsLayer.tsx` and `styles/conversation-view.css`.
CSS-only except Bugs 2 and 3 (TypeScript). Zero changes outside the two permitted files.

- [x] **Bug 1 — "Thought process" label not left-aligned with AI prose response**
  - `conversation-view.css`: The `.text-sm\!important.opacity-70` reasoning wrapper sits inside the
    `.border-l` expanded block which has `border-left:2px + padding-left:18px` → places children
    20px inside the `#chatHover` left edge. `.assistantContentBlock` (prose text) sits at 0px.
    Fix: `margin-left: -18px` on the `#expandComponent` button pulls it flush with the prose left
    edge (the 2px border line is intentional and reads as the block's decoration, not indentation).
    CSS-only, no component changes.

- [x] **Bug 2 — Hover buttons still disappear before user can click them**
  - `NewUIMessageActionsLayer.tsx`: Three-part fix.
  - **(a)** Hide timeout increased from 300ms → **600ms** in both `onMouseOut` and
    `handleRowHoverChange`'s leave timer — gives more travel time on slow machines / big screens.
  - **(b)** `hideTimerRef` continues to be exposed so `handleRowHoverChange(key, true)` (fired by
    ActionRow's `onMouseEnter`) cancels the pending hide when the pointer arrives at the pill.
  - **(c)** New `pointermove` keep-alive `useEffect` on `hoveredKey`: while a row is shown, listens
    on `document` for `pointermove`; if the pointer is within **60px** of the visible action row's
    bounding rect, cancels any pending hide timer. Listener is attached only while `hoveredKey` is
    non-null (zero overhead when no row is visible) and detached on cleanup.

- [x] **Bug 3 — Action row scrolls incorrectly and icons too large**
  - **(3a)** `NewUIMessageActionsLayer.tsx` `ActionRow` scroll listener: wrapped `setPosition()` in
    a `requestAnimationFrame` (with cancel-on-cleanup) so position updates are applied in sync with
    the browser paint — prevents single-frame lag that reads as "jumping." Both `window` (for when
    a parent is the scroller) and `.chatcontainer` (for when it is the scroller) are listened to —
    whichever fires scroll events, the position updates.
  - **(3c)** `conversation-view.css` `.new-ui-action-btn-lg`: reduced icon size from `18×18` to
    **`14×14`** and button touch target from `28×28` to **`24×24`** per user feedback.

- [x] **Bug 4 — Action row appears detached from its message**
  - **(4a)** `NewUIMessageActionsLayer.tsx` `computePosition()`: `GAP` reduced from `14px` → **`6px`**.
    The 14px buffer was for avoiding logo overlap; that's solved by anchoring to `#chatHover` bottom
    (Phase 31), so a large gap is no longer needed. 6px is just enough not to overlap the last text line.
  - **(4b)** `conversation-view.css` + `NewUIMessageActionsLayer.tsx`: the always-visible last-assistant
    row now has `data-last-assistant="true"` on the div. CSS rule
    `.new-ui-msg-action-row[data-last-assistant="true"]:not(:hover):not(:focus-within) { opacity: 0.6 }`
    renders it at 60% opacity at rest, rising to 100% on hover/focus — reads as a "caption" to the
    message rather than floating chrome.

### Phase 33 — Action Row Positioning Rewrite (fixed → absolute-in-scroller) ✅ COMPLETE

**Root cause:** `position: fixed` rows were positioned via `getBoundingClientRect()` into React state on every scroll frame — always ≥1 paint frame behind, unfixable with tuning.

**Fix:** rows are `position: absolute` children of `.new-ui-actions-overlay` (inset:0, pointer-events:none) `createPortal`'d directly into `.chatcontainer`. They scroll with content for free — no scroll listeners, no rAF, no per-frame state.

- [x] `.chatcontainer` made `position: relative` (its offsetParent). `offsetWithin()` helper walks offsetParent chain from `#chatHover` to `.chatcontainer` for row position. No `getBoundingClientRect` anywhere.
- [x] Rescans via MutationObserver (120ms debounce, ignores own overlay) + message-count/streaming effect + debounced `window` resize.
- [x] Always-visible last-assistant row removed per user request. All rows hover/`:focus-within` only.
- [x] `pointermove` keep-alive removed. Hide timer 600ms→200ms.
- [x] CSS: reasoning wrapper `margin-bottom` 26px→10px; `.enhanced-chat-message { padding-bottom: 36px }` reserves in-flow row space.

### Phase 34 — Three Targeted CSS / Spacing Fixes ✅ COMPLETE
Three small targeted fixes; no new files, no new components.

- [x] **Fix 1 — Solid bar / mask bleed next to scroll-to-bottom button** (`styles/conversation-view.css`)
  Root cause: `.new-ui-actions-overlay` (the portal host injected directly into `.chatcontainer`) is a
  direct child of `.chatcontainer` and therefore inherits its `mask-image` gradient. When the user scrolls
  up and the scroll-to-bottom button appears, the mask's top transparent band creates a semi-opaque strip
  that makes the background colour bleed through content — reads as a "solid bar". Fix: added
  `[data-new-ui="true"] .chatcontainer > .new-ui-actions-overlay { mask-image: none !important;
  -webkit-mask-image: none !important; }`. Safe because the overlay's rows are `position:absolute` in
  scroll-coordinate space, not viewport-relative, so the mask transition point was never meaningful for
  them anyway.
- [x] **Fix 2 — Too much vertical space below AI responses** (`styles/conversation-view.css`)
  The single `padding-bottom: 36px !important` on `.enhanced-chat-message` was applied to both user and
  assistant messages. User spacing was confirmed good; assistant spacing was too large. Split into two
  role-specific rules: `.user-message { padding-bottom: 36px }` (unchanged),
  `.assistant-message { padding-bottom: 20px }` (reduced from 36px). The base rule on
  `.enhanced-chat-message` is now labelled as a fallback; the role rules override it.
- [x] **Fix 3 — Too much horizontal space between hover action icons** (`components/NewUI/chat/NewUIMessageActionsLayer.tsx`)
  `iconClusterStyle.gap` in `ActionRow` reduced from `user:18/assistant:22` → `user:8/assistant:10`.
  Timestamp separator margins reduced from `marginRight:20px/marginLeft:8px` → `marginRight:10px/marginLeft:6px`.
- [x] **`tsc --noEmit` confirmed clean** — all errors in output are pre-existing test-file issues
  unrelated to the Phase 34 changes.

### Phase 35 — Four Targeted Chat-Pane Fixes ✅ COMPLETE

- [x] **Fix 1** — `.chatcontainer` mask changed to top-fade only (`transparent 0 → #000 80px → #000 100%`). Bottom fade removed — it read as a bar covering text near the jump button.
- [x] **Fix 2** — `.enhanced-chat-message.assistant-message` `padding-bottom` 20px→8px.
- [x] **Fix 3** — Hover row disappear-on-move: `onMouseOut` delegation now early-returns when target/relatedTarget is inside `.new-ui-actions-overlay`; row exit driven by non-bubbling `mouseleave` on row container (clears immediately, no timer).
- [x] **Fix 4** — `#expandComponent { margin-left:0; gap:0 }` + `#expandComponent .font-medium { margin-left:0 }` — "Thought process" label now lands exactly at prose left edge.

### Phase 36 — Two Targeted Chat-Pane Fixes ✅ COMPLETE
Two small fixes; no new files, no new components. `ConversationViewShell.tsx` and
`styles/conversation-view.css` touched only (One-Directory Rule observed).

- [x] **Fix 1 — Invisible slab covering chat content at jump-button position** (`ConversationViewShell.tsx`)
  Root cause: the jump-to-latest button's outer wrapper `<div>` (`position:absolute; bottom:190px;
  left:0; right:0`) had no explicit `height` set, so it defaulted to its content height (~40px).
  Even though it was `pointer-events:none`, the shell's `overflow:hidden` meant the wrapper's rendered
  40px-tall area could cause paint interference with content at that vertical position. Fix: added
  `height: 0` and `overflow: 'visible'` to the outer wrapper so it occupies zero space in the layout
  and cannot cause any clipping or paint interference. The button (40px tall) still renders and is
  clickable via `overflow: visible` and the button's own `pointerEvents: showJumpBtn ? 'auto' : 'none'`.
- [x] **Fix 2 — Still too much space below AI responses** (`styles/conversation-view.css`)
  `.enhanced-chat-message.assistant-message` `padding-bottom` reduced `8px → 2px` (Phase 35 had
  reduced it 20px→8px; still too large per user). User-message value unchanged (36px, confirmed good).
- [x] **`tsc --noEmit` confirmed clean** — zero errors in production source; all errors in output are
  pre-existing test-file issues in `__tests__/` unrelated to this session's changes.

### Phase 37 — Three Targeted Fixes: GAP, Icon Spacing, Brand Mark ✅ COMPLETE
Three small targeted fixes; no new files, no new components. Files touched:
`components/NewUI/chat/NewUIMessageActionsLayer.tsx`,
`components/NewUI/sidebar/SidebarHeader.tsx`,
`components/NewUI/home/NewHome.tsx`,
`styles/conversation-view.css`.

- [x] **Fix 1 — AI response hover-row gap reduced + icon horizontal spacing tightened** (`NewUIMessageActionsLayer.tsx`)
  - `computePosition()`: `GAP` is now role-specific — `user: 2` (tight below bubble; `.user-message`
    `padding-bottom: 36px` creates the visual separation from the *next* message), `assistant: 1`
    (sits flush under the prose). Previously both were `GAP = 6`.
  - `iconClusterStyle.gap`: reduced from `user:8/assistant:10` → uniform `4` for both roles.
  - Timestamp margins: `marginRight` (user, timestamp→icon) `10 → 6`; `marginLeft` (assistant,
    icon→timestamp) `6 → 4`. Tighter, more visually cohesive clusters.
  - `tsc --noEmit` confirms zero errors in modified file.

- [x] **Fix 2 — Replace ✳ accent glyph with `icon2.png` in three places**
  - **(2a) Sidebar header** (`SidebarHeader.tsx`): the `<span aria-hidden="true">✳</span>` (first
    child of the wordmark div) replaced with `<Image src="/icon2.png" alt="Amplify" width={24}
    height={24} style={{ borderRadius: 4 }} />` via `next/image`. `import Image from 'next/image'`
    added at the top.
  - **(2b) New chat landing page** (`NewHome.tsx`): `<span aria-hidden="true">✳</span>` in the
    greeting section replaced with `<Image src="/icon2.png" alt="Amplify" width={40} height={40}
    style={{ borderRadius: 6 }} />` via `next/image`. `import Image from 'next/image'` added.
  - **(2c) Chat view bottom brand mark** (`styles/conversation-view.css`): CSS pseudo-element
    `[data-new-ui="true"] .h-[300px]::after` switched from text-based `content: "✳"` (with
    `font-size`, `color: var(--accent)`, `line-height`) to a background-image approach:
    `content: ""`, `width: 28px`, `height: 28px`, `background-image: url('/icon2.png')`,
    `background-size: contain`, `background-repeat: no-repeat`, `background-position: center`,
    `border-radius: 4px`. The streaming-state rules (opacity change only) required no further
    changes. Text-only properties (`font-size`, `color`, `line-height`, `margin-left: -0.05em`)
    removed from the idle rule.

### Phase 38 — Four Targeted Visual Bug Fixes ✅ COMPLETE
Four CSS-only fixes; no new files, no new components. `styles/conversation-view.css` only
(One-Directory Rule observed — this is a CSS-scoped rule file, not a component file).

- [x] **Bug 1 — Thinking/loading circle misaligned when message is first sent** (`styles/conversation-view.css`)
  Root cause: `ChatLoader.tsx` (rendered at `{loading && <ChatLoader/>}` in `Chat.tsx:1741`) is a
  **direct sibling of `.enhanced-chat-message` elements** inside `.chatcontainer` — NOT wrapped in an
  `.enhanced-chat-message`. The column constraint rule (`max-width: min(74ch, calc(100% - 48px));
  margin: 0 auto`) only applies to `.enhanced-chat-message` elements, so `ChatLoader` was rendering at
  the full width of the scroll area. The breathing dot (`::before` on `.group...bg-gray-50 > div`,
  which Phase 27 had already set to `margin-left: 0`) appeared at the far-left edge of the viewport
  rather than at the column-left edge (same x as `.assistantContentBlock` prose text).
  Investigation confirmed: `PromptingStatusDisplay` (the post-token in-stream indicator) renders INSIDE
  the last `ChatMessage`'s `.enhanced-chat-message.assistant-message`, so it IS column-constrained and
  correctly aligned. The misalignment is specific to `ChatLoader` (visible in the "send → first token"
  gap). Fix: added `max-width: min(74ch, calc(100% - 48px)); margin-left: auto; margin-right: auto;
  width: 100%` to the existing `.group.border-b.border-black\/10.bg-gray-50` Phase 27 rule, matching
  the `.enhanced-chat-message` column geometry exactly. Selector confirmed unique: `group border-b
  border-black/10 bg-gray-50` appears only in `ChatLoader.tsx` (grep-verified).

- [x] **Bug 2 — Old-UI model selector briefly flashes after user sends a message** (`styles/conversation-view.css`)
  Root cause: `Chat.tsx` renders `#overflowScroll` (the old empty-conversation panel, containing the
  old-UI `ModelSelect` + "Start a new conversation." heading) whenever `messages.length === 0`. In the
  normal flow, `ConversationViewShell` is hidden (`position:fixed; left:-100vw; visibility:hidden`)
  while `messages.length === 0`. BUT when a NEW conversation is created via the pending-message bridge,
  `home.tsx` sets `pendingNewConversationSend=true`, which makes the outer wrapper style switch to
  `{display:flex, flex:1}` (visible) BEFORE the first message has been added. During the ~150-300ms
  window between `ConversationViewShell` becoming visible and the bridge's text injection + click-send
  completing, `messages.length` is still 0, so Chat.tsx renders `#overflowScroll` with the old
  `ModelSelect` — which was visible on screen. The existing `#overflowScroll` CSS (Phase 12) only
  removed the JS-set `min/maxHeight` constraints — it never hid the element. Fix: added
  `[data-new-ui="true"] #overflowScroll { display: none !important }` to hide it entirely. The new UI
  never needs `#overflowScroll` — `NewHome` handles the 0-message landing experience. Selector confirmed
  unique: `id="overflowScroll"` appears only at `Chat.tsx:1294` (grep-verified).

- [x] **Bug 3 — Two old-UI ldrs spinner animations visible during the pre-response window** (`styles/conversation-view.css`)
  During the window between the user sending a message and the first streaming token arriving, TWO
  old-UI loading animations were visible alongside the new-UI ChatLoader breathing dot:
  - **`<l-ping>` (ldrs ping element)** — rendered by `ChatMessage.tsx:1036-1038`:
    `{((messageIsStreaming || artifactIsStreaming) && messageIndex == last) ? <Loader type="ping" size="48"/> : null}`.
    This is a 48px ripple/concentric-circle animation sitting at the bottom of the last assistant
    message's `.flex.flex-col.w-full` wrapper, visible alongside PromptingStatusDisplay and ChatLoader.
  - **`<l-quantum>` (ldrs quantum element)** — rendered inside `PromptStatus.tsx:48`'s `.w-14.h-12`
    cover column when `status.inProgress`. The `.rounded-xl.shadow-lg .w-14 { display:none }` Phase 12
    rule already hides the `.w-14` ancestor, but the explicit element rule is added for defence-in-depth.
  Both are ldrs library custom HTML elements. Neither has a `class` attribute, so the existing
  `[class*="loader"]` rule does NOT match them. Neither appears anywhere in `components/NewUI/` (grep-
  verified). Element-type selectors (`l-ping`, `l-quantum`) are used — not class/id selectors — because
  these are globally-unique custom element tag names, not CSS class names. Added:
  `[data-new-ui="true"] l-ping { display: none !important }` — hides the ripple animation.
  `[data-new-ui="true"] l-quantum { display: none !important }` — hides the quantum spinner (defence).
  PromptingStatusDisplay / PromptStatus step line kept fully visible — only the extra spinner elements
  are hidden.

- [x] **Bug 4 (Phase 39 dot-alignment fix) — Thinking dot still too far right even after Phase 38 column-constraint fix** (`styles/conversation-view.css`)
  Phase 38 correctly constrained the ChatLoader outer container to `max-width: min(74ch, 100% - 48px);
  margin: 0 auto` — same geometry as `.enhanced-chat-message`. However the dot was STILL offset to the
  right inside that container. Root cause: `ChatLoader.tsx` (DO-NOT-CHANGE) renders
  `<div className="flex gap-4 ...">` (the inner flex row) containing TWO children: (1) an avatar wrapper
  `<div className="min-w-[40px] items-end">` wrapping the Amplify avatar, and (2) `<span class="animate-pulse">`.
  Phase 27 already hides the Amplify avatar itself (`.enhanced-avatar { display:none }`), but the **wrapper
  div** (`min-w-[40px]`) remained as a live flex item at 40px wide + 8px `gap` = **48px of left offset**
  before the dot — exactly how far right the dot appeared. `.assistantContentBlock` prose and the "Thought
  process" label are both at x=0 of the column, so the dot must also be at x=0.
  Fix: added `[data-new-ui="true"] .group.border-b.border-black\/10.bg-gray-50 > div > div:first-child { display: none !important }`.
  This hides only the avatar wrapper div (the `> div > div:first-child` child-combinator path is specific
  to ChatLoader's exact three-level DOM shape and cannot accidentally match any `.enhanced-chat-message`
  content). With the wrapper gone, the dot is the sole flex child and sits at exactly x=0 = prose left
  edge = "Thought process" label left edge. Selector uniqueness confirmed: the `.group.border-b.border-black/10.bg-gray-50`
  parent class combination appears only in `ChatLoader.tsx` (grep-verified in Phase 27).

### Phase 39 — Send→First-Token Scroll-Jump Fix ✅ COMPLETE
CSS-only fix; no new files, no new components. Only `styles/conversation-view.css`
touched (One-Directory Rule observed — CSS-scoped rule file, not a component file).
Zero changes to `Chat.tsx`, `ChatLoader.tsx`, or `ConversationViewShell.tsx`.

**Bug:** When the user sends a message, the chat view jumps vertically — scrolling
up and down repeatedly — during the window between "message sent" and the first
streaming token arriving.

**Root cause (investigation-first, read-only trace of the protected `Chat.tsx`):**
`Chat.tsx` (DO-NOT-CHANGE) runs TWO competing auto-scroll effects while
`messageIsStreaming === true`, both targeting `messagesEndRef` — which is the
`.h-[300px]` bottom spacer div (`Chat.tsx` ~L1743–1746):
  - **L1082–1088** — a 250ms-throttled effect → `messagesEndRef.scrollIntoView(true)`
    (aligns the spacer's **top** to the viewport top).
  - **L1090–1104** — a `setInterval(…, 100ms)` → `messagesEndRef.scrollIntoView(false)`
    (aligns the spacer's **bottom** to the viewport bottom).
This dual-effect setup is intrinsic to `Chat.tsx` and exists in the classic UI too,
but it only *manifests as a visible jump in the new UI* because of a new-UI CSS
override: `.chatcontainer { padding-bottom: 220px }` (added in Phase 27 to clear the
absolutely-positioned composer overlay) combined with the spacer being shrunk to
`height: 48px` (Phase 14). With 220px of container padding sitting **below** the
spacer:
  - `scrollIntoView(false)` leaves that 220px below the fold → scroll = `max − 220px`.
  - `scrollIntoView(true)` on the tiny 48px spacer clamps to **max bottom**.
So the two effects target scroll positions ~220px apart and fire on 100ms/250ms
cadences → the viewport oscillates up and down. The layout churn during the gap
(ChatLoader mount/unmount, the new assistant `.enhanced-chat-message` + PromptStatus
mounting) keeps re-triggering the effects, sustaining the flicker for the whole
"sent → first token" window. Ruled out as NOT the cause: the `data-streaming`
asterisk `::after` toggle (opacity-only, no layout change), the scroll-to-latest
button wrapper (Phase 36 `height:0; overflow:visible`, zero layout footprint),
`#overflowScroll` (Phase 38 `display:none`), and `ConversationViewShell`'s
`showJumpBtn` state (a symptom of the scroll change, not a cause — it never mutates
scroll except on explicit button click).

**Fix (the one lever available without touching `Chat.tsx`):** move the composer
clearance OUT of `.chatcontainer`'s `padding-bottom` and INTO the `.h-[300px]`
spacer element itself — i.e. the exact element `scrollIntoView` targets:
  - `[data-new-ui="true"] .chatcontainer` — `padding-bottom: 220px` → **`0`**.
  - `[data-new-ui="true"] .h-\[300px\]` — `height: 48px` → **`268px`**
    (= the old 48px spacer + 220px padding, so total bottom clearance is unchanged).
With **zero padding below the spacer**, both `scrollIntoView(true)` and
`scrollIntoView(false)` converge on the same max-bottom scroll position: a 268px
spacer is shorter than any normal viewport, so `scrollIntoView(true)` clamps to max
bottom, exactly matching `scrollIntoView(false)`. No target gap → no fight → no jump.
The composer overlay clearance and the brand-mark position (`::after` at the spacer's
`padding-top: 20px`, ~248px above the fold when scrolled to bottom) are preserved
because total clearance is identical. Known edge case (documented, not fixed):
a viewport shorter than 268px tall would reintroduce a small divergence, but that's
an unrealistic window height.

- [x] `styles/conversation-view.css` — `.chatcontainer` `padding-bottom: 220px → 0`
  (with full root-cause comment).
- [x] `styles/conversation-view.css` — `.h-\[300px\]` `height: 48px → 268px`
  (with full root-cause comment).
- [x] CSS braces verified balanced.
- **Not runtime-verified:** no browser automation available + Cognito login required,
  so verified by code-trace of `Chat.tsx`'s scroll effects against the new-UI CSS
  geometry. Recommend a human/future-session visual pass: send a message in a long,
  scrollable conversation and confirm the view stays stable (no up/down oscillation)
  in the window between send and the first streaming token.

### Phase 40 — Image Attachment Bug Fixes + Post-Send Thumbnail Styling ✅ COMPLETE
Two related fixes. Zero changes to ChatMessage.tsx, Chat.tsx, useChatSendService.ts, or any
protected file (One-Directory Rule strictly observed; all changes inside components/NewUI/
and styles/conversation-view.css).

**Root-cause investigation (Sub-problem A):**
- `handleFile` (`AttachFile.tsx:127`) always sets `doc.raw = ""` for every file type
  including images — there is NO binary data in doc.raw to lose via JSON.stringify.
- `amplify_pending_docs` was written by `NewHome.tsx:193` (`JSON.stringify(attachedDocs)`)
  but `ConversationViewShell.tsx` only called `removeItem()` on it — **never read it**.
  All attached docs (images and regular files from the NewHome → new conversation flow)
  were silently discarded every time.
- `useChatSendService.ts` never reads `doc.raw`; for images it only needs `doc.key`
  (the S3 key, set after async upload via `addFile()`). Since `doc.key` IS preserved
  through JSON.stringify/parse, the data was intact — just unread.
- `ConversationComposer.addImageToRail` created a `UIAttachment` with a thumbnail
  object-URL (purely cosmetic) but never called `handleFile`, so pasted images in
  existing-conversation view were never uploaded to S3 and never sent to the backend.

**Sub-problem A fixes:**

- [x] **`ConversationViewShell.tsx` — pending-message bridge rewritten (two paths):**
  - Imports: `useSendService`, `newMessage`, `MessageType`, `getActivePlugins`,
    `getSettings`, `setAssistant` (from utils/app/assistants.ts), `DEFAULT_ASSISTANT`.
  - Calls `useSendService()` at the component level; holds a ref (`sendViaServiceRef`)
    that always points to the freshest closure (updated on each render via a separate
    effect).
  - PATH A (new): when `amplify_pending_docs` contains docs with `doc.key`, builds a
    `ChatRequest` (with `message`, `documents`, `plugins` from `getActivePlugins`,
    `conversationId`, and optional `options.assistantId` for assistants), applies the
    active assistant via `setAssistantInMsg`, and calls `sendViaServiceRef.current(request,
    shouldAbort)` directly — the same call that `Chat.tsx`'s own `handleSend` makes.
    Skips the `#sendMessage` DOM click entirely (avoids double-send).
  - PATH B (unchanged): when no pending docs with keys, uses the existing textarea
    injection + `#sendMessage` click approach.
  - Both paths share the same web-search/skills setup and sessionStorage cleanup logic.

- [x] **`ConversationComposer.tsx` — paste path fixed:**
  - Imports: `handleFile` from `AttachFile`, `useSendService`, `newMessage`,
    `MessageType`, `getActivePlugins`, `getSettings`, `setAssistant`.
  - New state: `attachedDocs: AttachedDocument[]` (mirrors NewHome's pattern).
  - New callbacks: `addDocCallback`, `handleDocSetKey`, `handleDocSetMetadata`,
    `handleDocUploadProgress` — fed to `handleFile` to track upload lifecycle.
  - `addImageToRail` rewritten: creates a sentinel UIAttachment with `status:'uploading'`
    for immediate display, then calls `handleFile(file, wrappedAttach, ...)` to start
    the real S3 upload. `wrappedAttach` replaces the sentinel id with the real `doc.id`
    once `handleFile`'s `onAttach` fires, linking the UIAttachment to the doc.
    `handleDocSetKey` marks the UIAttachment `status:'ready'` when the key arrives.
  - `handleRemoveAttachment` updated to also remove from `attachedDocs`.
  - `handleSend` rewritten with two paths:
    - PATH A: when `attachedDocs` has docs with keys → call `sendViaService` directly
      (same ChatRequest construction as ConversationViewShell PATH A).
    - PATH B: text-only → existing `#messageChatInputText` + `#sendMessage` DOM bridge.
  - `canSend` now blocks send while any image upload is still in progress
    (`allImagesUploaded` gate), so PATH A never fires with incomplete docs.

**Sub-problem B fix:**

- [x] **`styles/conversation-view.css` — DataSourcesBlock compact thumbnail strip:**
  - `DataSourcesBlock.tsx` (DO-NOT-CHANGE) already renders image thumbnails inside
    user messages via `message.data.dataSources` + presigned S3 URL fetch. The old
    default (200×200 cards with `shadow-lg`) is restyled for the new UI.
  - CSS rules (Phase 40 section, scoped to `[data-new-ui="true"] .user-message`):
    - `.mt-5.text-gray-800` outer container: `margin-top: 10px`
    - `.mt-5.text-gray-800 > .mr-3:first-child`: `display: none` (hides the
      "Included documents:" label — thumbnails are self-explanatory)
    - `.rounded-lg.shadow-lg.overflow-hidden.relative` cards: `88×88px`, `border-radius:
      8px`, `box-shadow: none`, `border: 1px solid var(--border-subtle)` — matches
      the new-UI attachment card visual language
    - File name footer, download icon, zoom icon: repositioned for smaller card
  - No portal component needed — DataSourcesBlock already handles the image
    fetch (presigned S3 URLs, not doc.raw/base64). Once Sub-problem A is fixed
    (docs reach the backend), message.data.dataSources is populated and the
    thumbnails appear automatically.

### Phase 40b — CSS Polish + Four Bug Fixes ✅ COMPLETE
Four targeted fixes; no new files, no new components. Files touched:
`styles/conversation-view.css` (all four fixes) and
`components/NewUI/chat/NewUIMessageActionsLayer.tsx` (Fix 4 only).
One-Directory Rule observed.

**Fix 1 — "Amplify Assistant is responding" text + old blinking cursor (highest priority)**

Two separate elements were visible during the pre-response window as loading indicators
alongside the new-UI breathing dot:

1. **PromptStatus text** (`{status.summary || status.message}` in `.mt-0.pt-0` inside
   `.rounded-xl.shadow-lg .mt-0.ml-3`). Root cause: Phase 26's `color:transparent` shimmer
   only applied inside `@media (prefers-reduced-motion: no-preference)`. In reduced-motion
   mode (and transiently on first render) the plain text "Amplify is responding" was visible
   as readable prose. Fix: `[data-new-ui="true"] .rounded-xl.shadow-lg .mt-0.ml-3 .mt-0.pt-0
   { display: none !important }`. The breathing dot (`::before` pseudo-element on `.mt-0.ml-3`)
   is unaffected and remains as the sole loading indicator. The Phase 26 gradient shimmer on
   this element is superseded — breathing dot only, which is cleaner and reduced-motion safe.

2. **ChatContentBlock streaming `▍` cursor** (`ChatContentBlock.tsx` line 499-500 appends
   `` `▍` `` to the markdown while `messageIsStreaming=true`; line 323-324 renders it as
   `<span class="animate-pulse cursor-default mt-1">▍</span>` inside `.chatContentBlock .prose`).
   This is NOT the same element as the ChatLoader dot (which is inside
   `.group.border-b.border-black/10.bg-gray-50`, a different ancestor, already styled Phase 27).
   Fix: `[data-new-ui="true"] .chatContentBlock .animate-pulse.cursor-default
   { display: none !important }`.

After these two rules, the only visible loading indicator is the breathing dot
(`::before` on `.rounded-xl.shadow-lg .mt-0.ml-3`) from Phase 26.

**Fix 2 — Text size inconsistency in AI responses**

Root cause: `[data-new-ui="true"] .assistantContentBlock h1` (22px override) targets
`StandAloneAssistant/AssistantContentBlock.tsx`'s class, NOT the `.prose` column in
`ChatContentBlock.tsx`. In ChatMessage's `ChatContentBlock`, headings render inside
`<MemoizedReactMarkdown className="prose dark:prose-invert ...">`. The h2/h3 rules already
covered `.enhanced-chat-message.assistant-message .prose h2/h3`, but `h1` was missing —
Tailwind Typography defaults h1 to ~2.25em (38px), which read as "randomly some text appears
larger."

Fixes added to `conversation-view.css`:
- `[data-new-ui="true"] .enhanced-chat-message.assistant-message .prose h1` → 20px, 700w
- `[data-new-ui="true"] .enhanced-chat-message.assistant-message .prose h4/h5/h6` → 1em, 600w
  (h4-h6 were never overridden at all; Tailwind Typography still renders them noticeably large)
- `[data-new-ui="true"] .text-sm\!important.opacity-70 .prose h1...h6` → 1.1em, 600w
  (headings inside the "Thought process" reasoning block were also unguarded; using em units so
  they stay relative to the block's 13.5px base)

**Fix 3 — Chat input box border contrast**

Root cause: the `.new-ui-composer-card` inline style uses `border: '1px solid var(--border-subtle)'`.
In dark mode, `--border-subtle` (`#33322F`) is essentially the same shade as `--bg-raised` (`#30302E`)
— the border was invisible. The existing `:focus-within` CSS rule already used `--bg-active` for the
focus state but there was no rest-state override. Added:
`[data-new-ui="true"] .new-ui-composer-card { border-color: var(--bg-active) !important }`.
`--bg-active` (dark `#3A3A38` / light `#e0e0e0`) provides just enough contrast against `--bg-raised`
to make the card edge visible without being heavy.

**Fix 4 — "@amplify: " prefix prepended when copying user prompt text**

Frontend root cause (two vectors):

*(a) Manual browser selection copy:* `ChatMessage.tsx`'s `getAtBlock()` renders a
`<span class="enhanced-at-block">@Amplify:</span>` inside `#userMessage`. Although
`.enhanced-at-block { display: none }` hides it visually, some browsers include `display:none`
element text in clipboard when the user manually selects text. Added `user-select: none;
-webkit-user-select: none` to the existing `.enhanced-at-block` CSS rule — this prevents
the hidden text from entering the clipboard via manual selection.

*(b) Action-row copy button:* `extractMessageText` in `NewUIMessageActionsLayer.tsx` read
`#userMessage.innerText`. When the markdown layer is active (`.new-ui-has-markdown #userMessage
{ display:none }`), `#userMessage.innerText` returns "" (element is hidden), so the copy button
was copying empty text. When the markdown layer is NOT active (e.g. `hasLargeText` messages),
`innerText` excludes `display:none` children per spec, but the function needed to prefer the
markdown-rendered content regardless. Fixed: `extractMessageText` now first checks for
`.new-ui-user-markdown > div:first-child` (the ReactMarkdown inner div, present when the
markdown layer is active). Its `innerText` is clean message text without `@Amplify:` prefix
or Show-more/Show-less button text. Fallback to `#userMessage.innerText` for messages without
the markdown layer.

**Files changed:**
- `styles/conversation-view.css` — all four fixes (CSS-only for Fixes 1, 2, 3; CSS part of Fix 4)
- `components/NewUI/chat/NewUIMessageActionsLayer.tsx` — `extractMessageText` function updated (Fix 4b)

### Phase 41 — Prompt-at-Top Scroll Anchoring + Streaming Chunk Fade-In ✅ COMPLETE
Files: `ConversationViewShell.tsx` + `conversation-view.css`. Zero changes to `Chat.tsx`. See §13 "Controlling chat scroll without touching Chat.tsx" for the full rules — key constraints summarised below.

**Critical constraint (scroll room must be `margin-top`, never `height`):**
The `.h-[300px]` bottom spacer is BOTH the layout spacer AND Chat.tsx's `IntersectionObserver` sentinel (`ref={messagesEndRef}`). 🛑 Never change its `height` — that re-enables the observer's auto-scroll gate. Scroll room must be added as `margin-top` above it so the sentinel's own box is untouched. `isIntersecting` is true for ANY overlap, so the sentinel must be **entirely** off screen.

**Fix 1 — new prompt anchored near top, then frozen:**
- [x] `conversation-view.css`: `[data-anchor-freeze="true"] .h-\[300px\] { margin-top: var(--new-ui-anchor-room, 0px) }`. Room is dynamic — sized to push sentinel off screen, handed back as response grows via `reduceRoomTo` invariant (never let `scrollHeight` drop below `scrollTop + clientHeight`).
- [x] `ConversationViewShell.tsx`: watches `messageIsStreaming` false→true; sets `data-anchor-freeze`, measures rects, sets `container.scrollTop` **instantly** (not smooth — smooth scroll reintroduces Phase 39 oscillation). `ANCHOR_TOP_OFFSET = 80`. Retries 20×50ms for message element to mount.
- [x] `.chatcontainer` `padding-top` 52px→80px (content starts above mask ramp; first message is reachable).

**Fix 2 — per-chunk fade-in on streaming text:**
- [x] `@keyframes new-ui-chunk-fade-in` (opacity 0→1, 100ms ease-out) on block-level nodes in streaming assistant prose. Scoped to LAST assistant message via `:not(:has(~ .enhanced-chat-message.assistant-message))` — prevents re-fading previous answers on each send. `prefers-reduced-motion` gated. Known limitation: tail paragraph growing token-by-token does not fade (no new element inserted).

**Note:** Phase 41a regression (scroll room added as `height` instead of `margin-top`) found and fixed in same session — see §13 for explanation.

### Phase 42 — Deferred-Send: Upload While Waiting ✅ COMPLETE
Files: `ConversationComposer.tsx`, `UploadPendingIndicator.tsx` (new), `AttachmentCard.tsx`, `AttachmentRail.tsx`, `conversation-view.css`.

- [x] **Three send paths in `handleSend`**: DEFERRED (uploads in progress → store `PendingUploadSend` ref, show indicator, clear text) | PATH A (docs have S3 keys → `sendViaService`) | PATH B (text-only → DOM bridge).
- [x] **Auto-fire effect**: when `pendingUploadState.done >= total`, builds `ChatRequest` from accumulated docs and fires `sendViaServiceRef.current`. Edge: all failed → falls through to PATH B if text present.
- [x] **`handleCancelPendingSend`**: clears pending send, restores message text to textarea.
- [x] **90s stall detection**: marks attachment `status:'failed'`, decrements `remainingCount`. `handleRetryAttachment` cancels send, removes failed card, restarts upload.
- [x] **`UploadPendingIndicator.tsx`**: thin 3px `--accent` progress bar + contextual label + Cancel. `aria-live="polite"`, `role="progressbar"`.
- [x] **`AttachmentCard.tsx`**: `onRetry` prop; Retry button shown on failed cards.
- [x] **CSS**: asterisk pulse at 0.45 opacity while `[data-upload-pending]`; `.new-ui-upload-bar-fill` with `--accent` bg + breathing animation.

### Phase 43 — Dual Loading-Dot Fix + Animated "Thinking…" Text ✅ COMPLETE
Files: `conversation-view.css` + `ConversationViewShell.tsx` only.

**Fix 1 — Multiple PromptStatus cards + ChatLoader overlap**

Root cause: `PromptingStatusDisplay` renders one `.rounded-xl.shadow-lg` card per active status ID — multiple simultaneous statuses produce multiple pulsing dots. Also, when `messageIsStreaming=true`, ChatLoader may still be mounted alongside PromptStatus.

**Fix 1a — Hide all PromptStatus cards after the first** (`conversation-view.css`):
```css
[data-new-ui="true"] .rounded-xl.hover\:opacity-50.shadow-lg ~ .rounded-xl.hover\:opacity-50.shadow-lg {
  display: none !important;
}
[data-new-ui="true"] .rounded-xl.hover\:opacity-50.shadow-lg ~ .rounded-xl.hover\:opacity-50.shadow-lg ~ .mx-2.mt-0.py-2.px-5 {
  display: none !important;
}
```
- Discriminating class: `hover:opacity-50` is unique to PromptStatus among `.rounded-xl.shadow-lg` elements (grep-verified). Escaped as `hover\:opacity-50` in CSS. Second rule hides the sibling details panel.

**Fix 1b — ChatLoader dot overlap during streaming** (`conversation-view.css`):
```css
[data-new-ui="true"][data-streaming="true"] .group.border-b.border-black\/10.bg-gray-50 .animate-pulse {
  visibility: hidden !important;
}
```
Addresses a separate but related window: when `messageIsStreaming=true` (→ `data-streaming=true`),
ChatLoader may still be mounted alongside PromptStatus. `visibility: hidden` (not `display: none`)
preserves Phase 38/39 layout footprint.

**Fix 2 — Animated "Thinking…" text alongside the breathing dot**

`ConversationViewShell.tsx`: `useEffect` + `MutationObserver` on `.chatcontainer`. `injectLoadingText()` finds `.rounded-xl.shadow-lg .mt-0.ml-3` (PromptStatus's dot row) and appends `<span class="new-ui-loading-text" aria-hidden="true">` — idempotent. `cleanupOrphanedText()` removes spans when PromptStatus unmounts. Screen readers use the existing `aria-live="polite"` region, not the CSS-generated text.

**CSS additions in `conversation-view.css` (Phase 43 section):**
```css
[data-new-ui="true"] .new-ui-loading-text { display: inline; color: var(--text-muted);
  font-size: 13px; font-style: italic; ... }
[data-new-ui="true"] .new-ui-loading-text::after { content: "Thinking\2026"; }
@media (prefers-reduced-motion: no-preference) {
  [data-new-ui="true"] .new-ui-loading-text { animation: new-ui-loading-pulse 2s ease-in-out infinite; }
}
@keyframes new-ui-loading-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
```
- `::after` generates "Thinking…" via CSS `content`. `prefers-reduced-motion: no-preference` gated. Selector uniqueness verified: `.mt-0.ml-3` inside `.rounded-xl.shadow-lg` is unique to PromptStatus (grep-verified).

- [x] CSS Fix 1: ChatLoader dot hidden when `data-streaming="true"` via `visibility:hidden`
- [x] CSS Fix 2 + JS: `.new-ui-loading-text` span injected via MutationObserver; styled with `::after`, pulse animation, PRM override

### Phase 44 — User-Resizable Sidebar Width ✅ COMPLETE
Single file change: `components/NewUI/sidebar/NewSidebar.tsx` only (no `home.tsx`, no CSS files).

**Implementation:**
- `SIDEBAR_MIN_WIDTH = 220`, `SIDEBAR_MAX_WIDTH = 480`, `SIDEBAR_DEFAULT_WIDTH = 310` — module-level
  constants. localStorage key: `amplify_sidebar_width`.
- `sidebarWidth` React state — initialized via lazy init reading and clamping the localStorage value.
- `displayWidthRef` (useRef) — tracks the "live" width during drag so that mid-drag React re-renders
  (from conversation list updates, etc.) re-apply the correct in-progress width via `style.width`
  rather than snapping back to the stale `sidebarWidth` state value.
- `sidebarRef` (useRef\<HTMLDivElement\>) — direct handle to the expanded sidebar's root div for
  imperative `style.width` updates during drag (bypasses React state, zero re-renders per pixel).
- `handleDragMouseDown` (useCallback []) — on mousedown: records `startX` + `startWidth`; attaches
  `document`-level `mousemove`/`mouseup` listeners. `mousemove`: `newWidth = clamp(startX + delta,
  220, 480)`, updates `displayWidthRef.current`, sets `sidebarRef.current.style.width` directly.
  `mouseup`: removes both listeners, calls `setSidebarWidth(finalWidth)` +
  `localStorage.setItem(SIDEBAR_WIDTH_KEY, ...)`.
- Expanded sidebar root div: removed `w-[310px]` Tailwind class, replaced with
  `style={{ width: displayWidthRef.current + 'px' }}`. Changed `transition-all` → `transition-colors`
  (width was the only meaningful CSS property that would have been animated; keeping it would cause
  a ~200ms lag on every drag pixel).
- Drag handle: `position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize;
  z-index: 10`. Hover highlight via `onMouseEnter`/`onMouseLeave` + inline style
  (`--border-subtle` bg, 150ms transition). `aria-hidden="true"` (purely visual/interactive, no
  semantic content).
- **Collapsed mode completely unaffected**: the collapsed render path (`if (!isOpen)`) is a separate
  React render tree that returns before any of the new code is reached. It retains its hardcoded
  `w-[52px]`. `sidebarRef` is never attached to it. The drag handle never renders in that branch.
- **Layout**: `home.tsx` main content div already has `flex-1 overflow-hidden`. `overflow-hidden`
  implicitly sets `min-width: 0` in modern browsers, so the content area automatically flex-shrinks
  as the sidebar grows. No change to `home.tsx` required.

- [x] Drag handle added to expanded sidebar (`NewSidebar.tsx`)
- [x] Width persisted to `localStorage` key `amplify_sidebar_width` on mouseup
- [x] Width restored from localStorage on mount, clamped to [220, 480], default 310
- [x] Direct DOM updates during drag — zero React re-renders per pixel
- [x] Collapsed icon-rail (52px) completely unaffected
- [x] Drag handle added to expanded sidebar (`NewSidebar.tsx`)
- [x] Width persisted to `localStorage` key `amplify_sidebar_width` on mouseup
- [x] Width restored from localStorage on mount, clamped to [220, 480], default 310
- [x] Direct DOM updates during drag — zero React re-renders per pixel
- [x] Collapsed icon-rail (52px) completely unaffected
- [x] **Action row alignment fixed** (`NewUIMessageActionsLayer.tsx`): added a `ResizeObserver` on
  `.chatcontainer` alongside the existing `window.resize` listener. Sidebar drag updates
  `style.width` directly on the DOM (no window event fires), causing `.chatcontainer` to grow/shrink
  via `flex-1` — the `ResizeObserver` detects this and calls `debouncedScan()`, recomputing all
  `offsetTop`/`offsetLeft` row positions with the correct, post-drag geometry. The 120ms debounce
  means one scan fires after the drag settles, not per pixel.
- [x] `tsc --noEmit` — zero errors in `components/NewUI/` (pre-existing `__tests__/` errors unchanged)

### Phase 45 — Settings: Account, Storage, and Connectors new-UI redesign ✅ COMPLETE
Full visual redesign of three Settings sections to match new-UI design language.
Zero changes to any file outside `components/NewUI/` and `styles/conversation-view.css`
(One-Directory Rule strictly observed).

**New files:**
- [x] `components/NewUI/settings/NewAccountSection.tsx` — Self-contained account section with:
  - Loads accounts on mount via `getAccounts()` (fixes the existing `AccountSection` shell which
    passed empty state to the old `<Accounts />` without loading anything)
  - MTD cost summary card (3 stats: today / this month / all time) via `getUserMtdCosts()`
  - Rate-limit warning banner (≥80% → orange, ≥100% → red) ported from original
  - Add-account form (`--bg-raised` card: name + COA + inline `NewRateLimiter` + Add button)
  - Default account dropdown selector
  - Accounts list (`--bg-raised` rows with hover reveal: rate-limit edit, delete)
  - Inline rate-limit editing (expand to `NewRateLimiter` with ✓/✗ confirm/cancel)
  - Delete disabled/hidden for `noCoaAccount`
  - Save button (accent when unsaved, muted when clean)
  - `settingsSave` event listener wired exactly like original
  - `NewRateLimiter` — inline new-UI styled rate limiter (port of `RateLimit.tsx` styling;
    does NOT modify `RateLimit.tsx`)

- [x] `components/NewUI/settings/NewStorageSection.tsx` — Self-contained storage section with:
  - Four card rows (local-only / future-local / cloud-only / future-cloud) with styled
    radio indicator (accent dot) and `--accent` left border when selected
  - Static info callout (browser-only note) with `--accent` left border
  - Pending change callout: when selection differs from saved, shows `confirmationMessage()` text
    inline before user clicks Save (no separate confirm dialog at this point — confirm on save)
  - `handleSaveWithConfirmation` pattern preserved: shows `window.confirm()` on Save click
  - Progress bar (thin `--accent` fill, `--bg-active` track) when `storageProcessing.isProcessing`
  - Save button (accent when unsaved, muted when clean)
  - `settingsSave` + `cleanupApiKeys` event listeners wired exactly like original

- [x] `components/NewUI/settings/NewConnectorsSection.tsx` — Self-contained connectors section with:
  - `SegmentedControl` tab bar: "Integrations" | "Tool API Keys" (Tool API Keys tab only shown
    when `featureFlags.webSearch && canAddWebSearchApiKey`)
  - Integrations tab:
    - Skeleton cards during load (3 placeholder rows)
    - Empty state with 🔌 icon and copy
    - Integration cards: icon (32×32 logo square) + displayName + Connected badge + Connect/Disconnect
    - `intIcon()` helper reproduces `translateIntegrationIcon` logic locally (read-only port;
      DO NOT MODIFY `IntegrationsDialog.tsx`)
    - Connect: `getOauthRedirect()` → opens 600×600 OAuth popup, polls until closed, refreshes
    - Token-sharing shortcut handled (when backend shares existing token, no popup needed)
    - Disconnect: `deleteUserIntegration()` after `window.confirm()`
    - Per-integration spinner while connecting/disconnecting
    - Provider settings (Azure admin consent etc.) forwarded to `getOauthRedirect()` exactly as original
  - Tool API Keys tab: renders `<ToolApiKeysTab open={true} />` wrapped in
    `<div data-new-ui="true" className="new-ui-tool-api-keys">` for CSS scoping.
    DO NOT MODIFY `ToolApiKeysTab.tsx` — visual overrides live in `conversation-view.css`.

**Updated files:**
- [x] `components/NewUI/settings/NewSettingsModal.tsx`:
  - Imports `NewAccountSection`, `NewStorageSection`, `NewConnectorsSection`
  - Removed now-unused imports: `IntegrationTabs`, `ConversationsStorage`, `Accounts`
  - `AccountSection` shell replaced: `if (!active) return null; return <NewAccountSection />`
  - `StorageSection` shell replaced: `if (!active) return null; return <NewStorageSection />`
  - `SectionContent` `'connectors'` case replaced: `return <NewConnectorsSection />`
- [x] `styles/conversation-view.css` — Added `/* Settings — Connectors section (Phase 45) */`
  block at end of file. Scoped to `[data-new-ui="true"] .new-ui-tool-api-keys`. Overrides:
  blue → `--accent` (buttons, links, icons), `bg-blue-50/800` info box → `--bg-raised` + `--accent`
  left border, `bg-neutral-100` key display → `--bg-app`, input borders → `--border-subtle`,
  text colours → new-UI tokens.

**Design language used:**
- Backgrounds: `--bg-raised` for cards, `--bg-hover` for row hover, `--bg-active` for inactive btns
- Typography: 14px/500 primary, 13px secondary, 12px muted/metadata
- Borders: `1px solid var(--border-subtle)`, `borderRadius: 12px` for cards, 8px for rows/callouts
- Accent: `--accent` for selected indicator, primary buttons, left border on active/info elements
- Spacing: 16px between sections, 20px card padding

**TypeScript:** `tsc --noEmit` — zero errors in new files or modified files.

### Phase 46 — Assistant Creation Access-Model Selector + Assistants View Layout Overhaul ✅ COMPLETE

Two-part session. Zero changes outside `components/NewUI/` (One-Directory Rule observed). No changes to `AssistantModal.tsx`, `Chat.tsx`, or any protected file.

**Part 1 — `NewAssistantTypeSelector.tsx` (Step 0 wizard before AssistantModal)**

- [x] **`components/NewUI/views/NewAssistantTypeSelector.tsx`** — new modal that intercepts the
  "New Assistant" flow in `MyAssistantsTab`, runs before `AssistantModal` opens.
  Layout: centered panel, max 520px, `--bg-raised` bg, 24px radius, blurred overlay backdrop.
  Header: "Create an Assistant" (18px/500) + "Choose who can access this assistant" (14px secondary).
  Three access-model cards (stacked vertically, `--bg-app` bg, `1px --border-subtle` border, 12px radius,
  `--accent` 4px left border when selected/hovered).

  **Card 1 — Private** (`IconLock`): "Just for me / Only you can see and use this assistant".
  Maps to: no astPath, no astPathData → `onConfirm(null, null)`.

  **Card 2 — Managed** (`IconShare`): "I manage it, others can use it / You control it. Choose how
  others access it." Only shown when `featureFlags.assistantPathPublishing` is true. When selected,
  expands inline (CSS `max-height` 0→520 transition) to two sub-options:
  - **"Specific people" sub-option** — expands further to show email textarea (comma-separated);
    maps to `astPathData = { isPublic: false, accessTo: { users: [emails], amplifyGroups: [] } }`.
  - **"Anyone with the link" sub-option** — maps to `{ isPublic: true, accessTo: ... }`.
  - **URL slug input** — shown for both sub-options; auto-sanitises to lowercase alphanumeric +
    hyphens, max 40 chars; live validation with red error text; `/assistants/{slug}` preview.
  When feature flag off: card shown disabled (greyed-out + tooltip) + note below: "To share
  assistants with others, contact your admin to enable assistant path publishing."

  **Card 3 — Collaborative** (`IconUsers`): "Team assistant / Multiple people can edit and manage
  this assistant." Only shown when user has ADMIN or WRITE access to at least one group (gated by
  `featureFlags.assistantAdminInterface`). Single group: clicking card immediately dispatches
  `openAstAdminInterfaceTrigger` and closes the selector (no Continue needed). Multiple groups:
  clicking card expands an inline `<select>` to choose the target group; Continue button dispatches
  the event with the selected group. Card 3 does NOT call `onConfirm` — it dispatches the group
  admin event and closes via `onClose()`.

  **Continue button**: right-aligned, filled `--accent`, disabled until a valid selection is made
  (Private always valid once selected; Managed requires sub-option + non-empty valid slug;
  Collaborative with multiple groups requires group selection). Cancel button dismisses.

  **Keyboard**: `Escape` closes, `Tab`/`Shift+Tab` focus-trapped within panel, `Space`/`Enter`
  activates cards/sub-options. Cards have `role="button"` `aria-pressed`. Panel has `role="dialog"`
  `aria-modal="true"` `aria-labelledby="new-ast-type-title"`. `tabIndex={-1}` + focus on mount.

  **KNOWN LIMITATION (documented inline)**: `AssistantModal` always initialises its `astPathData`
  state to `null` and runs a `lookupAssistant()` effect on mount; for a brand-new slug (never
  registered) this resets to `emptyAstPathData` (isPublic: true). Consequence: only `astPath` is
  reliably pre-filled in AssistantModal (read from `definition.astPath`); the `isPublic: false`
  intent from "Specific people" is lost — the user must manually uncheck "Publish to all users"
  inside AssistantModal's AssistantPathEditor. This is an inherent constraint of not modifying
  `AssistantModal.tsx`. Documented in the file header and inline comments.

- [x] **`components/NewUI/views/NewAssistantsView.tsx` — Part 1 wiring:**
  - `MyAssistantsTab`: replaced the two `setShowAssistantModal(true)` paths (header button +
    EmptyState CTA) with `setShowTypeSelector(true)`.
  - Added `showTypeSelector` state + `handleTypeSelectorConfirm(astPath, astPathData)` handler that
    creates a blank `Prompt` / `AssistantDefinition` with `astPath` pre-set, then opens
    `AssistantModal`.
  - Added `<NewAssistantTypeSelector>` render (portals naturally as it uses `position:fixed`).
  - Removed the old "Your Assistants" / "Shared Assistants" sub-tabs from `MyAssistantsTab` (shared
    assistants now have their own top-level tab — see Part 2).
  - Added `getAccessBadge(p)` helper: returns `{ label, bg, color }` based on whether the prompt's
    definition has `astPath` + `isPublic`. Three states: Private (gray `--bg-active` pill) / Shared
    (soft orange, `--accent` color) / URL (soft green `#3aa764`).
  - `AssistantRow` got an optional `accessBadge` prop — renders a small UPPERCASE pill next to the
    name when provided. Used only in `MyAssistantsTab`.

**Part 2 — Assistants View Layout Overhaul (5 tabs)**

- [x] **`MainTab` type** extended: `'individual' | 'shared' | 'group' | 'templates' | 'layered'`
  (was: `'individual' | 'group' | 'templates' | 'layered'`). Persisted `activeAssistantGalleryTab`
  localStorage value still honoured; `'shared'` added to the `valid` array.

- [x] **New `SharedWithMeTab` component** (inside `NewAssistantsView.tsx`):
  Shows individual assistants where `p.data?.noEdit === true` (= `canEdit=false`, shared read-only).
  These were previously in the "Shared Assistants" sub-tab inside "My Assistants". Now a first-class
  top-level tab with search, empty state. Group assistants (even read-only ones) stay in the Teams tab.
  No "source" attribution column — `p.data?.noEdit` prompts carry no "shared by" metadata in the
  current data model.

- [x] **`MyAssistantsTab` simplified**: now shows ONLY assistants where `canEdit=true` (your own,
  editable assistants). The "Shared Assistants" sub-tab is gone. Access-type badge makes the
  Private/Shared/URL distinction visible without any sub-tab.

- [x] **Tab list restructured** (5 tabs in order):
  1. My Assistants (`individual`) — yours + canEdit=true
  2. Shared with Me (`shared`) — canEdit=false individual assistants — always visible
  3. Teams (`group`, label changed from "Group Assistants") — GroupAssistantsTab, unchanged
  4. Layered Assistants (`layered`) — conditional on data
  5. Prompt Templates (`templates`) — always visible (moved from 3rd to 5th position)

- [x] **CONFLICT NOTE AND RESOLUTION**: The spec proposed that "Shared with Me" also includes
  "layered assistants from groups the user is a member of but doesn't admin." This would create
  duplicate display since the Teams tab (unchanged GroupAssistantsTab) already shows all group
  content including layered assistants. Rather than duplicate rows or remove content from Teams,
  "Shared with Me" is scoped to ONLY individual (non-group) prompts with `noEdit=true`. Group
  layered assistants remain exclusively in Teams. This avoids the duplication issue and the
  implementation is clean with the existing data model.

**TypeScript:** `tsc --noEmit` — zero errors in modified files (`NewAssistantsView.tsx`,
`NewAssistantTypeSelector.tsx`). Pre-existing test-file errors in `__tests__/` unrelated to this session.

### Phase 47 — AssistantModal New-UI Styling + Team Creation + All Paths to Modal ✅ COMPLETE

Three-part follow-up to Phase 46. Zero changes outside `components/NewUI/` + `styles/conversation-view.css`
(One-Directory Rule observed). No changes to `AssistantModal.tsx`, `Modal.tsx`, or any protected file.

**Part A — CSS: new-UI styling for AssistantModal**

- [x] `styles/conversation-view.css` — appended `[data-new-ui-assistants="true"]` CSS block.
  `Modal.tsx` does NOT use `createPortal` — its `position:fixed` panel is a real DOM descendant of
  `NewAssistantsView`'s root, so ancestor-scoped CSS reaches it.
  Overrides:
  - `.modal-overlay` → `backdrop-filter: blur(4px)` (matches other new-UI overlays)
  - `.modal-content` → `--bg-raised` bg, `--border-subtle` border, `16px` radius
  - `#modalTitle` → `--text-primary`, Inter 16px/600
  - `#modalScroll` / `#assistantModalScroll` → `--text-primary` color
  - Inputs/textareas/selects in `#assistantModalScroll` → `--bg-app` bg, `--border-subtle` border, `--text-primary` text, 8px radius; focus ring uses `--accent`
  - Form labels (`.font-bold`) → `--text-primary`
  - Footer `#confirmationButton` base → `--bg-app` bg, `--border-subtle` border, 8px radius
  - Footer last button (Save/Submit) → `--accent` bg, white text; disabled state → `--bg-active` muted
  - Footer divider `.border-t` → `--border-subtle`
  - `prefers-reduced-motion` override block

- [x] `components/NewUI/views/NewAssistantsView.tsx` — added `data-new-ui-assistants="true"` to
  `NewAssistantsView`'s root div (the scoping ancestor for the CSS block above).

**Part B — NewAssistantTypeSelector: Card 3 overhaul**

- [x] `onConfirm` signature updated: `(astPath: string | null, astPathData: AstPathData | null, groupId?: string)`
  Card 3 now always calls `onConfirm(null, null, groupId)` — NEVER dispatches `openAstAdminInterfaceTrigger`.
  This ensures ALL three cards lead to AssistantModal.

- [x] Card 3 expanded content — two modes via toggle ("Use existing team" / "Create new team"):

  **Use existing team** (default):
  - 1 admin group: auto-shows group name, Continue immediately enabled
  - Multiple admin groups: dropdown to pick target group
  
  **Create new team**:
  - Team name input (required, validated)
  - Member emails textarea (comma-separated, optional) — emails reverse-looked-up in `amplifyUsers`
    to find usernames; current user added as `GroupAccessType.ADMIN`, members as `GroupAccessType.WRITE`
  - On Continue: async `createAstAdminGroup` + optional `updateGroupMembers` → `onConfirm(null, null, result.id)`
  - Loading state: Continue button shows spinner + "Creating team…" text while async runs
  - Error state: red error message if creation fails

- [x] `handleContinue` made async (team creation requires await)
- [x] `isContinueEnabled` updated: collaborative enabled when teamMode='existing' + group selected,
  OR teamMode='new' + team name filled + not currently creating
- [x] Single-group auto-dispatch removed — clicking Card 3 now always selects it; user still clicks Continue
- [x] Added imports: `createAstAdminGroup`, `updateGroupMembers` from `@/services/groupsService`; `IconLoader2`

**Part C — NewAssistantsView: GroupAssistantsTab modal flow + MyAssistantsTab groupId**

- [x] `GroupAssistantsTab` "New Assistant" button: changed from `openAstAdminInterfaceTrigger` dispatch to
  `setShowGroupTypeSelector(true)`. Added `showGroupTypeSelector` / `showGroupAssistantModal` /
  `groupAssistantForEdit` / `creatingForGroupId` state. Renders `<NewAssistantTypeSelector>` +
  `<AssistantModal>` at the end of the tab's return. `handleGroupTypeSelectorConfirm` creates a blank
  prompt with `newPrompt.groupId = groupId` and opens AssistantModal.
  Note: the existing settings-gear icons on individual group rows STILL open `openAstAdminInterfaceTrigger`
  for editing existing assistants — that path is intentionally preserved.

- [x] `GroupAssistantsTab.handleUpdateGroupNewAssistant`: calls `handleUpdateAssistantPrompt` (updates
  `prompts` state) AND immediately updates `groups` state (adds the new prompt to `group.assistants`) so
  the new assistant appears in the Teams tab without requiring a page refresh.

- [x] `MyAssistantsTab.handleTypeSelectorConfirm`: updated to accept `groupId?: string`; when groupId
  provided, sets `newPrompt.groupId = groupId` on the blank prompt.

- [x] `MyAssistantsTab.handleUpdateAssistant`: when `creatingForGroupId` is set (user created a group
  assistant via My Assistants' type selector Card 3), also updates `groups` state immediately (same
  pattern as GroupAssistantsTab).

**TypeScript:** `tsc --noEmit` — zero errors. Pre-existing `__tests__/` errors unrelated.

### Phase 48 — Menu Hover-Preview Cards + Viewport-Aware Submenu Positioning ✅ COMPLETE

Three improvements to existing menus/popups. Two new shared files; no file outside
`components/NewUI/shared/` was touched (One-Directory Rule §9a clean, DO NOT CHANGE list §9 clean —
`types/`, `utils/`, `services/` were read only).

**New shared files**

- [x] **`components/NewUI/shared/InfoFloatCard.tsx`** (new) — the hover-preview card *shell* plus the
  `useInfoCardHover<T>()` hover-intent hook, and the content primitives both cards are built from
  (`InfoCardTitle`, `InfoCardText`, `InfoCardItalic`, `InfoCardMeta`, `InfoCardPills`,
  `InfoCardPill`). The two cards turned out to share the whole visual shell and all of the positioning
  logic — only the field list differs — so the shell was factored out and each menu keeps just its own
  ~40-line body component. Shell spec: 240px max-width, `--bg-raised`, 1px `--border-subtle`, 10px
  radius, 14px padding, `0 4px 16px rgba(0,0,0,0.2)`.
- [x] **`components/NewUI/shared/menuPositioning.ts`** (new) — one place defining the Floating UI
  middleware stack for *nested* submenu panels: `offset(4)` +
  `flip({ fallbackPlacements: ['left-start','bottom-start','top-start'] })` + `shift({ padding: 8 })`,
  plus `submenuStyle()` for the wrapper's inline style.

**Fix 1 — assistant hover card in `AttachMenu.tsx`**

- [x] Hovering an assistant row in the "Add assistant ›" submenu shows a card with: name (15px/600,
  `--text-primary`) → access pill (`Private` / `Shared` / `Group`) → description (2-line clamp, 13px
  `--text-secondary`) → `Instructions: …` (italic, 12px `--text-muted`, 1 line, first 120 chars,
  whitespace-collapsed) → up to 3 tag pills → `Uses: <model name>` → `N tools`.
- [x] Access is derived, not stored: `groupId` → **Group**, else `astPath` → **Shared**, else
  **Private** (`accessLabel()`). Matches the badge semantics already used in `NewAssistantsView`.
- [x] `data.model` is a model **id**; `resolveModelName()` maps it through `availableModels` for a human
  name, falling back to the raw id so a hidden/unavailable enforced model still reads sensibly.
- [x] Layered assistants get the same card via `layeredCardInfo()` (extra `Layered` pill; instructions
  preview comes from `rootNode.instructions`), so the two row types don't diverge visually.
- [x] Suppressed where there's nothing to preview: the "Standard conversation" row calls `hideNow()` on
  enter, and the empty/loading states have no handlers at all. Also `hideNow()` on select and whenever
  the search term changes (rows move under the cursor as the list filters).

**Fix 2 — model hover card in `ModelPicker.tsx`**

- [x] Hovering a row in the "More models ›" submenu shows: name → description (2-line clamp) →
  capability pills → `Context: 200K tokens`.
- [x] **Model id and provider are deliberately NOT shown** (product decision, Phase 48b — they were in the
  first cut and were cut). The display name carries enough and both extras made the card read as debug
  output. The `providerLabel()` / `PROVIDER_LABELS` id-sniffing helpers and the `InfoCardIdent` primitive
  were deleted rather than left dangling. Don't re-add without asking.
- [x] Capability pills from real `Model` fields: **Vision** (`supportsImages`), **Reasoning**
  (`supportsReasoning`), **Large context** (`inputContextWindow >= 128_000`). These are the only pills on
  the card now that the provider pill is gone.
- [x] Context line uses `inputContextWindow` and is **omitted entirely** when it's 0/absent.
  `formatTokenCount()` renders 200000 → `200K`, 1000000 → `1M`.
- [x] **Investigated and confirmed: there is no static model-metadata table to read from.** `utils/app/const.ts`
  holds no per-model descriptions or capability flags — everything shown comes off the `Model` object
  from the API (`types/model.ts`). Note the field is `inputContextWindow`, NOT the `maxLength`/`tokenLimit`
  named in the task; those don't exist on this codebase's `Model` type.

**Fix 3 — submenu positioning audit (both files)**

- [x] `ModelPicker.tsx`: effort + more-models submenus converted from `position: absolute` +
  `getBoundingClientRect`-measured `top` + `left: calc(100% + 6px)` to their own `useFloating`
  instances. Deleted `effortTopOffset`/`modelsTopOffset` state and the measuring effect.
- [x] `AttachMenu.tsx`: same conversion for all three panels that actually render (skills, connectors,
  assistant). Deleted `libraryTop`/`skillsTop`/`connectorsTop`/`assistantTop` state and the measuring
  effect. **Audit result: "Add from library" has no panel** — its row fires an action and closes the
  menu, so it keeps a plain ref and needs no Floating UI instance. No other absolutely-positioned
  nested panels exist in either file.
- [x] Zero visual change: panel dimensions, colours, radii, shadows, content, and each menu's own enter
  keyframe (`attachMenuEnter` / `modelPickerEnter`) are all preserved. Only the positioning mechanism moved.

**Two non-obvious decisions worth keeping (see the header comments in both new files)**

- [x] **Submenus keep `strategy: 'absolute'` and stay DOM children of the primary panel.** This is
  load-bearing, not laziness: `useDismiss` decides "outside press" by DOM containment, so portalling a
  submenu out would make every click inside it dismiss the whole menu — which would break the Skills
  submenu's checkbox rows (they toggle and are *supposed* to keep the menu open). The primary panel is
  `position: fixed`, so it is the offsetParent and absolute offsets resolve against it, while flip/shift
  still measure against the viewport. Best of both.
- [x] **The hover card is the opposite case:** it must escape `overflow: hidden` / `overflowY: auto` on
  the submenu panels, so it uses `strategy: 'fixed'` + `FloatingPortal`. To keep that from re-introducing
  the dismiss problem it is `pointer-events: none`, which also guarantees it can never swallow a click
  meant for the row underneath it. Show/hide is therefore driven purely by row mouse enter/leave.

**Phase 48b — follow-up fixes (same session)**

- [x] **Recommended models now get the card too.** The hover card was only wired to the "More models ›"
  submenu rows; the Opus/Sonnet/Haiku rows in the *primary* panel had none. Added a second
  `useInfoCardHover<Model>()` in the `ModelPicker` body reusing the same `ModelCardBody`. Because this
  hook lives in the component (not in a submenu that unmounts), it needs explicit dismissal — `hideNow()`
  on panel close (`onOpenChange`), in `closeAll()`, and in `openSubmenu()` (a submenu panel opens over the
  space the card occupies). Without the `onOpenChange` call, `item` stays set and the card reappears the
  next time the menu opens.

- [x] **"More models" no longer clips — root cause was `flip`'s `crossAxis` default, not the fallback list.**
  Symptom: "Effort" flipped sides perfectly while "More models" got cut off, despite both using the
  identical middleware stack. Traced through `@floating-ui/core`'s `flip` implementation: with
  `crossAxis: true` (the default) the *alignment*-side overflows (top/bottom for a right/left placement)
  are pushed into the same `overflows` array as the side-axis overflow, and any entry `> 0` disqualifies
  the placement. "More models" is up to 420px tall, so anchored near the bottom of the window it overflows
  the bottom edge at right-start **and** left-start **and** every fallback. flip then falls through to its
  tie-break (`overflows[0] <= 0` sorted by cross-axis overflow, else `bestFit` = smallest *total* overflow),
  where a large vertical overflow dominates and a horizontally-clipped placement wins. The ~230px "Effort"
  panel fits vertically, so it only ever had the left/right question to answer — hence the difference.
  Fix: `flip({ crossAxis: false, … })` in `submenuMiddleware()`, so flip decides *only* which side, and
  `shift()` — the middleware actually built for it — handles the vertical fit. `MoreModelsMenu`'s
  `min(420px, 60dvh)` cap guarantees shift can always fit it. No dimensions or styling changed.
- [x] Same flaw fixed in the hover cards, which had their own copy of the stack: a card near the bottom
  edge would flip to the left of the row (overlapping the menu) even with ample room on the right. The
  cards now share `submenuMiddleware()` — parameterised with a gap argument (`submenuMiddleware(12)` for
  cards, default `4` for submenu panels) — so the crossAxis reasoning only has to be right in one place.

- [x] **Effort ⓘ tooltip no longer truncated.** It was `position: absolute; bottom: calc(100% + 6px)`
  inside the row, and `EffortMenu`'s container sets `overflow: hidden` — so any text that hung outside the
  320px panel was clipped. Converted to `FloatingPortal` + `useFloating` (`placement: 'top'`, fallbacks
  `['bottom','right','left']`, `shift({ padding: 8 })`, `strategy: 'fixed'`, `zIndex: 10002` to sit above
  both submenu panels and hover cards). Kept `pointer-events: none` and the identical 220px / `--bg-raised`
  / 8px-radius look, plus the existing `aria-describedby` wiring.

**Other details**

- [x] Submenu references are bound in an effect keyed on `submenu`, **not** via an inline callback ref —
  an inline `ref={(n) => {...}}` is invoked with `(null, node)` on every render and would thrash
  `setReference`'s internal state.
- [x] Passing a fresh `submenuMiddleware()` array each render is safe: Floating UI deep-compares
  middleware and compares functions by `toString()`, so no update loop (verified in
  `@floating-ui/react-dom@1.3.0`'s `deepEqual`).
- [x] Both submenu wrappers and the card are hidden (`visibility: hidden`) until the first
  `computePosition` resolves, so nothing flashes at 0,0 on open.
- [x] Hover intent: 250ms in / 200ms out, matching the task spec. Moving between rows while a card is
  already open swaps its contents instantly rather than waiting another 250ms.
- [x] `infoFloatCardEnter` (opacity-only, 120ms) is applied via a class, not inline style, specifically
  so the `@media (prefers-reduced-motion: reduce)` rule can override it — consistent with the Phase 19
  reduced-motion audit's treatment of `attachMenuEnter`/`modelPickerEnter`.

**Verification:** `tsc --noEmit` — zero errors in `components/NewUI/` (only the pre-existing
`__tests__/` "Cannot find name 'it'/'expect'" errors remain). `eslint` on all four touched/new files —
clean, zero warnings. `npm run build` — **✓ Compiled successfully**, zero warnings from the four files.

⚠️ **Pre-existing build failure, unrelated to this phase (worth knowing about):** `npm run build`
compiles fine but then **exits 1** during "Generating static pages" — `pages/mcp-oauth-callback.tsx`
calls `useRouter()` during render, which throws `NextRouter was not mounted` when Next tries to
statically prerender it (46 failures = that one page × each i18n locale). **Confirmed pre-existing by
building with this phase's changes removed** (stashed the two modified files, moved the two new files
aside): baseline is byte-for-byte the same failure — `exit=1`, 46 × `NextRouter was not mounted`. That
page imports nothing from `components/NewUI/`. Fixing it means giving it a `getStaticProps`/`dynamic`
opt-out or moving the `useRouter()` call into an effect, but it lives outside `components/NewUI/` so it
is out of scope here — flagging it because it makes `npm run build` look broken to the next person.

**Not browser-verified:** this repo has
no DOM test environment (`vitest.config.ts` is `environment: 'node'`; no `jsdom`, no
`@testing-library/react`) and the app requires a live authenticated session to reach the composer, so
hover/flip behaviour was reasoned through against the Floating UI 0.19.2 source rather than observed. If
you can run the app, the two things worth eyeballing are (a) the card flipping to the left of the
submenu when the window is narrow, and (b) the Skills submenu checkboxes still not closing the menu.

### Phase 49 — Workflow Templates Full-Pane View ✅ COMPLETE

Surfaces Assistant Workflow Templates as a first-class sidebar section and full-pane view in the
new UI. Previously only accessible via `ChatbarSettings.tsx` "Assistant Workflows" button in the
classic UI.

- [x] **`NewWorkflowsView.tsx`** (`components/NewUI/views/`) — new full-pane view. Follows the
  exact two-pane layout of `NewScheduledTasksView.tsx`:
  - 52px sticky top bar: back chevron (→ chat) + "Workflows" title + "New Workflow" button
    (only shown when `featureFlags.createAssistantWorkflows` is true; read-only browse mode
    when false)
  - 340px left list pane: search bar (filters name/description), skeleton cards while loading
    (`listAstWorkflowTemplates(true)`), template cards (name, 1-line desc, step-count badge,
    base-template badge, public badge), hover edit/delete icons (feature-flagged), confirm
    dialog before delete, empty states for filtered vs. no-templates vs. flag-off
  - flex-1 right detail pane: empty state with `IconPuzzle` when nothing selected; read-only
    detail view showing name, description, badge pills, Inputs table (from `inputSchema.properties`),
    Steps list (numbered collapsible cards: description, `<code>` tool badge, expandable instructions);
    "Edit Workflow" button at bottom (feature-flagged)
  - AssistantWorkflowBuilder integration: `<div className="new-ui-workflow-editor-modal text-neutral-900 dark:text-white"><AssistantWorkflowBuilder isOpen={showEditor} .../></div>` —
    the builder's own full-screen Modal is kept as-is; the wrapper class enables scoped CSS
    overrides (see below). `onRegister` refreshes the list and selects the new template.
- [x] **`NewSidebar.tsx`** — added `IconPuzzle` import; added Workflows nav entry gated by
  `featureFlags.createAssistantWorkflows` (after Customize, before Notebook/Scheduled) in both
  the expanded nav array and the collapsed icon rail; updated `currentNavId` mapping to highlight
  'workflows' when `(page as any) === 'workflows'`.
- [x] **`home.tsx`** — added `import { NewWorkflowsView }` and render case
  `{(page as any) === 'workflows' && (<NewWorkflowsView />)}` matching the `scheduledTasks` precedent.
- [x] **`conversation-view.css`** — added `/* Workflows view — inner builder overrides */` block
  scoped to `[data-new-ui="true"] .new-ui-workflow-editor-modal`:
  - backdrop: `background: rgba(0,0,0,0.6) + backdrop-filter: blur(4px)` (new-UI style)
  - `.modal-content`: `background: var(--bg-raised)`, `border-color: var(--border-subtle)`,
    `color: var(--text-primary)`, `border-radius: 16px`
  - Text overrides for light-mode gotcha: `.text-black/.text-neutral-800/-.600/-.500` mapped to
    respective `--text-*` vars; `.border-neutral-300` → `--border-subtle`; `.bg-white` → `--bg-app`
  - Modal footer buttons: new-UI token styling
  - `@media (prefers-reduced-motion: reduce)` gated for button transitions
- [x] **`NEW_UI_DOCS.md`** registry updated (Section 5, `NewWorkflowsView.tsx`).
- [x] **`NEW_UI_PORTING_STATUS.md`** — workflow builder row updated to ✅.
- [ ] **TODO (future phase)**: dedicated new-UI visual pass on `AssistantWorkflowBuilder`'s internal
  components (step cards, tool selector, visual builder, AI generator modal) — currently the builder
  renders in its original old-UI styling inside the new-UI backdrop.

### Phase 50 — Blue Accent Color Pass ✅ COMPLETE
Token-first change: every interactive accent in the new UI is now Majk blue. No component logic changes.

**Changed files:** `styles/globals.css`, `styles/conversation-view.css`, `components/NewUI/home/NewHome.tsx`, `components/NewUI/chat/ConversationComposer.tsx`

- [x] **`styles/globals.css` — `--accent` token updated:**
  - `:root` `--accent`: `#D97757` (orange) → `#3b82f6` (Tailwind blue-500, same as `--color-primary-500`)
  - `.dark` `--accent`: `#D97757` → `#006FEE` (NextUI primary blue)
  - New companion token `--accent-fg: #ffffff` added in both `:root` and `.dark`.
    White on `#3b82f6` ≈ 3.9:1 (WCAG SC 1.4.11 pass); white on `#006FEE` ≈ 4.6:1 (AA pass).
- [x] **`styles/globals.css` — global scrollbar** (lines ~166–174): already uses `var(--color-primary-400)` (#60a5fa, blue). **Confirmed correct — no change needed.**
- [x] **`styles/globals.css` — `--color-secondary-*` purple scale**: `grep` confirms zero references in any `components/NewUI/` file. **Confirmed not used in new UI — no change needed.**
- [x] **Send button glyph color fixed in two files:**
  - `components/NewUI/home/NewHome.tsx`: `color: '#2A1710'` → `color: 'var(--accent-fg)'`
  - `components/NewUI/chat/ConversationComposer.tsx`: `color: '#2A1710'` → `color: 'var(--accent-fg)'`
  - Rationale: `#2A1710` (warm dark brown) was chosen for contrast against orange. It is visually wrong and low-contrast on blue. `var(--accent-fg)` (white) is the correct foreground for any `--accent`-background element.
- [x] **`styles/conversation-view.css` — scrollbar thumbs updated:**
  - `.chatcontainer::-webkit-scrollbar-thumb`: `var(--border-subtle)` (neutral grey) → `#93c5fd` (blue-300, softened — clearly blue but not distracting at rest)
  - `.chatcontainer::-webkit-scrollbar-thumb:hover`: `var(--text-muted)` → `#60a5fa` (blue-400, stronger on hover)
  - Global new-UI scrollbar (`[data-new-ui="true"] ::-webkit-scrollbar-thumb`): same change, `#93c5fd`
  - Fallback rationale: used fixed hex values (`#93c5fd`/`#60a5fa`) instead of `color-mix()` for maximal browser compatibility.
- [x] **Hardcoded orange/purple/indigo/violet audit (`grep`):** zero hits across `components/NewUI/` and `styles/conversation-view.css`. All interactive accents already used `var(--accent)` — the token change alone converted them all automatically.
- [x] **Breathing dots** in `conversation-view.css` (Phases 26/27/40b): confirmed they use `background-color: var(--accent)` — automatically become blue with no additional changes.
- [x] **Upload progress bar** (`.new-ui-upload-bar-fill`) in `conversation-view.css`: uses `background: var(--accent)` — automatically blue.
- [x] **Info callout left-border** in `.new-ui-tool-api-keys .bg-blue-50` override: uses `border-left: 3px solid var(--accent)` — automatically blue.
- [x] **`NEW_UI_DOCS.md` Section 4.2 token table** updated with new `--accent` values and `--accent-fg` row.
- [x] **`NEW_UI_WIKI_INSTRUCTIONS.md` Section 9** — new standing rule added locking in blue as the accent color for all future sessions.
- [x] **`NEW_UI_PORTING_STATUS.md`** — m1 contrast note updated (old orange/brown contrast issue is resolved with blue + white).

### Phase 51 — Sidebar Three-Dot Menu Upgrade + Collapsible Pinned/Recents ✅ COMPLETE

**Changed files:** `components/NewUI/sidebar/ConversationRow.tsx`, `components/NewUI/sidebar/SidebarSection.tsx`, `components/NewUI/sidebar/NewSidebar.tsx`

- [x] **`ConversationRow.tsx` — upgraded three-dot menu:**
  - Added **Pin/Unpin** item (between Rename and Share). Uses `IconPin` / `IconPinnedOff` (14px). Reads `isPinned` from `conversation.data?.pinned || (conversation as any).pinned` (dual check for backward compat). Writes to `conversation.data.pinned` via `handleUpdateConversation(conversation, { key: 'data', value: { ...conversation.data, pinned: !isPinned } })` — triggers remote sync pipeline. TODO comment left to add `pinned?: boolean` to `Conversation` type in `types/chat.ts`.
  - Added **Share** item (between Pin/Unpin and Delete). Uses `IconShare` (14px). Calls `onSelect()` then `setTimeout(() => document.getElementById('shareChatUpper')?.click(), 50)` — identical to `ConversationHeader.tsx handleShare`. The 50ms delay lets the chat view mount before the share button is sought.
  - Added a `<div className="h-px bg-[--border-subtle] mx-2 my-1" />` divider before Delete to visually separate the destructive action.
  - Imported `handleUpdateConversation` from `HomeContext` (was missing before — context was imported but not destructured).
  - Delete item now has red color (`text-red-400 hover:text-red-300`) for visual distinction.
  - Rename stays conditionally rendered (only when `onRename` prop is provided).

- [x] **`SidebarSection.tsx` — collapsible section support:**
  - New props: `isCollapsible?: boolean`, `storageKey?: string`, `children?: React.ReactNode`.
  - When `isCollapsible`: heading row gets `cursor-pointer`, `role="button"`, `aria-expanded`, `aria-label`, `tabIndex={0}`, keyboard handler (Enter/Space).
  - Chevron: `IconChevronDown` when expanded, `IconChevronRight` when collapsed (14px, `--text-muted`).
  - `rightSlot` container stops click propagation when collapsible (prevents sort/view icon clicks from toggling collapse).
  - Children body: `overflow-hidden`, `max-height: 0px / 2000px`, transition via `motion-safe:transition-[max-height] motion-safe:duration-200 motion-safe:ease-out` (Tailwind JIT — maps to `@media (prefers-reduced-motion: no-preference)` per wiki §9 rule 17).
  - Non-collapsible usages with no children are **fully backward-compatible**.

- [x] **`NewSidebar.tsx` — Pinned section + collapsible Recents:**
  - Pin filter updated: `isPinnedConv = (c) => !!(c.data?.pinned) || !!(c as any).pinned` — checks both new `data.pinned` storage and legacy top-level cast.
  - Pinned section: replaced `<div className="group">` + manual `<SidebarSection label="Pinned" />` header with `<SidebarSection label="Pinned" isCollapsible storageKey="amplify_sidebar_pinned_collapsed">`. Children passed directly.
  - Recents section: replaced custom `<div>` heading with `<SidebarSection label="Recents" isCollapsible storageKey="amplify_sidebar_recents_collapsed" rightSlot={...}>`. All recents content (skeleton, Today/Yesterday/Previous groups, empty state) is now passed as children — collapsed in one gesture.
  - `rightSlot` for Recents wraps the sort + view-all `IconButton`s in a div; `SidebarSection`'s rightSlot handler stops propagation so these buttons don't accidentally toggle the section.

### Phase 52 — Delete Confirmation Dialog + Hover Bug Fix ✅ COMPLETE

**Changed files:** `components/NewUI/shared/ConfirmDialog.tsx` (new), `components/NewUI/sidebar/ConversationRow.tsx`, `components/NewUI/chat/ConversationHeader.tsx`, `components/NewUI/views/NewAssistantsView.tsx`

- [x] **New `ConfirmDialog.tsx`** — reusable confirmation modal (registered in Component Registry §5):
  - `variant='danger'` (default): red confirm button (`bg-red-500 hover:bg-red-600`)
  - `variant='warning'`: amber; `variant='neutral'`: `--accent` blue
  - Portalled to `document.body` via `ReactDOM.createPortal` (never clipped by overflow ancestors)
  - Focus trap (Tab/Shift-Tab), Escape cancels (capture phase, won't conflict with other Escape handlers), backdrop mousedown cancels
  - Cancel button receives focus on open — user must consciously move to the red button to confirm
  - `aria-modal="true"`, `aria-labelledby` on the panel per wiki §9 rule 12

- [x] **`ConversationRow.tsx` — delete now requires confirmation:**
  - Clicking "Delete" in the three-dot menu sets `confirmDeleteOpen: true` instead of calling `onDelete()` immediately
  - `ConfirmDialog` rendered inside the component; `onConfirm` calls `onDelete()` then closes

- [x] **`ConversationRow.tsx` — hover highlight bug fixed:**
  - Removed `hover:bg-[--bg-raised]` from the dots (⋯) button's className
  - Root cause: when hovering an unselected row, the row button shows `--bg-hover` and the gradient overlay fades to `--bg-hover`. The dots button's `hover:bg-[--bg-raised]` added a THIRD, visually conflicting background on top of the gradient area. Removing it means only the icon color changes on hover (`text-[--text-muted]` → `text-[--text-primary]`), which is clean and sufficient affordance.

- [x] **`ConversationHeader.tsx` — header title-dropdown Delete now requires confirmation:**
  - `handleDelete` now sets `confirmDeleteOpen: true`; new `confirmDelete` fires the actual `window.dispatchEvent(new Event('deleteConversation'))`

- [x] **`NewAssistantsView.tsx` (LayeredAssistantsTab) — layered-assistant delete now requires confirmation:**
  - `confirmDeleteLA` state stores the `LayeredAssistant` pending deletion (null = dialog closed)
  - `onDelete` in `AssistantRow` calls `setConfirmDeleteLA(la)` instead of `handleDelete(la)` directly
  - `ConfirmDialog` `onConfirm` calls `handleDelete(confirmDeleteLA)` then clears state

### Phase 53 — Modal Header Row Alignment + Dimension Standardization ✅ COMPLETE

**Changed files:** `components/NewUI/settings/NewSettingsModal.tsx`, `components/NewUI/settings/NewAdminModal.tsx`

- [x] **Fix 1 — × button aligned with the section title (both modals).**
  Before: the × lived in a `position:sticky; top:20px` wrapper (`marginBottom:-20px`,
  `pointerEvents:none`) that was a **sibling of the `<h2>` *inside* the `overflow-y:auto`
  scroll container**. It floated over scrolling content and never shared a baseline with the
  title, which is why it read as misaligned. The `<h2>` carried `paddingRight:'44px'` purely
  to dodge it.
  After: the right pane is a flex COLUMN containing a real header row —
  `display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px 24px; flexShrink:0`
  — with the heading on the left and the × on the right, rendered **above** (not inside) the
  scroll container. Header stays put while content scrolls.
- [x] Close button restyled for the header-row context: borderless/transparent, 32×32 hit area,
  `IconX size={20}`, `--text-secondary` → hover `--text-primary` + `--bg-hover`.
  `aria-label="Close"` on both (was "Close settings" / "Close admin panel").
  The bordered `--bg-raised` box was dropped — it only existed to keep the floating button
  legible above scrolling content, which no longer happens.
- [x] Heading font size/weight untouched (18px / 700); only `marginBottom:20px` +
  `paddingRight:44px` removed in favor of `margin:0` (the row owns the spacing now).
- [x] Scroll container horizontal padding changed `32px` → `24px` to match the header row, so the
  title is left-aligned with the content beneath it. `contentRef` moved onto this inner div —
  it is the actual scroll container now, so the scroll-to-top-on-section-change effect still works.
- [x] `NewAdminModal`'s `text-neutral-900 dark:text-white` class moved to the outer flex-column
  wrapper so **both** the header row and the tab content still inherit it (the old AdminUI tab
  components depend on this for light-mode text — see Phase 22).

- [x] **Fix 2 — standardized outer dimensions.** `NewSettingsModal` panel
  `maxWidth: 1040px → 1100px`, `height: min(780px, 88dvh) → min(820px, 90dvh)`.
  `NewAdminModal` unchanged (it was already the larger, and is the source of truth).
  Remaining intentional delta: left-rail width is still 210px (settings) vs 220px (admin) —
  not part of the outer-dimension standardization and left alone to avoid scope creep.

- [x] **Fix 3 — shared `TwoColumnModalShell` DEFERRED (not created).** The extraction was
  evaluated against the stated threshold (≤4 props beyond the base 5, and no `onClose`/Escape
  special-casing inside the shell) and **fails both**:
  1. `escapeDisabled` — admin's Escape is guarded by `hasChildModalOpen`, where Escape must be a
     **no-op while the × still works**. That is not expressible through `onClose` alone, so the
     shell would have to special-case the Escape flow. This alone is a documented stop condition.
  2. `zIndex` — 9999 (settings) vs 10000 (admin). **Superseded by Fix 4:** admin no longer renders
     inside settings' overlay, so this difference is now cosmetic rather than load-bearing and would
     no longer *require* a prop. That drops the count to 5 extra props — still over the ≤4 threshold,
     and reason 1 (the Escape special-case) is independently disqualifying, so the deferral stands.
  3. `leftRailWidth` — 210px vs 220px.
  4. `ariaLabelledBy` — settings' labelling element is the shell's own header `<h2>`; admin's is
     the `Admin Panel` span in its **left rail**. The shell owns the header, so it needs an override.
  5. `contentClassName` — admin's `text-neutral-900 dark:text-white` inheritance requirement.
  6. `title` would have to widen from `string` to `ReactNode` for admin's inline "● unsaved" badge.

  Also genuinely admin-only and non-extractable: unsaved dots on nav rows, the unsaved-count
  badge, the save/reload footer, and the unsaved-confirm on ×/overlay/Escape. The left rails are
  structurally different too (settings = one scrolling column; admin = fixed header + scrolling
  nav + fixed footer). Per instruction, work stopped at Fix 2 rather than forcing a shell that
  would make both modals harder to read. Fixes 1 and 2 were applied twice, by hand, identically.

- [x] **Fix 4 — admin panel REPLACES the settings modal instead of stacking on top of it.**
  Reported symptom: opening the admin panel left the settings modal visible behind it.
  Root cause: `NewSettingsModal` rendered `<NewAdminModal>` as a **child of its own overlay div**,
  so the settings backdrop + panel stayed mounted and painted underneath.
  Fix: an early return placed below all hooks — `if (showAdminUI && featureFlags.adminInterface)
  return <NewAdminModal onClose={onClose} />;` — and the nested render removed. The settings frame
  is simply not rendered while admin is open.
  - `onClose` is passed **straight through** to the parent. All three render sites
    (`NewSidebar` ×2, `home.tsx`) unmount `NewSettingsModal` on `onClose`, so closing the admin
    panel returns you to the app rather than back to the settings modal — admin is a peer
    destination, not a drill-in. (If a back-to-settings flow is ever wanted instead, admin's
    `onClose` would go back to `setShowAdminUI(false)` and the early return would stay as-is.)
  - `NewAdminModal` has exactly ONE render site, so this fix covers every entry point: the settings
    nav-rail "Admin Panel" item, the sidebar "Admin" item, and the `AccountMenu` "Admin Panel"
    button. The latter two mount the component with `openToSection='admin'`, which makes
    `showAdminUI` true on the very first render — the settings frame is never painted at all.

- [x] **Fix 4b — fixed a related double-Escape bug (pre-existing).** Both modals register a
  `document` keydown listener. While admin was open, BOTH fired on Escape: admin's ran its
  unsaved-changes `confirm()`, and settings' then called `onClose()` **unconditionally** — which
  unmounted the whole tree and discarded admin's unsaved changes *even if the user clicked Cancel*.
  The settings effect now early-returns when `showAdminUI` is true (with `showAdminUI` added to its
  dep array), so it never registers a competing listener. **Standing pattern: when one modal renders
  another, the inner modal must be the only one with a live `document` Escape listener.**

### Phase 54 — Accent-Brand Teal Border on Composer Card ✅ COMPLETE

**Changed files:** `styles/globals.css`, `styles/conversation-view.css`,
`components/NewUI/home/NewHome.tsx`, `components/NewUI/chat/ConversationComposer.tsx`

Visual polish: gives the chat composer a persistent 2px teal border that distinguishes Amplify's
UI from Claude.ai (blue/warm), ChatGPT (green), and the old Amplify orange accent.

- [x] **New `--accent-brand` token defined in `styles/globals.css`:**
  - `:root` (light): `--accent-brand: #0d9488` (Tailwind teal-600)
  - `.dark`: `--accent-brand: #14b8a6` (Tailwind teal-500)
  - Contrast verified: light `#0d9488` on `#ffffff` ≈ **3.7:1** ✅; dark `#14b8a6` on `#262624` ≈ **3.4:1** ✅ (WCAG 3:1 minimum for non-text UI components, SC 1.4.11)
  - Separate token from `--accent` (blue). `--accent-brand` governs only the composer border; `--accent` governs all interactive elements (buttons, active borders, indicators).

- [x] **`styles/conversation-view.css` — updated `.new-ui-composer-card` rules (replaced Fix 40 block):**
  - `border-color: var(--accent-brand) !important; border-width: 2px !important;` — replaces old `--bg-active` color + upgrades width from the old 1px inline default
  - `:focus-within` adds an outer glow ring: `box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-brand) 25%, transparent) !important`
  - `prefers-reduced-motion` already covered by the existing block at line 1885 — no second rule needed

- [x] **`components/NewUI/home/NewHome.tsx`:**
  - Added `new-ui-composer-card` class to the composer box `<div>` (previously only used Tailwind border classes; without the class name, the CSS rules above would not target it)
  - Upgraded `border` → `border-2` (1px → 2px) in Tailwind classes for layout consistency

- [x] **`components/NewUI/chat/ConversationComposer.tsx`:**
  - Inline `border` changed from `'1px solid var(--border-subtle)'` → `'2px solid var(--border-subtle)'` (CSS `border-color` override takes over the color; inline only controls width)

**Standing rule established (see wiki §9 rule 21):** `--accent-brand` is reserved for the composer card border only. Never use it for buttons, badges, loading indicators, active-state borders, or any interactive element.

### Phase 55 — Custom Surface Palette ✅ COMPLETE

**Changed files:** `styles/globals.css`, `styles/conversation-view.css`,
`components/NewUI/home/NewHome.tsx`, `components/NewUI/chat/ConversationComposer.tsx`

Complete surface color replacement with a precisely specified palette.

- [x] **`styles/globals.css`** — All main surface tokens updated in both `:root` and `.dark`. Two new tokens introduced:
  - `--bg-composer` / `--border-composer-active` — specific to the chat input card. Decoupled from `--bg-raised` so user message bubbles, modals, and code blocks are unaffected.
  - Light: chat area `#fcfcfb`, sidebar `#fbfbf9`, composer `#ffffff`, resting edge `#e5e5e4`, hover/focus edge `#d4d4d1`
  - Dark: chat area `#151515`, sidebar `#111111`, composer `#20201f`, resting edge `#363635`, hover/focus edge `#4a4a48`

- [x] **`styles/conversation-view.css`** — Replaced the old Fix 40 block. New rules:
  - Expanded selector from `[data-new-ui="true"]` to cover both `[data-new-ui-shell="true"]` (NewHome landing) and `[data-new-ui="true"]` (ConversationComposer) — NewHome is not a descendant of the `data-new-ui` shell; without the `data-new-ui-shell` selector it would be missed entirely.
  - Resting: `background: var(--bg-composer)`, `border-color: var(--border-subtle)`
  - Hover **and** focus: `border-color: var(--border-composer-active)` — `:hover` and `:focus-within` share one rule, so mouse-over and keyboard/click focus produce the same edge
  - `prefers-reduced-motion` block updated to cover both selectors

- [x] **Hover trigger added** — `:hover` joined `:focus-within` on both selector variants so the active edge is not keyboard/click-only.

- [x] **Active edge widened to clear the perception floor** — spec values `#373736` dark / `#e4e4e3` light were 1/255 from resting (≈0.4 ΔE) and read as "no change." Now `#4a4a48` dark / `#d4d4d1` light. Resting `--border-subtle` unchanged. See the perception-floor note in §4.2.

- [x] **`components/NewUI/home/NewHome.tsx`** — composer `<div>`:
  - Added `new-ui-composer-card` class (CSS selector requires it)
  - `bg-[--bg-raised]` → `bg-[--bg-composer]`
  - `focus-within:border-[--bg-active]` → `focus-within:border-[--border-composer-active]`

- [x] **`components/NewUI/chat/ConversationComposer.tsx`** — inline style:
  - `background: 'var(--bg-raised)'` → `background: 'var(--bg-composer)'`

### Phase 56 — Prompt Templates in Settings + Sidebar Items Visibility ✅ COMPLETE

Two related sidebar/settings changes: Prompt Templates extracted out of the Assistants view into Settings,
and a new "Sidebar Items" settings section that lets users show/hide individual nav items.

**Step 1 — Prompt Templates moved to Settings → Customize:**

- [x] **`components/NewUI/settings/PromptTemplatesSection.tsx`** (NEW) — extracted from `PromptTemplatesTab`
  in `NewAssistantsView.tsx`. Identical logic: same `useContext(HomeContext)`, same three-section layout
  (Quick Actions / System Instructions / Your Templates), same search, same PromptModal open/close flow,
  same create/edit/cancel handlers. Local helpers (SectionHeading, SearchInput, EmptyState, TemplateRow)
  copied from NewAssistantsView. `className="text-neutral-900 dark:text-white"` on outermost div per wiki §9.
- [x] **`components/NewUI/views/NewAssistantsView.tsx`** — removed `'templates'` from `MainTab` type and
  valid array; added fallback: stored `'templates'` value defaults to `'individual'`. Removed templates entry
  from tabs array. Removed `{activeTab === 'templates' && <PromptTemplatesTab />}` render. Deleted the entire
  `PromptTemplatesTab` component definition (~180 lines). Cleaned up now-unused imports: `IconTemplate`,
  `PromptModal`, `savePrompts`.
- [x] **`NewSettingsModal.tsx`** — added `{ id: 'promptTemplates', label: 'Prompt Templates', Icon: IconTemplate }`
  as **first item** in the Customize nav group (before customInstructions). Added `case 'promptTemplates'`
  to SectionContent. Added `IconTemplate` and `IconLayoutSidebar` to icon imports.

**Step 2 — Sidebar Items visibility settings:**

- [x] **`components/NewUI/shared/sidebarVisibility.ts`** (NEW) — `SidebarVisibility` interface + `DEFAULT_SIDEBAR_VISIBILITY`
  constant + `SIDEBAR_VISIBILITY_KEY` constant. Shared between `SidebarItemsSection` (writer) and `NewSidebar` (reader).
  Keys: `chats | assistants | library | workflows | notebook | scheduled`, all default `true`.
  Recents is always shown — not included in the interface (cannot be hidden by design).
- [x] **`components/NewUI/shared/ToggleSwitch.tsx`** (NEW) — Reusable pill switch. 44×24px track; off=`--text-muted`,
  on=`--accent`; 18px white knob, 150ms ease transition; `role="switch"` + `aria-checked`; `e.stopPropagation()`
  so row `onClick` doesn't double-fire. Used by `SidebarItemsSection`.
- [x] **`components/NewUI/settings/SidebarItemsSection.tsx`** (NEW) — toggle rows using `ToggleSwitch` for all
  toggleable sidebar items. Auto-saves on each change. Feature-flagged items only rendered when their flag is on.
  New Chat, Customize, and Recent conversations are always visible (never shown as toggles).
  Clicking the full row label area also fires the toggle (row `onClick` + `e.stopPropagation()` in switch).
- [x] **`NewSettingsModal.tsx`** — added `{ id: 'sidebarItems', label: 'Sidebar Items', Icon: IconLayoutSidebar }`
  as **last item** in the Customize nav group (after mcp). Added `case 'sidebarItems'` to SectionContent.
- [x] **`components/NewUI/sidebar/NewSidebar.tsx`** — imports `SidebarVisibility`, `DEFAULT_SIDEBAR_VISIBILITY`,
  `SIDEBAR_VISIBILITY_KEY`. Adds `sidebarVisibility` state (initialized from localStorage with spread-merge
  for forward-compatibility). Adds `amplifySidebarVisibilityChanged` event listener that re-reads localStorage.
  `navItems` array: each item gains a `visible` field; array ends with `.filter(item => item.visible)`.
  Recents always rendered (no visibility guard — it is always shown per product decision).
  Collapsed icon-rail: `chats`, `assistants`, `scheduled`, `workflows` individually gated by `sidebarVisibility.*`;
  Customize always shown.

**localStorage keys introduced:**
- `amplify_sidebar_items_visible` — JSON SidebarVisibility object

**Event bridges introduced:**
- `amplifySidebarVisibilityChanged` — dispatched by `SidebarItemsSection`, consumed by `NewSidebar`

### Phase 57 — Auto-Collapse Sidebar on Narrow Viewports ✅ COMPLETE
Single-file change: `components/NewUI/sidebar/NewSidebar.tsx` only.

- [x] **`SIDEBAR_AUTO_COLLAPSE_THRESHOLD = 768`** constant added to the sidebar constants block (alongside `SIDEBAR_MIN_WIDTH`, `SIDEBAR_MAX_WIDTH`, `SIDEBAR_DEFAULT_WIDTH`, `SIDEBAR_WIDTH_KEY`). Value chosen so the chat area retains at least ~500px at the default sidebar width.
- [x] **`isOpenRef`** (useRef) — always-fresh mirror of `isOpen` state, updated in a dedicated `useEffect([isOpen])`. Prevents stale-closure issues in the resize handler's empty-deps useEffect.
- [x] **`wasAutoCollapsedRef`** (useRef\<boolean\>) — tracks whether the sidebar was collapsed programmatically (by the resize handler) rather than by user action. Key invariant: only auto-expand when this is true; never auto-expand after a user-initiated collapse.
- [x] **Resize effect** (empty deps, runs once on mount): calls `window.addEventListener('resize', handleResize, { passive: true })`. Also calls `handleResize()` synchronously on mount to handle windows that open at a narrow width. The handler:
  - If `innerWidth < 768 && isOpenRef.current` → sets `wasAutoCollapsedRef.current = true`, calls `setIsOpen(false)`, dispatches `showChatbar: false`. **Does NOT write localStorage.**
  - If `innerWidth >= 768 && !isOpenRef.current && wasAutoCollapsedRef.current` → clears the flag, calls `setIsOpen(true)`, dispatches `showChatbar: true`. **Does NOT write localStorage.**
  - Condition guards prevent repeated toggling of an already-correct state (no thrashing on rapid resize).
- [x] **`handleToggle` updated**: sets `wasAutoCollapsedRef.current = false` before toggling. Ensures any user-initiated collapse/expand is not mistaken for an auto-collapse, preventing unwanted auto-expand when the window later widens.
- [x] **localStorage NOT touched during auto-collapse/expand** — preserves user's stored preference. When the window narrows and widens back, the sidebar returns to the user's last manual preference, not some transient state.

**Behaviour table (code-traced):**

| Scenario | Result |
|---|---|
| Window starts < 768px | Sidebar auto-collapses on mount |
| Window starts ≥ 768px | No change |
| Wide → drag below 768px | Auto-collapses |
| Auto-collapsed → drag above 768px | Auto-expands |
| User manually collapses → narrow → wide | Stays collapsed (user's choice) |
| User manually expands while < 768px | `wasAutoCollapsedRef` cleared; stays open until next resize event fires |
| Rapid resize back and forth | No thrashing — guards prevent toggling already-correct state |

### Phase 19 — Remaining Port Work (NEXT)
- [x] Responsive: icon rail at 760-1099px ✅ resolved
- [x] Responsive: off-canvas drawer <760px ✅ resolved
- [x] `prefers-reduced-motion` audit for most existing transitions (A11y Pass 1, 2026-08-14):
  AttachmentRail height, attachMenuEnter/modelPickerEnter keyframes, action row opacity fade,
  composer cross-fade, message collapse, hover transitions all now gated. AttachmentPreview
  FLIP already gated in its own component JS. Remaining gap: `animation: attachment-spinner`
  for the upload spinner in AttachmentCard (indeterminate spinning arc) not yet reduced-motion
  gated — add `@media (prefers-reduced-motion: reduce) { .attachment-spinner { animation: none } }`
  in a future pass.
- [ ] Light mode polish for new components (non-admin areas)
- [ ] Settings → Usage section — **requires backend work first; deferred as backend TODO after rework**
- [ ] Settings → Capabilities section
- [ ] Custom Instructions overhaul (Task 16): multiple named sets (save/update/name), select the
  active set, wire it into `handleNewConversation` so it is applied to ALL new conversations. The
  current single-value `amplify_custom_instructions` key is NOT injected into any conversation.
  UX must make clear the active set is appended to all chats including those with assistants.
- ~~New-UI styling pass for Notebook view~~ — **out of scope for this rework** (intentional)
- [ ] Conversation fork surfaced in new UI
- ~~Import / Export / Clear conversations~~ — **intentionally removed from new UI**
- [ ] Memory dialog surfaced in new UI
- [ ] See `NEW_UI_PORTING_STATUS.md` for full tracking

---

## 13. Key Patterns & Conventions

### Always Do
1. **Read this doc before starting** any session
2. **Update this doc** after any significant change
3. **Use reusable components** from `components/NewUI/shared/`
4. **Check feature flags** — new features should respect `featureFlags`
5. **Support dark + light mode** for every component
6. **Use Tabler Icons** (`@tabler/icons-react`) for all icons
7. **Keep backend-touching code unchanged**

### Component Template
```tsx
import React from 'react';
// imports...

interface Props {
  // typed props
}

export const ComponentName: React.FC<Props> = ({ ... }) => {
  // hooks at top
  // handlers
  return (
    // JSX with dark: variants for every color
  );
};

export default ComponentName;
```

### Dark Mode Pattern
Always use Tailwind's `dark:` variant:
```tsx
<div className="bg-[--bg-sidebar] text-[--text-primary]">
  // OR
<div className="bg-white dark:bg-[#1F1E1D] text-gray-900 dark:text-[#FAF9F5]">
```

**Light-mode gotcha when wrapping old components in new-UI modals:**
Old admin/settings components often relied on a parent wrapper that set the inherited text color
(e.g. `AdminUI` had `<div className="text-black dark:text-white">`). When you render these
components inside a new-UI modal that doesn't have that wrapper, any element that only sets
`dark:text-*` (without a matching light-mode `text-*`) will have no light-mode text color and may
be invisible or very low contrast on the white/light-gray modal background.

**The fix:** Add `className="text-neutral-900 dark:text-white"` to the outermost content div of
any new-UI modal that renders old components. This restores the inheritance chain. See
`NewAdminModal`'s right content pane for the reference implementation.

Specific old-component color patterns to watch for:
- `dark:text-neutral-100` / `dark:text-white` with no preceding light `text-*` → add `text-neutral-700` or `text-neutral-900`
- `text-blue-100` / `text-neutral-200` without `dark:` prefix → these are *always* near-white, usually an error; replace with a visible color like `text-blue-500`
- `text-[#0bb9f4]` or similar bright cyan → contrast ~2.2:1 on white; use `text-[#0284c7]` (darker) for light, original for dark

### Event Bus Pattern (existing, keep using)
The app uses `window.dispatchEvent(new CustomEvent(...))` for cross-component communication:
- `homeChatBarTabSwitch` → switch sidebar tab
- `openArtifactsTrigger` → open/close artifacts
- `updateFeatureSettings` → feature flags changed
- `openScheduledTasksTrigger` → navigate to the Scheduled Tasks full-pane view (`page='scheduledTasks'`), carrying an optional prefilled `ScheduledTask` via the sessionStorage bridge (see below)
- `openSettingsTrigger` → open settings to a tab
- `openAstAdminInterfaceTrigger` → open assistant admin
- `openNewUIAdminPanel` → (new) open settings modal to admin section (dispatched by AccountMenu admin button, received by NewSidebar)

### Pending-Message Bridge Pattern
When `NewHome` creates a new conversation, it stores the typed message (and optionally attached docs + selected model ID) in `sessionStorage` before calling `handleNewConversation`. Then `ConversationViewShell` — which mounts when the conversation view renders — polls for `#messageChatInputText` (textarea) and `#sendMessage` (button), injects the text via React's native setter trick (`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, val)` + `input`/`change` events), then clicks send. This lets the full `ChatInput` pipeline (assistants, plugins, file attachments) handle the send without touching `Chat.tsx`.

**Generalized one-shot sessionStorage handoff** (same pattern, simpler consumer): any time an old-UI
event carries a payload that a new full-pane view needs after a `page` switch, write the payload to a
dedicated `sessionStorage` key just before dispatching the page change, then have the view's own
`useMemo`/`useEffect` on mount read + immediately `removeItem` that key. No DOM-polling is needed unless
the payload must be injected into a native input (only the message-bridge case needs that). Example:
`NewSidebar.tsx`'s `openScheduledTasksTrigger` listener writes `amplify_pending_scheduled_task`
(`JSON.stringify`'d `ScheduledTask`) before dispatching `page: 'scheduledTasks'`; `NewScheduledTasksView`
consumes it via `useMemo` on mount.

### Image Thumbnail Gotcha — handleFile Wipes doc.raw
`handleFile` (from `components/Chat/AttachFile.tsx`) sets `doc.raw = ""` (empty string) on the `AttachedDocument` it passes to `onAttach`. This means you **cannot** generate a thumbnail from `doc.raw` inside `addDocument`.

**The correct pattern:**
```ts
const addFileToRail = (file: File) => {
  let intercepted = false;
  const wrappedAdd = (doc: AttachedDocument) => {
    if (!intercepted) {
      intercepted = true;
      const thumbUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      if (thumbUrl) thumbUrlsRef.current[doc.id] = thumbUrl;
    }
    addDocument(doc); // passes thumbUrl via createUIAttachmentFromDoc(..., thumbUrl)
  };
  handleFile(file, wrappedAdd, ...);
};
```
Always revoke object-URLs on remove and on send to avoid memory leaks.

### Image Paste Pattern
Both `RichComposer` (`onImagePaste` prop) and the plain `<textarea>` in `ConversationComposer` (`onPaste` handler) check `clipboardData.items` for `image/*` entries **before** any text-paste logic. This covers screenshots (⌘⇧4 then ⌘V on macOS) and images copied from browsers/apps.

### Date Parsing — Timezone Gotcha
**Never** use `new Date("YYYY-MM-DD")` to parse a date-only string for local date comparison. ISO date-only strings are parsed as UTC midnight, which shifts to the previous calendar day in any timezone west of UTC.
**Always** use:
```ts
const [, y, m, d] = "2026-08-06".match(/^(\d{4})-(\d{2})-(\d{2})$/)!.map(Number);
const localDate = new Date(y, m - 1, d); // local midnight — correct
```
Full ISO timestamps (`2026-08-06T18:23:00.000Z`) are fine to parse normally — they have an explicit UTC offset.
The `parseDateForBucket()` helper in `NewSidebar.tsx` implements this correctly.

### Shared-id/shared-class CSS scoping gotcha (Phase 28)
Several protected components under `components/Chat/ChatContentBlocks/` reuse the SAME id or class
across many unrelated call sites — most notably `ExpansionComponent.tsx`, which hardcodes
`id="expandComponent"` and `className="border-l border-gray-300 dark:border-gray-600 ..."` on every
single instance it renders, regardless of which parent uses it (`AssistantReasoningMessage`,
`ChatSourcesBlock`, `AgentLogBlock`, `RagEvaluationBlock`, `ChatCodeInterpreterFilesBlock`,
`RemovedDataSourcesBlock`, `ChatContentBlock`'s MCP/Jupyter/Source/Result blocks, and ~10 more outside
the chat tree). **Before writing a CSS rule targeting `#expandComponent`, `.border-l.border-gray-300`,
or any other id/class you find inside a shared/reusable protected component, grep for every consumer
of that component first** (`grep -rn "ExpansionComponent" components/`) and scope your selector through
a class that's unique to the ONE call site you actually mean, not the shared wrapper's own markup. The
Phase 28 reasoning-block redesign found and fixed exactly this bug in Phase 12/15/26's CSS (which had
been unscoped since Phase 12) — see `styles/conversation-view.css`'s "AssistantReasoningMessage /
ExpansionComponent" section for the fix and the reasoning-only scoping class
(`.text-sm\!important.opacity-70`, from `AssistantReasoningMessage.tsx` line 38) now used everywhere.

### ConversationViewShell data attributes (Phase 30)
`ConversationViewShell` exposes two data attributes on its root `<div>` for CSS-driven state:

| Attribute | Value | Set by | Used by |
|---|---|---|---|
| `data-new-ui` | `"true"` | static | all `[data-new-ui="true"]` CSS rules in conversation-view.css |
| `data-streaming` | `"true"` / absent | effect on `messageIsStreaming` | `[data-streaming="true"] .h-[300px]::after` (asterisk full-opacity + pulse); Phase 43: `[data-streaming="true"] .group...bg-gray-50 .animate-pulse { visibility:hidden }` (hides ChatLoader dot once PromptStatus dot is active) |
| `data-body-face` | `"serif"` / `"sans"` | effect on `amplify_chat_font` localStorage key, updated via `amplifyChatFontChanged` event | font-family selector blocks in conversation-view.css |
| `data-anchor-freeze` | `"true"` / absent | Phase 41: set when a message is sent, cleared by `reduceRoomTo` as the room is handed back (capped so it never moves the view) | `[data-anchor-freeze="true"] .h-[300px] { margin-top: var(--new-ui-anchor-room, 0px) }` — reserves the scroll room that makes prompt-at-top anchoring reachable and keeps BOTH of Chat.tsx's auto-scroll gates reading "not at bottom". 🛑 Never set `height` here — that div is also Chat.tsx's IntersectionObserver sentinel; see Phase 41a |
| `--new-ui-anchor-room` (CSS custom property, not an attribute) | px value, e.g. `"431px"` | Phase 41: written next to `data-anchor-freeze`, shrinks to 0 during streaming | consumed by the `margin-top` rule above. Set imperatively via `style.setProperty` on the shell; React's style diffing only writes changed keys so it survives re-render, and the `var()` fallback of `0px` degrades safely |

Pattern: when you need CSS to respond to React state that lives in a protected component (like `messageIsStreaming` in Chat.tsx) or a user preference (like Chat font), set a data-attribute on the shell element from ConversationViewShell and write attribute-selector CSS. This avoids runtime inline style updates and keeps the CSS declarative.

### Custom Instructions (formerly "System Prompt")
`localStorage.getItem('amplify_custom_instructions')` stores the user's global custom instructions.
- Set via Settings → Customize → Custom Instructions
- The old `SystemPrompt.tsx` component labeled this field "Custom Instructions" in the old UI; this is the same concept now surfaced as a settings section
- **TODO Phase 16:** Wire this into `handleNewConversation` in `home.tsx` so new conversations use it as the system prompt instead of (or prepended to) `DEFAULT_SYSTEM_PROMPT`
- Key: `amplify_custom_instructions`, max 4000 chars

### RAG / Web Search Wiring Gap (Phase 24 investigation; Web Search fixed Phase 25)

**Web Search** — fixed via `components/NewUI/shared/webSearchPreference.ts`. `getActivePlugins()` in Chat.tsx always overrides `WEB_SEARCH` from `settings.featureOptions.includeWebSearch` (not from `conversation.data`). Fix: `persistWebSearchPluginPreference()` forces that localStorage value on when the toggle is enabled. Known limitation: first message in an already-open conversation immediately after first-ever toggle may miss the plugin; all subsequent/new/reloaded conversations work.

**RAG** — no RAG toggle exists in `components/NewUI/`. "Add from library" is a document picker only. To build a toggle: replicate `webSearchPreference.ts` pattern + dispatch `ragOn` to HomeContext. Deliberately out of scope — see porting status §2 for tracking.

### Controlling chat scroll behaviour without touching `Chat.tsx` (Phase 41)
`Chat.tsx` is DO-NOT-CHANGE, but its scrolling **is** controllable from
`components/NewUI/` — not by fighting it with competing scrolls, but through the single
input it derives all its behaviour from.

Every auto-scroll in `Chat.tsx` is gated on `autoScrollEnabled && !isUserScrolling`, and
its `onScroll` handler recomputes `setAutoScrollEnabled(isAtBottom)` where
`isAtBottom = scrollTop + clientHeight >= scrollHeight - 30` (~L906-935). Both flags are
local `useState` and are **not** exposed on `HomeContext` (grep-verified), so they can't be
set directly.

**But `handleScroll` is only ONE of two writers.** An `IntersectionObserver` (L1185-1199)
also does `setAutoScrollEnabled(entry.isIntersecting)` on the bottom sentinel, gated only on
`!isUserScrolling` (which self-clears 500ms after the user stops). **Both** must read "not at
the bottom" or auto-scroll comes straight back on, repeatedly.

**Therefore:** to stop auto-scroll, leave `.chatcontainer` more than 30px from the bottom
**and** keep the sentinel entirely off screen; to allow it, return to the bottom. Express any
"don't auto-scroll" requirement as a scroll-position outcome, never as an attempt to
out-scroll `Chat.tsx`.

Four traps found the hard way in Phase 41 / 41a:
1. **The bottom spacer IS the observer sentinel.** One div, both `className="h-[300px]"` and
   `ref={messagesEndRef}` (L1743-1746). 🛑 Never change its height to make layout room — that
   silently re-enables auto-scroll. Add space *around* it (`margin-top`) instead.
2. **`isIntersecting` is true for ANY overlap.** A `threshold` only controls when the callback
   *fires*, never what counts as intersecting. "Mostly off screen" is not off screen.
3. **Reachability.** `scrollTop` is capped at `scrollHeight - clientHeight`. Parking a short
   message near the top needs roughly a viewport of content *below* it, or the browser clamps
   and the scroll silently under-shoots.
4. **Shrinking content jumps the view.** Removing reserved space lowers `scrollHeight`, which
   clamps `scrollTop` if the user is near the bottom. The invariant: **never let
   `scrollHeight` drop below `scrollTop + clientHeight`** — cap every reduction at
   `scrollHeight - clientHeight - scrollTop`. All-or-nothing releases guarded only by a
   boolean check still moved content 431px in testing.

Also note `.chatcontainer`'s `mask-image` reaches full opacity only at **80px**, so anything
positioned above that renders partially transparent — the container's `padding-top` is 80px
to match (Phase 41).

### CSS animations as a "new content arrived" signal (Phase 41)
A CSS `animation` starts when its selector **begins to match**, not only when an element is
inserted. This makes `animation` a free per-chunk arrival cue for streamed content (new
elements animate themselves once, with no JS and no per-token cost) — but it also means a
state-toggling ancestor selector like `[data-streaming="true"] … .prose > *` will
**re-animate every already-rendered element the instant the state flips**. Phase 41's first
draft did exactly that and would have re-faded every previous answer on every send.

Scope such rules to the one subtree that is actually changing. For the streaming message
that is `.enhanced-chat-message.assistant-message:not(:has(~ .enhanced-chat-message.assistant-message))`
("no later assistant sibling"), which is valid because `.enhanced-chat-message` is each
`ChatMessage`'s root element in a flat `.map()` (`Chat.tsx:1700-1736`) — all messages are
true siblings. **Verify this class of rule by inspecting `element.getAnimations()` on both a
new and a pre-existing node; it is not reliably reviewable by reading the selector.**

### Admin Panel in New UI
`featureFlags.adminInterface` (fetched from admin API on load) gates all admin entry points:
- Sidebar nav item "Admin" (`IconShield`) → `setSettingsSection('admin')` 
- AccountMenu → "Admin Panel" → dispatches `openNewUIAdminPanel` event → sidebar listener sets section
- Settings modal nav "Admin" group → clicking opens `AdminUI` as a **peer modal** (not embedded in settings content)
- `AdminUI` is rendered as a sibling element inside `NewSettingsModal`'s return, z-stacked on top

### Auto-Collapse with User-Override Preservation (Phase 57)

When a `useEffect` auto-changes a state value that the user can also change manually, you need a way to distinguish "the system changed this" from "the user changed this" so you can avoid silently undoing the user's choice.

**Pattern: `wasAutoChangedRef` boolean flag**

```ts
// Tracks whether the state was changed programmatically (not by user).
const wasAutoCollapsedRef = useRef(false);

// In the programmatic handler:
wasAutoCollapsedRef.current = true;
setIsOpen(false);
// NOT writing to localStorage — transient, not a preference

// In the "undo" condition:
if (shouldRestore && wasAutoCollapsedRef.current) {
  wasAutoCollapsedRef.current = false;
  setIsOpen(true);
  // NOT writing to localStorage — restoring prior preference
}

// In any user-initiated handler (e.g. handleToggle):
wasAutoCollapsedRef.current = false; // user owns this state now
```

**Rules:**
- **Never write to localStorage during auto-collapse/expand** — the user's stored preference should survive transient viewport changes.
- **Clear the flag on any user action** — once the user explicitly toggles, they own the state and the auto-logic should not override them.
- Use a `ref` (not state) for the flag so it updates synchronously without causing re-renders or stale closures in the resize handler.
- The stale-closure problem for the primary state variable (`isOpen`) is solved separately with an `isOpenRef` that mirrors the state in a `useEffect([isOpen])` — the resize handler reads the ref, never the state directly.

**Used by:** `NewSidebar.tsx` `SIDEBAR_AUTO_COLLAPSE_THRESHOLD = 768` resize logic (Phase 57).

---

## 13b. Accessibility Findings — Pass 1 (WCAG 2.1/2.2 AA — 2026-08-14)

**Target:** WCAG 2.1/2.2 Level AA. Scope: all components in `components/NewUI/`.
**Result:** 8 Critical fixed, 5 Major fixed, 4 Major deferred (TODO), 3 Minor findings noted.

---

### CRITICAL — Fixed in this pass ✅

**C1 — Color contrast: `--text-muted` fails 4.5:1 AA in both modes (SC 1.4.3)**
- **Light mode `#888888`** on `--bg-app` (#fff): 3.41:1 | on `--bg-sidebar` (#f9f9f9): 3.26:1 — both fail.
- **Dark mode `#8A8780`** on `--bg-raised` (#30302E): 3.84:1 — fails.
- `--text-muted` is used for timestamps, placeholders, captions, the PromptStatus step line, model description text, and other normal-size UI text that must meet 4.5:1.
- **Fix applied:** `--text-muted` updated to `#6E6E6E` (light, 5.02:1 on white ✅) and `#9E9C96` (dark, passes all surfaces ✅) in `globals.css`.

**C2 — NewSettingsModal: no focus trap (SC 2.1.2 / 4.1.2)**
- Modal opened without moving focus into it. Tab key could exit the modal.
- **Fix applied:** `NewSettingsModal.tsx` — added `panelRef` + `useEffect` that (a) focuses the panel on open and (b) traps Tab/Shift-Tab within all focusable children. Escape already worked. Added `aria-labelledby="settings-modal-heading"` and `tabIndex={-1}` on the panel. Added `id="settings-modal-heading"` to the h2.

**C3 — NewAdminModal: no focus trap (SC 2.1.2 / 4.1.2)**
- Same as C2 for the admin modal.
- **Fix applied:** `NewAdminModal.tsx` — same focus trap pattern + `aria-labelledby="admin-modal-heading"` + `id="admin-modal-heading"` on the title span.

**C4 — AttachmentPreview: focus trap was partial (SC 2.1.2)**
- Close button was focused on open (`closeBtnRef.current?.focus()`) but Tab cycling was not implemented — Shift+Tab on the close button did not cycle to the last focusable element.
- **Fix applied:** `AttachmentPreview.tsx` — added full Tab/Shift-Tab cycling within the panel in the existing `handleKeyDown` useEffect.

**C5 — ConversationComposer textarea: no accessible label (SC 4.1.2)**
- The `<textarea>` had only a `placeholder` attribute, which is not a substitute for an accessible label (screen readers may not announce it reliably).
- **Fix applied:** `ConversationComposer.tsx` — added `aria-label="Message input"` and `aria-multiline="true"`.

**C6 — AccountMenu: popover opens without moving focus (SC 2.1.1)**
- The `role="menu"` popover opened without shifting focus into it. Keyboard users could not interact with menu items without extra Tab presses.
- **Fix applied:** `AccountMenu.tsx` — added focus to first `[role="menuitem"]` on open.

**C7 — PromptStatus streaming state not announced to screen readers (SC 4.1.3)**
- While the assistant streams a response, the in-stream "Amplify is thinking…" step line (`.rounded-xl.shadow-lg`) had no `aria-live` attribute. Screen reader users received no feedback that the AI was working.
- **Fix applied:** `ConversationViewShell.tsx` — added a DOM effect (MutationObserver + retry) that injects `aria-live="polite"` and `aria-atomic="false"` onto `.rounded-xl.shadow-lg` elements whenever they enter the DOM. Follows same pattern as the pending-message bridge. `PromptStatus.tsx` itself is DO-NOT-CHANGE.

**C8 — IconButton: no `aria-label` prop (SC 4.1.2)**
- `IconButton` only accepted `title` for tooltip text; there was no way for consumers to set an explicit `aria-label` separate from the tooltip.
- **Fix applied:** `IconButton.tsx` — added `aria-label` prop (falls back to `title` if absent). `SidebarHeader.tsx` updated to pass explicit `aria-label` values on both icon buttons.

---

### MAJOR — Fixed in this pass ✅

**M1 — prefers-reduced-motion: many transitions unaudited (SC 2.3.3)**
- Phase 26 gated thinking-shimmer and reasoning-settle-in. All other transitions (AttachmentRail height, menu open/close, action row fade, composer cross-fade, message collapse, hover transitions) were unaudited.
- **Fix applied:** `conversation-view.css` — added `@media (prefers-reduced-motion: reduce)` block that disables: AttachmentRail height transition, attachMenuEnter/modelPickerEnter keyframes (instant instead of translateY+scale), action row opacity fade, composer cross-fade, message collapse animation, composer card border transition, all button hover transitions within `[data-new-ui]`.

**M2 — AttachMenu primary panel missing `aria-label` for primary menu (SC 4.1.2)**
- The primary `role="menu"` div lacked `aria-label`. Already had `aria-label="Add to chat"`.
- Actually already had `aria-label="Add to chat"` — confirmed no fix needed for primary panel.

**M3 — ModelPicker primary panel missing `aria-label` (SC 4.1.2)**
- Primary `role="menu"` div had no `aria-label`.
- **Fix applied:** `ModelPicker.tsx` — added `aria-label="Select model"`.

**M4 — SegmentedControl tablist missing `aria-label` (SC 4.1.2)**
- `role="tablist"` had no `aria-label`. Screen readers would announce only "tab list" with no context.
- **Fix applied:** `SegmentedControl.tsx` — added `aria-label` prop (defaults to item labels joined by " / " if not provided).

**M5 — AttachMenu badge dot: decorative span untagged (SC 1.1.1)**
- The `<span>` badge dot on the ⊕ trigger had no text and no `aria-hidden`. Screen readers would encounter it as an unnamed element.
- **Fix applied:** `AttachMenu.tsx` — added `aria-hidden="true"` to the badge span.

**M6 — Skills submenu loading state not announced (SC 4.1.3)**
- The "Loading…" text in the Skills submenu had no `aria-live`. Screen readers wouldn't know when skills finished loading.
- **Fix applied:** `AttachMenu.tsx` SkillsSubmenu — added `aria-live="polite"` and `aria-busy={loading}` to the list container div.

---

### MAJOR — Deferred (TODO — needs scoped session)

**MD1 — "Reasoning" / "Thought process" announced incorrectly by screen readers**
- `ExpansionComponent.tsx` (DO-NOT-CHANGE) hardcodes the text "Reasoning" inside the reasoning disclosure toggle. CSS hides it and adds a `::after` pseudo-element with "Thought process" — but CSS-generated content is not reliably announced by all screen readers. Assistive technology will announce "Reasoning" (the real DOM text) regardless of the CSS substitution.
- **Fix:** requires either modifying `AssistantReasoningMessage.tsx` (protected) to pass a different `title`/`aria-label` prop to `ExpansionComponent`, or adding a React `aria-label` override via a DOM effect in `NewUIUserMessageMarkdownLayer` or `NewUIMessageActionsLayer` (same DOM-injection pattern as the aria-live fix). The second approach is feasible but needs careful scoping to only affect the reasoning block, not the ~20 other `#expandComponent` call sites.
- **Status:** TODO — flagged but not attempted this session.

**MD2 — AttachmentRail: roving tabindex not fully implemented (SC 2.1.1)**
- Wiki claims roving tabindex; `handleRailKeyDown` tracks `focusedIdx` but never sets `tabIndex` on individual card face buttons. All cards default to `tabIndex=0` and are Tab-sequentially focusable (more accessible than broken roving tabindex, but inconsistent with spec).
- **Fix:** pass `tabIndex={idx === focusedIdx ? 0 : -1}` from `AttachmentRail` to each `AttachmentCard`, and set `tabIndex={-1}` on card face buttons by default (letting rail manage focus programmatically). Requires `AttachmentCard` to accept a `tabIndex` prop on its face button.
- **Status:** TODO — current behavior (all cards focusable) is accessible, but not spec-compliant. Low priority.

**MD3 — NewSettingsModal: keyboard-only flow for Settings → Skills / Connectors subviews**
- `SkillsLibrary`, `IntegrationTabs`, and `MCPServersTab` are wrapped old-UI components inside `NewSettingsModal`. Their internal focus management, keyboard nav, and ARIA are inherited from the old UI and not audited here per task scope.
- **Status:** TODO — flagged as "inherited from wrapped component — needs upstream fix."

**MD4 — NewScheduledTasksView / NewLibraryView / NewAssistantsView: not audited**
- These full-pane views were not included in Pass 1 scope. They wrap old-UI sub-widgets (CronScheduleBuilder, etc.) without accessibility improvements.
- **Status:** TODO — needs a dedicated Pass 2 for views.

---

### MINOR — Noted, no fix applied

**m1 — `--accent` contrast (RESOLVED — Phase 50)**
- The send button was previously orange (#D97757) with dark glyph (#2A1710). That combination was borderline at 2.95:1 (SC 1.4.11 requires 3:1 for UI components).
- **Phase 50 fix:** `--accent` changed to Majk blue (#3b82f6 light / #006FEE dark). Blue-500 on --bg-raised (#f2f2f0): ~3.97:1 — passes SC 1.4.11. Glyph changed to white (`--accent-fg`). White on #3b82f6: ~3.9:1 (passes). White on #006FEE: ~4.6:1 (AA). **Status: RESOLVED.**

**m2 — AccountMenu: no arrow-key navigation within `role="menu"` (SC 2.1.1)**
- The `role="menu"` pattern recommends ↑/↓ arrow key navigation between `role="menuitem"` items (ARIA Authoring Practices Guide). Currently only Tab/Shift-Tab work.
- **Status:** Minor friction. Current behavior (Tab-through menu items) is functional. Arrow key support is an enhancement for ARIA-menu compliance.

**m3 — Timestamp text color (`--text-muted`) on `--bg-active`: borderline**
- Message action row timestamps use `--text-muted` (now #9E9C96 dark). On `--bg-active` (#3A3A38 dark): L(#9E9C96) ≈ 0.363, L(#3A3A38) ≈ 0.047. Ratio = (0.363+0.05)/(0.047+0.05) = 0.413/0.097 ≈ **4.26:1** — just below 4.5:1 for the dark mode active state. Timestamps only appear on hover so this is acceptable; the C1 fix moved the baseline up enough to pass all non-active surfaces.
- **Status:** Monitor. No fix applied (timestamps appear over `--bg-app` or transparent backgrounds in practice, not over `--bg-active`).

---

## 14. Sidebar Spec Reference

The full sidebar design spec is at: `/Users/maxmoundas/Downloads/sidebar-shell-spec.md`

Key measurements:
- Sidebar: 310px fixed, `--bg-sidebar: #1F1E1D` (dark)
- Header: 48px, `padding: 0 14px`
- Nav rows: 36px h, 8px radius, 10px x-padding
- Recents rows: 32px h
- Account row: 56px h
- Settings popover: 288px wide, opens upward, `--bg-raised` bg

---

## 15. UI Preference & Load Balancer Notes

Per product direction:
- User selection triggers the new UI session
- Set cookie `X-Amplify-UI=new` when user opts in (for future LB routing)
- Load balancer listener rule #3 on port 443 will eventually route `X-Amplify-UI: new` header to new target group
- This cookie mechanism is future-proof — implement the cookie-setting now even if LB rule isn't live yet
- Classic UI remains fully functional; no features are removed

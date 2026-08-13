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
/* New UI tokens — Claude-inspired */
:root {
  --bg-app:        #ffffff;
  --bg-sidebar:    #f9f9f9;
  --bg-raised:     #f0f0f0;
  --bg-hover:      #ebebeb;
  --bg-active:     #e0e0e0;
  --border-subtle: #e5e5e5;
  --text-primary:  #1a1a1a;
  --text-secondary:#555555;
  --text-muted:    #888888;
  --accent:        #D97757;  /* Amplify orange accent */
}
.dark {
  --bg-app:        #262624;
  --bg-sidebar:    #1F1E1D;
  --bg-raised:     #30302E;
  --bg-hover:      #2F2E2C;
  --bg-active:     #3A3A38;
  --border-subtle: #33322F;
  --text-primary:  #FAF9F5;
  --text-secondary:#C2C0B6;
  --text-muted:    #8A8780;
  --accent:        #D97757;
}
```

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
    SidebarHeader.tsx        ← wordmark ✳ + collapse + search buttons (48px)
    SidebarNavItem.tsx       ← REUSABLE nav row (icon + label + rest/hover/active/focus states)
    SidebarSection.tsx       ← REUSABLE section heading ("Pinned", "Recents") with optional right slot
    ConversationRow.tsx      ← REUSABLE recent chat row with hover ⋯ menu (rename/delete)
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
                               Four tabs: My Assistants | Group Assistants | Prompt Templates | Layered Assistants
                               Each tab has: search, "+ New" creation button, list rows (not old gradient card grid)
                               All creation flows use AssistantModal / PromptModal / openLayeredBuilderTrigger
                               Group admin actions gate on featureFlags.assistantAdminInterface + GroupAccessType
                               Old AssistantGallery still renders in the classic-UI path — untouched.
  settings/
    NewSettingsModal.tsx     ← two-column settings modal. Props: onClose, openToSection?:string
    NewAdminModal.tsx        ← two-column admin panel (same shell as NewSettingsModal). Props: onClose, openToTab?:AdminTab
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
                               Sections: general|account|usage|storage|apikeys|customInstructions|
                                         skills|connectors|mcp|admin
                               Entry points: sidebar Customize (→skills), AccountMenu (→general), ⌘, (→general)
                               "Custom Instructions" is the rebrand of the system prompt / custom instructions
                               concept from the old UI. Stored in localStorage key: amplify_custom_instructions
  shared/
    SegmentedControl.tsx     ← REUSABLE segmented tab control (size: sm=sidebar, xs=composer)
    IconButton.tsx           ← REUSABLE 28×28/32×32 icon button with hover ring
    Badge.tsx                ← REUSABLE "Labs"-style pill badge
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
    ModelPicker.tsx          ← REUSABLE spec-compliant model+effort picker (model-picker-spec.md)
                               Props: selectedModelId, selectedEffort: EffortLevel, onModelChange, onEffortChange, composerRef?
                               Three surfaces: trigger → primary menu → effort|more-models submenu
                               Effort levels: 'low'|'medium'|'high'|'off' (maps to REASONING_LEVELS)
                               Uses Floating UI (useFloating) for primary menu, absolute for submenus
                               Used by: NewHome
                               Enter → sends, Escape inside block → exits to line after
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
| ≥1100px | Fixed 310px sidebar |
| 760-1099px | Collapses to 60px icon rail (labels in tooltips) |
| <760px | Off-canvas drawer behind hamburger |

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
- [x] `SidebarSection.tsx` — section heading (Pinned, Recents)
- [x] `ConversationRow.tsx` — recent chat with hover ⋯ menu (rename/delete)
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
Rewrote the positioning model in `NewUIMessageActionsLayer.tsx` and made two CSS fixes in
`styles/conversation-view.css`. Zero changes outside those two files (One-Directory Rule observed).

**Part 1 — `position: fixed` → `position: absolute` inside the scroll container:**
- [x] **Root cause of the scroll "lag/detach":** `position: fixed` rows were positioned from
  `getBoundingClientRect()` into React state and re-computed on every scroll frame via `rAF`. There
  is always ≥1 paint frame where the fixed row's viewport position doesn't match the message's new
  scroll position — intrinsic to reading DOM position into React state; no listener/rAF tuning can
  close it.
- [x] **The fix:** rows are now `position: absolute` children of an overlay div (`.new-ui-actions-overlay`,
  `position:absolute; inset:0; pointer-events:none; overflow:visible`) that is `createPortal`'d
  **directly into `.chatcontainer`** (the scroller) as its last child — the same proven portal
  pattern as `NewUIUserMessageMarkdownLayer` (which portals into each `#chatHover`). Because the rows
  live *inside* the scroller, they scroll with the content automatically — **zero scroll listeners,
  zero rAF, no per-frame position state anywhere in the component.**
- [x] `computePosition()` fully replaced. New `offsetWithin(el, container)` helper walks the
  `offsetParent` chain from the anchor (`#chatHover`) up to `.chatcontainer`, summing
  `offsetTop`/`offsetLeft` to get the element's edge in container scroll coordinates. Row `top` =
  `anchorTop + anchor.offsetHeight + GAP(6px)`. Assistant `left` = anchor's `offsetLeft`. User
  `right` = `container.clientWidth - (offsetLeft + offsetWidth)`. **No `getBoundingClientRect()`
  anywhere** — these are pure layout values, stable regardless of scroll position.
- [x] `.chatcontainer` made `position: relative !important` in `conversation-view.css` so it is the
  offsetParent / containing block for the overlay and its rows. (`.enhanced-chat-message` are direct
  children of `.chatcontainer`; `#chatHover` sits inside a `position:relative`
  `.enhanced-message-content` — the offsetParent walk terminates cleanly at `.chatcontainer`.)
- [x] Removed the `position` React state from `ActionRow`; position is passed on the `Slot` and set as
  an inline `top`/`left`/`right` on the absolute row. Recompute happens only in `scan()` — triggered
  by the existing `MutationObserver` (subtree, 120ms debounce; now ignores mutations inside our own
  overlay to avoid a rescan loop) + the message-count/streaming effect + a debounced `window` **resize**
  listener (resize changes column width → row edges; this is a layout change, deliberately NOT a scroll
  listener). Overlay is created on attach and removed on cleanup.

**Part 2 — Removed the always-visible last-assistant row (per user request):**
- [x] `scan()` no longer computes `isLastAssistant`; the field was removed from `Slot` entirely.
- [x] `data-last-assistant` attribute assignment removed from the row div.
- [x] `.new-ui-msg-action-row[data-last-assistant="true"]:not(:hover):not(:focus-within){opacity:.6}`
  rule removed from `conversation-view.css` (replaced with a note). Rows now appear on hover/focus
  only, for every message including the last.
- [x] `ActionRow` visibility simplified to `const visible = hovered || focused;`.

**Part 3 — Hover-disappear fix + removed `pointermove` keep-alive:**
- [x] Removed the Phase 32 `pointermove` keep-alive `useEffect` (and its 60px proximity-zone logic) —
  it was a workaround for the fixed-position gap and is unnecessary now the row is in-flow, 6px below
  the content inside the same scroll container (tiny pointer travel).
- [x] Hide grace timer reduced from 600ms → **200ms** in both `onMouseOut` and `handleRowHoverChange`
  — the disappear-on-move issue resolves because the row is now adjacent in the DOM (portal child of
  `.chatcontainer`) rather than a floating fixed overlay outside the message. `hideTimerRef` cancel on
  row-enter retained.

**Part 4 — CSS spacing fixes (`conversation-view.css`):**
- [x] **(a)** `.text-sm\!important.opacity-70` (reasoning block outer wrapper) `margin-bottom`
  `26px → 10px` — user reported too much space between "Thought process" and the response below.
- [x] **(b)** Added `padding-bottom: 36px` to `.enhanced-chat-message` (longhand after the existing
  `padding: 0 !important` shorthand — both `!important`, longhand wins for the bottom edge only) to
  reserve space for the now-in-flow absolute action row (6px GAP + ~24px row height + breathing room).

**Verified:** `tsc --noEmit` shows zero errors in `NewUIMessageActionsLayer.tsx` (the only remaining
errors are pre-existing `__tests__/**` + `utils/**/__tests__/**` test-runner-globals errors, unrelated
and predating this session). No scroll/resize-on-scroll/rAF/getBoundingClientRect references remain in
the component (grep-verified — all remaining "scroll" hits are in comments/docstrings).

**Not runtime-verified:** no browser automation available in this sandbox + Cognito login required, so
scroll lock-step and hover behaviour were verified by code-trace, not a rendered screenshot. Recommend
a human/future-session visual pass: (1) scroll a long conversation and confirm rows move in perfect
lock-step with messages (zero lag), (2) confirm rows appear on hover for every message incl. the last,
(3) confirm moving from a message toward its row keeps the row visible.

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
Four small targeted fixes; no new files, no new components. Only `styles/conversation-view.css`
and `components/NewUI/chat/NewUIMessageActionsLayer.tsx` touched (One-Directory Rule observed).

- [x] **Fix 1 — Content covered by the scroll-to-bottom button area** (`styles/conversation-view.css`)
  Root cause (user inspect-element): the `.chatcontainer` `mask-image` bottom transition band (from
  `#000` to `transparent` over the last ~200px) made content in that region semi-transparent; because
  the jump-button's outer wrapper div (`position:absolute; bottom:190px; left:0; right:0` in
  `ConversationViewShell.tsx`) spans the full width at exactly that scroll position, the faded band read
  visually as a bar covering the response text. Fix: removed the **bottom** fade from both `mask-image`
  and `-webkit-mask-image` on `[data-new-ui="true"] .chatcontainer` — now `transparent 0 → #000 80px →
  #000 100%` (top fade clearing the 52px header kept; bottom fade gone). This supersedes Phase 34 Fix 1's
  approach (which only exempted the overlay from the mask); the underlying content is no longer faded at
  the bottom at all, so no bar appears regardless of the overlay. The Phase 34 overlay-exemption rule is
  now harmless/redundant and left in place.
- [x] **Fix 2 — Still too much vertical space below AI responses** (`styles/conversation-view.css`)
  `.enhanced-chat-message.assistant-message` `padding-bottom` reduced `20px → 8px` (Phase 34 had reduced
  it 36px→20px; still too large per user). User-message value unchanged (36px, confirmed good).
- [x] **Fix 3 — Hover options disappear when moving between buttons** (`NewUIMessageActionsLayer.tsx`)
  Root cause: the action rows are portaled into `.new-ui-actions-overlay`, a real DOM child of
  `.chatcontainer`, so `mouseout` events fired while the pointer moves button→gap→button INSIDE a row
  bubble up to the container-level `onMouseOut` delegation and arm the 200ms hide timer — and nothing
  cancels it, because the row's own `onMouseEnter`/`onMouseLeave` don't re-fire for child-to-child
  transitions within the same element. Two-part fix:
  (a) `handleRowHoverChange`'s leave branch no longer starts a grace timer — it clears immediately
  (`setHoveredKey(prev => prev===key ? null : prev)`), because it is now driven by the row container's
  `mouseleave`, which does NOT bubble and only fires on genuine exit of the whole row.
  (b) the container-level `onMouseOut` now early-returns when the event's `target` OR `relatedTarget` is
  inside `.new-ui-actions-overlay` — intra-row movement and message→row travel no longer arm the hide
  timer at all. Row exit is handled authoritatively by the row's `mouseleave`. `ActionRow`'s
  `onMouseEnter`/`onMouseLeave` (→ `onHoverChange`) kept as-is. (Note: the instruction specified only
  part (a); part (b) was required in addition because the container delegation — not just
  `handleRowHoverChange` — was arming the timer, since the portal makes the overlay a real DOM descendant
  of the scroller. Verified by tracing the event path.)
- [x] **Fix 4 — "Thought process" label slightly too far left** (`styles/conversation-view.css`)
  Investigated the real offset chain (`AssistantReasoningMessage.tsx` + `ExpansionComponent.tsx`, both
  DO-NOT-CHANGE): the reasoning wrapper `.text-sm!important.opacity-70` has ONLY `mb-4` (no left
  padding/margin — nothing to zero on the wrapper). The rightward offset of the label "T" comes from
  INSIDE `#expandComponent`: it is `display:inline-flex; gap:6px`, and its children are the (now
  `display:none`, 0-width) caret icon then `<span class="font-medium" style="margin-left:8px">`. So "T"
  sat flex-gap(6) + span-margin(8) = ~14px right of the button content-left. The prior `margin-left:-18px`
  (derived from the `.border-l` block's border+padding, not the button's flex layout) overshot: -18+14 =
  -4px → label ~4px LEFT of the prose (the reported symptom). The literal `-4px` suggestion would land at
  +10px right. Exact fix: `#expandComponent { margin-left:0; gap:0 }` + new rule
  `#expandComponent .font-medium { margin-left:0 }` → "T" lands at exactly x=0 = the prose left edge,
  independent of the (0-width) hidden icon. (Deviated from the instruction's literal `-4px` because the
  DOM investigation it asked for revealed the true offset was the button's internal flex layout, making
  x=0 the exact target rather than any magic negative margin.)
- [x] **`tsc --noEmit` confirmed clean** — zero errors outside `__tests__/`; the 59 remaining errors are
  all pre-existing test-runner-globals / missing-dev-dep issues in `__tests__/**` + `utils/**/__tests__/**`,
  unrelated to and predating this session.

### Phase 19 — Remaining Port Work (NEXT)
- [ ] Responsive: icon rail at 760-1099px
- [ ] Responsive: off-canvas drawer <760px
- [ ] `prefers-reduced-motion` audit for all OTHER existing transitions (Phase 26 closed this for the
  new thinking-shimmer/reasoning-settle-in animations only; other pre-existing transitions —
  AttachmentRail entry animation, AttachMenu/ModelPicker open/close, AttachmentPreview FLIP, message
  action pill fade, etc. — are not yet audited for reduced-motion support)
- [ ] Light mode polish for new components (non-admin areas)
- [ ] Settings → Usage section (port `UserCostBreakdownModal`)
- [ ] Settings → Capabilities section
- [ ] Wire `amplify_custom_instructions` into `handleNewConversation` so new conversations use the saved custom instructions as their system prompt
- [ ] New-UI styling pass for Notebook view
- [ ] Conversation fork surfaced in new UI
- [ ] Import / Export / Clear conversations in new UI
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
| `data-streaming` | `"true"` / absent | effect on `messageIsStreaming` | `[data-streaming="true"] .h-[300px]::after` (asterisk full-opacity + pulse) |
| `data-body-face` | `"serif"` / `"sans"` | effect on `amplify_chat_font` localStorage key, updated via `amplifyChatFontChanged` event | font-family selector blocks in conversation-view.css |

Pattern: when you need CSS to respond to React state that lives in a protected component (like `messageIsStreaming` in Chat.tsx) or a user preference (like Chat font), set a data-attribute on the shell element from ConversationViewShell and write attribute-selector CSS. This avoids runtime inline style updates and keeps the CSS declarative.

### Custom Instructions (formerly "System Prompt")
`localStorage.getItem('amplify_custom_instructions')` stores the user's global custom instructions.
- Set via Settings → Customize → Custom Instructions
- The old `SystemPrompt.tsx` component labeled this field "Custom Instructions" in the old UI; this is the same concept now surfaced as a settings section
- **TODO Phase 16:** Wire this into `handleNewConversation` in `home.tsx` so new conversations use it as the system prompt instead of (or prepended to) `DEFAULT_SYSTEM_PROMPT`
- Key: `amplify_custom_instructions`, max 4000 chars

### Load-Time State Consumption Audit — RAG / Web Search Wiring Gap (Phase 24; Web Search resolved in Phase 25)
A static audit comparing classic-UI vs new-UI consumption of `home.tsx`'s on-mount state (see Phase 24
above) found that the new UI's plugin-driven request behavior (RAG, and likely Web Search) is not
actually wired into the outgoing chat request, despite UI controls existing for it. **Update (Phase 25,
2026-08-11): the Web Search half of this gap is now fixed** — see `components/NewUI/shared/webSearchPreference.ts`
and Phase 25 above. RAG remains unfixed because, on re-investigation, no RAG toggle exists anywhere in
`components/NewUI/` to fix — building one is new feature work, deliberately out of scope for that
bug-fix session. Record of the underlying mechanism kept below for anyone building the RAG toggle or
touching Web Search further:

- **How classic UI turns a toggle into request behavior:** classic `ChatInput.tsx` maintains a `plugins`
  array (of `Plugin` objects, keyed by `PluginID`) that IS what gets sent in the `ChatRequest` — see
  `Chat.tsx:199` (`const [plugins, setPlugins] = useState<Plugin[] | null>(null)`) and
  `Chat.tsx:512-517` (`createChatRequest`: `plugins: plugins ?? []`). Checking a plugin checkbox in
  `PluginSelector.tsx` mutates this array directly. `hooks/useChatSendService.ts:585-595` then reads
  `pluginIds.includes(PluginID.RAG)` from that array (combined with `featureFlags.ragEnabled`) to decide
  whether to skip RAG server-side. Separately, `ChatInput.tsx:1354-1366` keeps the *ambient*
  `HomeContext.state.ragOn` boolean in sync with whether `PluginID.RAG` is in that array — `ragOn` is
  consumed independently by `utils/fileHandler.ts`'s `resolveRagConfiguration` for upload-time
  embedding/caching behavior.
- **What the new UI does instead:** `ConversationComposer.tsx` and `NewHome.tsx` each keep their own
  local `webSearchEnabled` (and `selectedSkillIds`) React state, and on send persist it only to
  `conversation.data.webSearchEnabled`/`data.skills` (`ConversationComposer.tsx` `handleSend`,
  `handleUpdateConversation(... { key: 'data', value: {...} })`). **Nothing reads `conversation.data`
  back out into `Chat.tsx`'s local `plugins` state** — there is no effect anywhere that constructs a
  `plugins` array from `conversation.data` and feeds it to `Chat.tsx`. Since new UI reuses `Chat.tsx`
  unmodified (by design — see §10), and `Chat.tsx`'s `plugins` state is what actually reaches
  `createChatRequest`, the web-search toggle in new UI likely has no effect on the actual request.
  The same gap applies to RAG: nothing in `components/NewUI/` ever adds `PluginID.RAG` to any plugins
  array, and nothing ever dispatches `homeDispatch({field: 'ragOn', ...})`, so `state.ragOn` stays at
  its `home.state.tsx` default (`false`) forever in the new-UI path.
- **Two dead-write sessionStorage keys discovered:** `amplify_pending_web_search` and
  `amplify_pending_skills` are written by `NewHome.tsx` (lines ~195-198) but never read anywhere —
  `ConversationViewShell.tsx` only `removeItem`s them as part of its pending-message cleanup. They look
  like an intended-but-never-finished bridge (parallel to the working `amplify_pending_message`/
  `amplify_pending_docs`/`amplify_pending_model_id` bridge pattern documented above). A fix for the
  web-search/RAG gap could plausibly extend this exact bridge pattern instead of touching `Chat.tsx`,
  but that still needs a design pass to confirm `ConversationViewShell` (or a new hook) can safely
  inject into `Chat.tsx`'s plugin state via a DOM/event mechanism without modifying `Chat.tsx` itself —
  not attempted in this session; see `NEW_UI_PORTING_STATUS.md` for the tracked follow-up.

### Admin Panel in New UI
`featureFlags.adminInterface` (fetched from admin API on load) gates all admin entry points:
- Sidebar nav item "Admin" (`IconShield`) → `setSettingsSection('admin')` 
- AccountMenu → "Admin Panel" → dispatches `openNewUIAdminPanel` event → sidebar listener sets section
- Settings modal nav "Admin" group → clicking opens `AdminUI` as a **peer modal** (not embedded in settings content)
- `AdminUI` is rendered as a sibling element inside `NewSettingsModal`'s return, z-stacked on top

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

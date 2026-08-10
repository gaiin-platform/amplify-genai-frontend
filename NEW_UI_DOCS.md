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
- **Display/heading font:** system-ui fallback or add Newsreader/Instrument Serif for display text
- New UI uses Inter at `-0.005em` tracking for UI, larger serif for greeting

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
    NewUIMessageActionsLayer.tsx ← floating action pill for hovered messages (no props)
                               User messages: Copy + Edit (clicks hidden #editPrompt to trigger ChatMessage's existing edit+resend flow)
                               Assistant messages: Copy + Read Aloud (window.speechSynthesis, auto-cancel on stream)
                               Event delegation on .chatcontainer, 200ms DOM-ready retry, position:fixed pill.
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
    RichComposer.tsx         ← REUSABLE contentEditable composer with inline code block support
                               Props: onSend(markdown), onChange?(value), onLargePaste?(text), onImagePaste?(file), placeholder, editorClassName, autoFocus
                               Ref handle: clear(), focus(), getValue()
                               Trigger: type ``` then Shift+Enter → inserts styled code block
                               onImagePaste: fires for any clipboard item with type image/* — file is never inserted as text; parent calls addFileToRail(file)
                               onLargePaste: fires when pasted text ≥ 4,000 chars; composer is NOT updated — parent converts to attachment card
                               Paste order: image check → large-text check → normal insert
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

### Phase 19 — Remaining Port Work (NEXT)
- [ ] Responsive: icon rail at 760-1099px
- [ ] Responsive: off-canvas drawer <760px
- [ ] All transitions under `prefers-reduced-motion`
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

### Custom Instructions (formerly "System Prompt")
`localStorage.getItem('amplify_custom_instructions')` stores the user's global custom instructions.
- Set via Settings → Customize → Custom Instructions
- The old `SystemPrompt.tsx` component labeled this field "Custom Instructions" in the old UI; this is the same concept now surfaced as a settings section
- **TODO Phase 16:** Wire this into `handleNewConversation` in `home.tsx` so new conversations use it as the system prompt instead of (or prepended to) `DEFAULT_SYSTEM_PROMPT`
- Key: `amplify_custom_instructions`, max 4000 chars

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

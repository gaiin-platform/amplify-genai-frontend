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
  chat/
    ConversationViewShell.tsx ← thin wrapper around Chat.tsx with data-new-ui="true" for CSS scoping
  views/
    ChatsListView.tsx        ← full-pane "Chats and tasks" table (search, filter, relative dates). page='chats'
    LibraryView.tsx          ← full-pane document library wrapping DataSourcesTable. page='library'
  settings/
    NewSettingsModal.tsx     ← two-column settings modal. Props: onClose, openToSection?:string
                               Sections: general|account|usage|capabilities|code|cowork|
                                         skills|assistants|connectors|plugins|storage|apikeys|organization
                               Entry points: sidebar Customize (→skills), AccountMenu (→general), ⌘, (→general)
  shared/
    SegmentedControl.tsx     ← REUSABLE segmented tab control (size: sm=sidebar, xs=composer)
    IconButton.tsx           ← REUSABLE 28×28/32×32 icon button with hover ring
    Badge.tsx                ← REUSABLE "Labs"-style pill badge
    RichComposer.tsx         ← REUSABLE contentEditable composer with inline code block support
                               Props: onSend(markdown), placeholder, editorClassName, autoFocus
                               Ref handle: clear(), focus(), getValue()
                               Trigger: type ``` then Shift+Enter → inserts styled code block
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
| `components/TabSidebar/TabSidebar.tsx` | Can be replaced by NewSidebar in new-UI mode |
| `components/Sidebar/Sidebar.tsx` | Used by old UI; keep as-is; new UI uses NewSidebar |
| `components/Chatbar/Chatbar.tsx` | Logic stays; visual layer can be wrapped |
| `styles/globals.css` | Add new design tokens; keep existing classes |
| `tailwind.config.js` | Add new theme keys safely |

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

### Phase 7 — Polish (NEXT)
- [ ] `NewChatInput.tsx` — redesigned bottom composer (replaces the overlay plugin selector)
- [ ] Responsive: icon rail at 760-1099px
- [ ] Responsive: off-canvas drawer <760px
- [ ] All transitions under `prefers-reduced-motion`
- [ ] Light mode polish for new components
- [ ] Fill in placeholder settings sections: Usage, Capabilities, Assistants

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

### Event Bus Pattern (existing, keep using)
The app uses `window.dispatchEvent(new CustomEvent(...))` for cross-component communication:
- `homeChatBarTabSwitch` → switch sidebar tab
- `openArtifactsTrigger` → open/close artifacts
- `updateFeatureSettings` → feature flags changed
- `openScheduledTasksTrigger` → open scheduler
- `openSettingsTrigger` → open settings to a tab
- `openAstAdminInterfaceTrigger` → open assistant admin

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

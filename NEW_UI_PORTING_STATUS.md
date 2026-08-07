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
| Chats & Tasks full list view | ✅ | `ChatsListView.tsx` |
| Library view (data sources) | ✅ | `LibraryView.tsx` |
| Home landing page | ✅ | `NewHome.tsx` |
| UI preference banner (new vs classic) | ✅ | `UIPreferenceBanner.tsx` |
| Off-canvas drawer <760px | ❌ | Phase 17 |
| Responsive icon rail 760–1099px | ❌ | Phase 17 |

---

## 2. Chat Interface

| Feature | Status | Notes |
|---------|--------|-------|
| Chat message rendering | ✅ | Via `ConversationViewShell` wrapping existing `Chat.tsx` |
| User message bubbles (right-aligned) | ✅ | CSS-scoped in `conversation-view.css` |
| Assistant prose (no bubble) | ✅ | |
| Code block styling | ✅ | |
| Table styling | ✅ | |
| Reasoning / thinking disclosure block | ✅ | `AssistantReasoningMessage` styled via CSS |
| PromptStatus in-stream step lines | ✅ | |
| Composer (new chat + in-conversation) | ✅ | `NewHome.tsx` + `ConversationComposer.tsx` |
| Model picker | ✅ | `ModelPicker.tsx` — family-aware, effort levels |
| Attach menu (⊕) | ✅ | `AttachMenu.tsx` — files, library, skills, connectors, web search |
| Pending-message bridge (home → chat) | ✅ | sessionStorage injection |
| Conversation header (title + share) | ✅ | `ConversationHeader.tsx` |
| Stop generating button | ✅ | In `ConversationComposer.tsx` |
| Scroll-to-latest button | ✅ | |
| Hover action row (copy, edit, read aloud) | ✅ | `NewUIMessageActionsLayer.tsx` — transparent pill, no backdrop |
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

---

## 3. Assistants

| Feature | Status | Notes |
|---------|--------|-------|
| Assistants view (all four tabs) | ✅ | `NewAssistantsView.tsx` — new-UI implementation |
| My Assistants list | ✅ | Your + Shared sub-tabs, search, chat-on-click |
| Create new assistant | ✅ | `AssistantModal` opened from new view |
| Edit assistant | ✅ | Edit icon on hover → `AssistantModal` |
| Group Assistants list | ✅ | Grouped by group with section headers |
| Group admin access (settings gear) | ✅ | Gated by `featureFlags.assistantAdminInterface` + access check |
| Create group assistant (admin) | ✅ | "+ New Assistant" dispatches `openAstAdminInterfaceTrigger` |
| Prompt Templates list | ✅ | Three sections: Quick Actions / System Instructions / Your Templates |
| Create new prompt template | ✅ | `PromptModal` from new view |
| Layered Assistants list | ✅ | Cards with edit/delete |
| Create new layered assistant | ✅ | Dispatches `openLayeredBuilderTrigger` with blank LA |
| Layered assistant builder | 🚧 | Builder is old UI (`LayeredAssistantBuilder`); opens via event |
| Assistant admin interface | 🚧 | `AdminUI` / `openAstAdminInterfaceTrigger`; old UI panel |
| Assistant email events config | ❌ | Not surfaced yet in new UI |
| Promptbar folder tree (old sidebar) | 🚫 | Intentionally removed — replaced by flat list in new view |

---

## 4. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Settings modal (two-column) | ✅ | `NewSettingsModal.tsx` |
| General — theme toggle | ✅ | |
| General — feature flags | ✅ | |
| Custom Instructions | ✅ | Rebrand of "System Prompt"; saves to `amplify_custom_instructions` localStorage key |
| Account info | ✅ | Wraps existing `Accounts` component |
| Usage section | ❌ | Placeholder — `UserCostBreakdownModal` not yet ported |
| Storage selection | ✅ | Wraps existing `ConversationsStorage` |
| API Keys | ✅ | Wraps existing `ApiKeys` |
| Skills | ✅ | Wraps existing `SkillsLibrary` |
| Connectors / Integrations | ✅ | Wraps existing `IntegrationTabs` |
| MCP Servers | ✅ | Wraps existing `MCPServersTab` |
| Admin Panel | ✅ | Gated by `featureFlags.adminInterface`; opens existing `AdminUI` |
| Capabilities section | ❌ | Placeholder |
| Code section | ❌ | Placeholder |

---

## 5. Scheduled Tasks

| Feature | Status | Notes |
|---------|--------|-------|
| Scheduled Tasks modal | ✅ | Opened via sidebar "Scheduled" nav item or `openScheduledTasksTrigger` event. Renders existing `ScheduledTasks` component via portal. Gated by `featureFlags.scheduledTasks`. |
| Scheduler panel (inline) | 🚧 | `SchedulerPanel` is old UI; surfaced via events in other components |

---

## 6. Notebook

| Feature | Status | Notes |
|---------|--------|-------|
| Notebook view | ✅ | `NotebookApp` renders when `page='notebook'`; gated by `featureFlags.notebook` |
| Notebook new-UI styling | ❌ | No `data-new-ui` scoping applied to notebook; renders in old styles |

---

## 7. Other Old-UI Features

| Feature | Status | Notes |
|---------|--------|-------|
| Import conversations from file | ❌ | `Import.tsx` in old sidebar settings; not in new UI yet |
| Export data | ❌ | `handleExportData` in Chatbar; not in new UI yet |
| Clear all conversations | ❌ | `ClearConversations.tsx`; not in new UI |
| User cost breakdown | ❌ | `UserCostBreakdownModal`; planned for Usage settings section |
| Python function modal | ❌ | `PythonFunctionModal`; not surfaced |
| Workflow builder | ❌ | `AssistantWorkflowBuilder`; not surfaced |
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
| **Old TabSidebar** (3-tab left+right sidebar) | Replaced by unified `NewSidebar`. The dual-sidebar concept with collapsible left/right panels was confusing UX. |
| **Sub-tabs and nested navigation inside the old sidebar** | The old sidebar had complex nested state (e.g. "Chats" tab → folder tree → settings sub-sections). Flattened into a single nav list. |
| **"Chat/Cowork" segmented toggle on home screen** | Was removed — the Cowork concept is not part of the new UI direction. |
| **Quick-action suggestion chips on home screen** | Removed — the blank composer is the right starting point; chips felt promotional/cluttered. |
| **"@Amplify:" prefix label on assistant messages** | Visual decoration with no informational value. Hidden via CSS. |
| **Message animated status card** (wave animation, cover image) | Replaced with a clean muted in-stream step line per spec §4.4. |

---

## 9. Future Ideas 💡

> These are **not on the current roadmap** and will not be tackled during the current rewrite.
> Capture here for future developer discussion.

| Idea | Description |
|------|-------------|
| **Native deep research** | A built-in deep research mode that fans out searches, fetches sources, synthesizes a cited report — comparable to Perplexity or ChatGPT deep research. Could be a first-party skill or a distinct mode in the composer. |
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
| **Custom themes** | User-configurable accent color and sidebar color beyond the current dark/light toggle. |

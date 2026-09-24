# Amplify New UI — Implementation Guide

> Read this before writing any code. Update the Component Registry when you add a component.
> Branch: `new-ui` — Repo: `/Users/maxmoundas/Amplify/amplify-genai-frontend`

---

## 1. The One Rule

**Every line of new UI code lives inside `components/NewUI/`.** Three exceptions only:

| File | What's allowed |
|------|----------------|
| `styles/globals.css` | Adding CSS design tokens — never removing existing ones |
| `styles/conversation-view.css` | Scoped CSS overrides for old-UI components wrapped by new-UI shells |
| `pages/api/home/home.tsx` | The layout/render section only (~line 1617+, the `uiPreference === 'new'` block) |

If you need behaviour from an old-UI component: **import it**, don't modify it. If you need to
restyle an old component wrapped inside a new-UI shell, add CSS overrides in
`conversation-view.css` scoped to a `data-*` attribute you control (e.g. `[data-new-ui-assistants]`).

---

## 2. Files You Must Never Touch

```
pages/api/home/home.tsx          — state, reducers, handlers (layout section is OK, body is not)
pages/api/home/home.context.tsx
pages/api/home/home.state.tsx
components/Chat/                 — all files (Chat.tsx, ChatMessage.tsx, etc.)
components/Chatbar/              — all files
components/Promptbar/            — all files
services/                        — all files
types/                           — all files (read-only reference)
utils/                           — all files (read-only reference)
```

---

## 3. Design Tokens

Defined in `styles/globals.css`. Always use these — never hardcode hex values.

```css
/* Surfaces */
--bg-app          /* page / chat area background */
--bg-sidebar      /* sidebar background */
--bg-raised       /* cards, modals, raised surfaces */
--bg-hover        /* row hover background */
--bg-active       /* selected / pressed state */
--bg-composer     /* chat input card background */
--bg-card         /* card surface that must stay distinct from --bg-raised
                     (e.g. file cards inside a modal panel) */

/* Borders */
--border-subtle             /* default border color */
--border-composer-active    /* composer card border on hover/focus */

/* Text */
--text-primary    /* body text, headings */
--text-secondary  /* labels, secondary info */
--text-muted      /* timestamps, placeholders, captions only */
--text-error      /* failure reasons — text only, never a fill */

/* File-type icon hues — semantic, non-interactive. Icons only. */
--file-icon-pdf   /* red   — PDF */
--file-icon-doc   /* blue  — Word / docs / web sources */
--file-icon-sheet /* green — spreadsheets / CSV */

/* Accent — blue, ALL interactive elements */
--accent          /* #3b82f6 light / #006FEE dark */
--accent-fg       /* #ffffff — text/icons placed ON an accent background */
```

**Accent rules:**
- `--accent` (blue) for every button, active border, indicator, loading state
- `--accent-fg` for content placed on top of `--accent` backgrounds
- Never use orange, purple, indigo, or violet as interactive accents

---

## 4. Component Registry

Everything that exists in `components/NewUI/`. Check here before building anything new.

### `chat/`
| File | Purpose |
|------|---------|
| `ConversationViewShell.tsx` | Wraps `Chat.tsx`; owns `data-scrolling` idle timer, pending-send indicator |
| `ConversationComposer.tsx` | In-chat message input; attachment rail; deferred-upload send |
| `ConversationHeader.tsx` | Chat header: title, rename, share, delete |
| `NewUIMessageActionsLayer.tsx` | Absolute-positioned hover action row (copy/thumbs) |
| `NewUIShareModal.tsx` | Share conversation/assistant modal |
| `NewUIUserMessageMarkdownLayer.tsx` | Portal-based markdown render inside user bubbles |
| `NewUITranscriptAttachmentsLayer.tsx` | Moves post-send attachment cards into a sibling surface above user bubbles |
| `NewUITranscriptPastedTextLayer.tsx` | Renders sent `data.largeTextBlocks` pastes as `shared/AttachmentCard` chips in the transcript rail; opens `shared/AttachmentPreview` on click |
| `NewUITranscriptPreviewLayer.tsx` | Suppresses the classic `ImageModal` and mirrors post-send attachment previews into `shared/AttachmentPreview` (same component as the composer) |
| `NewUISourcesLayer.tsx` | Portal-based replacement for `ChatSourcesBlock`/`ExpansionComponent` "Sources" — renders a compact "N source(s)" pill toggle + flat list of source cards; hides original via `data-nui-src-original` CSS attribute |
| `UploadPendingIndicator.tsx` | Thin progress bar shown while uploads are in flight |
| `ArtifactPanelLayer.tsx` | Injects a sticky header into `#artifactsTab` (the forbidden `Artifacts.tsx` panel): title/version dropdown, Download split button (Copy MD / Download .md / Download .docx), expand/fullscreen toggle, close (×). Also writes `--nui-artifact-panel-w` onto the shell so the composer and jump button constrain to the chat column. Listens to `openArtifactsTrigger`. |
| `ArtifactInlineCardLayer.tsx` | MutationObserver layer that replaces the static "Creating Your Artifact…" box from `AutoArtifactsBlock.tsx` with a polished inline card (generating spinner → completed card with Open/Hide toggle). Also injects `data-nui-artifact-btn` on `#artifactsButtonBlock` elements for CSS restyling without touching forbidden files. |

### `home/`
| File | Purpose |
|------|---------|
| `NewHome.tsx` | Landing page with centered composer |

### `settings/`
| File | Purpose |
|------|---------|
| `NewSettingsModal.tsx` | Two-column settings modal (left rail + right content) |
| `NewAdminModal.tsx` | Two-column admin modal; replaces settings modal on open |
| `NewAccountSection.tsx` | Settings → Account |
| `NewStorageSection.tsx` | Settings → Storage |
| `NewConnectorsSection.tsx` | Settings → Connectors (Integrations + Tool API Keys tabs) |
| `PromptTemplatesSection.tsx` | Settings → Customize → Prompt Templates. Two tabs: "My Templates" (Edit/Share/Delete hover actions) + "Shared with Me" (lazy-loads via `getSharedItems`, import on open) |
| `CustomInstructionsSection.tsx` | Settings → Customize → Custom Instructions. List of named instructions with hover Edit/Delete, radio-style active selector (one or none), inline create/edit form, ConfirmDialog for deletes. Active instruction injected into every new blank conversation |
| `SidebarItemsSection.tsx` | Settings → Customize → Sidebar Items visibility toggles |
| `admin/AdminsCard.tsx` | Admin section wrapper card |

### `shared/`
| File | Purpose |
|------|---------|
| `CreationModalShell.tsx` | Single-column creation modal shell (1100px × min(820px,90dvh)) |
| `ConfirmDialog.tsx` | Portalled confirmation modal; `variant='danger'/'warning'/'neutral'` |
| `IconButton.tsx` | Accessible icon button — always pass `aria-label` |
| `ToggleSwitch.tsx` | Pill switch; `role="switch"`, `aria-checked` |
| `SegmentedControl.tsx` | Tab strip / segmented picker; pass `aria-label` |
| `ModelPicker.tsx` | Model selector with families, effort levels, hover preview cards |
| `InfoFloatCard.tsx` | 250ms hover-in preview card; Floating UI positioned |
| `AttachMenu.tsx` | ⊕ attach menu (files, library, assistant, skills, connectors, web search toggle). "Add from library" opens `DataSourceLibraryPicker` in a `surface='floating'` submenu and emits the picked files — it never opens the local file picker |
| `AttachmentRail.tsx` | Pre-send attachment card strip above the composer textarea |
| `AttachmentCard.tsx` | Individual attachment with upload progress and retry |
| `DataSourceCard.tsx` | 76px file card + `DataSourceCardGrid` (2-col ≥640px, 12px gap) for attached data sources. State shows only in the 40px icon slot (spinner → file-type icon cross-fade) and the subtitle — the card surface never changes color |
| `DataSourceLibraryPicker.tsx` | Multi-select picker for already-uploaded library files. Emits `{id, name, type, metadata}` with **no `key`** — the assistant save step prefixes a keyless source with `s3://`. `surface='inline'` (default) is a band in a form; `surface='floating'` + `width` is the ⊕ menu's submenu panel |
| `libraryAttachment.ts` | The already-uploaded-file intake — `libraryFileToAttachedDocument` (derives the bare S3 `key`; `null` ⇒ unsendable, refuse it), `createLibraryUIAttachment` (`ready` card, `pending` preview), `hydrateLibraryAttachmentPreview` (downloads and resolves the card face; never throws). Use this for anything coming out of the library — `AttachFile#handleFile` would upload a second copy. No React imports |
| `FileDropZone.tsx` | Drag-and-drop file intake: `useFileDropTarget` (handlers + active flag for an existing root element), `FileDropOverlay`, and the `FileDropZone` wrapper. Only reacts to `Files` drags; depth-counted dragenter/leave |
| `libraryQuery.ts` | Shared library query vocabulary — `sanitizePageKey` (DynamoDB cursor rules; unsanitized page keys 502), `buildLibraryQuery`, `isAssistantRecord`, `libraryTypeLabel`. Used by NewLibraryView + the picker. No React imports |
| `assistantIdentity.ts` | Shared "is this really an assistant?" vocabulary — `PLACEHOLDER_ASSISTANT_NAMES`, `isPlaceholderAssistantName`. Rejects the backend's `"default"` fallback and the old-UI `"Standard Conversation"` look-alike, both of which mean *no* assistant. No React imports |
| `customInstructions.ts` | React-free store for custom instructions — `loadStore`, `saveStore`, `getActiveInstructionContent`, `buildPromptWithInstruction`, `createInstruction`, `updateInstruction`, `deleteInstruction`, `setActiveInstruction`. Migrates old single-string key on first read. Used at every new-conversation call site in the new UI |
| `AttachmentPreview.tsx` | Full-screen attachment preview with nav and focus trap |
| `RichComposer.tsx` | Textarea with paste/image capture handlers |
| `Badge.tsx` | Small status badge |
| `SortableHeader.tsx` | Column header that toggles sort; chevron when active, selector icon when not. Used by Library + Chats lists |
| `FilterMenu.tsx` | Filter popover — radio groups, Clear all; `variant='toolbar'` (labelled button + count badge) or `'icon'` (ghost icon button + dot). Portalled and positioned from the trigger rect, so it survives overflow-hidden/scrolling ancestors |
| `chatFilters.ts` | Shared conversation filter/sort vocabulary (pinned, storage, assistant + comparators). Used by ChatsListView and the sidebar Recents section. No React imports |
| `sidebarVisibility.ts` | Shared type + key for sidebar item visibility state |
| `useConversationAssistant.ts` | Resolves the assistant attached to the selected conversation (explicit pick → `promptTemplate` → transcript stamps), re-attaches it to `selectedAssistant` once per conversation so follow-up sends stay routed, and exposes `detach()`. Use this instead of reading `selectedAssistant` directly — that field is global and gets reset by `handleNewConversation`/`handleSelectConversation`. Test "is there an assistant?" with its `isRealAssistant`, never `id === DEFAULT_ASSISTANT.id` |
| `useStableFeatureFlags.ts` | Read feature flags through this, never `state.featureFlags` directly. Falls back to a localStorage cache while `/feature_flags` is in flight or failed, and merges (rather than applies) the single-key `smartMessages` startup patch. No React-free exports: `resolveFeatureFlags`, `isFullFlagSet`, `PATCH_ONLY_FLAG_KEYS` |
| `integrationIcon.tsx` | `integrationIcon(id, size?)` — the `public/logos/integrations/*.svg` logo for an integration id (underscores → hyphens). Used by Settings → Connectors and the assistant editor's drive panel |
| `GeneratingSpinner.tsx` | Minimal 12px SVG arc spinner (270° dash, no track ring). Place inside a `text-[--text-muted]` container; the SVG uses `currentColor`. CSS animation defined in `globals.css` (`.nui-generating-spinner`). Accepts optional `size` prop. |
| `SearchInput.tsx` | The 34px toolbar search field (`IconSearch` + input), with `fullWidth` for use inside a card and an optional `onClear`. Extracted from three verbatim copies. Does **not** cover the divergent fields in `ChatsListView`, `NewLibraryView`, `DataSourceLibraryPicker`, `DriveFileBrowser`, `AttachMenu` |
| `EmailChipsInput.tsx` | The one people picker — chips + `amplifyUsers` autocomplete, portalled `position:fixed` dropdown. Used by the assistant editor (Specific people → *Who has access*, Team → *Add members*) and `chat/NewUIShareModal`. Uncontrolled input unless you pass `inputValue`/`onInputChange`; `onError` reports duplicate/malformed addresses. Escape closes only the dropdown (§14) |
| `emailSuggestions.ts` | React-free vocabulary behind it — `normalizeEmailPool`/`buildEmailPool` (drop raw-UUID values, dedupe case-insensitively, sort), `rankEmailSuggestions` (prefix matches before substring), `resolveUsernameForEmail` (case-insensitive email→username for the share/group APIs), `splitEmailList`, `looksLikeEmail`. No React imports |
| `useIntegrationConnections.ts` | Supported + connected integrations, OAuth popup connect, disconnect, for an optional `filter`. The one copy of that flow; `useDriveIntegrations` is a thin wrapper. Also exports `isConfigurationMessage` — an unconfigured backend answers with a *message*, not a failure worth alerting on |
| `openAtLatest.ts` | The "open a conversation at its newest message" rule — `nextOpenAtLatestTop` plus its tolerance/frame budgets. Returns the scroll maximum to pin to, or `null` once the user scrolls up. Used by `ConversationViewShell`'s open-at-latest pin loop. No React, no DOM imports |
| `uiPreferenceResolution.ts` | The stored new-vs-classic choice: `UI_PREF_KEY`, `getUIPreference`, `writeLocalUIPreference`, `resolveStoredUIPreference` (server beats localStorage; only `'ask'` may show the popup), and the `?uiPreference=reset` helpers. No React imports |
| `userDefaultModel.ts` | User's personal default model preference — `USER_DEFAULT_MODEL_KEY`, `getUserDefaultModelId`, `setUserDefaultModelId`. localStorage-backed, no React imports. Takes precedence over admin's `defaultModelId` in `NewHome` + `ModelPicker` slate. **Roams**: `shared/userDisplayPrefs` mirrors this key to/from the server — write it through `saveDisplayPrefsToServer` too, or the choice stays on one device. |
| `userDefaultEffort.ts` | User's personal default reasoning effort — `USER_DEFAULT_EFFORT_KEY`, `getUserDefaultEffort`, `setUserDefaultEffort`. localStorage-backed, no React imports. Seeds `NewHome` + `ConversationComposer` initial effort state. **Roams** via `shared/userDisplayPrefs` — same caveat as `userDefaultModel.ts`. |
| `userDisplayPrefs.ts` | The one server-sync path for the four personal display prefs (chat font, conversation storage, default model, default effort). `getChatFont` (**the** font resolver: dedicated key → settings blob → `'sans'`; the settings dropdown, `ConversationViewShell` and the CSS fallback must agree or the setting misreports), `saveDisplayPrefsToServer` (fetches server settings, merges, guarantees the schema-required keys, saves; returns `false` rather than throwing), `applyServerPrefsToLocalStorage` (writes server values into the dedicated keys the pickers read; fires `amplifyChatFontChanged` only on change), `backfillLocalDefaultsToServer` (one-shot publish of pre-existing local choices for keys the server has no opinion on). **`null` = explicitly cleared and roams; key absent = no opinion, leave the device alone** — conflating them either wipes a local choice or makes "System default" un-roamable. No React imports |
| `UserPrefsSync.tsx` | Mounts once at the new-UI root; renders nothing. Idempotent difference-based sync of the server-synced display prefs, a grace-delayed seed of the system storage default, and a once-per-load backfill. Precedence: server-synced user choice > admin default > system default. Never calls `handleStorageSelection` — `'future-cloud'` is going-forward and must not migrate existing conversations |
| `PromptTemplateFillDialog.tsx` | New-UI styled "populate and use this template" form — portalled to `document.body`, supports text/file/boolean/options variable types with design-token styling. Has an edit icon button (`onEdit`) so the host can switch to edit mode. Used by `PromptTemplateDialog`. |
| `PromptTemplateDialog.tsx` | Orchestrates the fill-in popup: invokes `PromptTemplateFillDialog` (new UI), runs `fillInTemplate` semantics, sends via `amplify_pending_message`. Accepts `onEdit` callback passed through to the fill dialog. Also exports `promptTemplateVariables`. |
| `promptConversation.ts` | `startConversationWithTemplate` — creates the conversation for a template (promptTemplate, tags, rootPrompt, resolved model) under the `'New Conversation'` name so the AI renames it after the first reply. Takes `homeDispatch` because it must set `isStandalonePromptCreation` in the same batch (§30). No React imports |
| `PromptTemplateDialogHost.tsx` | Single mount point for the popup above, at the new-UI root in `home.tsx` — a sibling of `NewSettingsModal`, never a descendant. Launch it with the exported `openPromptTemplateDialog(prompt)` and then close your own modal: the popup survives because it isn't in your subtree. Settings has three entry points (collapsed sidebar, expanded sidebar, ⌘,) so per-launcher hosts would have to be triplicated |
| `LayeredBuilderHost.tsx` | Listens for `openLayeredBuilderTrigger` window events and renders `LayeredAssistantBuilder` in a portalled full-screen dialog. The event's only classic-UI listener is `UserMenu`; this host provides the equivalent for the new-UI branch. Mounted at the new-UI root in `home.tsx` alongside `PromptTemplateDialogHost` |
| `AssistantAdminUIHost.tsx` | Listens for `openAstAdminInterfaceTrigger` window events and renders `AssistantAdminUI`. The event's only classic-UI listener is `UserMenu`; this host provides the equivalent for the new-UI branch so gear icons in `GroupAssistantsTab` open the admin interface. Mounted at the new-UI root in `home.tsx` alongside `LayeredBuilderHost` |
| `lastViewedChat.ts` | The "refresh puts me back in the chat I was reading" vocabulary — `LAST_CHAT_KEY` (sessionStorage, so it survives a refresh but not a new tab), `nextRecordedChat` (`record`/`clear`/**`keep`** — an unknown message state must never clear a good id) and `findRestorableConversation` (proves content via `messages`, `compressedMessages`, **or** being cloud-stored, and normalizes `messages` to an array on the way out). Both keep *empty* apart from *unknown* per §36. No React imports |
| `LastChatRestore.tsx` | Mounts once at the new-UI root; renders nothing. Records the conversation being viewed and re-selects it once per load, so reloading inside a chat no longer lands on NewHome. Restore waits for a non-empty `availableModels` (`handleSelectConversation` rewrites `conversation.model` when the model isn't in that map) and gates hydration on `conversationStateId !== 'init'`, **not** `=== 'post-init'` — `useHomeReducer` replaces that string with a uuid on every later `selectedConversation`/`conversations` dispatch. Defers to the `amplify_pending_message` bridge |
| `NewUILoadingStatus.tsx` | Quiet accessible loading overlay for New UI — translucent scrim + centered card, so the app stays visible behind it. Used for startup ("Setting Up Amplify…") and in-view async work (Library delete). `role="status"`, `aria-live="polite"`, respects `prefers-reduced-motion`. |

### `sidebar/`
| File | Purpose |
|------|---------|
| `NewSidebar.tsx` | Main sidebar: resize drag, auto-collapse at 768px, pinned + recents |
| `ConversationRow.tsx` | Sidebar conversation row: rename, pin, share, delete (with ConfirmDialog) |
| `SidebarSection.tsx` | Collapsible section; `isCollapsible`, `storageKey` props |
| `SidebarNavItem.tsx` | Nav icon + label row |
| `SidebarHeader.tsx` | Sidebar top row (logo + new chat button) |
| `AccountMenu.tsx` | Account popover (role="menu", focus-on-open) |
| `SettingsModal.tsx` | Sidebar entry point that opens NewSettingsModal |

### `views/assistant/` (new subfolder)
| File | Purpose |
|------|---------|
| `assistantDraftContract.ts` | Zod-validated contract for AI-produced draft patches. Exports `parseAssistantDraftPatch`, `filterDraftPatch`, `safeChangesToApply`. No React, no service imports. |
| `assistantDeletion.ts` | The delete-an-assistant vocabulary — `getDeletableAssistantId` (root id, never the version id; `null` ⇒ local-only), `canDeleteAssistantPrompt`, `promptsAfterAssistantDelete` (drops **every** version sharing the assistantId), `isSelectedAssistantDeleted`. No React imports |
| `NewWebsiteSourceInput.tsx` | Data Sources → Website URL panel. Replaces `DataSources/WebsiteURLInput` with the same `onAddURL(url, isSitemap, maxPages?, exclusions?)` contract; Single page / Sitemap segmented control. Still defers to the old (portalled, unstyled) `SitemapUrlSelectionModal` for sitemap URL picking |
| `DriveSourcesPanel.tsx` | Data Sources → OneDrive/SharePoint. Native replacement for the old `AssistantDriveDataSources` stack (which stays in place for the old editor). The connector rows **are** the service selector — no tab bar, no "Select Service" dropdown; active row gets a left accent bar. Disconnect is revealed on hover and never clears that service's selections |
| `DriveFileBrowser.tsx` | One connected drive service's browser: breadcrumb above the table, one search field, one 40px header row, select-all with indeterminate state, rows capped on a whole-row boundary. Owns the folder trail + listing cache, so the panel must key it on the integration id |
| `DriveFileRow.tsx` | One 46px browser row. Containers navigate, files select, Level 4 does neither; type comes from the leading icon plus a muted inline label, never a column |
| `driveBrowserModel.ts` | Drive selection algebra — `normalizeDriveRecord`, `isContainer`, `applySelection` (the **only** mutator; one call per user action), `clearIntegration`, `selectionCounts`, `displaySize`. Ported from the old component so the saved `integrationDriveData` is unchanged. No React imports |
| `useDriveIntegrations.ts` | The drive-filtered view of `shared/useIntegrationConnections`. Replaces rendering `IntegrationTabs` purely for its side effects |
| `CapabilityCard.tsx` | The collapsible card wrapping each Capabilities panel. Opens with `grid-template-rows: 0fr → 1fr`, **not** a `max-height` ceiling — the Tools panel outgrows any fixed one, and `overflow:hidden` made the excess unreachable. `visibility` (not the `hidden` attribute, which loses to an inline `display:grid`) keeps collapsed content out of the tab order |
| `CapabilityRow.tsx` | The one selectable row for tools, ops, and skills — replaces `Agent/ToolItem` **and** `AssistantApi/ApiItem`, which differed only in their data adapter. Optional gear + `configurePanel`, optional collapsed `details` |
| `toolSelectionModel.ts` | Tool selection algebra — `toggleComposite` (the only composite mutator; unticking keeps ops another ticked composite still needs), `inferSelectedComposites` (edit-mode seed, suppresses subset composites), `buildBindings`/`bindingsToDraft`/`withBindings`, `toOpRow`/`toAgentToolRow`, `matchesToolQuery`. No React imports |
| `CompositeToolCard.tsx` | One task-based tool card (a named bundle of ops) + its per-op binding editors |
| `ToolsCapabilityPanel.tsx` | Capabilities → Tools & APIs. Replaces the `ApiIntegrationsPanel` → `CompositeActionsPanel` / `AgentToolsSelector` / `ApiSelector` stack, and `opsSearchToggleButtons`. Task-based tools grouped by integration, then one merged browse list. Not-connected categories offer an **inline** OAuth Connect, because the old amber banner's `openSettingsTrigger` has no listener in the new UI |
| `ParameterBindingEditor.tsx` | Per-parameter AI/Manual binding. Controlled and stateless — the draft lives in the panel, seeded from saved bindings |
| `SkillsCapabilityPanel.tsx` | Capabilities → Skills. Replaces `Skills/SkillsSection`, dropping its duplicate accordion header and its purple accent. Still launches the old `SkillEditor` for creation, early-returned |
| `WorkflowTemplatePicker.tsx` | Capabilities → Workflow Template. Replaces `AssistantWorkflows/AssistantWorkflowSelector`; still launches the old `AssistantWorkflowBuilder`, early-returned rather than permanently mounted |
| `AssistantEmailEventsPanel.tsx` | Advanced Settings → Email Events. New-UI replacement for the old `AssistantEmailEvents` — uses `ToggleSwitch`, design-token text colors, and inline expand/collapse for instructions |
| `NewGroupManagementModal.tsx` | Group management modal opened from the gear icon on a group header in `GroupAssistantsTab`. Members (add/remove/edit-access via `EmailChipsInput`), Group Types, Amplify Groups, System Users, and Delete Group. Uses `CreationModalShell`, `CapabilityCard`, `ConfirmDialog`, `NewUILoadingStatus`. Never opens `AssistantAdminUI` |

### `views/`
| File | Purpose |
|------|---------|
| `NewAssistantsView.tsx` | Assistants gallery: My / Shared with Me / Teams / Layered tabs |
| `NewAssistantTypeSelector.tsx` | Step-0 type picker (Private/Managed/Team) before AssistantModal |
| `NewUIAssistantCreationModal.tsx` | Unified assistant creation form (access type + fields inline) |
| `NewUIPromptCreationModal.tsx` | Prompt template creation modal |
| `ChatsListView.tsx` | Chats & Tasks full-pane list with search |
| `NewLibraryView.tsx` | Data sources library: list rows, upload, batch delete |
| `LibraryView.tsx` | Thin wrapper for NewLibraryView |
| `NewScheduledTasksView.tsx` | Scheduled tasks: list + editor/logs pane |
| `NewWorkflowsView.tsx` | Workflow templates: list + detail pane |

### Root
| File | Purpose |
|------|---------|
| `UIPreferenceBanner.tsx` | New vs classic UI switch banner |

---

## 5. Standing Rules

1. **Close buttons go in a flex header row**, not inside the scroll container. Pattern:
   ```
   [flex-column, height 100%]
     [header row, flexShrink:0] → <h2> ... <button aria-label="Close">
     [scroll body, flex:1, minHeight:0, overflowY:auto]
   ```

2. **One modal at a time.** If modal A opens modal B, use an early-return below all hooks:
   `if (showB) return <ModalB onClose={onClose} />;`
   Never render B as a child of A's overlay div.

3. **Every `IconButton` must have `aria-label`.** Every modal needs a focus trap +
   `role="dialog" aria-modal="true" aria-labelledby`.

4. **Dark mode is required** on every new element. Use `dark:` Tailwind variants or
   CSS variables (which already encode both modes).

5. **Every animation needs a reduced-motion override:**
   `@media (prefers-reduced-motion: reduce) { ... }` or Tailwind `motion-safe:`.

6. **Reusable components go in `components/NewUI/shared/`**, not inline in a view.

7. **When wrapping an old-UI component**, add `className="text-neutral-900 dark:text-white"` to
   the outermost new-UI wrapper div — old components rely on inherited text color and are
   invisible on light backgrounds without it.

8. **Before adding a CSS override that targets a class inside a shared old component** (e.g.
   `id="expandComponent"`), grep for every consumer. Scope the rule tightly to the one
   call site you're targeting to avoid accidental global restyling.

9. **Chrome scrollbar cascade quirk:** When two `::webkit-scrollbar-*` rules both have
   `!important`, Chrome picks the *later-in-file* one regardless of specificity. Avoid
   `!important` on global scrollbar rules; use it only on the specific container rule.

10. **Never route new-UI file attachments through ChatInput's hidden `#__attachFile`.**
    The old dock is `display:none` in the new UI, so files attached there render no
    card, and `ConversationComposer.handleSend`'s direct-send path (PATH A) ignores
    them whenever the composer holds its own docs. Use the composer's `attachFiles`
    intake (picker, paste, and drag-and-drop all share it).

11. **Scrollbar auto-hide pattern:** Remove `::webkit-scrollbar { width }` from containers
    that should use OS overlay scrollbars. The `data-scrolling="true"` idle-timer in
    `ConversationViewShell.tsx` provides progressive-enhancement visibility control for
    Windows/Linux (the timer is 700ms, constant `SCROLLBAR_IDLE_MS`).

12. **`state.featureFlags` has more than one writer, and a non-empty value is not
    necessarily a complete one.** `home.tsx` fires `fetchFeatureFlags()` and
    `fetchUserAppConfigs()` concurrently; the latter dispatches
    `{ smartMessages: bool }` as the *entire* flag state when it wins. Gate new UI on
    `useStableFeatureFlags()`, never on `state.featureFlags` directly, or the gated
    element will blink out mid-load. If another call site starts dispatching a lone flag,
    add its key to `PATCH_ONLY_FLAG_KEYS`.

13. **"No assistant" has three different representations, so never test for it with
    `selectedAssistant.id === DEFAULT_ASSISTANT.id`.** The backend's fallback assistant is
    named `"default"` and streams `data.state.currentAssistant = "default"` on *every* plain
    send; the old-UI `AssistantSelectModal` dispatches `{ id: 'amplify', assistantId: '' }`
    named `"Standard Conversation"`; and `utils/app/assistants#setAssistant` only strips the
    canonical `DEFAULT_ASSISTANT` **by reference**, so a look-alike gets stamped onto the
    transcript permanently. Use `isRealAssistant` (or `isPlaceholderAssistantName` in
    React-free modules) — an id comparison alone shows a phantom assistant chip on plain
    chats and sends an `options.assistantId` the backend cannot resolve.

14. **Capture-phase `document` Escape handlers stack, and `stopPropagation` does not
    separate them.** `CreationModalShell` and `ConfirmDialog` both listen for Escape on
    `document` in the capture phase; listeners on the *same node* are unaffected by
    `stopPropagation`, so a nested dialog that only calls it dismisses itself **and** the modal
    behind it, discarding the user's form. Nested dialogs must use
    `e.stopImmediatePropagation()`.

15. **A state updater must stay pure.** Toasts, path mirroring, and other side effects inside a
    `setState(prev => …)` callback fire twice under StrictMode. Decide from the render-time value
    outside the updater, then update.

16. **An "is this still mounted?" ref must be re-armed in the effect body, never only by
    `useRef(true)`.** `reactStrictMode` is on, so every component mounts → unmounts → remounts
    and the cleanup fires once on the simulated unmount. `useEffect(() => () => { alive.current
    = false; }, [])` therefore latches `false` permanently, and every guarded setter — including
    the `setLoading(false)` that ends a skeleton state — is skipped for the life of the
    component. Write `useEffect(() => { alive.current = true; return () => { alive.current =
    false; }; }, [])` and declare it before the effect that loads, or prefer a per-request
    sequence guard (`requestSeq` in `views/assistant/DriveFileBrowser.tsx`), which also
    discards superseded responses rather than only post-unmount ones.

17. **`types/` is read-only reference *and* is not always accurate about primitives.** It
    describes some payload fields with the wrong type, and because it is off-limits (§2) the
    coercion has to live in your code. `IntegrationFileRecord.size` is declared `string` but
    Microsoft Graph sends a number of bytes; calling `.trim()` on it threw an unhandled
    `TypeError`. Old-UI components often survive this by rendering the value straight into JSX,
    where React coerces silently — so a new helper that calls a *string* method on a field is
    the first thing to break. When porting, take `unknown` and narrow with `typeof`, and cover
    the real payload shape in a test with an explicit cast: a fixture built from the `types/`
    interface cannot reproduce the bug.

18. **An old-UI event bridge is not automatically a working one — check that a listener renders
    in the new branch.** `Agent/CompositeActionsPanel` dispatches `openSettingsTrigger` for its
    "Go to Integrations" link, but the only listener is `components/Layout/UserMenu.tsx`, which
    `home.tsx` renders in the **classic** `else` branch. The link is therefore a dead click in
    the new UI, and importing the component brought the dead click with it. The new-UI
    equivalent is `openNewUISettingsSection` (listened for in `NewSidebar` and `NewHome`) — but
    firing it from inside a modal stacks `NewSettingsModal` over `CreationModalShell` and hits
    §14, so prefer doing the thing inline (`shared/useIntegrationConnections#connect`) over
    navigating the user away from a half-filled form.

19. **Hydration is part of the save contract: grep every `data.*` key the save writes for a
    matching read.** `NewUIAssistantCreationModal` wrote `workflowTemplateId` only when
    `baseWorkflowTemplateId` was truthy but never hydrated it, while it *did* hydrate
    `opsLanguageVersion` — so editing a workflow assistant re-saved it as v4 with no template
    and silently dropped the workflow. A write-without-read is invisible on create and only
    destroys data on edit, so it survives manual testing easily. When porting a panel, diff its
    keys against `AssistantModal.tsx`'s load, which hydrates more of them.

20. **Selection state that a user ticks is not always safe to derive from what was saved.**
    Composite tools nest — `draftEmail`'s ops are a strict subset of `sendEmail`'s, and six more
    such pairs exist in `COMPOSITE_FUNCTION_CATEGORIES` — so deriving "which bundles are
    checked?" from the flat op list on every render lights up the subset too, and unticking that
    phantom strips ops out from under the real selection. Seed such state **once** from a
    dedicated inference function that suppresses subsets (`inferSelectedComposites`), and keep
    it out of the saved payload.

21. **The chat shell REMOUNTS on every conversation switch, so anything living in DOM state
    resets — scroll position included.** `home.tsx` renders it with
    `key={selectedConversation.id}`, so `.chatcontainer` is a brand-new node at
    `scrollTop = 0` and the transcript opens on message #1. Chat.tsx does not correct this
    (its auto-scroll needs the message count to grow *and* the last message to be the
    user's), so the new UI restores it — `ConversationViewShell`'s open-at-latest
    `useLayoutEffect` + `shared/openAtLatest.ts`. Restore such state in a **layout** effect
    (pre-paint, so nothing flashes) and re-assert it for a few frames, because transcript
    height keeps growing after the first paint (images, highlighting, KaTeX) and a one-shot
    scroll lands mid-conversation. Yield to the user the moment they scroll, and to
    `anchorNewPrompt` whenever it has frozen the viewport.

22. **`uiPreference` starts `null` on every load, and `null` renders the *classic* layout.**
    `home.tsx` seeds it from localStorage in a passive effect and from the server in
    `fetchSettings()`, so the unresolved window is a window in which the old UI is on
    screen and any component gated on `uiPreference === null` is mounted over it. Two
    consequences: a first-run prompt gated that way flashes open and closes itself the
    moment the server answers, and the old UI is briefly visible on any device whose
    localStorage is empty. `UIPreferenceBanner` owns both — it resolves the stores
    itself before rendering anything, holds an opaque cover (not `null`) while
    resolving, and does the synchronous localStorage branch in a **layout** effect so
    that path costs no visible frame. `?uiPreference=reset` erases both stores and
    reloads to re-test the first run; clearing localStorage alone is not enough,
    because the server value is restored on the next load.

23. **Anything that collects people uses `shared/EmailChipsInput` — do not write a second one.**
    Every such field needs the same four behaviours out of `state.amplifyUsers`, and getting
    any of them wrong is invisible until a share fails: values can be **raw UUIDs** (`home.tsx`
    substitutes the key when a user has no mapped email) and must never be suggested;
    suggestions must rank prefix matches before substring ones; the reverse
    email→username lookup the share/group APIs need must be **case-insensitive** (a strict
    `===` silently falls back to the raw address); and the dropdown must be portalled, because
    every modal body that hosts one scrolls or clips. `shared/emailSuggestions.ts` holds that
    logic React-free — reach for it, not for a local `Object.keys(amplifyUsers).find(…)`.

24. **`prompts` is a cache of a server list, so removing an item from it is not a delete.**
    `home.tsx` re-seeds `prompts` on every load from `listAssistants()` →
    `utils/app/assistants#syncAssistants`, so a row filtered out of `prompts` +
    `savePrompts()` disappears convincingly and then walks back in on the next refresh or
    login. Any destructive action on a server-backed item must call its service op
    **first**, keep the row on screen when that call fails, and only then update local
    state — the reverse order is indistinguishable from success right up until the reload.
    The same trap applies per-*version*: rows are keyed by the version-specific
    `prompt.id` while the backend deletes the root `definition.assistantId`, so filter by
    the assistantId (`views/assistant/assistantDeletion.ts`) or the other versions stay
    listed.

25. **"Upload a file" and "attach a file I already uploaded" are two different
    intents, and only one of them involves a `File`.** A library record has no local
    bytes, is already in S3, and must be attached by `key` — running it through
    `AttachFile#handleFile` uploads a duplicate of something the user already owns,
    and `createUIAttachmentFromDoc` alone leaves it stuck at
    `previewState:'unsupported'` because `doc.data` is null. Use
    `shared/libraryAttachment.ts` for the library path and keep it distinct from the
    picker/paste/drop path. Note also that the old UI's library entry point is a
    **dead bridge** here for the same reason as §18: `ChatInput`'s `#viewFiles` button
    toggles `DataSourceSelector` inside the old dock, which the new UI renders
    `display:none` — clicking it via `getElementById` opens nothing at all.

26. **A modal that `Chat.tsx` renders is unreachable in the new UI — don't "navigate and let
    Chat show it".** Three separate mechanisms hide it, and fixing one is not enough:
    it is nested inside `#overflowScroll`, which `conversation-view.css` sets to
    `display:none !important`; `home.tsx` parks the whole `ConversationViewShell` at
    `left:-100vw; visibility:hidden` for as long as `messages.length === 0`; and
    `ReusableComponents/Modal` is **not portalled** and uses `z-50`, so it lands under
    `NewSettingsModal`'s `zIndex: 9999` regardless. `VariableModal` (the prompt-template
    variable prompt) hit all three at once — clicking a template appeared to do nothing.
    The new UI must render such a dialog itself: import the old component unmodified,
    `createPortal` it to `document.body` inside a wrapper that owns a stacking context
    above 9999, and drive the outcome through an existing bridge rather than through
    Chat's own handler (`shared/PromptTemplateDialog.tsx`). Note also that the
    `amplify_pending_model_id` key is **cleared** by `ConversationViewShell` but never
    applied — only `handleNewConversation({ model })` sets a model, so a model picker on
    such a dialog is a no-op unless you pass the model through conversation creation.

27. **A dialog that must outlive the modal that opened it cannot be rendered inside it.**
    Rendering it as a descendant gives you a choice of two bugs: leave the launcher open
    and it sits visible behind the dialog, or close the launcher and React unmounts the
    dialog with it. Portalling does not help — a portal changes where the DOM node lands,
    not who owns the React subtree. Mount such a dialog once at the new-UI root in
    `home.tsx` as a sibling of `NewSettingsModal`, and have launchers open it by window
    event, then close themselves (`shared/PromptTemplateDialogHost.tsx`). One root mount
    also covers the fact that settings itself has three entry points — the collapsed
    sidebar, the expanded sidebar, and the ⌘, shortcut.

28. **A `createPortal` target that you do not own can strand an overlay on screen forever.**
    React removes a portal's children from the container it *recorded at mount*, so a
    portalling component that is swapped out of a conditional slot — or replaced by Fast
    Refresh while its dialog is open — can leave an owner-less `position:fixed` node sitting
    in `document.body` with no React owner and therefore no way to close it. That is what
    put the prompt-template fill dialog behind the edit modal "forever". Two rules follow:
    only **one** component in a swap may own the portal (the host, never both branches —
    `PromptTemplateFillDialog` renders a plain `position:fixed` div and lets
    `PromptTemplateDialogHost` portal it), and the host should portal into a **container
    element it creates and `remove()`s in an effect**, not into `document.body` directly, so
    teardown is one node removal instead of a per-child reconciliation.

29. **A portalled new-UI surface needs `data-new-ui-shell="true"` or its scrollbars come out
    orange.** `_app.tsx` sets `data-chat-palette` (default `warm-browns`) on `document.body`,
    and that palette's `::-webkit-scrollbar-thumb` rule is orange. `conversation-view.css` is
    `@import`ed at the *top* of `globals.css`, so its `[data-new-ui="true"]` blue thumb rule
    loses the equal-specificity tie on source order; only the
    `[data-new-ui-shell="true"]` rules (declared after every palette override, in
    `globals.css` itself) win. Anything portalled to `document.body` is outside home.tsx's
    shell div and must opt in on its own wrapper. Do **not** reach for
    `data-new-ui="true"` for this — that attribute is the chat-area CSS scope root and
    drags ~4000 lines of transcript overrides into scope.

30. **A modal that is invisible in the new UI still runs its effects — and Chat.tsx's
    `VariableModal` writes to the conversation.** §26 explains why the new UI can't *see*
    Chat's prompt-template dialog; it does not stop Chat from **mounting** it. Chat.tsx
    shows it for any conversation with a `promptTemplate` and zero messages, and its
    mount effect calls `handleUpdateModel(models[0])` — `handleUpdateConversation` →
    `dispatch({field:'selectedConversation'})` — so the model that
    `handleNewConversation({ model })` just applied is overwritten with the
    alphabetically-first available model a few ms later, before the pending-message
    bridge fires the send ~160ms in. Its `window` click listener also calls
    `onClose(true)`, which **deletes** a zero-message promptTemplate conversation. So any
    new-UI flow that creates a conversation carrying a `promptTemplate` must first
    dispatch `isStandalonePromptCreation: true` — the only gate on that Chat.tsx effect,
    and Chat.tsx is its only consumer, so nothing else changes. **The dispatch has to
    batch into the same render as the `selectedConversation` dispatch**: Chat reads the
    flag while rendering, and its effect has already run by the time any effect of yours
    could. Re-asserting the model afterwards is not a fix — you are racing a mount effect,
    and every ordering you can reach from a parent component loses. More generally: before
    handing a conversation to Chat.tsx in a state the old UI treats as "needs input",
    check what the old UI *mounts* for that state, not just what it displays.

31. **Reasoning effort has no per-request field — it only exists as
    `conversation.data.reasoningLevel`.** `useChatSendService` (:629-644) reads
    `selectedConversation.data?.reasoningLevel` and turns it into
    `options.reasoningLevel`, or `disableReasoning: true` for `'off'`; `ChatRequest`
    carries nothing. So a `ModelPicker`'s `selectedEffort` is **decorative** unless the
    host writes it onto the conversation — via `handleNewConversation({ data: {
    reasoningLevel } })` at creation, or `handleUpdateConversation(conv, { key: 'data',
    value: { ...conv.data, reasoningLevel } })` afterwards. The symptom of forgetting is
    not an error but a silent downgrade to the backend's default, which reads as "my
    effort was changed to medium". Two corollaries: seed the picker **from**
    `conversation.data.reasoningLevel` (defaulting the state to `'medium'` makes the
    control misreport a conversation started at another level), and never bridge effort
    through `sessionStorage` — `amplify_pending_effort` was written by `NewHome` and only
    ever `removeItem`'d, exactly like `amplify_pending_model_id` (§26). Any write to
    `key: 'data'` must spread `...conv.data`, since web search, skills and effort all
    share that one object.

32. **Riding a new field along in the server `settings` object has two hard constraints, and
    breaking either fails silently.** The backend accepts unknown keys (that is how
    `uiPreference` roams), but `save_settings_schema.py` declares
    `required: ["theme", "featureOptions", "hiddenModelIds"]` and `saveUserSettings`
    **replaces** the whole object rather than patching it. So `saveUserSettings({ myField })`
    is rejected by validation and never persists — and the case that breaks is the
    brand-new user, whose browser has no `settings` blob to merge those three keys from,
    which is exactly the population a new default targets. Fetch the server object first,
    merge onto it, and guarantee the required keys
    (`shared/userDisplayPrefs#saveDisplayPrefsToServer`). Note also that `fetchSettings`
    forces `theme` to the device-local value before caching, so echoing the localStorage
    blob back to the server writes a device-local theme as the roaming one.

33. **`updateFeatureSettings` is not a "settings loaded" signal — it has ~7 dispatchers.**
    `home.tsx` fires it on **every** `featureFlags` change, long before `fetchSettings`
    resolves, and for a brand-new user `fetchSettings` never fires it at all (the backend
    returns `data: None` and the dispatch sits inside `if (result.data)`). A handler that
    treats one firing as authoritative and guards with `if (a value exists) return;` will
    write its default from an empty blob and then permanently block the user's real
    server-side value from landing on that device. Make such a handler **idempotent and
    difference-based** (server value wins whenever it disagrees; every local write mirrors
    into the blob, so a fresh local choice never reads as a disagreement), and delay
    seeding a hardcoded default so `fetchUserAppConfigs`'s admin-configured default — gated
    on `!storageSelection` and therefore suppressed by whoever writes first — still wins.

34. **A default that is applied in a passive effect flashes, if CSS treats the unset state
    as the other value.** `conversation-view.css` selects the serif face with
    `:not([data-body-face="sans"])`, so the attribute being absent *means* serif; setting
    it in a `useEffect` painted Newsreader for one frame for every sans user once sans
    became the default. Write such an attribute in a `useLayoutEffect` (pre-paint, making
    the CSS fallback unreachable). More generally, a user-facing default usually lives in
    more than one place — the control's own state, the DOM/attribute that applies it, and a
    CSS fallback. Grep all three and route them through one resolver, or the setting will
    report a value the app is not using.

35. **The transcript in the DOM is one commit behind `selectedConversation`, so a DOM
    measurement triggered by a state change must verify the DOM caught up.** `Chat.tsx`
    does not render context state — it mirrors it into its own `useState` in a passive
    effect (L343-346). Child effects flush before the parent's, but that mirror is a
    *setState*, so its re-render has not committed while a new-UI effect runs. A
    measurement that finds *something* therefore silently measures the PREVIOUS message:
    `anchorNewPrompt` parked follow-up sends on the prior prompt, and only worked on the
    first send because "zero user bubbles" happened to look like "not mounted yet" and hit
    the retry path. Pass the count you expect (mirroring Chat's render filter — an
    `actionResult` message is user-role but renders as `.action-message`, not
    `.user-message`) and retry until the DOM agrees, comparing with `!==` so an
    edit-and-resend's *shrinking* transcript is also awaited. Keep a frame budget after
    which the gate lifts, so an unexpected filter degrades to a late anchor, not to none.

36. **`conversation.messages` in `state.conversations` has three shapes, and "no messages"
    means *unknown*, not *empty*.** A record is either **full** (`messages: Message[]`),
    **local/compressed** (`messages: []` + `compressedMessages` — every local chat looks
    empty after `compressAllConversationMessages` on load and
    `condenseForConversationHistory` on every update), or **cloud metadata with the
    `messages` key missing entirely** — `updateWithRemoteConversations` writes the raw
    `/get/all` records into `conversations`, bypassing `cleanConversationHistory`, which is
    the only thing that backfills `messages: []`. So `messages.length > 0` as a
    "has content?" test silently refuses every local conversation, and `messages.length`
    read blind is an unhandled TypeError — old-UI code survives it because several paths
    dispatch a history record straight into `selectedConversation` and Chat.tsx guards with
    `?.`. Prove content with `messages` **or** `compressedMessages` **or**
    `isRemoteConversation`, normalize `messages` to an array before handing a record to
    anything, and never *clear* stored state on the strength of an unknown shape. Also
    note `conversationStateId` is not a milestone you can wait for: `useHomeReducer`
    replaces `'post-init'` with a fresh uuid on every later `selectedConversation` or
    `conversations` dispatch, so gate on `!== 'init'`.

---

## 6. Key Architecture Notes

- **In-app routing** is state-based via the `page` field in HomeContext (`'home'`, `'chat'`,
  `'chats'`, `'assistantGallery'`, `'library'`, `'scheduledTasks'`, `'workflows'`, `'notebook'`).
  Add a new full-pane view by adding a `page=` value in `home.tsx`'s render section.

- **Event bridges** (`window.dispatchEvent`) are the safe way to trigger old-UI modals from
  new-UI code without modifying the old component. Example: `openLayeredBuilderTrigger`.

- **Pending message bridge** (home → chat): `sessionStorage` key `amplify_pending_message`
  carries the unsent message across the `page` transition.

- **`data-new-ui="true"`** is set on the chat shell div and is the CSS scope root for all
  chat-area overrides in `conversation-view.css`.

- **`data-new-ui-shell="true"`** is set on the NewHome shell for CSS rules that must also
  cover the landing page composer (not a descendant of `data-new-ui`).

---

## 7. Updating This File

Add one line to the Component Registry whenever you create a new component.
Add a token to Section 3 if you define a new CSS variable in `globals.css`.
Add a rule to Section 5 if you discover a new constraint that should apply to all future sessions.
Do not add implementation history, phase numbers, or debugging notes — keep it reference-only.

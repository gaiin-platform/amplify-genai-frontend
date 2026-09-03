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
| `UploadPendingIndicator.tsx` | Thin progress bar shown while uploads are in flight |

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
| `PromptTemplatesSection.tsx` | Settings → Customize → Prompt Templates |
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
| `AttachMenu.tsx` | ⊕ attach menu (files, library, skills, web search toggle) |
| `AttachmentRail.tsx` | Pre-send attachment card strip above the composer textarea |
| `AttachmentCard.tsx` | Individual attachment with upload progress and retry |
| `DataSourceCard.tsx` | 76px file card + `DataSourceCardGrid` (2-col ≥640px, 12px gap) for attached data sources. State shows only in the 40px icon slot (spinner → file-type icon cross-fade) and the subtitle — the card surface never changes color |
| `DataSourceLibraryPicker.tsx` | Inline multi-select picker for already-uploaded library files. Emits `{id, name, type, metadata}` with **no `key`** — the assistant save step prefixes a keyless source with `s3://` |
| `FileDropZone.tsx` | Drag-and-drop file intake: `useFileDropTarget` (handlers + active flag for an existing root element), `FileDropOverlay`, and the `FileDropZone` wrapper. Only reacts to `Files` drags; depth-counted dragenter/leave |
| `libraryQuery.ts` | Shared library query vocabulary — `sanitizePageKey` (DynamoDB cursor rules; unsanitized page keys 502), `buildLibraryQuery`, `isAssistantRecord`, `libraryTypeLabel`. Used by NewLibraryView + the picker. No React imports |
| `assistantIdentity.ts` | Shared "is this really an assistant?" vocabulary — `PLACEHOLDER_ASSISTANT_NAMES`, `isPlaceholderAssistantName`. Rejects the backend's `"default"` fallback and the old-UI `"Standard Conversation"` look-alike, both of which mean *no* assistant. No React imports |
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
| `NewWebsiteSourceInput.tsx` | Data Sources → Website URL panel. Replaces `DataSources/WebsiteURLInput` with the same `onAddURL(url, isSitemap, maxPages?, exclusions?)` contract; Single page / Sitemap segmented control. Still defers to the old (portalled, unstyled) `SitemapUrlSelectionModal` for sitemap URL picking |
| `DriveSourcesPanel.tsx` | Data Sources → OneDrive/SharePoint. Native replacement for the old `AssistantDriveDataSources` stack (which stays in place for the old editor). The connector rows **are** the service selector — no tab bar, no "Select Service" dropdown; active row gets a left accent bar. Disconnect is revealed on hover and never clears that service's selections |
| `DriveFileBrowser.tsx` | One connected drive service's browser: breadcrumb above the table, one search field, one 40px header row, select-all with indeterminate state, rows capped on a whole-row boundary. Owns the folder trail + listing cache, so the panel must key it on the integration id |
| `DriveFileRow.tsx` | One 46px browser row. Containers navigate, files select, Level 4 does neither; type comes from the leading icon plus a muted inline label, never a column |
| `driveBrowserModel.ts` | Drive selection algebra — `normalizeDriveRecord`, `isContainer`, `applySelection` (the **only** mutator; one call per user action), `clearIntegration`, `selectionCounts`, `displaySize`. Ported from the old component so the saved `integrationDriveData` is unchanged. No React imports |
| `useDriveIntegrations.ts` | Supported + connected drive integrations, OAuth popup connect, disconnect. Replaces rendering `IntegrationTabs` purely for its side effects |

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

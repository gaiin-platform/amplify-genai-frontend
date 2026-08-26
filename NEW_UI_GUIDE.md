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

/* Borders */
--border-subtle             /* default border color */
--border-composer-active    /* composer card border on hover/focus */

/* Text */
--text-primary    /* body text, headings */
--text-secondary  /* labels, secondary info */
--text-muted      /* timestamps, placeholders, captions only */

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
| `AttachmentPreview.tsx` | Full-screen attachment preview with nav and focus trap |
| `RichComposer.tsx` | Textarea with paste/image capture handlers |
| `Badge.tsx` | Small status badge |
| `sidebarVisibility.ts` | Shared type + key for sidebar item visibility state |

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

10. **Scrollbar auto-hide pattern:** Remove `::webkit-scrollbar { width }` from containers
    that should use OS overlay scrollbars. The `data-scrolling="true"` idle-timer in
    `ConversationViewShell.tsx` provides progressive-enhancement visibility control for
    Windows/Linux (the timer is 700ms, constant `SCROLLBAR_IDLE_MS`).

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

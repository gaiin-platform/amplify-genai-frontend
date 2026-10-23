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
| `components/Home/home.tsx` | The layout/render section only (~line 1617+, the `uiPreference === 'new'` block) |

If you need behaviour from an old-UI component: **import it**, don't modify it. If you need to
restyle an old component wrapped inside a new-UI shell, add CSS overrides in
`conversation-view.css` scoped to a `data-*` attribute you control (e.g. `[data-new-ui-assistants]`).

---

## 2. Files You Must Never Touch

```
components/Home/home.tsx          — state, reducers, handlers (layout section is OK, body is not)
components/Home/home.context.tsx
components/Home/home.state.tsx
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
--bg-elevated     /* card that sits ON --bg-app (settings lists): white in light mode */

/* Borders */
--border-subtle             /* default border color */
--border-composer-active    /* composer card border on hover/focus */

/* Text */
--text-primary    /* body text, headings */
--text-secondary  /* labels, secondary info */
--text-muted      /* timestamps, placeholders, captions only */
--text-error      /* failure reasons — text only, never a fill */

/* Status — callouts and status text only, never interactive accents */
--warning-bg / --warning-border / --warning-fg / --warning-icon   /* caution callout (e.g. shown-once key) */
--success-fg / --success-bg                                       /* "Active" status */

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
| `NewUITranscriptPdfThumbnail.tsx` | Adapter that `NewUITranscriptAttachmentsLayer` portals into the classic grey "PDF" tile: maps a data source to `shared/PdfThumbnailFace` (library source, name left to the classic label). Covers sent **and** reloaded messages. No iframe/embed/object — see §5 rule 40 |
| `NewUITranscriptPastedTextLayer.tsx` | Renders sent `data.largeTextBlocks` pastes as `shared/AttachmentCard` chips in the transcript rail; opens `shared/AttachmentPreview` on click |
| `NewUITranscriptPreviewLayer.tsx` | Suppresses the classic `ImageModal` and mirrors post-send attachment previews into `shared/AttachmentPreview` (same component as the composer) |
| `NewUISourcesLayer.tsx` | Portal-based replacement for `ChatSourcesBlock`/`ExpansionComponent` "Sources" — renders a compact "N source(s)" pill toggle + flat list of source cards; hides original via `data-nui-src-original` CSS attribute |
| `NewUITokenCostInfoLayer.tsx` | Portals `shared/InfoTooltip` (i) beside the "Total Token Cost" line that `AgentLogBlock` renders inside Reasoning / Actions, explaining the figure is informational and not charged to the user |
| `NewUIMessageInfoButton.tsx` | The "⋯" action on an assistant reply: popover with send time (to the minute), model, assistant, and tools/features/connectors involved. Content from `shared/messageProvenance`; panel is portalled, so it carries `data-new-ui-shell` |
| `UploadPendingIndicator.tsx` | Thin progress bar shown while uploads are in flight |
| `ArtifactPanelLayer.tsx` | Injects a sticky header into `#artifactsTab` (the forbidden `Artifacts.tsx` panel): title/version dropdown, Download split button (Copy MD / Download .md / Download .docx), expand/fullscreen toggle, close (×). Also writes `--nui-artifact-panel-w` onto the shell so the composer and jump button constrain to the chat column. Listens to `openArtifactsTrigger`. |
| `ArtifactInlineCardLayer.tsx` | MutationObserver layer that replaces the static "Creating Your Artifact…" box from `AutoArtifactsBlock.tsx` with a polished inline card (generating spinner → completed card with Open/Hide toggle). Also injects `data-nui-artifact-btn` on `#artifactsButtonBlock` elements for CSS restyling without touching forbidden files. |
| `NewUIToolStepsLayer.tsx` | Replaces the classic "Calling: X with: …" status box with compact tool-step rows. Portals into a `[data-nui-tools-host]` placed first in each assistant message's `#chatHover`, and sets `data-takeover="true"` so a `:has()` rule in `conversation-view.css` hides the classic status wrapper (with nothing to show, the classic "● Thinking…" row stays). Steps come LIVE from HomeContext `status` (parsed + accumulated — `status` only ever holds the latest call) and, once present, SAVED from `data.state.agentLog` plus `data.state.codeInterpreter.runs` (authoritative: errors, result counts, and for code runs the code/output/files; what a reloaded chat shows). MCP calls are SAVED too (gated on `useStableFeatureFlags().mcp`): `data.state.mcpRuns` for calls the backend ran, and `data.mcpToolResults` + the message's `tool_calls` for calls the browser ran — on the intermediate assistant message the send hook keeps them on, **not** the final answer. A still-running MCP call is added from LIVE until its record lands. Sets `data-mcp-takeover="true"` on the host only when every `mcpToolResults` entry has a row, so a `:has()` rule can hide the classic `.mcp-tool-results` card without ever leaving a result unshown. Owns the one persistent `aria-live="polite"` announcer. Leaves `AgentLogBlock` ("Reasoning / Actions") alone |
| `ToolStepViews.tsx` | Presentational `ToolStepRow` (icon · label · status · chevron; expands to monospace parameters), `ToolStepGroup` (open while a step runs, collapses to "Used Outlook · 2 steps"), `ThinkingRow` (model reasoning, deliberately not styled as a step) and `MessageToolSteps`. A code-interpreter step (`step.detail`) is titled by the model's `step.title` and expands to `CodeRunDetails` — Code (copyable) / Output / Error / Files created — instead of raw parameters. An MCP step (`step.mcp`) expands to `McpCallDetails` — "Server · tool · duration", Arguments grid (copy as JSON), Result (copyable, "Result shortened"), Error, "Returned an image" notes, and images already stored on the message; the `plug` category icon; titled "Tool (Server)". Props only — renders to static markup in tests |
| `NewUITruncationNoticeLayer.tsx` | Notice under an assistant reply that stopped at the output-token limit ("Response was cut off…" + Continue) or produced no answer text. Portals into a `[data-nui-truncation-host]` appended to the message's `#chatHover`. Continue types a plain follow-up into ChatInput's hidden textarea and clicks the hidden send. Detection is `shared/responseTruncation` |

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
| `NewApiKeysSection.tsx` | Settings → API Access. Replaces the legacy `Settings/AccountComponents/ApiKeys` render: intro, create form, "Your keys" + "Delegated to you" lists (search/status/sort), shown-once key after create. Reports uncopied-key / unsaved-edit state to the modal via `onLeaveGuardChange` |
| `apiKeys/ApiKeyCard.tsx` | One key: the whole header row is the `aria-expanded` toggle (name or italic "Untitled key", meta line, one Active / Expired / Inactive pill), a read-only details grid, a single explicit Edit mode (Cancel / Save changes, Escape cancels), rotate + deactivate behind `ConfirmDialog`s, shown-once reveal after rotation. View and edit share one `auto-fill` grid so columns don't move. Edit state is per card |
| `apiKeys/apiKeyModel.ts` | React-free rules: `keyStatus` (expired comes from the DATE — the backend flips expired keys to `active=false` on fetch), who may edit/rotate (owner, active, unexpired), `describeLastUsed` / `neverUsed` (`lastAccessed` is initialised to `createdAt`), `formatAccount`, the edit draft → `updates` diff (only changed fields), validation, `minExpirationDate` (today is already expired server-side), Full access vs individual types, list filter/sort |
| `apiKeys/apiKeyActions.ts` | The Save / Rotate request handling (`saveKeyUpdates`, `rotateKey`) with injectable services; failure → message mapping |
| `apiKeys/AccessTypesField.tsx` | Access-types checkbox grid; Full access checks + disables the rest |
| `apiKeys/buttonStyles.ts` | Primary / secondary / ghost-danger button classes for the section |
| `leaveGuard.ts` | `LeaveGuard` — copy a section hands the settings modal when leaving would lose something (uncopied key, unsaved key edits) |
| `PromptTemplatesSection.tsx` | Settings → Customize → Prompt Templates. Two tabs: "My Templates" (Edit/Share/Delete hover actions) + "Shared with Me" (lazy-loads via `getSharedItems`, import on open) |
| `CustomInstructionsSection.tsx` | Settings → Customize → Custom Instructions. List of named instructions with hover Edit/Delete, radio-style active selector (one or none), inline create/edit form, ConfirmDialog for deletes. Active instruction injected into every new blank conversation |
| `SidebarItemsSection.tsx` | Settings → Customize → Sidebar Items visibility toggles |
| `admin/AdminsCard.tsx` | Admin section wrapper card; removing an admin uses the shared `ConfirmDialog` (its open state feeds the modal's Escape guard) |
| `admin/ConfigurationsTab.tsx` | Admin → Configurations tab content |
| `admin/SystemPromptsTab.tsx` | Admin → System Prompts tab — editors for ordinary-chat base, web-search, artifact, code-interpreter, and feature-gated Amplify-helper prompts |
| `admin/DeploymentFeaturesTab.tsx` | Admin → Deployment tab — toggles for deployment-wide feature availability (highlighter, artifacts, web search, code interpreter, memory) and classic-UI switch control |
| `admin/AnnouncementCard.tsx` | Admin → Deployment → Announcement Banner: on/off, message (500 chars), and expiry (until turned off / for N hours-days / until a date). Edits `deploymentFeatures.announcement` through the tab's normal `setConfig` + Save; includes a live preview |

### `shared/`
| File | Purpose |
|------|---------|
| `CreationModalShell.tsx` | Single-column creation modal shell (1100px × min(820px,90dvh)) |
| `ConfirmDialog.tsx` | Portalled confirmation modal; `variant='danger'/'warning'/'neutral'` |
| `FormControls.tsx` | The standard `TextControl` / `TextAreaControl` / `SelectControl` (real chevron) / `CheckboxControl` + `FieldError`: 36px, `--border-subtle`, focus ring, `aria-invalid` |
| `OneTimeSecretReveal.tsx` | The one place a shown-once secret (new / rotated API key) is displayed: calm warning callout, read-only monospace field, labelled Copy ("Copied ✓" + `aria-live`), Done. `useOneTimeSecret()` holds the value and the "Have you saved this key?" rule (`guard(action)`); copying counts as saving. Never log or persist the value |
| `IconButton.tsx` | Accessible icon button — always pass `aria-label` |
| `ToggleSwitch.tsx` | Pill switch; `role="switch"`, `aria-checked` |
| `SegmentedControl.tsx` | Tab strip / segmented picker; pass `aria-label` |
| `ModelPicker.tsx` | Model selector with families, effort levels, hover preview cards. Also exports `ModelCardBody` (the card content) — pair it with `InfoFloatCard` + `useInfoCardHover<Model>()` to preview a model anywhere (Settings → General default-model list does) |
| `modelCost.ts` | `getModelCostTier(model)` → `'low' \| 'moderate' \| 'high' \| null` plus `MODEL_COST_LABEL` / `MODEL_COST_GLYPHS` ($/$$/$$$). Shown on the `ModelPicker` hover card. Ports the classic `ModelSelect#getCostIcon` thresholds (costs are USD per **1K** tokens); the higher of input/output wins; `null` when unpriced so an unconfigured model is never advertised as "Low". No React imports |
| `InfoTooltip.tsx` | Hover/focus (i) icon with a small floating explanation; props `text`, `ariaLabel`, `maxWidth`. The reusable "what is this?" affordance |
| `InfoFloatCard.tsx` | 250ms hover-in preview card; Floating UI positioned. Used by `AttachMenu`, `ModelPicker`, and Settings → General default model |
| `AttachMenu.tsx` | ⊕ attach menu (files, library, assistant, explicit connectors). Optional ordinary-chat tools are deployment-managed and selected server-side; skills/plugin mode selectors are not user entry points. "Add from library" opens `DataSourceLibraryPicker` in a `surface='floating'` submenu and emits the picked files — it never opens the local file picker |
| `AttachmentRail.tsx` | Pre-send attachment card strip above the composer textarea |
| `AttachmentCard.tsx` | Individual attachment with upload progress and retry |
| `PdfThumbnailFace.tsx` | The one face of a PDF attachment card: skeleton → page-1 still (fills card width, cropped from the top, `devicePixelRatio`-sharp) with a "PDF · N pages" chip and optional truncated name + tooltip → on any failure (encrypted, corrupt, >25 MB, unreachable) a plain file card: PDF icon, "PDF · size", name. Lazy via IntersectionObserver. Used by `AttachmentCard` (composer) and `chat/NewUITranscriptPdfThumbnail` (sent/reloaded), so the surfaces cannot drift. `PdfThumbSource` is a stored library key or an in-memory URL |
| `pdfThumbnail.ts` | pdf.js rendering behind it — `planThumbnail` (width-fill + top-crop + DPR clamp), `renderPdfThumbnail`, `loadPdfThumbnail` (shared in-flight fetch, 60-entry cache, 2 concurrent renders, permanent failures cached / transient ones retried), `classifyPdfError`. Loads the vendored `components/Chat/JsPDF.js` lazily; its worker is `public/pdfjs/pdf.worker.min.js` and **must match that file's pdf.js version (3.10.111)**. No React imports |
| `DataSourceCard.tsx` | 76px file card + `DataSourceCardGrid` (2-col ≥640px, 12px gap) for attached data sources. State shows only in the 40px icon slot (spinner → file-type icon cross-fade) and the subtitle — the card surface never changes color |
| `DataSourceLibraryPicker.tsx` | Multi-select picker for already-uploaded library files. Emits `{id, name, type, metadata}` with **no `key`** — the assistant save step prefixes a keyless source with `s3://`. `surface='inline'` (default) is a band in a form; `surface='floating'` + `width` is the ⊕ menu's submenu panel |
| `libraryAttachment.ts` | The already-uploaded-file intake — `libraryFileToAttachedDocument` (derives the bare S3 `key`; `null` ⇒ unsendable, refuse it), `createLibraryUIAttachment` (`ready` card, `pending` preview), `hydrateLibraryAttachmentPreview` (downloads and resolves the card face; never throws). Use this for anything coming out of the library — `AttachFile#handleFile` would upload a second copy. No React imports |
| `FileDropZone.tsx` | Drag-and-drop file intake: `useFileDropTarget` (handlers + active flag for an existing root element), `FileDropOverlay`, and the `FileDropZone` wrapper. Only reacts to `Files` drags; depth-counted dragenter/leave |
| `libraryQuery.ts` | Shared library query vocabulary — `sanitizePageKey` (DynamoDB cursor rules; unsanitized page keys 502), `buildLibraryQuery`, `isAssistantRecord`, `libraryTypeLabel`. Used by NewLibraryView + the picker. No React imports |
| `assistantIdentity.ts` | Shared "is this really an assistant?" vocabulary — `PLACEHOLDER_ASSISTANT_NAMES`, `isPlaceholderAssistantName`. Rejects the backend's `"default"` fallback, its internal per-request assistants (`"Amplify Automation"` for connectors, `"Code Interpreter Assistant"`, `"Artifacts Assistant"`) and the old-UI `"Standard Conversation"` look-alike, all of which mean *no* assistant. No React imports |
| `amplifyHelperGuide.ts` | React-free identity, reserved marker, policy/resource links, built-in prompt, and comprehensive New UI guide sections for the all-users Amplify Helper |
| `customInstructions.ts` | React-free store for custom instructions — `loadStore`, `saveStore`, `getActiveInstructionContent`, `buildPromptWithInstruction`, `createInstruction`, `updateInstruction`, `deleteInstruction`, `setActiveInstruction`. Migrates old single-string key on first read. Used at every new-conversation call site in the new UI |
| `AttachmentPreview.tsx` | Full-screen attachment preview with nav and focus trap |
| `RichComposer.tsx` | Textarea with paste/image capture handlers |
| `Badge.tsx` | Small status badge |
| `SortableHeader.tsx` | Column header that toggles sort; chevron when active, selector icon when not. Used by Library + Chats lists |
| `FilterMenu.tsx` | Filter popover — radio groups, Clear all; `variant='toolbar'` (labelled button + count badge) or `'icon'` (ghost icon button + dot). Portalled and positioned from the trigger rect, so it survives overflow-hidden/scrolling ancestors |
| `chatFilters.ts` | Shared conversation filter/sort vocabulary (pinned, storage, assistant + comparators). Used by ChatsListView and the sidebar Recents section. No React imports |
| `sidebarVisibility.ts` | Shared type + key for sidebar item visibility state |
| `messageProvenance.ts` | "What produced this reply?" — `getMessageProvenance` (model stamp, assistant, web search, skills, agent-log actions, MCP tools, attached connector actions/files), `buildMessageMetaStamp`, `MESSAGE_META_KEY` (`data.newUiMeta`), `formatExactTimestamp`, `formatProvenanceMarkdown` (the one-line blockquote `shared/ArtifactExportMenu#formatConversationAsMarkdown` puts under each reply in the Markdown/Word/copy export — same facts as the popover, each shown once). The backend doesn't stream the model back, so `NewUIMessageActionsLayer` stamps it when a live reply starts streaming; older replies have none and show "Not recorded" — never infer from the conversation's current model. No React imports |
| `useConversationAssistant.ts` | Resolves the assistant attached to the selected conversation (explicit pick → `promptTemplate` → transcript stamps), re-attaches it to `selectedAssistant` once per conversation so follow-up sends stay routed, and exposes `detach()`. Use this instead of reading `selectedAssistant` directly — that field is global and gets reset by `handleNewConversation`/`handleSelectConversation`. Test "is there an assistant?" with its `isRealAssistant`, never `id === DEFAULT_ASSISTANT.id` |
| `useStableFeatureFlags.ts` | Read feature flags through this, never `state.featureFlags` directly. Falls back to a localStorage cache (scoped to the signed-in user via `amplify_feature_flags_cache_owner`) while `/feature_flags` is in flight or failed, and merges (rather than applies) the single-key `smartMessages` startup patch. No React-free exports: `resolveFeatureFlags`, `isFullFlagSet`, `PATCH_ONLY_FLAG_KEYS` |
| `FeatureFlagsSelfHeal.tsx` | Mounts once at the new-UI root; renders nothing. home.tsx fetches `/feature_flags` once, so a failed request leaves `state.featureFlags` `{}` all session (and nothing cached on a first visit/new browser). While no full flag set is present it retries the de-duplicated request with backoff, on refocus and on `online`, then dispatches the result. Stops when any writer supplies a full set |
| `featureFlagRetry.ts` | React-free retry rules: `FLAG_RETRY_DELAYS_MS`, `FLAG_RETRY_STEADY_MS`, `nextFlagRetryDelay` (backoff, then a 5-min steady cadence — never gives up), `mergeRetriedFlags` (rejects untrusted payloads; keeps the `PATCH_ONLY_FLAG_KEYS` values already in state). No React imports |
| `integrationIcon.tsx` | `integrationIcon(id, size?)` — the `public/logos/integrations/*.svg` logo for an integration id (underscores → hyphens). Used by Settings → Connectors and the assistant editor's drive panel |
| `GeneratingSpinner.tsx` | Minimal 12px SVG arc spinner (270° dash, no track ring). Place inside a `text-[--text-muted]` container; the SVG uses `currentColor`. CSS animation defined in `globals.css` (`.nui-generating-spinner`). Accepts optional `size` prop. |
| `SearchInput.tsx` | The 34px toolbar search field (`IconSearch` + input), with `fullWidth` for use inside a card and an optional `onClear`. Extracted from three verbatim copies. Does **not** cover the divergent fields in `ChatsListView`, `NewLibraryView`, `DataSourceLibraryPicker`, `DriveFileBrowser`, `AttachMenu` |
| `EmailChipsInput.tsx` | The one people picker — chips + `amplifyUsers` autocomplete, portalled `position:fixed` dropdown. Used by the assistant editor (Specific people → *Who has access*, Team → *Add members*) and `chat/NewUIShareModal`. Uncontrolled input unless you pass `inputValue`/`onInputChange`; `onError` reports duplicate/malformed addresses. Escape closes only the dropdown (§14) |
| `SignInRequiredNote.tsx` | One-line muted note "must have signed in to Amplify at least once" placed by the host under every `EmailChipsInput` (`action`: `share` / `access` / `delegate` / `add`). The backend only accepts users already in the Amplify user table: an API-key delegate is rejected, and a share silently drops them. Not rendered inside `EmailChipsInput` because each host owns its hint line. Used by `NewUIShareModal` (chats, assistants, prompt templates), `NewApiKeysSection`, the assistant creation modal and `NewGroupManagementModal` |
| `emailSuggestions.ts` | React-free vocabulary behind it — `normalizeEmailPool`/`buildEmailPool` (drop raw-UUID values, dedupe case-insensitively, sort), `rankEmailSuggestions` (prefix matches before substring), `resolveUsernameForEmail` (case-insensitive email→username for the share/group APIs), `splitEmailList`, `looksLikeEmail`. No React imports |
| `useIntegrationConnections.ts` | Supported + connected integrations, OAuth popup connect, disconnect, for an optional `filter`. The one copy of that flow; `useDriveIntegrations` is a thin wrapper. Also exports `isConfigurationMessage` — an unconfigured backend answers with a *message*, not a failure worth alerting on |
| `openAtLatest.ts` | The "open a conversation at its newest message" rule — `nextOpenAtLatestTop` plus its tolerance/frame budgets. Returns the scroll maximum to pin to, or `null` once the user scrolls up. Used by `ConversationViewShell`'s open-at-latest pin loop. No React, no DOM imports |
| `uiPreferenceResolution.ts` | The stored new-vs-classic choice: `UI_PREF_KEY`, `getUIPreference`, `writeLocalUIPreference`, `clearUIRoutingCookie`, `resolveStoredUIPreference` (server beats localStorage), `resolveUIPreferenceWithPolicy` (rollout disabled → classic; no choice → new; never `'ask'`), and the `?uiPreference=reset` helpers. No React imports |
| `deploymentFeaturePolicy.ts` | Deployment flag vocabulary. `isNewUiEnabled` (pure: only an explicit `newUi: true` enables), `resolveNewUiRollout` (verdict from a raw payload, `null` if untrusted), `isClassicUiSwitchAllowed` (independent of the rollout), the per-user rollout cache (`cacheNewUiRollout`/`readCachedNewUiRollout`) and the classic-switch cache. No React imports |
| `uiRolloutStore.ts` | Module-level store: may this user see the New UI? Written only by `UIPreferenceBanner`. `computeEffectiveUi` and `canApplyUiPreference` hold the rules. No React imports |
| `featureFlagName.ts` | `normalizeFeatureFlagName` — admin "Add Feature" label → camelCase key ("New UI" → `newUi`, acronyms lower-cased, reserved names canonicalised). Used by `Admin/AdminComponents/FeatureFlags.tsx`. No React imports |
| `uiPreferenceResolver.ts` | The startup New-vs-Classic decision as a state machine (both responses, timeout, late responses; fails closed). No React imports |
| `NewUiRolloutGate.tsx` | Render-prop gate around home.tsx's New-vs-Classic ternary; renders New only while the rollout is confirmed enabled. Also `useUiRolloutSnapshot` |
| `useUiSwitchPolicy.ts` | `canSwitchToNew` / `canSwitchToClassic` — the one rule both account menus use |
| `userDefaultModel.ts` | User's personal default model preference — `USER_DEFAULT_MODEL_KEY`, `getUserDefaultModelId`, `setUserDefaultModelId`. localStorage-backed, no React imports. Takes precedence over admin's `defaultModelId` in `NewHome` + `ModelPicker` slate. The setter fires `USER_DEFAULT_MODEL_CHANGED_EVENT` on a real change (Settings or server sync) so the already-mounted `NewHome` follows without a refresh. **Roams**: `shared/userDisplayPrefs` mirrors this key to/from the server — write it through `saveDisplayPrefsToServer` too, or the choice stays on one device. |
| `userDefaultEffort.ts` | User's personal default reasoning effort — `USER_DEFAULT_EFFORT_KEY`, `getUserDefaultEffort`, `setUserDefaultEffort`. localStorage-backed, no React imports. Seeds `NewHome` + `ConversationComposer` initial effort state; the setter fires `USER_DEFAULT_EFFORT_CHANGED_EVENT` on a real change so `NewHome` follows live. **Roams** via `shared/userDisplayPrefs` — same caveat as `userDefaultModel.ts`. |
| `outputTokenBudget.ts` | The one place `max_tokens` is decided: `computeMaxOutputTokens(model, effort)` = `min(limit, max(limit/2, reasoningReserve[effort] + responseAllowance))`, with the answer's share protected on small-limit models. Tunables are `DEFAULT_PROFILE` + `MODEL_PROFILE_OVERRIDES`; the cap is `model.outputTokenLimit`. `maxTokensForRequest` also honours an assistant's enforced model and `enforceThinkingLevel`. No React imports |
| `temperature.ts` | `clampTemperature` (0–1, the range every provider accepts; non-numbers → default) and `resolveConversationTemperature` (new empty chat → `DEFAULT_TEMPERATURE`, else clamp). The new UI has no temperature control, so chats must not inherit the last chat's value. No React imports |
| `useOutputTokenBudget.ts` | Mounted by `ConversationComposer`; keeps `conversation.maxTokens` equal to the budget above and `temperature` valid (idempotent, skipped while streaming). `NewHome` and `promptConversation` also stamp it at creation so the first send is sized too |
| `responseTruncation.ts` | `getTruncation` / `truncationCopy` / `CONTINUE_PROMPT`. Reads a reported length stop from `message.data.state` (`stopReason`, `finishReason`, `truncated`, …) and infers the reasoning-only/no-text case. No React imports |
| `sharedItemClassifier.ts` | Classifies incoming share bundles by content type (`conversation` / `assistant` / `prompt-template`). Module-level promise cache + localStorage persistence so the O(n) load is paid once per session. Exports `getClassifiedSharedItems`, `invalidateSharedItemsCache`, `ClassifiedShareItem`, `ClassifiedShareItems`. No React imports |
| `shareHistory.ts` | localStorage-backed, user-scoped record of outgoing shares. Exports `loadShareHistory`, `recordShare`, `getSharesForSource`. Also `resolveShareNote` (blank note → item name, so receivers never see "Untitled share"; pass its result to `shareItems`). Call `recordShare` only after a successful `shareItems()` resolve. No React imports |
| `shareAssistantWithEmails.ts` | Runs the Share-modal share (strip → `createExport` → `shareItems` → `recordShare` → cache invalidation) for an assistant `Prompt` + emails. Used by the assistant creation modal's "Specific people" access, which on its own only registers a path allow-list and never reaches Shared with me. No React imports |
| `shareOutcome.ts` | What a `shareItems()` response means for the typed addresses: `interpretShareResult` → `all` / `partial` / `none` / `failed` plus which addresses were `reached` vs `notSignedIn`. The backend returns `invalidUsers` (usernames or raw emails, matched case-insensitively) — a *partial* share still has `success: true`, so never treat `success` alone as "everyone got it". Also `noneSignedInMessage` / `partialSignedInMessage` copy. Used by `NewUIShareModal` (none → inline error, partial → warning + Done, history records only reached people) and `shareAssistantWithEmails` (returns `{ ok, notSignedIn }`). No React imports |
| `userDisplayPrefs.ts` | The one server-sync path for the four personal display prefs (chat font, conversation storage, default model, default effort). `getChatFont` (**the** font resolver: dedicated key → settings blob → `'sans'`; the settings dropdown, `ConversationViewShell` and the CSS fallback must agree or the setting misreports), `saveDisplayPrefsToServer` (fetches server settings, merges, guarantees the schema-required keys, saves; returns `false` rather than throwing), `applyServerPrefsToLocalStorage` (writes server values into the dedicated keys the pickers read; fires `amplifyChatFontChanged` only on change), `backfillLocalDefaultsToServer` (one-shot publish of pre-existing local choices for keys the server has no opinion on). **`null` = explicitly cleared and roams; key absent = no opinion, leave the device alone** — conflating them either wipes a local choice or makes "System default" un-roamable. No React imports |
| `userWebSearch.ts` | The user's web-search opt-out (Settings → General, for Level 3 data) — `getUserWebSearchEnabled` (**default ON**; dedicated key → settings blob → `true`), `getStoredUserWebSearchChoice`, `setUserWebSearchEnabled`, `WEB_SEARCH_LEVEL3_INFO` (the `InfoTooltip` copy). Roams via `shared/userDisplayPrefs` (`webSearchEnabled`). `hooks/useChatSendService` sends `disableWebSearch: true` when off; the backend router treats it as a veto only. No React imports |
| `UserPrefsSync.tsx` | Mounts once at the new-UI root; renders nothing. Idempotent difference-based sync of the server-synced display prefs, a grace-delayed seed of the system storage default, and a once-per-load backfill. Precedence: server-synced user choice > admin default > system default. Never calls `handleStorageSelection` — `'future-cloud'` is going-forward and must not migrate existing conversations |
| `PromptTemplateFillDialog.tsx` | New-UI styled "populate and use this template" form — portalled to `document.body`, supports text/file/boolean/options variable types with design-token styling. Has an edit icon button (`onEdit`) so the host can switch to edit mode. Used by `PromptTemplateDialog`. |
| `PromptTemplateDialog.tsx` | Orchestrates the fill-in popup: invokes `PromptTemplateFillDialog` (new UI), runs `fillInTemplate` semantics, sends via `amplify_pending_message`. Accepts `onEdit` callback passed through to the fill dialog. Also exports `promptTemplateVariables`. |
| `promptConversation.ts` | `startConversationWithTemplate` — creates the conversation for a template (promptTemplate, tags, rootPrompt, resolved model) under the `'New Conversation'` name so the AI renames it after the first reply. Takes `homeDispatch` because it must set `isStandalonePromptCreation` in the same batch (§30). No React imports |
| `PromptTemplateDialogHost.tsx` | Single mount point for the popup above, at the new-UI root in `home.tsx` — a sibling of `NewSettingsModal`, never a descendant. Launch it with the exported `openPromptTemplateDialog(prompt)` and then close your own modal: the popup survives because it isn't in your subtree. Settings has three entry points (collapsed sidebar, expanded sidebar, ⌘,) so per-launcher hosts would have to be triplicated |
| `LayeredBuilderHost.tsx` | Listens for `openLayeredBuilderTrigger` window events and renders `LayeredAssistantBuilder` in a portalled full-screen dialog. The event's only classic-UI listener is `UserMenu`; this host provides the equivalent for the new-UI branch. Mounted at the new-UI root in `home.tsx` alongside `PromptTemplateDialogHost` |
| `AssistantAdminUIHost.tsx` | Listens for `openAstAdminInterfaceTrigger` window events and renders `AssistantAdminUI`. The event's only classic-UI listener is `UserMenu`; this host provides the equivalent for the new-UI branch so gear icons in `GroupAssistantsTab` open the admin interface. Mounted at the new-UI root in `home.tsx` alongside `LayeredBuilderHost` |
| `lastViewedChat.ts` | The "refresh puts me back in the chat I was reading" vocabulary — `LAST_CHAT_KEY` (sessionStorage, so it survives a refresh but not a new tab), `nextRecordedChat` (`record`/`clear`/**`keep`** — an unknown message state must never clear a good id) and `findRestorableConversation` (proves content via `messages`, `compressedMessages`, **or** being cloud-stored, and normalizes `messages` to an array on the way out). Both keep *empty* apart from *unknown* per §36. No React imports |
| `LastChatRestore.tsx` | Mounts once at the new-UI root; renders nothing. Records the conversation being viewed and re-selects it once per load, so reloading inside a chat no longer lands on NewHome. Restore waits for a non-empty `availableModels` (`handleSelectConversation` rewrites `conversation.model` when the model isn't in that map) and gates hydration on `conversationStateId !== 'init'`, **not** `=== 'post-init'` — `useHomeReducer` replaces that string with a uuid on every later `selectedConversation`/`conversations` dispatch. Defers to the `amplify_pending_message` bridge |
| `LiveHomeStateMirror.tsx` | Mounts once at the new-UI root; renders nothing. Feeds `useSendService`'s module-level mirror of the selected conversation id + conversation list. Needed because the chat view is keyed by conversation id: clicking away unmounts the component that owns an in-flight send, so the hook's render-refreshed refs go stale and its `selectedConversation` guard would let the stream yank the user back. The hook also records WHICH conversation is generating (`useStreamingConversationIds` / `isConversationStreaming`) because `messageIsStreaming` is one global boolean: the sidebar spinner and `ConversationViewShell` (which re-provides `HomeContext` with the flag scoped to the open chat, so old-UI `Chat`/`ChatMessage` show their action buttons on an idle chat) both use it. Empty ids = unknown owner, fall back to the global flag |
| `ChatBusyNoticeHost.tsx` | Mounts once at the new-UI root. Shows a `NoticeDialog` ("another chat is still responding") when `blockIfOtherChatGenerating()` (hooks/useChatSendService) fires its window event. Called by `ConversationComposer.handleSend` and `NewHome.handleSend` (before the draft is cleared, so text is kept) and as a safety net at the top of `useSendService.handleSend` (retry/edit). Sends are blocked because the generating flags are global — a concurrent send would corrupt the first one's state |
| `NewUILoadingStatus.tsx` | Quiet accessible loading treatment — viewport overlay by default, or compact inline status with `variant="inline"`. `NewUILegacyLoadingAdapter` detects a specific initial-load row inside a New UI wrapper and replaces it without changing legacy behavior. Used for startup, in-view work, and Settings initial loads. `role="status"`, `aria-live="polite"`, respects `prefers-reduced-motion`. |
| `announcement.ts` | React-free vocabulary for the admin banner — `readAnnouncement`, `isAnnouncementActive`/`isAnnouncementExpired`, `msUntilExpiry`, `computeExpiresAt`, `patchAnnouncement` (new `id` on new text or re-enable), and the per-tab-session dismissal helpers. Lives in `deploymentFeatures.announcement`; expiry is one absolute `expiresAt`. No React imports |
| `toolStepLabels.ts` | The one map from a tool name to how the chat shows it — connector (brand icon via `integrationIcon`, "Used Outlook" naming) or category icon, running label ("Searching your inbox"), done label, optional result `unit`. Covers every `microsoft*` tool in the office365 lambda plus `exec_code`. Labels read friendly values from args (mail folder, date range) formatted in the user's local zone, never ISO/UTC. Unmapped tools fall back to `humanizeToolLabel` (vendor prefix dropped, camelCase split). `describeToolStep` is the entry point; an `mcp_<server>_<tool>` name is recognised (`parseMcpToolName`, category `mcp`) and humanised, never shown raw. No React imports |
| `toolSteps.ts` | Structured tool-step model — `ToolStep {tool, status, args, resultSummary?, errorDetail?}`. `parseLegacyToolStatus` recovers `{tool, args}` from the "Calling: X" string `utils/app/agent#handleAgentRun` writes; `advanceLiveSteps` accumulates distinct calls (the poll only carries the latest, and no result/error); `stepsFromAgentLog` rebuilds authoritative steps from a saved log; `groupTitle`, `plainErrorMessage`, `formatParamRows`, and `stepsFromInterpreterRuns` (one `exec_code` step per sandbox run from `state.codeInterpreter.runs` — the backend's `buildRunRecord`: `{id, ok, code, description?, stdout?, error?, files?, truncated?}`; skips malformed records). `ToolStep.title` / `ToolStep.detail` carry a run's description and body. MCP: `ToolStep.mcp` plus `stepsFromMcpRuns` (backend `buildMcpRunRecord` records: `{id, ok, tool, serverName?, args?, result?, error?, media?, ms?, truncated?}`), `stepsFromMcpToolResults` (browser-run calls: `data.mcpToolResults` paired with `tool_calls` by position), `describeStep` (server-aware labels), `withRunningMcpSteps`, `mcpServersUsed`, `summarizeMcpResult` (a count only for a clear JSON list); `groupTitle` names servers. No React imports |
| `DisclosureChevron.tsx` | The one expand/collapse glyph (right → down). Glyph only — the parent must be a `<button aria-expanded>`. Rotation transition lives in `conversation-view.css` with a reduced-motion override |
| `AmplifyLogo.tsx` | The one Amplify mark (sidebar, new-chat heading, login). Bypasses the `/_next/image` optimizer (`unoptimized`) and swaps to an "A" tile on load failure, so a broken-image icon never shows. Use it instead of a bare `<Image src="/amplify-logo.png">` |
| `AnnouncementBanner.tsx` | Mounted in `home.tsx`'s New UI layout above the sidebar/content row. Shows the admin announcement until the user closes it (close lasts the tab session, cleared on sign-out, so it returns next login). Also exports `AnnouncementBar` (the presentational bar, used for the admin preview). The message is centred on one line; if it doesn't fit it scrolls as a looping ticker (pauses on hover; reduced-motion users get a static, manually scrollable line) |

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
| `NewAssistantsView.tsx` | Assistants gallery: My / Shared with Me / Teams / Layered / feature-gated Amplify Helper tabs |
| `NewAssistantTypeSelector.tsx` | Step-0 type picker (Private/Managed/Team) before AssistantModal |
| `NewUIAssistantCreationModal.tsx` | Unified assistant creation form (access type + fields inline) |
| `NewUIPromptCreationModal.tsx` | Prompt template creation modal |
| `ChatsListView.tsx` | Chats & Tasks full-pane list with search |
| `NewLibraryView.tsx` | Data sources library: list rows, upload, batch delete |
| `LibraryView.tsx` | Thin wrapper for NewLibraryView |
| `AmplifyHelperAssistant.tsx` | Feature-gated Amplify Helper tab guide and locked start-chat surface; never persisted as a user assistant |
| `NewScheduledTasksView.tsx` | Scheduled tasks: list + editor/logs pane |
| `NewWorkflowsView.tsx` | Workflow templates: list + detail pane |

### Root
| File | Purpose |
|------|---------|
| `UIPreferenceBanner.tsx` | Startup resolver + opaque cover for the New-vs-Classic choice; publishes the rollout verdict; exports `setUIPreference` (policy-guarded, returns `{applied, persisted}`) |

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

23. **The `newUi` feature flag is the only authority on whether the New UI may appear.**
    Never decide New-vs-Classic from `uiPreference`, localStorage, a cookie or a cached
    flag directly. `home.tsx` renders the New layout only through `NewUiRolloutGate`;
    menus read `useUiSwitchPolicy()`; persistence goes through `setUIPreference`, which
    refuses a change the policy forbids. The flag name is exactly `newUi`; it is **off by
    default** (absent = disabled, everyone stays on Classic) until an admin enables it. User/group exceptions *invert* the flag server-side, so the client only ever
    sees an effective boolean. A failed or untrusted `/feature_flags` falls back to this
    user's cached verdict, then to Classic (fail closed); a late response re-resolves. An open tab re-checks on refocus (≥30 s apart), when
    the admin saves flags (`REVALIDATE_ROLLOUT_EVENT`) and when another tab of the same user
    publishes a verdict; a failed re-check never changes the verdict.


37. **Anything that must reflect an admin *take-down* reads `state.featureFlags`, not
    `useStableFeatureFlags`.** The stable hook deliberately serves the localStorage cache while
    `/feature_flags` is in flight so gated UI doesn't blink out; that is exactly wrong for an
    announcement the admin has just removed, which would flash back on every load. The banner
    accepts appearing a beat late instead (`shared/AnnouncementBanner.tsx`).

38. **`max_tokens` is shared by reasoning and the answer, and the client cannot see why a reply
    stopped.** `useChatSendService` sends `conversation.maxTokens || outputTokenLimit / 2` and
    nothing per request, so size it on the conversation (`shared/outputTokenBudget`,
    `useOutputTokenBudget`) from the model **and the effective effort** — an assistant's
    `enforceThinkingLevel` / `model` override the conversation's. `Chat.tsx` still mounts and
    rewrites `maxTokens` from its hidden response-length slider on a model change; the hook
    corrects it. Separately, `services/chatService` drops `finish_reason` and the backend does
    not forward `max_tokens`/`length` stops, so truncation is only knowable when the backend
    adds one to `data.state` (`shared/responseTruncation`). Do not infer "cut off" from text that
    merely ends abruptly.

39. **A `window` event only the classic UI dispatches is a dead save path, not just a dead link.**
    `Settings/AccountComponents/ApiKeys` queued each field edit in a ref and sent them on the
    `settingsSave` event, which only `Settings/SettingDialog.tsx` (classic) fires — so in the New
    UI every API-key edit was collected and never sent, with no error. §18 covers dead *navigation*
    bridges; the same applies to deferred *saves*. When wrapping an old component, grep its
    `addEventListener` names for a dispatcher in the new branch, and prefer a section that saves
    itself (`settings/NewApiKeysSection`). Related backend facts it encodes: `/apiKeys/keys/update`
    is owner-only and rejects inactive or expired keys, an expiration of *today* already counts as
    expired, and `full_access` is a stored sentinel (every check is `type in access or
    "full_access" in access`), not shorthand for the other types.

40. **A PDF in the message list is a still image, never an `<iframe>`/`<embed>`/`<object>`.** Those
    hand the file to the browser's own viewer, which paints its own toolbar (zoom / fit /
    download) in a separate compositing layer that ignores the card's `overflow`, `transform` and
    `opacity` — it floats beside the card, and `#toolbar=0` is a Chrome hint other browsers
    ignore. Render page 1 with `shared/pdfThumbnail` and show it via `shared/PdfThumbnailFace`.
    The native viewer may appear only in `shared/AttachmentPreview` (portalled out of the
    transcript); `shared/__tests__/pdfThumbnail.test.ts` fails if another New UI file embeds one.
    The classic code-interpreter block still embeds `<iframe id="Generated_PDF">`, so
    `conversation-view.css` hides it inside `.chatcontainer`.

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

## 7. Documentation References

For an AI chat failure that may originate in the backend, use the backend repository's [AWS Backend Logs and AI Chat Debugging Runbook](https://github.com/gaiin-platform/amplify-genai-backend/blob/dev/docs/aws-backend-logs-and-chat-debugging.md). It covers frontend symptom triage, API Gateway/Lambda/CloudWatch correlation, and deployment artifact verification.

Keep incident timelines, log excerpts, and recovery history in separate incident documents; this guide remains reference-only.

## 8. Updating This File

Add one line to the Component Registry whenever you create a new component.
Add a token to Section 3 if you define a new CSS variable in `globals.css`.
Add a rule to Section 5 if you discover a new constraint that should apply to all future sessions.
Do not add implementation history, phase numbers, or debugging notes — keep it reference-only.

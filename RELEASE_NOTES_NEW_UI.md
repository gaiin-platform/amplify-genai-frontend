# Release Notes: v0.9.5 (New UI) - Frontend

**Release Date**: 2026-11-06 (planned)
**Previous Version**: v0.9.4 (September 10, 2026)
**Branch**: `dev` (merges to `main` at release)
**Requires**: backend v0.9.5 - see [`amplify-genai-backend/RELEASE_NOTES_NEW_UI.md`](https://github.com/gaiin-platform/amplify-genai-backend/blob/main/RELEASE_NOTES_NEW_UI.md). **Deploy the backend first.**

---

## Summary

Version 0.9.5 adds the **New UI**, a redesigned interface for Amplify. Compared with `v0.9.4` it contains **322 commits** and **659 changed files**. The New UI ships **switched off**: it is controlled by a feature flag named `newUi`, and deploying this release changes nothing for users until an admin turns the flag on. The Classic UI is still in the product.

This document keeps two kinds of content apart:

- **[Part 1 - Before you upgrade](#part-1---before-you-upgrade)**: what an operator or admin must know or do beyond a normal rebuild and deploy. Read this first.
- **[Part 2 - What's new](#part-2---whats-new)**: what users get in this release, by area.

### Highlights at a Glance
- :warning: **Requires backend v0.9.5.** The New UI reads its on/off flag from `GET /amplifymin/feature_flags` and calls routes that are new in the backend.
- :warning: **The New UI is off by default.** An admin enables the `newUi` feature flag (exact name, case-sensitive).
- :warning: **Build changes** - Next.js 14 to 15, Node 20 or newer, `console.log/info/debug` removed from production builds.
- :art: **White labeling** - the New UI honors `NEXT_PUBLIC_CUSTOM_LOGO`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_DEFAULT_THEME` and the new `NEXT_PUBLIC_ORGANIZATION_NAME`. These are **build-time** values and must be passed as Docker build arguments.
- :mag: **RAG upgrade (admin tool)** - a new **RAG Migration** tab in the New UI admin panel and a **Document Retention** card (off by default). They need the matching backend and do nothing until an admin uses them. See [section 6](#6-rag-migration-and-document-retention-admins).
- :package: **No mandatory data migration** in the browser or on the server. Moving existing documents to the new RAG storage is optional and admin-run (section 6).

### Terms used in this document
- **Feature flag**: an on/off switch in the Admin panel, with optional per-user and per-group exceptions.
- **Build argument** (`docker build --build-arg NAME=value`): a value supplied when the image is built. `NEXT_PUBLIC_*` variables are copied into the compiled JavaScript at that moment, so changing them later, at `docker run`, has no effect.
- **Classic UI / New UI**: the previous and the redesigned interface.

---

# Part 1 - Before you upgrade

## 1. Deploy order

1. Deploy the backend (all services; see its release notes). Without it the `newUi` flag cannot be read and some New UI features call routes that do not exist.
2. Rebuild the frontend image, then push it and update your service (ECS, or your own hosting).
3. In the Admin panel, turn on the `newUi` flag (next section).

## 2. Turn on the New UI (admin steps)

The New UI is off until `newUi` is on. The backend serves the flag, so the backend must already be deployed.

1. Sign in as an admin and open the **Admin Panel** (from the account menu in the sidebar). In the New UI the tabs are: Configurations, System Prompts, Deployment, Supported Models, Application Variables, **Feature Flags**, Feature Data, User Costs. In the Classic UI use the gear icon, then **Admin Interface**, then the **Feature Flags** tab.
2. Find `newUi` in the list. A current backend creates it as **disabled** the first time flags are read, so it should already be there. If it is missing, click the **+** button next to the "Feature Flags" heading (**Add Feature**) and type `New UI`. The form converts that to the exact name **`newUi`** (it also converts `newUI` and `new ui`). The name must be exactly `newUi`; a flag spelled any other way is ignored.
3. Choose who gets it:
   - **Everyone**: switch `newUi` on and save.
   - **A pilot group**: leave `newUi` **off** and add the pilot users (email) or Amplify groups as **exceptions**. An exception **inverts** the flag for that person, so they see the New UI while everyone else does not.
   - **Everyone except some people**: switch `newUi` on and add the people who should stay on Classic as exceptions.
4. Click **Save** in the admin modal. Nothing is stored until you save.
5. Users get the change on their next page load. Open tabs re-check when the tab regains focus (at most every 30 seconds) and the admin's own tab re-checks as soon as the flags are saved.

### What a user sees

`allowClassicUiSwitch` is a setting on the Deployment tab (default on). A user's "saved preference" is the last UI they picked (stored in their browser and in their server-side user settings).

| `newUi` flag (after exceptions) | Saved preference | `allowClassicUiSwitch` | User sees |
|---|---|---|---|
| off | any | any | **Classic UI** |
| on | none (first visit) | any | **New UI** |
| on | New | any | **New UI** |
| on | Classic | on | **Classic UI** |
| on | Classic | off | **New UI** (the Classic choice is overridden) |

- `newUi` is the **only** thing that can turn the New UI on. A saved preference, local storage or a cookie cannot.
- With the flag off, saved preferences are kept, so turning the flag back on restores each user's choice.
- When the flag is on, the New UI account menu has **Switch to Classic UI**, and the Classic user menu has **Switch to New UI**. The Classic switch is hidden when `allowClassicUiSwitch` is off. The server also refuses to save a Classic preference in that case.
- **If the flag cannot be read** (request fails or returns an unusable answer), the app uses that user's last known answer from their browser. If there is none, it shows **Classic**. If the request hangs, the app decides after 6 seconds. A late answer is applied when it arrives.
- To test a first run in one browser, open the app with `?uiPreference=reset`. It clears that browser's saved choice and the server-side one, then reloads.

## 3. Other flags and admin settings the New UI reads

| Setting | Where | Default | Notes |
|---|---|---|---|
| `newUi` | Feature Flags | **off** | Gate for the whole New UI. |
| `amplifyHelper` | Feature Flags | off | A base flag. Shows the Amplify Helper tab under Assistants. See `docs/AMPLIFY_HELPER_GUIDE.md`. |
| `notebook` | Feature Flags | not present | **Not** a backend base flag: an admin must create it with **Add Feature**. Only an explicit `true` turns it on. |
| `halloween` | Feature Flags | not present | **Not** a base flag: create it with **Add Feature**. Seasonal theme. Only an explicit `true` turns it on. |
| `mcp`, `skills`, `webSearch`, `artifacts`, `scheduledTasks`, `createAssistantWorkflows` and other existing flags | Feature Flags | per backend | The New UI honors them. For example, the Workflows sidebar item appears only with `createAssistantWorkflows`, and Scheduled tasks need `scheduledTasks`. |
| `deploymentFeatures` | Admin, Deployment tab | see below | Deployment-wide availability and UI policy (new). |
| `systemPrompts` | Admin, System Prompts tab | built-in prompts | Editable system prompts (new). |

**`deploymentFeatures`** fields:

| Field | Default | Meaning |
|---|---|---|
| `availability.promptHighlighter` | **off** | Prompt highlighter. |
| `availability.memory` | **off** | Memory. |
| `availability.artifacts` | on | Artifacts. |
| `availability.webSearch` | on | Web search. |
| `availability.codeInterpreter` | on | Code interpreter. |
| `allowClassicUiSwitch` | on | Whether users may use the Classic UI. |
| `routingEnabled` | off | Automatic model routing for ordinary chat (not network routing). |
| `routingModelId` | empty | Model the router uses; empty uses the built-in default. |
| `announcement` | none | Site-wide banner (message up to 500 characters in the Admin UI, optional expiry, users can dismiss it). |

**Behavior changes admins will notice**
- **Prompt highlighter and memory default to OFF** when no `deploymentFeatures` record exists, including on existing deployments. Turn them on in Admin, Deployment if you want them.
- **System prompts**: Admin, System Prompts can override the built-in prompts. An empty text keeps the built-in one. A save replaces the whole set, so open the tab, check every prompt, then save. If your own admin account does not see the Amplify Helper card (because `amplifyHelper` is off for you), saving will drop a stored Amplify Helper prompt.
- **Announcement banner**: a removed announcement disappears on the next load.

## 4. Build and runtime requirements

| Item | Change |
|---|---|
| Next.js | **14 to 15** (`next ^15.5.27`, resolved 15.5.29). Vitest 4 and `@types/node` 22 for tests. Run a clean `npm ci`. |
| Node.js | Use **Node 20 or newer**. `amplify.yml` runs `nvm install 20`. The `Dockerfile` uses `node:lts-alpine3.20`. `package.json` has no `engines` field. |
| Console output | Production builds **remove `console.log`, `console.info` and `console.debug`**. `console.error` and `console.warn` are kept. Plan your production debugging around that. |
| Environment variables | **No new runtime variables.** `.env.local.example` is unchanged. The only new variable is the build-time `NEXT_PUBLIC_ORGANIZATION_NAME` (next section). |
| CI | In `.github/workflows/ecr-build-push.yml`, AWS credentials and ECR login are skipped on pull-request runs. The workflow passes **no build arguments**, so the image it publishes is unbranded. |
| Sessions | The 3-hour absolute session limit was removed. Sessions still expire after 3 hours of inactivity (rolling). Token refresh retries twice, then signs the user out after 3 consecutive temporary failures, or at once on a permanent error. |
| Browser data | **No migration.** IndexedDB (version 1) is unchanged. New per-user settings (chat font, default model, reasoning effort, storage choice) are saved in the server-side user settings. Local chats are not moved to the cloud automatically. |

## 5. White labeling the New UI

White-label settings are `NEXT_PUBLIC_*` variables. Next.js copies them into the JavaScript during `npm run build`, so they are **fixed when the image is built**, not read when the container starts. In Docker they must be passed as **build arguments**. The `Dockerfile` accepts these four, and no others:

| Build argument | Effect in the New UI |
|---|---|
| `NEXT_PUBLIC_CUSTOM_LOGO` | A **filename** (no folder, no `/`) of a file in `public/logos/`. Used in the sidebar, the home greeting and the login page. Falls back to the stock Amplify mark, then to a one-letter tile. Square or icon-style logos look best (24 px sidebar, 40 px home, about 58 px login); wide logos are scaled, not stretched. |
| `NEXT_PUBLIC_BRAND_NAME` | Sidebar wordmark, login heading ("Welcome to ..."), startup message, logo alt text, iOS home-screen title and the "... Helper" names. Default in the New UI: `Amplify` (the Classic UI default is `Amplify GenAI`). |
| `NEXT_PUBLIC_DEFAULT_THEME` | First-visit theme (`light` or `dark`). A user's saved choice wins. |
| `NEXT_PUBLIC_ORGANIZATION_NAME` | **New.** Set it on any deployment that is not run by Vanderbilt. It removes Vanderbilt policy text, links and contact details from the Amplify Helper's in-app guide. |

Must know:
- **Colors are different in the New UI.** The `--color-primary-*` variables from the Classic UI do nothing here. Edit `--accent`, `--accent-fg`, the `--bg-*` and `--text-*` tokens at the top of `styles/globals.css`, once in `:root` (light) and once in `.dark`. Details: `docs/WHITE_LABEL.md`.
- **Amplify Helper prompt.** If you enable the `amplifyHelper` flag on a white-labeled deployment, replace the default prompt in **Admin, System Prompts, Amplify Helper**. The backend's built-in default names Vanderbilt and `amplify@vanderbilt.edu`, and the text box in the Admin panel starts with that default.
- **Not rebranded**: product terms such as "Amplify Groups", messages saying users must have "signed in to Amplify", and the default chat system prompt ("You are Amplify..."). You can change the chat prompt in System Prompts.
- With none of these set, the output is the same as before.

### Build and run a branded image

> The steps below follow the `Dockerfile` and `docs/WHITE_LABEL.md`. We have **not** tested this Docker path end to end.

1. Copy your logo to `public/logos/` **before** building (for example `public/logos/acme-logo.svg`). The `Dockerfile` copies `public/` into the build.
2. Build, passing every value as a build argument. `--no-cache` makes sure no earlier layer is reused:
   ```bash
   docker build --no-cache \
     --build-arg NEXT_PUBLIC_CUSTOM_LOGO="acme-logo.svg" \
     --build-arg NEXT_PUBLIC_BRAND_NAME="Acme AI" \
     --build-arg NEXT_PUBLIC_DEFAULT_THEME="dark" \
     --build-arg NEXT_PUBLIC_ORGANIZATION_NAME="Acme Corporation" \
     -t acme-amplify:v0.9.5 .
   ```
3. Run it with your usual runtime environment file (see `README.md` and `.env.local.example`; these are runtime values such as `API_BASE_URL` and the auth settings):
   ```bash
   docker run --env-file ./.env.local -p 3000:3000 acme-amplify:v0.9.5
   ```

### Troubleshooting: branding does not show up

The most common cause is a **stale image or an old container**, not a code problem. Work through this list:

1. **Rebuild with `--no-cache`.** Docker reuses cached layers, and a cached build step keeps the old values.
2. **Pass each value with `--build-arg`.** Setting a variable in `.env.local`, or at `docker run`, does not affect the compiled code, and `.dockerignore` excludes `.env` and `.env.local` from the build, so a Docker build never sees them. A build argument that is not passed is empty.
3. **Put the logo in `public/logos/` before building**, and use only the filename (no path) as the value. Names are case-sensitive.
4. **Use a new image tag** (for example the version) so your host cannot keep pulling the old one.
5. **Stop and remove the old container**, then start a new one from the new image. `docker run` on a running name or port keeps serving the old container:
   ```bash
   docker ps
   docker stop <container> && docker rm <container>
   ```
6. **Check that your brand is inside the image** before blaming the app. This prints the compiled files that contain your brand name, and prints nothing if the value was not baked in:
   ```bash
   docker run --rm --entrypoint sh acme-amplify:v0.9.5 -c 'grep -rl "Acme AI" .next/static | head'
   ```
7. **Hard refresh the browser** (Cmd+Shift+R / Ctrl+Shift+R). Users who chose a theme keep their choice.
8. If you host with AWS Amplify instead of Docker, the build runs `env | grep NEXT_PUBLIC_` into `.env.production`, so set the variables in the Amplify build environment.

## 6. RAG migration and document retention (admins)

**RAG** is how Amplify searches uploaded documents. This release works with a backend change that processes **new** uploads in a new way and lets an admin move **existing** documents over. The full operator guide (new AWS resources, settings, costs, limits, regions) is in the backend release notes, [section 11](https://github.com/gaiin-platform/amplify-genai-backend/blob/main/RELEASE_NOTES_NEW_UI.md#11-rag-pipeline-upgrade). This section covers what you see in the web app. Both parts need the matching backend; an older backend gives errors (see below).

**What users notice without any admin action**
- A document that is attached to a chat only, with no search embeddings, shows the status **"Chat Only"** instead of `-----`. This applies in the Classic and New UIs.
- In the New UI assistant editor, saved data sources show a status (Starting, Processing, Completed, Failed, Error) and a regenerate button, with summary lines such as "198 completed - 2 need attention".
- In the New UI, source cards in a chat show where the quote came from (for example "Page 8" or "Slides 22-25") and an expandable excerpt of up to 700 characters.
- Uploads over the new size limits are rejected with a message from the backend. The frontend did not add limits.

**RAG Migration tab (New UI only)**
- **Where:** Admin Panel, left rail, **RAG Migration**. It shows to anyone who can open the admin panel, and the backend routes also check for an admin. The Classic admin has no such tab.
- **It is optional.** Nothing is moved until an admin starts it. Without it, existing documents keep working.
- **How a run goes:** choose the documents, set the pace, create the new embeddings, move assistants' references to the new copies, then (optionally, later) remove the old embeddings. Details and limits are in the backend notes.
- **Keep the page open.** The run loop lives in the browser page and uses the admin's login (the confirmation says about an hour). Closing the tab stops new documents starting; ones already building finish. The list of tracked documents is kept only for the browser session.
- **Start, Pause, Stop:** Start and Resume ask for a confirmation. Pause stops only new starts. Stop also empties the waiting queue.
- **"Move references"** (cut-over) handles up to 50 documents per press and can be rolled back with "Roll back". Leave "Move references automatically" off for the first run.
- **"Remove old embeddings"** is the only step that deletes data, and it cannot be undone. It is guarded by a browser confirmation only, so treat it carefully. Each press handles up to 200 documents.
- **Orphaned files:** a "Clean up orphaned files" section lists files no assistant uses any more. Deleting needs the admin to type `DELETE`.
- **Cost figures** in the tab are estimates built from fixed values in the code, and the tab itself says page-image prices are not confirmed with AWS.
- Documents cannot be started between about 02:55 and 03:20 UTC.

**Document Retention card (Classic and New admin)**
- **Where:** Admin Panel, Configurations, **Document Retention**. Off by default; the default period is 90 days (allowed 1 to 3650).
- When on, a daily clean-up (about 04:00 UTC) deletes chat-only attachments not used for that many days. Deleted files cannot be recovered. Files used by an assistant or group, images, videos and files with embeddings are not deleted.
- Deploy the backend (including `amplify-lambda-js`) before turning it on.

**If the backend is older:** the RAG Migration tab is not hidden. It shows a loading placeholder with an error and retries every 10 seconds. We did not test the exact error text.

## 7. Load-balancer cookie (check with your infra owner)

When a user is on the New UI the app sets a cookie `X-Amplify-UI=new` (one year), and it clears the cookie when the flag is off. A code comment says it exists for a load-balancer rule that sends that cookie to a separate "new UI" target group. **No load-balancer configuration for it exists in either repo.** If you serve both UIs from one build, which is the default for this repo, you need nothing. If your environment runs separate New UI and Classic targets, that rule must exist before you turn the flag on.

---

# Part 2 - What's new

These descriptions come from the commit history and the code. Items behind a feature flag say so.

### Chat
- Pasted text and image attachments, drag-and-drop, a PDF preview, "Thinking..." and "Stopped Before Completing" indicators, chat download (including Word), and a notice that blocks concurrent sends in a busy chat.
- Tool steps, reasoning and action dropdowns, code-interpreter and MCP status messages, and model cost in the model cards.
- The speech-to-text mic button was removed.

### Artifacts
- Artifacts save to the Library with versions, can be resized, renamed and edited into new versions, and a cut-off artifact shows a Continue button. Generation runs on the server (fewer 403 errors).

### Library
- A Library view with pagination, rename and PDF preview. Each artifact is one row with its versions.

### Assistants
- Tabs for My, Shared with Me, Groups, Layered and the Helper. Duplicate assistants, group management, layered assistants, icons, attachment management, and sharing with provenance and dismissal.

### Workflows and scheduled tasks
- A Workflows view (needs `createAssistantWorkflows`) and a Scheduled view with a schedule builder, run logs and a resizable list/detail pane (needs `scheduledTasks`). Their builders still use the Classic styling.

### Notebook
- Behind the `notebook` flag, which an admin must add by hand.

### Amplify Helper
- Behind the `amplifyHelper` flag. An all-users guide with an admin-managed prompt. See `docs/AMPLIFY_HELPER_GUIDE.md`.

### Sharing
- Share history, a classifier for incoming shares, a clear message when a recipient has never signed in, and a viewer for shared chats.

### Settings and customization
- Custom Instructions, Prompt Templates with a model selector, Sidebar Items, and synced defaults for chat font, model and reasoning effort.

### Documents and RAG
- A **RAG Migration** admin tab (New UI) for moving existing documents to the new document storage, with cost estimates, rollback before clean-up, and an orphaned-file finder. A **Document Retention** card in both admin UIs (off by default). See Part 1, [section 6](#6-rag-migration-and-document-retention-admins).
- A "Chat Only" document status, embedding status and a regenerate button in the assistant editor, and source cards that show the page or slide a quote came from.

### Admin
- A redesigned admin modal with User Costs, System Prompts, Deployment, RAG Migration, a site-wide announcement banner, model rate limits and an AI router model setting.

### Rollout, themes and mobile
- The `newUi` flag, a first-run UI choice, and switches between the two UIs (see Part 1).
- Dark, light and system appearance; a seasonal Halloween theme behind the `halloween` flag.
- The sidebar collapses below 768 px. There is no installable-app (PWA) manifest or service worker.

### Reliability
- Feature flags retry and fall back safely, older chats load on demand, fewer startup requests, token refresh retries, and a queued cloud save for conversations that detects conflicts (`expectedVersion`). The cloud-save change also carries the fix for how non-ASCII text (emoji, Cyrillic, Greek and similar) is compressed. Deploy it with the matching backend release.

### Not finished
- The sidebar has TODOs for the 760-1099 px icon rail and the narrow-screen drawer. The Scheduled and Workflows builders use the Classic styling.

---

## Stats

Measured with `git diff origin/main...origin/dev` on 2026-11-06 (at `fbbcb974`); commits keep landing, so re-run before publishing.

| Metric | Count |
|--------|-------|
| Commits | 322 |
| Files changed | 659 |
| Insertions | +118,784 |
| Deletions | -6,599 |
| Merged pull requests | 10 (#333, #336, #338, #339, #344, #345, #346, #347, #349, #350) |

## Contributors

- **Max Moundas** - New UI implementation, rollout, admin, white-label (committed under two git names, `Max Moundas` and `maxmoundas`)
- **Harsha Raj Kumar** - Artifact library, preview and edit fixes, PowerPoint generation
- **Jagadeesh Reddy Vanga** - Halloween theme, Download as Word, Classic skills picker, security fixes
- **Karely Rodriguez** - RAG Migration admin tab, Admin User Costs, model rate limits
- **prestonmhorne** - Notebook components moved to the New UI design tokens

## Deployment instructions

1. **Deploy backend v0.9.5 first.** See the [backend release notes](https://github.com/gaiin-platform/amplify-genai-backend/blob/main/RELEASE_NOTES_NEW_UI.md). In it, `amplify-lambda` must finish deploying before `embedding` starts.
2. Rebuild the frontend image (with `--no-cache` and any white-label `--build-arg` values), push it to ECR and update the ECS service.
3. In the Admin panel, enable the `newUi` flag for the users you want.

See the full [deployment guide](https://github.com/gaiin-platform/.github/blob/main/profile/README.md).

## Links

- Backend release notes: `amplify-genai-backend/RELEASE_NOTES_NEW_UI.md`
- White labeling: `docs/WHITE_LABEL.md`
- New UI developer guide: `docs/NEW_UI_GUIDE.md`
- Amplify Helper: `docs/AMPLIFY_HELPER_GUIDE.md`
- Previous release: `RELEASE_NOTES_v0.9.0.md`

---

## Draft status (delete this section before publishing)

1. **Contributor lines are taken from commit subjects**; confirm names and wording (prestonmhorne has one commit and no full name in git).
2. **`GET /state/share/sent`**: the backend route was added (backend commit `0920ab5a`) so the share dialog can load share history saved on the server. Without it the dialog silently falls back to the browser's own history. We have not called it on a deployed backend.
3. **RAG Migration wording to fix or accept** (all confirmed in the frontend code):
   - `RagMigrationTab.tsx:30` tells admins "'Update assistants' tries again", but that button was removed. Retrying is done by pressing "Move references" again.
   - `RagMigrationScope.tsx:169-170` points to a "Documents section below" with a "Complete" filter that no longer exists; the real path is step 1, "Select documents".
   - The "Remove old embeddings" confirm (`RagMigrationTab.tsx:708`) says "every document whose references have moved" and names PostgreSQL, but one press handles at most 200. It is the only irreversible bulk step and has only a browser confirm; orphan deletion by contrast requires typing `DELETE`.
   - Cost figures use fixed numbers in the code (for example 20 embedding calls per file and $0.0015 per OCR page) and the tab says page-image prices are unconfirmed.
4. **Not tested by us:** the Docker build and troubleshooting steps above, a deployed flag rollout, the load-balancer cookie behaviour, and the RAG Migration tab against a live backend.
5. **Versions:** `package.json` still says `0.9.0`.

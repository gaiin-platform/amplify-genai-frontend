# Release Notes: New UI (Frontend)

**Status**: DRAFT. Scope is "must-knows and requirements outside a normal service deployment".
**Compared against**: `origin/main` (`babb17e1`) → `dev`
**Requires**: the matching backend release (see `amplify-genai-backend/RELEASE_NOTES_NEW_UI.md`). Deploy the backend first.

---

## TL;DR

1. The New UI ships **dark**. It is controlled by the `newUi` feature flag, which is **off by default**. Deploying this frontend does not change what anyone sees until an admin turns the flag on.
2. The flag is served by the backend (`GET /amplifymin/feature_flags`), so the backend must be deployed first.
3. There are **no new frontend environment variables** and no change to `.env.local.example`.

---

## Enabling the New UI (admin steps)

1. Deploy the backend, then this frontend.
2. In the admin panel, open **Feature Flags**, and make sure `newUi` exists. A current backend adds it as *disabled* the first time `/feature_flags` is read. If it is missing, use **Add Feature** and type `New UI`. The name normalizes to exactly `newUi` (a flag named `newUI` is dead, and the UI prevents creating it).
3. Turn it on for everyone, or for a pilot group:
   - Leave the flag **off** and add the pilot users or Amplify groups as **exceptions**. An exception *inverts* the flag for that user, so the client only ever sees a final true/false.
   - Or turn it **on**, and use exceptions to keep specific users on Classic.
4. Users need a page reload. Open tabs re-check on refocus (at most every 30 s) and when an admin saves flags.

### How a user's UI is decided
- `newUi` is the **only** authority for whether the New UI may appear. Nothing else (local storage, saved preference, cookie) can turn it on.
- Flag on and no saved choice → **New UI**.
- Flag on and the user previously chose Classic → stays on Classic, **unless** the admin has set `allowClassicUiSwitch: false` (then everyone is forced to New).
- Flag off → Classic for everyone. Saved choices are kept, so turning the flag back on restores them.
- If `/feature_flags` fails or takes longer than 6 s, the app uses that user's last known server answer, otherwise it shows **Classic** (fails closed). A late answer re-resolves.
- To retest a first run on one browser, open the app with `?uiPreference=reset`.

---

## Flags and admin settings the New UI reads

| Setting | Where it lives | Default | Notes |
|---|---|---|---|
| `newUi` | Feature Flags | **off** | Gate for the whole New UI. |
| `amplifyHelper` | Feature Flags | off | Shows the Amplify Helper tab under Assistants. Guide: `docs/AMPLIFY_HELPER_GUIDE.md`. |
| `notebook` | Feature Flags | off | Must be **added manually** (not in backend base flags). Strict: missing, false or malformed means off. |
| `halloween` | Feature Flags | off | Must be **added manually**. Seasonal theme. |
| `mcp`, `skills`, `webSearch` | Feature Flags | per backend | The New UI honors these flags. |
| `deploymentFeatures` | Admin → deployment settings | see below | Deployment-wide availability and UI policy. |

`deploymentFeatures` fields: `availability` (`promptHighlighter`, `artifacts`, `webSearch`, `codeInterpreter`, `memory`), `allowClassicUiSwitch`, `routingEnabled`, `routingModelId`, `announcement`.

### Behavior changes admins will notice
- **Prompt highlighter and memory default to OFF** when no `deploymentFeatures` record exists (new or legacy configs). Artifacts, web search and code interpreter default to ON. Enable highlighter or memory explicitly if you want them.
- **Site-wide announcement banner**: admins can publish a message (optional expiry). Users can dismiss it. A removed announcement disappears on next load.
- **AI model routing** (`routingEnabled`, `routingModelId`): off by default. This is the ordinary-chat model router, not network routing.

---

## Requirements outside a normal deployment

- **Next.js upgraded 14 → 15** (`next@^15.5`), plus Vitest 4 and `@types/node` 22. Run a clean `npm ci`. Use Node 20+ (`amplify.yml` uses `nvm install 20`; the Dockerfile uses `node:lts-alpine`).
- **Production builds strip `console.log/info/debug`** (errors and warnings are kept). If you debug production with logs, expect less output.
- **CI**: AWS credentials and ECR login in `ecr-build-push.yml` are skipped on pull-request runs.
- **No data migration** is needed in the browser. New per-user display prefs (chat font, default model, reasoning effort, storage selection) sync to the server's user settings. Seeding the storage default does not move existing conversations.

## White labeling

The New UI honors the build-time white-label settings (`docs/WHITE_LABEL.md`). They are `NEXT_PUBLIC_*` variables, so they are baked in when the image is **built**: pass them as Docker build args (the Dockerfile accepts them) or set them in the build environment. The stock GitHub workflow passes none, so the standard image is unbranded.

| Variable | Effect in the New UI |
|---|---|
| `NEXT_PUBLIC_CUSTOM_LOGO` | Filename in `public/logos/`. Sidebar, home greeting and login. Falls back to the Amplify mark, then a letter tile. Square or icon-style logos look best. |
| `NEXT_PUBLIC_BRAND_NAME` | Sidebar wordmark, login heading, startup message, logo alt text, iOS home-screen title, "... Helper" names. Default `Amplify`. |
| `NEXT_PUBLIC_DEFAULT_THEME` | First-visit light/dark. |
| `NEXT_PUBLIC_ORGANIZATION_NAME` | **New.** Set it on any non-Vanderbilt deployment. It removes Vanderbilt policy text, links and contact details from the Amplify Helper. |

Must know:
- **Colors are different in the New UI.** The `--color-primary-*` variables documented for the classic UI do not affect it. Change `--accent` and the `--bg-*` / `--text-*` tokens at the top of `styles/globals.css` (both `:root` and `.dark`).
- **Amplify Helper prompt.** If you enable the `amplifyHelper` flag on a white-labeled deployment, replace the default `amplifyHelper.base` prompt in **Admin → System Prompts**. The backend's built-in default names Vanderbilt and `amplify@vanderbilt.edu`.
- **Not rebranded:** product terms such as "Amplify Groups", "signed in to Amplify" messages, and the default chat system prompt ("You are Amplify...", editable in System Prompts).
- Nothing changes for an unbranded build: with none of these set the output is identical to before.

## Load-balancer / routing cookie (verify with your infra owner)

The app sets a cookie `X-Amplify-UI=new` when a user is on the New UI, and clears it when the flag is off. The source comment says it is for a load-balancer rule that sends that cookie to a separate "new UI" target group. **No infrastructure config for this is in either repo.** If your environment runs separate New UI and Classic targets, that rule must exist before the flag is enabled. If you serve both UIs from the same build (the default for this repo), nothing is needed.

## Known gaps to confirm before release
- Whether any environment uses the cookie-based target-group routing above.
- Versioning: this draft has no version number or release date.

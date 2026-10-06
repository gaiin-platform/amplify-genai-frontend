# Projects: rollout and QA

## What ships

- **Backend, `amplify-assistants`:** project, memory and *project file manifest* endpoints; three new DynamoDB
  tables (`projects`, `project-memories`, `project-files`); `serverless.yml` packaging excludes for the local harness.
- **Backend, `amplify-lambda-js`:** reads the project for every chat that carries a `projectId` and attaches, on the
  server, the project's instructions, its approved memories and its knowledge-base files.
- **Frontend:** Projects view, chat header link, Move to project, project filters. Everything is behind
  `NEXT_PUBLIC_PROJECTS_ENABLED` (off unless `true`).

Nothing outside Projects changes behavior. Two small shared touches to be aware of: the Library query now also
excludes files whose `knowledgeBase` starts with `proj/` (`components/NewUI/shared/libraryQuery.ts`), and
`amplify-lambda/files/file.py` pagination was rewritten (see below).

## Deploy order

1. `amplify-assistants` (creates the tables and publishes their names to Parameter Store automatically).
2. `amplify-lambda-js` (reads those parameters at deploy time, so it must come second; `serverless-compose.yml`
   already orders it after `amplify-assistants`).
3. Frontend build with `NEXT_PUBLIC_PROJECTS_ENABLED=true`.

`amplify-lambda-js` reads the three Projects table names from Parameter Store with a placeholder fallback, so deploying it
before `amplify-assistants` does not fail; project chats simply have no project context until the tables exist.

If the frontend is deployed first with the flag on, the Projects page shows a "Couldn't load your projects" state
with Retry. Turning the flag off (and rebuilding) hides every Projects entry point.

## Rollback

Set `NEXT_PUBLIC_PROJECTS_ENABLED=false` and rebuild. Data is untouched. The tables have point-in-time recovery.

## How project files reach a chat

1. Upload goes through the normal files service with `knowledgeBase = <project id>`.
2. The browser registers the file on the project (`POST /project/files/add`); the server only accepts keys under the
   caller's own prefix and enforces the 100-file limit.
3. The browser watches processing and records `ready` (with token count) or `failed` on the manifest.
4. On every chat message the backend reads the manifest (a keyed Query) and adds the files as data sources. Up to
   25,000 total tokens they are attached whole; beyond that, or while a size is unknown, they are `ragOnly`, so each
   message retrieves only the relevant passages. The constant lives in
   `amplify-lambda-js/projects/projectContext.js` and `components/NewUI/projects/projectContextUsage.ts`; keep them equal.

## What a project reply used

With every project chat reply the backend sends a `projectContext` state event (names and counts only: the project,
whether instructions applied, how many memories, and which files, each marked whole-document or searched). The chat
service already merges state events into the reply's `data.state`, so no shared chat code changed. The chat header's
Project context button tooltip and the Project context drawer ("The last reply used…") read it. Per-message inline
citations are not added: that would mean changing the shared message renderer.

## Regression check: nothing outside Projects changed

Purpose: show reviewers that turning Projects on or off leaves normal Amplify untouched. Run it twice on the dev
environment: once with `NEXT_PUBLIC_PROJECTS_ENABLED=false`, once with `true`. Every step must behave identically in both.

**Shared code this change touches** (everything else is new files):
- Frontend: `hooks/useChatSendService.ts`, `components/NewUI/home/NewHome.tsx`,
  `components/NewUI/chat/ConversationHeader.tsx`, `components/NewUI/sidebar/{NewSidebar,ConversationRow}.tsx`,
  `components/NewUI/views/ChatsListView.tsx`, `components/NewUI/shared/{chatFilters,libraryQuery,useConversationAssistant}.ts`,
  `services/fileService.ts` (new optional parameter, one new function), `utils/app/{conversation,memory}.ts`, `pages/api/home/home.tsx`.
- Backend: `amplify-lambda-js/router.js` (project strip and attach; returns immediately without a `projectId`),
  `assistants/userDefinedAssistants.js`, `common/conversations.js`, and the `serverless.yml` files.
- Not part of Projects and worth a separate decision: the pagination rewrite in `amplify-lambda/files/file.py`.

**Normal chat (flag off, then on)**
- [ ] New chat, send, get a streamed reply; reload; the chat is still there.
- [ ] Attach a PDF and an image; both are used in the reply.
- [ ] Use a built-in assistant and a user-defined assistant; replies come from it; follow-ups keep it.
- [ ] Model picker: the chosen model is the one used (including an assistant that pins a model).
- [ ] Web search, skills and connectors toggles still work from the plus menu.
- [ ] Rename, pin, move to a folder, share, delete a chat.
- [ ] Sidebar Recents: filter and sort work; nothing new appears when no chat belongs to a project.
- [ ] Chats list: search, sort by column, filters; no Project column, filter or pill when Projects is off.
- [ ] Memory (global): extraction and use behave as before in a normal chat.
- [ ] Cloud-stored chats: reload, open one, send another message.

**Library and files (flag off, then on)**
- [ ] Library lists your files newest first; name search and next/previous page work.
- [ ] Upload a file from Library and from a chat; delete one.
- [ ] The assistant editor's Library picker lists and searches files.
- [ ] With the flag on, files you upload to a project do not appear in Library or the pickers; all other files still do.

**With the flag off, additionally**
- [ ] No Projects item in the sidebar or in Settings > sidebar items.
- [ ] No "Move to project" in any chat menu; no project icon or pill anywhere.
- [ ] The browser network tab shows no requests to `/project/...`.

**Backend safety**
- [ ] A chat request without `projectId` returns exactly as before (compare a request before and after deploy).
- [ ] Deploying `amplify-lambda-js` before `amplify-assistants` succeeds, and normal chats work.

## Manual QA on the dev environment

Use a fresh test user and a small PDF with real text, a large PDF (100+ pages), and a scanned/image-only PDF.

**Projects basics**
- [ ] Create a project; it appears in the gallery; reload keeps it.
- [ ] Rename via the `⋯` menu, archive, unarchive, delete (with files and chats present).
- [ ] Deleting a project removes its memories, its manifest and its files; its chats remain as normal chats.

**Files**
- [ ] Add a small PDF: row shows Uploading, then Processing, then Ready with a token count.
- [ ] Add the scanned PDF: row ends as Failed with the OCR explanation, and is not used in chats.
- [ ] Add the large PDF: the context meter says files are searched per message.
- [ ] Ask a question only the small PDF can answer in a new project chat: correct answer, source shown.
- [ ] Ask the same in a *second* chat and after a page reload: still answered (server-side attach).
- [ ] Remove a file from the panel: it disappears, chats stop using it, it is gone from your file list.
- [ ] The uploaded project files do **not** appear in Library or the attachment pickers.
- [ ] Try to add a 101st file: refused.

**Chats**
- [ ] Send from the project home: the chat shows the project link and Project context button.
- [ ] Reload with cloud storage on: the chat is still in the project.
- [ ] "New chat" from the project shows the project banner.
- [ ] Move a chat into a project and out again; the sidebar icon and Chats-list pill follow.
- [ ] Filter the Chats list and sidebar by project.
- [ ] With an assistant attached to the project, new chats start with it; switching it in the composer works.
- [ ] Project search finds a chat by title and by text (local chats), a file by name, and a memory.

**Memory**
- [ ] Turn memory on; state two clear preferences over a few messages; suggestions appear (toast + header badge).
- [ ] Pasting a long document does not create suggestions.
- [ ] After a reply, the header button tooltip and drawer show what it used (files, memories, instructions).
- [ ] Approve one, dismiss one; a new project chat uses the approved one only.
- [ ] Turn memory off: approved memory is no longer used.

**Isolation**
- [ ] A second user cannot open the first user's project (by id), files or memories.
- [ ] Other chats, assistants and Library are unaffected.

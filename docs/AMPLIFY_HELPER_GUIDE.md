# Amplify Helper Guide

## Purpose

Amplify Helper is the administrator-controlled, all-users guide to Vanderbilt Amplify. It explains what each New UI feature is for, where to find it, and how to use it without claiming that a deployment-enabled feature is available when it is not.

## Quick answers

### Can something happen every day at 9:00 AM?

Yes. Open **Scheduled** in the left sidebar, choose **New Task**, select an assistant, action, API tool, or workflow, set the schedule to daily at 9:00 AM, and save. Use the task detail pane to edit, run, disable, or inspect execution logs.

### What is the difference between a group assistant and a shared assistant?

A **group/team assistant** can be collaborative: authorized group members may edit its prompt and knowledge base. A **shared assistant** remains controlled by the owner; recipients can use it and may copy it to create an editable version, but they do not control the original prompt or knowledge base.

### Can Amplify connect to email?

Yes. Open **Settings → Connectors**, establish the Outlook connector, then attach the relevant action—such as **read email**—to the conversation. Follow the connector’s authorization and permission prompts, and never paste credentials into chat.

## New UI map

### New chat and composer

Select **New chat** in the sidebar or use the landing-page composer. Choose a model and reasoning effort when needed. The plus menu can attach local files, add existing Library files, select connector actions, select skills, and enable web search. Send with the arrow button. Conversations follow the Storage setting and appear in Recents.

### Chats & Tasks

**Chats** opens searchable **My Chats** and **Shared with Me** lists. Search, sort, and filter the list, open a conversation, rename it, or manage sharing. The sidebar also provides pinned conversations, date-grouped Recents, user-created folders, folder rename/pin/delete controls, and a shortcut to the full Chats view.

### Assistants

Open **Assistants** to find these tabs when enabled by the deployment:

- **My Assistants** — assistants you own or copied into your workspace.
- **Shared with Me** — assistants shared by another user. The owner controls the original prompt and knowledge base; copy it if you need an editable version.
- **Groups/Teams** — collaborative assistants available through a group. Authorized members can edit the prompt and knowledge base.
- **Layered Assistants** — assistants that combine or route across assistants through a configurable structure.
- **Amplify Helper** — the administrator-controlled guide to using Amplify. This tab appears only when the `amplifyHelper` feature is enabled.

Choose **New Assistant** when you have permission to create one. Assistant capabilities can include website or drive data sources, tools/APIs, skills, workflow templates, and email events.

### Customize

Open **Customize** in the sidebar or Settings:

- **Prompt Templates** stores reusable prompt starters that can be filled in and used in a new conversation.
- **Custom Instructions** stores named personal instructions. One instruction can be active for new conversations, or none can be selected.
- **Sidebar Items** controls which navigation entries are visible to you.

### Connectors, actions, skills, and MCP

Use **Settings → Connectors** to authorize supported integrations and manage tool API keys. After connecting a service, attach a relevant action to a conversation. **Skills** provides reusable capabilities. **MCP Servers** is available when enabled by the deployment and is managed separately from standard connectors.

If a connector fails, check that it is connected and that the requested permission is granted. Do not put credentials, tokens, or secrets in a prompt.

### Library and data sources

**Library** stores uploaded data sources and generated artifacts. You can search, sort, preview, tag, reprocess, rename, download, or delete items. To use an existing file in a conversation, choose **Add from library** in the composer; do not upload a second copy. Attached data sources may provide retrieval-augmented context, so review returned sources and permissions for important work.

### Scheduled Tasks

Open **Scheduled** to create recurring assistant, action-set, API-tool, or workflow tasks. Set the task name, instructions, object, schedule, active state, and tags. Select a task to edit it, execute it now, or inspect execution logs. Availability depends on deployment feature settings.

### Workflows

Open **Workflows** to browse workflow templates. When workflow creation is enabled, use **New Workflow** to build and save a reusable sequence; otherwise the view is read-only. Workflows can be attached to conversations or selected by scheduled tasks.

### Notebook

**Notebook** is a separate workspace for notebook-based analysis and is available when enabled by the deployment. Use it for longer-running, structured analysis rather than a single short chat.

### Settings and administration

Personal Settings include:

- **General** — appearance, chat font, default model, reasoning effort, web-search preference, and conversation storage.
- **Account** — account context, usage notices, and billing/COA information when configured.
- **API Access** — API keys and related access when enabled.
- **Connectors** — integrations and tool API keys.
- **Skills** and **MCP Servers** — capability configuration.
- **Prompt Templates**, **Custom Instructions**, and **Sidebar Items** — personal customization.

Administrators may also expose an **Admin Panel** with deployment features, supported models, feature flags, integrations, application variables, user costs, and system prompts. The Amplify Helper prompt is configured under **Admin Panel → System Prompts → Amplify Helper — All-Users Prompt**. An administrator’s prompt takes effect on the next helper request; it is not a user-editable assistant prompt.

## Vanderbilt policy, support, training, and cost

- Amplify is approved for **Level 3 data excluding HIPAA data**. Review [VUIT’s data-classification definition](https://www.vanderbilt.edu/cybersecurity/guidelines/data-classification/) before submitting sensitive material.
- Amplify through the web interface at [www.vanderbilt.ai](https://www.vanderbilt.ai) is free for Vanderbilt staff, students, faculty, and researchers.
- Amplify API access is available after providing a COA. API usage is billed quarterly for AI token cost/consumption.
- Contact the team at [amplify@vanderbilt.edu](mailto:amplify@vanderbilt.edu).
- Vanderbilt’s bi-monthly training recordings, user guides, and user videos are available on the [AGI platform resources page](https://www.vanderbilt.edu/agi/platforms/resources/).

Feature availability, model access, data retention, and connector permissions can vary by deployment and administrator policy. When in doubt, check the relevant Settings/Admin Panel section or contact the Amplify team.

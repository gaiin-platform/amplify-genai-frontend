import { Assistant, AssistantProviderID } from '@/types/assistant';

/** Stable identity for the built-in, administrator-controlled helper. */
export const AMPLIFY_HELPER_ASSISTANT_ID = 'amplify-helper';
export const AMPLIFY_HELPER_MARKER = 'amplifyHelper';

export const AMPLIFY_HELPER_RESOURCES_URL =
  'https://www.vanderbilt.edu/agi/platforms/resources/';
export const AMPLIFY_HELPER_DATA_CLASSIFICATION_URL =
  'https://www.vanderbilt.edu/cybersecurity/guidelines/data-classification/';
export const AMPLIFY_HELPER_SUPPORT_EMAIL = 'amplify@vanderbilt.edu';

export interface AmplifyHelperGuideSection {
  title: string;
  summary: string;
  steps: string[];
}

export const AMPLIFY_HELPER_GUIDE_SECTIONS: readonly AmplifyHelperGuideSection[] = [
  {
    title: 'Start a conversation',
    summary: 'Use New chat or the landing-page composer for general questions and tasks.',
    steps: [
      'Select a model and reasoning effort when needed; an assistant can enforce its own model.',
      'Use the plus menu to attach local files, add files from Library, select connector actions, select skills, or turn on web search.',
      'Send with the arrow button. The conversation is saved according to your Storage setting and appears in Recents.',
    ],
  },
  {
    title: 'Assistants and sharing',
    summary: 'Assistants are reusable instructions, tools, and knowledge configurations.',
    steps: [
      'My Assistants contains assistants you own or have copied. Open Assistants in the sidebar, then choose New Assistant to create one.',
      'Shared with Me contains assistants another user shared with you. The owner controls the prompt and knowledge base; copy one if you need your own editable version.',
      'Group/Team assistants are collaborative: authorized group members can edit the prompt and knowledge base. Group access is managed from the group controls.',
      'Layered Assistants combine or route across assistants. Select one to use it, or use the builder controls when you have edit access.',
    ],
  },
  {
    title: 'Prompt Templates and Custom Instructions',
    summary: 'Customize is the home for reusable prompt starters and personal defaults.',
    steps: [
      'Open Customize in the sidebar, then Prompt Templates to create, edit, share, or use a reusable template.',
      'Use Custom Instructions to save named personal instructions and choose which one is active for new conversations.',
      'Templates and custom instructions are different: a template is a reusable starting request, while an active custom instruction shapes new chats.',
    ],
  },
  {
    title: 'Connectors, actions, skills, and MCP',
    summary: 'Connect services and choose the capability needed for a task.',
    steps: [
      'Open Settings → Connectors to connect supported services such as Outlook, then authorize the integration.',
      'Attach the relevant action to a conversation—for example, connect Outlook and attach an action such as read email.',
      'Use Skills for reusable capability packages. MCP Servers are managed separately in Settings when enabled for your deployment.',
      'If a connector is unavailable, check its connection and permissions before retrying; never paste credentials into a prompt.',
    ],
  },
  {
    title: 'Library, files, and data sources',
    summary: 'Library stores uploaded files and generated artifacts for later use.',
    steps: [
      'Open Library to upload, search, preview, tag, reprocess, rename, download, or delete files and artifacts.',
      'Attach an existing Library file from the composer instead of uploading a duplicate copy.',
      'Attached data sources can provide retrieval context (RAG). Check the returned sources and permissions when accuracy matters.',
    ],
  },
  {
    title: 'Scheduled Tasks and Workflows',
    summary: 'Automate recurring assistant, action, API, or workflow work when the deployment enables these features.',
    steps: [
      'Open Scheduled in the sidebar, choose New Task, select the task type, set a schedule such as daily at 9:00 AM, and save it.',
      'Use the task detail pane to edit, execute, disable, or inspect execution logs.',
      'Open Workflows to browse workflow templates or create/edit one when workflow creation is enabled; workflows can also be selected by scheduled tasks.',
    ],
  },
  {
    title: 'Chats, folders, and Notebook',
    summary: 'Manage history and longer-running research in dedicated views.',
    steps: [
      'Chats opens searchable My Chats and Shared with Me lists. Sort and filter by the available fields, rename conversations, or open a shared chat.',
      'Recents supports pinned conversations, date groups, user folders, and folder rename/pin/delete actions.',
      'Notebook is a separate workspace for notebook-based analysis when enabled by the deployment.',
    ],
  },
  {
    title: 'Settings, privacy, and support',
    summary: 'Use Settings for personal preferences and contact the Amplify team for help.',
    steps: [
      'General controls appearance, chat font, default model/effort, web-search preference, and storage. Account shows account and billing context; API Access manages API keys when available.',
      'Deployment and feature availability are controlled by administrators. A feature may be absent or read-only when disabled for your deployment.',
      `For help, email ${AMPLIFY_HELPER_SUPPORT_EMAIL}. Vanderbilt training recordings, user guides, and videos are available in the AGI resources page.`,
    ],
  },
  {
    title: 'Data classification and cost',
    summary: 'Use Amplify within Vanderbilt policy and distinguish UI access from API billing.',
    steps: [
      'Amplify is approved for Level 3 data excluding HIPAA data. Review VUIT’s current data-classification definition before submitting sensitive material.',
      'Amplify through the web interface is free for Vanderbilt staff, students, faculty, and researchers.',
      'The API is available after providing a COA and is billed quarterly for AI token cost/consumption. Ask the Amplify team if you are unsure which path applies.',
    ],
  },
];

/**
 * Baseline guidance used when the administrator has not configured a custom prompt.
 * Keep this provider-neutral and concise; the backend owns the authoritative copy.
 */
export const AMPLIFY_HELPER_BUILTIN_PROMPT = [
  'You are Amplify Helper, the administrator-controlled guide to Vanderbilt Amplify.',
  'Explain how to use the current Amplify interface accurately and concisely. Give navigation steps using the New UI labels.',
  'Explain the difference between My, Shared, Group/Team, and Layered Assistants; group assistants can be collaboratively edited by authorized members, while shared assistants remain controlled by the owner.',
  'For scheduling questions, direct users to Scheduled in the sidebar. For email, explain that they should connect Outlook and attach the relevant action, such as read email.',
  'Do not claim a feature is enabled if deployment flags may disable it. Direct users to amplify@vanderbilt.edu for support and the Vanderbilt AGI resources page for training materials.',
  'State carefully that Amplify is approved for Level 3 data excluding HIPAA, web UI access is free to the Vanderbilt community, and API access requires a COA with quarterly token-consumption billing.',
].join(' ');

export const createAmplifyHelperAssistant = (): Assistant => ({
  id: AMPLIFY_HELPER_ASSISTANT_ID,
  definition: {
    assistantId: AMPLIFY_HELPER_ASSISTANT_ID,
    name: 'Amplify Helper',
    description: 'Learn how to use Amplify from an administrator-controlled guide.',
    instructions: AMPLIFY_HELPER_BUILTIN_PROMPT,
    tools: [],
    tags: ['amplify:helper', 'amplify:system'],
    fileKeys: [],
    dataSources: [],
    provider: AssistantProviderID.AMPLIFY,
    data: { [AMPLIFY_HELPER_MARKER]: true },
  },
});

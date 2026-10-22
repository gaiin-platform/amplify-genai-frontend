/**
 * toolStepLabels — the one map from an agent tool name to how the chat shows it.
 *
 * Each tool gets a connector (brand icon + "Used Outlook" naming) or, failing
 * that, a generic category icon, plus a running label ("Searching your inbox")
 * and a done label ("Searched your inbox"). Labels may read friendly values
 * out of the call's arguments — a mail folder, a date range — and dates are
 * always formatted in the user's local time, never as ISO/UTC strings.
 *
 * Unknown tools fall back to a humanised name ("microsoftListMessages" →
 * "List messages"): vendor prefix dropped, camelCase split.
 *
 * Labels in this map carry NO trailing ellipsis; `describeToolStep` appends it
 * to the running label.
 *
 * No React imports — the icon is chosen by the component from `category` /
 * `connector`, so this stays unit-testable.
 */

import { humanizeToolName } from './messageProvenance';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToolCategory =
  | 'mail'
  | 'calendar'
  | 'file'
  | 'site'
  | 'spreadsheet'
  | 'document'
  | 'notes'
  | 'tasks'
  | 'chat'
  | 'contacts'
  | 'people'
  | 'code'
  | 'mcp'
  | 'generic';

/** Ids match `public/logos/integrations/<id with hyphens>.svg`. */
export type ConnectorId =
  | 'microsoft_outlook'
  | 'microsoft_calendar'
  | 'microsoft_drive'
  | 'microsoft_sharepoint'
  | 'microsoft_excel'
  | 'microsoft_word'
  | 'microsoft_onenote'
  | 'microsoft_planner'
  | 'microsoft_teams'
  | 'microsoft_contacts'
  | 'microsoft_user_groups';

export const CONNECTOR_NAMES: Record<ConnectorId, string> = {
  microsoft_outlook: 'Outlook',
  microsoft_calendar: 'Calendar',
  microsoft_drive: 'OneDrive',
  microsoft_sharepoint: 'SharePoint',
  microsoft_excel: 'Excel',
  microsoft_word: 'Word',
  microsoft_onenote: 'OneNote',
  microsoft_planner: 'Planner',
  microsoft_teams: 'Teams',
  microsoft_contacts: 'Contacts',
  microsoft_user_groups: 'Groups',
};

export interface LabelContext {
  args: Record<string, unknown>;
  /** "Now" — injectable so "today's messages" is testable. */
  now: Date;
  /** IANA zone; undefined = the browser's local zone. */
  timeZone?: string;
  locale?: string;
}

type Label = string | ((ctx: LabelContext) => string);

export interface ToolStepConfig {
  category: ToolCategory;
  connector?: ConnectorId;
  running: Label;
  done: Label;
  /** Singular/plural noun for a list result, e.g. ['message', 'messages']. */
  unit?: readonly [string, string];
}

export interface ToolStepDescription {
  tool: string;
  category: ToolCategory;
  connector?: ConnectorId;
  /** "Outlook" — present when `connector` is. */
  connectorName?: string;
  /** Includes the trailing ellipsis: "Searching your inbox…". */
  running: string;
  /** "Searched your inbox". */
  done: string;
  unit?: readonly [string, string];
  /** True when the tool came from the map rather than the humanised fallback. */
  known: boolean;
}

// ─── Friendly argument formatting ────────────────────────────────────────────

const WELL_KNOWN_FOLDERS: Record<string, string> = {
  inbox: 'Inbox',
  sentitems: 'Sent Items',
  drafts: 'Drafts',
  deleteditems: 'Deleted Items',
  junkemail: 'Junk Email',
  archive: 'Archive',
  outbox: 'Outbox',
};

/** A readable mail folder name, or null for opaque Graph ids ("AAMkAGI2…"). */
export const friendlyFolder = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const known = WELL_KNOWN_FOLDERS[trimmed.toLowerCase().replace(/[\s_-]/g, '')];
  if (known) return known;
  // Graph folder ids are long, unbroken, base64-ish strings — never show them.
  if (trimmed.length > 24 && !/\s/.test(trimmed)) return null;
  return trimmed;
};

const dayKey = (d: Date, timeZone?: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

const formatDay = (d: Date, ctx: LabelContext): string => {
  const sameYear = dayKey(d, ctx.timeZone).slice(0, 4) === dayKey(ctx.now, ctx.timeZone).slice(0, 4);
  return new Intl.DateTimeFormat(ctx.locale, {
    timeZone: ctx.timeZone,
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d);
};

const parseDate = (raw: unknown): Date | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * "today's messages" / "messages from Oct 14" / "messages from Oct 10 to Oct 15".
 * `noun` is plural ("messages", "events"). Null when there is no usable bound.
 */
export const friendlyRange = (
  start: Date | null,
  end: Date | null,
  noun: string,
  ctx: LabelContext,
): string | null => {
  if (!start && !end) return null;
  const today = dayKey(ctx.now, ctx.timeZone);
  const yesterday = dayKey(new Date(ctx.now.getTime() - 86_400_000), ctx.timeZone);
  // An exclusive end of exactly local midnight belongs to the previous day.
  const endDay = end ? dayKey(new Date(end.getTime() - 1), ctx.timeZone) : null;
  const startDay = start ? dayKey(start, ctx.timeZone) : null;

  if (startDay && endDay) {
    if (startDay === endDay) {
      if (startDay === today) return `today's ${noun}`;
      if (startDay === yesterday) return `yesterday's ${noun}`;
      return `${noun} from ${formatDay(start as Date, ctx)}`;
    }
    return `${noun} from ${formatDay(start as Date, ctx)} to ${formatDay(new Date((end as Date).getTime() - 1), ctx)}`;
  }
  if (startDay) {
    return startDay === today ? `today's ${noun}` : `${noun} since ${formatDay(start as Date, ctx)}`;
  }
  return `${noun} before ${formatDay(end as Date, ctx)}`;
};

/** Pull the date bounds out of an OData filter such as `receivedDateTime ge … and receivedDateTime le …`. */
export const dateBoundsFromFilter = (filter: unknown): { start: Date | null; end: Date | null } => {
  if (typeof filter !== 'string') return { start: null, end: null };
  const iso = '(\\d{4}-\\d{2}-\\d{2}T[\\d:.]+(?:Z|[+-]\\d{2}:?\\d{2})?)';
  const lower = filter.match(new RegExp(`DateTime\\s+(?:ge|gt)\\s+${iso}`));
  const upper = filter.match(new RegExp(`DateTime\\s+(?:le|lt)\\s+${iso}`));
  return { start: parseDate(lower?.[1]), end: parseDate(upper?.[1]) };
};

const clip = (s: string, max = 40): string => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

// ─── Dynamic labels ──────────────────────────────────────────────────────────

const mailListLabel = (verb: string) => (ctx: LabelContext): string => {
  const folder = friendlyFolder(ctx.args.folder_id);
  const { start, end } = dateBoundsFromFilter(ctx.args.filter_query);
  const range = friendlyRange(start, end, 'messages', ctx);
  if (range) return `${verb} ${folder ?? 'Inbox'} for ${range}`;
  // The user's phrase is "your inbox"; other folders are named.
  return folder && folder !== 'Inbox' ? `${verb} ${folder}` : `${verb} your inbox`;
};

const mailSearchLabel = (verb: string) => (ctx: LabelContext): string => {
  const q = typeof ctx.args.search_query === 'string' ? ctx.args.search_query.trim() : '';
  return q ? `${verb} your mail for “${clip(q)}”` : `${verb} your mail`;
};

const eventsBetweenLabel = (verb: string) => (ctx: LabelContext): string => {
  const range = friendlyRange(parseDate(ctx.args.start_dt), parseDate(ctx.args.end_dt), 'events', ctx);
  return range ? `${verb} your calendar for ${range}` : `${verb} your calendar`;
};

// ─── The map ─────────────────────────────────────────────────────────────────

type Row = readonly [tool: string, running: Label, done: Label, unit?: readonly [string, string]];

const section = (
  category: ToolCategory,
  connector: ConnectorId | undefined,
  rows: Row[],
): Record<string, ToolStepConfig> => {
  const out: Record<string, ToolStepConfig> = {};
  for (const [tool, running, done, unit] of rows) {
    out[tool] = { category, connector, running, done, ...(unit ? { unit } : {}) };
  }
  return out;
};

const MESSAGES = ['message', 'messages'] as const;
const EVENTS = ['event', 'events'] as const;
const FILES = ['file', 'files'] as const;
const ITEMS = ['item', 'items'] as const;

export const TOOL_STEP_CONFIG: Record<string, ToolStepConfig> = {
  // ── Outlook (mail) ─────────────────────────────────────────────────────────
  ...section('mail', 'microsoft_outlook', [
    ['microsoftListMessages', mailListLabel('Searching'), mailListLabel('Searched'), MESSAGES],
    ['microsoftSearchMessages', mailSearchLabel('Searching'), mailSearchLabel('Searched'), MESSAGES],
    ['microsoftGetMessageDetails', 'Opening an email', 'Opened an email'],
    ['microsoftGetAttachments', 'Checking email attachments', 'Checked email attachments', ['attachment', 'attachments']],
    ['microsoftDownloadAttachment', 'Downloading an attachment', 'Downloaded an attachment'],
    ['microsoftCreateDraft', 'Drafting an email', 'Drafted an email'],
    ['microsoftAddAttachment', 'Attaching a file to the draft', 'Attached a file to the draft'],
    ['microsoftDeleteAttachment', 'Removing an attachment', 'Removed an attachment'],
    ['microsoftSendDraft', 'Sending your email', 'Sent your email'],
    ['microsoftSendMail', 'Sending your email', 'Sent your email'],
    ['microsoftReplyToMessage', 'Replying to an email', 'Replied to an email'],
    ['microsoftReplyAllMessage', 'Replying to everyone', 'Replied to everyone'],
    ['microsoftForwardMessage', 'Forwarding an email', 'Forwarded an email'],
    ['microsoftDeleteMessage', 'Deleting an email', 'Deleted an email'],
    ['microsoftMoveMessage', 'Moving an email', 'Moved an email'],
    ['microsoftUpdateMessage', 'Updating an email', 'Updated an email'],
    ['microsoftListFolders', 'Listing your mail folders', 'Listed your mail folders', ['folder', 'folders']],
    ['microsoftListSharedMailboxMessages', 'Searching a shared mailbox', 'Searched a shared mailbox', MESSAGES],
    ['microsoftSearchSharedMailboxMessages', 'Searching a shared mailbox', 'Searched a shared mailbox', MESSAGES],
    ['microsoftGetSharedMailboxMessage', 'Opening a shared mailbox email', 'Opened a shared mailbox email'],
    ['microsoftListSharedMailboxFolders', 'Listing shared mailbox folders', 'Listed shared mailbox folders', ['folder', 'folders']],
    ['microsoftGetSharedMailboxAttachments', 'Checking email attachments', 'Checked email attachments', ['attachment', 'attachments']],
    ['microsoftDownloadSharedMailboxAttachment', 'Downloading an attachment', 'Downloaded an attachment'],
    ['microsoftCreateSharedMailboxDraft', 'Drafting an email', 'Drafted an email'],
    ['microsoftAddSharedMailboxDraftAttachment', 'Attaching a file to the draft', 'Attached a file to the draft'],
    ['microsoftDeleteSharedMailboxDraft', 'Deleting a draft', 'Deleted a draft'],
    ['microsoftMoveSharedMailboxMessage', 'Moving an email', 'Moved an email'],
  ]),

  // ── Calendar ───────────────────────────────────────────────────────────────
  ...section('calendar', 'microsoft_calendar', [
    ['microsoftListCalendars', 'Checking your calendars', 'Checked your calendars', ['calendar', 'calendars']],
    ['microsoftListCalendarEvents', 'Checking your calendar', 'Checked your calendar', EVENTS],
    ['microsoftGetEventsBetweenDates', eventsBetweenLabel('Checking'), eventsBetweenLabel('Checked'), EVENTS],
    ['microsoftGetEventDetails', 'Opening a calendar event', 'Opened a calendar event'],
    ['microsoftGetEventAttachments', 'Checking event attachments', 'Checked event attachments', ['attachment', 'attachments']],
    ['microsoftCheckEventConflicts', 'Checking for scheduling conflicts', 'Checked for scheduling conflicts'],
    ['microsoftFindMeetingTimes', 'Finding meeting times', 'Found meeting times'],
    ['microsoftGetCalendarSchedule', 'Checking availability', 'Checked availability'],
    ['microsoftCreateEvent', 'Creating a calendar event', 'Created a calendar event'],
    ['microsoftCreateRecurringEvent', 'Creating a recurring event', 'Created a recurring event'],
    ['microsoftScheduleMeeting', 'Scheduling a meeting', 'Scheduled a meeting'],
    ['microsoftUpdateEvent', 'Updating a calendar event', 'Updated a calendar event'],
    ['microsoftUpdateRecurringEvent', 'Updating a recurring event', 'Updated a recurring event'],
    ['microsoftDeleteEvent', 'Deleting a calendar event', 'Deleted a calendar event'],
    ['microsoftRespondToEvent', 'Responding to an invitation', 'Responded to an invitation'],
    ['microsoftDeleteEventAttachment', 'Removing an event attachment', 'Removed an event attachment'],
    ['microsoftCalendarAddAttachment', 'Attaching a file to an event', 'Attached a file to an event'],
    ['microsoftCreateCalendar', 'Creating a calendar', 'Created a calendar'],
    ['microsoftDeleteCalendar', 'Deleting a calendar', 'Deleted a calendar'],
    ['microsoftShareCalendar', 'Sharing your calendar', 'Shared your calendar'],
    ['microsoftRemoveCalendarSharing', 'Removing calendar sharing', 'Removed calendar sharing'],
    ['microsoftGetCalendarPermissions', 'Checking calendar sharing', 'Checked calendar sharing'],
  ]),

  // ── OneDrive ───────────────────────────────────────────────────────────────
  ...section('file', 'microsoft_drive', [
    ['microsoftListDriveItems', 'Browsing your OneDrive', 'Browsed your OneDrive', ITEMS],
    ['microsoftGetDriveItem', 'Looking up a file', 'Looked up a file'],
    ['microsoftGetFolderDetails', 'Looking up a folder', 'Looked up a folder'],
    ['microsoftUploadFile', 'Uploading a file', 'Uploaded a file'],
    ['microsoftDownloadFile', 'Downloading a file', 'Downloaded a file'],
    ['microsoftDeleteItem', 'Deleting a file', 'Deleted a file'],
    ['microsoftCreateFolder', 'Creating a folder', 'Created a folder'],
    ['microsoftUpdateDriveItem', 'Updating a file', 'Updated a file'],
    ['microsoftCopyDriveItem', 'Copying a file', 'Copied a file'],
    ['microsoftMoveDriveItem', 'Moving a file', 'Moved a file'],
    ['microsoftInviteToDriveItem', 'Sharing a file', 'Shared a file'],
    ['microsoftCreateSharingLink', 'Creating a sharing link', 'Created a sharing link'],
    ['microsoftRemovePermission', 'Removing sharing access', 'Removed sharing access'],
    ['microsoftRestoreVersion', 'Restoring an earlier version', 'Restored an earlier version'],
  ]),

  // ── SharePoint ─────────────────────────────────────────────────────────────
  ...section('site', 'microsoft_sharepoint', [
    ['microsoftListSites', 'Browsing SharePoint sites', 'Browsed SharePoint sites', ['site', 'sites']],
    ['microsoftGetSiteByPath', 'Opening a SharePoint site', 'Opened a SharePoint site'],
    ['microsoftListSiteLists', 'Listing SharePoint lists', 'Listed SharePoint lists', ['list', 'lists']],
    ['microsoftGetListItems', 'Reading a SharePoint list', 'Read a SharePoint list', ITEMS],
    ['microsoftCreateList', 'Creating a SharePoint list', 'Created a SharePoint list'],
    ['microsoftCreateListItem', 'Adding a list item', 'Added a list item'],
    ['microsoftUpdateListItem', 'Updating a list item', 'Updated a list item'],
    ['microsoftDeleteListItem', 'Deleting a list item', 'Deleted a list item'],
    ['microsoftListDocumentLibraries', 'Listing document libraries', 'Listed document libraries', ['library', 'libraries']],
    ['microsoftListLibraryFiles', 'Browsing a document library', 'Browsed a document library', FILES],
    ['microsoftGetSharepointDriveItemMetadata', 'Looking up a SharePoint file', 'Looked up a SharePoint file'],
    ['microsoftGetSharepointFileDownloadUrl', 'Preparing a file download', 'Prepared a file download'],
    ['microsoftGetAllSharepointLibraryFilesRecursively', 'Scanning a document library', 'Scanned a document library', FILES],
    ['microsoftUploadFileToSharepointLibrary', 'Uploading to SharePoint', 'Uploaded to SharePoint'],
  ]),

  // ── Excel ──────────────────────────────────────────────────────────────────
  ...section('spreadsheet', 'microsoft_excel', [
    ['microsoftListWorksheets', 'Listing worksheets', 'Listed worksheets', ['worksheet', 'worksheets']],
    ['microsoftGetWorksheet', 'Opening a worksheet', 'Opened a worksheet'],
    ['microsoftCreateWorksheet', 'Adding a worksheet', 'Added a worksheet'],
    ['microsoftDeleteWorksheet', 'Deleting a worksheet', 'Deleted a worksheet'],
    ['microsoftReadRange', 'Reading spreadsheet cells', 'Read spreadsheet cells'],
    ['microsoftUpdateRange', 'Updating spreadsheet cells', 'Updated spreadsheet cells'],
    ['microsoftListTables', 'Listing tables', 'Listed tables', ['table', 'tables']],
    ['microsoftGetTableRange', 'Reading a table', 'Read a table'],
    ['microsoftCreateTableExcel', 'Creating a table', 'Created a table'],
    ['microsoftDeleteTable', 'Deleting a table', 'Deleted a table'],
    ['microsoftUpdateTableCell', 'Updating a table cell', 'Updated a table cell'],
    ['microsoftAddRowToTable', 'Adding a table row', 'Added a table row'],
    ['microsoftListCharts', 'Listing charts', 'Listed charts', ['chart', 'charts']],
    ['microsoftGetChart', 'Opening a chart', 'Opened a chart'],
    ['microsoftCreateChart', 'Creating a chart', 'Created a chart'],
    ['microsoftDeleteChart', 'Deleting a chart', 'Deleted a chart'],
    ['microsoftApplyFormatting', 'Formatting cells', 'Formatted cells'],
  ]),

  // ── Word ───────────────────────────────────────────────────────────────────
  ...section('document', 'microsoft_word', [
    ['microsoftListDocuments', 'Listing documents', 'Listed documents', ['document', 'documents']],
    ['microsoftCreateDocument', 'Creating a document', 'Created a document'],
    ['microsoftDeleteDocument', 'Deleting a document', 'Deleted a document'],
    ['microsoftGetDocumentContent', 'Reading a document', 'Read a document'],
    ['microsoftUpdateDocumentContent', 'Editing a document', 'Edited a document'],
    ['microsoftGetDocumentSections', 'Reading document sections', 'Read document sections'],
    ['microsoftGetDocumentStatistics', 'Checking document statistics', 'Checked document statistics'],
    ['microsoftGetDocumentVersions', 'Checking document versions', 'Checked document versions'],
    ['microsoftGetDocumentPermissions', 'Checking document sharing', 'Checked document sharing'],
    ['microsoftSearchDocument', 'Searching a document', 'Searched a document'],
    ['microsoftReplaceText', 'Replacing text in a document', 'Replaced text in a document'],
    ['microsoftAddComment', 'Adding a comment', 'Added a comment'],
    ['microsoftInsertImage', 'Inserting an image', 'Inserted an image'],
    ['microsoftInsertPageBreak', 'Inserting a page break', 'Inserted a page break'],
    ['microsoftInsertSection', 'Inserting a section', 'Inserted a section'],
    ['microsoftSetHeaderFooter', 'Setting a header or footer', 'Set a header or footer'],
    ['microsoftCreateTableWord', 'Adding a table', 'Added a table'],
    ['microsoftShareDocument', 'Sharing a document', 'Shared a document'],
  ]),

  // ── OneNote ────────────────────────────────────────────────────────────────
  ...section('notes', 'microsoft_onenote', [
    ['microsoftListNotebooks', 'Listing notebooks', 'Listed notebooks', ['notebook', 'notebooks']],
    ['microsoftListSectionsInNotebook', 'Listing notebook sections', 'Listed notebook sections', ['section', 'sections']],
    ['microsoftListPagesInSection', 'Listing notebook pages', 'Listed notebook pages', ['page', 'pages']],
    ['microsoftGetPageContent', 'Reading a notebook page', 'Read a notebook page'],
    ['microsoftCreatePageInSection', 'Creating a notebook page', 'Created a notebook page'],
    ['microsoftCreatePageWithAttachment', 'Creating a notebook page', 'Created a notebook page'],
  ]),

  // ── Planner ────────────────────────────────────────────────────────────────
  ...section('tasks', 'microsoft_planner', [
    ['microsoftListPlansInGroup', 'Listing plans', 'Listed plans', ['plan', 'plans']],
    ['microsoftListBucketsInPlan', 'Listing plan buckets', 'Listed plan buckets', ['bucket', 'buckets']],
    ['microsoftListTasksInPlan', 'Listing tasks', 'Listed tasks', ['task', 'tasks']],
    ['microsoftCreateTask', 'Creating a task', 'Created a task'],
    ['microsoftUpdateTask', 'Updating a task', 'Updated a task'],
    ['microsoftDeleteTask', 'Deleting a task', 'Deleted a task'],
  ]),

  // ── Teams ──────────────────────────────────────────────────────────────────
  ...section('chat', 'microsoft_teams', [
    ['microsoftListTeams', 'Listing your teams', 'Listed your teams', ['team', 'teams']],
    ['microsoftListChannels', 'Listing channels', 'Listed channels', ['channel', 'channels']],
    ['microsoftCreateChannel', 'Creating a channel', 'Created a channel'],
    ['microsoftSendChannelMessage', 'Posting to a channel', 'Posted to a channel'],
    ['microsoftGetChatMessages', 'Reading chat messages', 'Read chat messages', MESSAGES],
  ]),

  // ── Contacts ───────────────────────────────────────────────────────────────
  ...section('contacts', 'microsoft_contacts', [
    ['microsoftListContacts', 'Looking through your contacts', 'Looked through your contacts', ['contact', 'contacts']],
    ['microsoftGetContactDetails', 'Opening a contact', 'Opened a contact'],
    ['microsoftCreateContact', 'Adding a contact', 'Added a contact'],
    ['microsoftDeleteContact', 'Deleting a contact', 'Deleted a contact'],
  ]),

  // ── People & groups ────────────────────────────────────────────────────────
  ...section('people', 'microsoft_user_groups', [
    ['microsoftListGroups', 'Listing groups', 'Listed groups', ['group', 'groups']],
    ['microsoftGetGroupDetails', 'Opening a group', 'Opened a group'],
    ['microsoftCreateGroup', 'Creating a group', 'Created a group'],
    ['microsoftDeleteGroup', 'Deleting a group', 'Deleted a group'],
    ['microsoftListUsers', 'Looking up people', 'Looked up people', ['person', 'people']],
    ['microsoftGetUserDetails', 'Looking up a person', 'Looked up a person'],
  ]),

  // ── Not connector-specific ─────────────────────────────────────────────────
  exec_code: { category: 'code', running: 'Running code', done: 'Ran code' },
};

/**
 * Tools that are agent plumbing, not something the user asked for. They get no
 * row (and never count as a "step").
 */
export const HIDDEN_TOOLS: ReadonlySet<string> = new Set([
  'think',
  'terminate',
  'finish',
  'final_answer',
]);

export const isHiddenTool = (tool: string): boolean => HIDDEN_TOOLS.has(tool);

// ─── Humanised fallback ──────────────────────────────────────────────────────

const VENDOR_PREFIX = /^(?:microsoft|google|office365|o365|msgraph|graph|ms)(?=[A-Z_\-.\s])/;

/** "microsoftListMessages" → "List messages"; "read_email" → "Read email". */
export const humanizeToolLabel = (raw: string): string => {
  const stripped = raw.replace(VENDOR_PREFIX, '').replace(/^[_\-.\s]+/, '');
  const spaced = (stripped || raw)
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

// ─── MCP tool names ──────────────────────────────────────────────────────────

/**
 * Split an MCP tool name — `mcp_<serverId>_<tool>`, e.g. `mcp_mcp_1767629390657_b1c2812d7_install_package` —
 * into the server id and the server's own tool name. Same rule as `services/mcpToolExecutor#parseMCPToolName`
 * (a copy: importing that module would drag its network code into this React-free file).
 */
export const parseMcpToolName = (fullName: string): { serverId: string; toolName: string } | null => {
  if (typeof fullName !== 'string' || !fullName.startsWith('mcp_')) return null;
  const remaining = fullName.substring(4);
  const m = remaining.match(/^(mcp_\d+_[a-z0-9]+)_(.+)$/);
  if (m) return { serverId: m[1], toolName: m[2] };
  const parts = remaining.split('_');
  if (parts.length < 2) return null;
  return { serverId: parts[0], toolName: parts.slice(1).join('_') };
};

/** "search_issues" / "searchIssues" → "Search issues". */
export const humanizeMcpToolName = (toolName: string): string => humanizeToolName(toolName);

// ─── Public API ──────────────────────────────────────────────────────────────

const resolveLabel = (label: Label, ctx: LabelContext): string =>
  typeof label === 'function' ? label(ctx) : label;

export const describeToolStep = (
  tool: string,
  args: Record<string, unknown> = {},
  opts: { now?: Date; timeZone?: string; locale?: string } = {},
): ToolStepDescription => {
  const config = Object.prototype.hasOwnProperty.call(TOOL_STEP_CONFIG, tool)
    ? TOOL_STEP_CONFIG[tool]
    : undefined;

  if (!config) {
    const mcp = parseMcpToolName(tool);
    if (mcp) {
      const human = humanizeMcpToolName(mcp.toolName);
      return { tool, category: 'mcp', running: `Calling ${human}…`, done: human, known: false };
    }
    const human = humanizeToolLabel(tool);
    return { tool, category: 'generic', running: `${human}…`, done: human, known: false };
  }

  const ctx: LabelContext = { args, now: opts.now ?? new Date(), timeZone: opts.timeZone, locale: opts.locale };
  let running: string;
  let done: string;
  try {
    running = resolveLabel(config.running, ctx);
    done = resolveLabel(config.done, ctx);
  } catch {
    // A malformed argument must never take the row down — fall back to the humanised name.
    const human = humanizeToolLabel(tool);
    running = `${human}…`;
    done = human;
    return { tool, category: config.category, connector: config.connector, connectorName: config.connector ? CONNECTOR_NAMES[config.connector] : undefined, running, done, unit: config.unit, known: true };
  }

  return {
    tool,
    category: config.category,
    connector: config.connector,
    connectorName: config.connector ? CONNECTOR_NAMES[config.connector] : undefined,
    running: `${running}…`,
    done,
    unit: config.unit,
    known: true,
  };
};

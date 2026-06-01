// Composite function definitions.
//
// Each CompositeFunction lists verified real op names (from the backend source).
// At runtime, OperationSelector resolves each op name against the live `allOperations`
// list fetched from the backend, then builds the correct `configuredTools` payload
// (each entry must include the full `operation` object).
//
// Add-ons mutate the base ops list:
//   - Default (no flags): append the addon's ops to the end
//   - replaces: true → replace the last op in the base list with the addon ops
//   - insertAt: N → insert the addon ops at index N in the base list

export interface CompositeAddon {
  id: string;
  label: string;
  /** Verified real op names for this add-on variant */
  operations: string[];
  /** If true, the addon ops replace the last op in the base list instead of appending */
  replaces?: boolean;
  /** If set, insert addon ops at this index in the base list */
  insertAt?: number;
}

export interface CompositeFunction {
  id: string;
  name: string;
  description: string;
  /** Verified real op names — resolved against live allOperations at runtime */
  operations: string[];
  addons?: CompositeAddon[];
}

export interface CompositeFunctionCategory {
  id: string;
  label: string;
  emoji: string;
  /** Integration IDs required for this category to be enabled */
  integrationIds: string[];
  functions: CompositeFunction[];
}

export const COMPOSITE_FUNCTION_CATEGORIES: CompositeFunctionCategory[] = [
  // ─────────────────────────────────────────────
  // Microsoft Outlook
  // ─────────────────────────────────────────────
  {
    id: 'outlook',
    label: 'Microsoft Outlook',
    emoji: '📧',
    integrationIds: ['microsoft_outlook'],
    functions: [
      {
        id: 'readEmail',
        name: 'Read Email',
        description: 'Fetch your inbox and open a specific message.',
        operations: ['microsoftListMessages', 'microsoftGetMessageDetails'],
        addons: [
          {
            id: 'includeAttachments',
            label: 'Include attachments',
            operations: ['microsoftGetAttachments'],
          },
        ],
      },
      {
        id: 'downloadAttachment',
        name: 'Download Attachment',
        description: 'Find a message, list its attachments, then download a specific one.',
        operations: ['microsoftListMessages', 'microsoftGetMessageDetails', 'microsoftGetAttachments', 'microsoftDownloadAttachment'],
      },
      {
        id: 'searchEmails',
        name: 'Search Emails',
        description: 'Search for messages by keyword and open the matching one.',
        operations: ['microsoftSearchMessages', 'microsoftGetMessageDetails'],
      },
      {
        id: 'draftEmail',
        name: 'Draft Email',
        description: 'Compose and save a draft email.',
        operations: ['microsoftCreateDraft'],
        addons: [
          {
            id: 'addAttachment',
            label: 'Add attachment',
            operations: ['microsoftAddAttachment'],
          },
        ],
      },
      {
        id: 'sendEmail',
        name: 'Send Email',
        description: 'Create a draft and send it.',
        operations: ['microsoftCreateDraft', 'microsoftSendDraft'],
        addons: [
          {
            id: 'addAttachment',
            label: 'Add attachment',
            operations: ['microsoftAddAttachment'],
            insertAt: 1,
          },
        ],
      },
      {
        id: 'replyToEmail',
        name: 'Reply to Email',
        description: 'Open a message for context, then reply to it.',
        operations: ['microsoftGetMessageDetails', 'microsoftReplyToMessage'],
        addons: [
          {
            id: 'replyAll',
            label: 'Reply all',
            operations: ['microsoftReplyAllMessage'],
            replaces: true,
          },
          {
            id: 'addAttachment',
            label: 'Add attachment',
            operations: ['microsoftAddAttachment'],
          },
        ],
      },
      {
        id: 'forwardEmail',
        name: 'Forward Email',
        description: 'Open a message and forward it to new recipients.',
        operations: ['microsoftGetMessageDetails', 'microsoftForwardMessage'],
        addons: [
          {
            id: 'addAttachment',
            label: 'Add attachment',
            operations: ['microsoftAddAttachment'],
          },
        ],
      },
      {
        id: 'moveEmailToFolder',
        name: 'Move Email to Folder',
        description: 'Open a message, find the destination folder, then move it.',
        operations: ['microsoftGetMessageDetails', 'microsoftListFolders', 'microsoftMoveMessage'],
      },
      {
        id: 'archiveEmail',
        name: 'Archive Email',
        description: 'Search for a message and move it to an archive folder.',
        operations: ['microsoftSearchMessages', 'microsoftListFolders', 'microsoftMoveMessage'],
      },
      {
        id: 'markEmail',
        name: 'Mark Email',
        description: 'Open a message and update its read/flag status.',
        operations: ['microsoftGetMessageDetails', 'microsoftUpdateMessage'],
      },
      {
        id: 'deleteEmail',
        name: 'Delete Email',
        description: 'Find a message, confirm it, then delete it.',
        operations: ['microsoftListMessages', 'microsoftGetMessageDetails', 'microsoftDeleteMessage'],
        addons: [
          {
            id: 'deleteAttachmentOnly',
            label: 'Delete attachment only (keep email)',
            operations: ['microsoftGetAttachments', 'microsoftDeleteAttachment'],
            replaces: true,
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Microsoft OneDrive
  // ─────────────────────────────────────────────
  {
    id: 'onedrive',
    label: 'Microsoft OneDrive',
    emoji: '📁',
    integrationIds: ['microsoft_drive'],
    functions: [
      {
        id: 'uploadFile',
        name: 'Upload File',
        description: 'Browse drive contents and upload a file.',
        operations: ['microsoftListDriveItems', 'microsoftUploadFile'],
        addons: [
          {
            id: 'createFolderFirst',
            label: 'Create new folder first',
            operations: ['microsoftCreateFolder'],
            insertAt: 1,
          },
        ],
      },
      {
        id: 'downloadFile',
        name: 'Download File',
        description: 'Locate a file and download it.',
        operations: ['microsoftListDriveItems', 'microsoftGetDriveItem', 'microsoftDownloadFile'],
      },
      {
        id: 'renameFile',
        name: 'Rename File',
        description: "Get a file's current metadata, then update its name or properties.",
        operations: ['microsoftGetDriveItem', 'microsoftUpdateDriveItem'],
      },
      {
        id: 'copyFile',
        name: 'Copy File',
        description: 'Locate a file and copy it to a different folder.',
        operations: ['microsoftGetDriveItem', 'microsoftCopyDriveItem'],
      },
      {
        id: 'moveFile',
        name: 'Move File',
        description: 'Locate a file and move it to a different folder.',
        operations: ['microsoftGetDriveItem', 'microsoftMoveDriveItem'],
      },
      {
        id: 'organizeFiles',
        name: 'Organize Files',
        description: 'List files, create a folder structure, then move files into it.',
        operations: ['microsoftListDriveItems', 'microsoftCreateFolder', 'microsoftMoveDriveItem'],
      },
      {
        id: 'shareFile',
        name: 'Share File',
        description: 'Locate a file and generate a shareable link.',
        operations: ['microsoftGetDriveItem', 'microsoftCreateSharingLink'],
        addons: [
          {
            id: 'invitePerson',
            label: 'Invite specific person instead',
            operations: ['microsoftInviteToDriveItem'],
            replaces: true,
          },
        ],
      },
      {
        id: 'deleteFile',
        name: 'Delete File',
        description: 'Browse to confirm the file exists, then delete it.',
        operations: ['microsoftGetDriveItem', 'microsoftDeleteItem'],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Microsoft Calendar
  // ─────────────────────────────────────────────
  {
    id: 'calendar',
    label: 'Microsoft Calendar',
    emoji: '📅',
    integrationIds: ['microsoft_calendar'],
    functions: [
      {
        id: 'viewCalendar',
        name: 'View Calendar',
        description: 'List calendars and pull all events within a date range.',
        operations: ['microsoftListCalendars', 'microsoftGetEventsBetweenDates'],
        addons: [
          {
            id: 'listIndividualEvents',
            label: 'List individual events',
            operations: ['microsoftListCalendarEvents'],
          },
        ],
      },
      {
        id: 'viewEvent',
        name: 'View Event',
        description: "Fetch an event's full details.",
        operations: ['microsoftGetEventDetails'],
        addons: [
          {
            id: 'includeAttachments',
            label: 'Include attachments',
            operations: ['microsoftGetEventAttachments'],
          },
        ],
      },
      {
        id: 'scheduleMeeting',
        name: 'Schedule Meeting',
        description: 'Find an available time and create a calendar event.',
        operations: ['microsoftFindMeetingTimes', 'microsoftCreateEvent'],
        addons: [
          {
            id: 'checkConflicts',
            label: 'Check conflicts first',
            operations: ['microsoftCheckEventConflicts'],
            insertAt: 0,
          },
          {
            id: 'makeRecurring',
            label: 'Make recurring',
            operations: ['microsoftCreateRecurringEvent'],
            replaces: true,
          },
        ],
      },
      {
        id: 'rescheduleEvent',
        name: 'Reschedule Event',
        description: 'Retrieve event details and update the time.',
        operations: ['microsoftGetEventDetails', 'microsoftUpdateEvent'],
        addons: [
          {
            id: 'checkConflicts',
            label: 'Check conflicts first',
            operations: ['microsoftCheckEventConflicts'],
            insertAt: 1,
          },
        ],
      },
      {
        id: 'updateRecurringEvent',
        name: 'Update Recurring Event',
        description: 'Retrieve the recurring event master record and update the series.',
        operations: ['microsoftGetEventDetails', 'microsoftUpdateRecurringEvent'],
      },
      {
        id: 'respondToInvite',
        name: 'Respond to Invite',
        description: 'View full event details, then accept, tentatively accept, or decline.',
        operations: ['microsoftGetEventDetails', 'microsoftRespondToEvent'],
      },
      {
        id: 'attachFileToEvent',
        name: 'Attach File to Event',
        description: 'Retrieve an existing event and attach a file to it.',
        operations: ['microsoftGetEventDetails', 'microsoftCalendarAddAttachment'],
      },
      {
        id: 'cancelEvent',
        name: 'Cancel Event',
        description: 'Fetch event details, add a cancellation note, then delete it.',
        operations: ['microsoftGetEventDetails', 'microsoftDeleteEvent'],
      },
      {
        id: 'createCalendar',
        name: 'Create Calendar',
        description: 'List existing calendars, then create a new one.',
        operations: ['microsoftListCalendars', 'microsoftCreateCalendar'],
      },
      {
        id: 'shareCalendar',
        name: 'Share Calendar',
        description: 'Find the correct calendar and share it with another user.',
        operations: ['microsoftListCalendars', 'microsoftShareCalendar'],
      },
      {
        id: 'removeCalendarSharing',
        name: 'Remove Calendar Sharing',
        description: 'Check calendar permissions, then remove sharing for a user.',
        operations: ['microsoftGetCalendarPermissions', 'microsoftRemoveCalendarSharing'],
      },
      {
        id: 'deleteCalendar',
        name: 'Delete Calendar',
        description: 'List calendars, confirm the correct one, then delete it.',
        operations: ['microsoftListCalendars', 'microsoftDeleteCalendar'],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Microsoft SharePoint
  // ─────────────────────────────────────────────
  {
    id: 'sharepoint',
    label: 'Microsoft SharePoint',
    emoji: '🗂️',
    integrationIds: ['microsoft_sharepoint'],
    functions: [
      {
        id: 'readListItems',
        name: 'Read List Items',
        description: 'Navigate to a site, find the target list, then retrieve its items.',
        operations: ['microsoftListSites', 'microsoftListSiteLists', 'microsoftGetListItems'],
      },
      {
        id: 'addListItem',
        name: 'Add List Item',
        description: 'Resolve the site, find the correct list, then add a new item.',
        operations: ['microsoftListSites', 'microsoftListSiteLists', 'microsoftCreateListItem'],
      },
      {
        id: 'updateListItem',
        name: 'Update List Item',
        description: 'Find the list, locate the specific item, then update its fields.',
        operations: ['microsoftListSites', 'microsoftListSiteLists', 'microsoftGetListItems', 'microsoftUpdateListItem'],
      },
      {
        id: 'deleteListItem',
        name: 'Delete List Item',
        description: 'Find the list, confirm the correct item exists, then delete it.',
        operations: ['microsoftListSites', 'microsoftListSiteLists', 'microsoftGetListItems', 'microsoftDeleteListItem'],
      },
      {
        id: 'browseLibraryFiles',
        name: 'Browse Library Files',
        description: 'List document libraries and browse the files inside.',
        operations: ['microsoftListSites', 'microsoftListDocumentLibraries', 'microsoftListLibraryFiles'],
      },
      {
        id: 'downloadSharepointFile',
        name: 'Download SharePoint File',
        description: 'Find a file in a library and get its download URL.',
        operations: ['microsoftListSites', 'microsoftListDocumentLibraries', 'microsoftListLibraryFiles', 'microsoftGetSharepointFileDownloadUrl'],
      },
      {
        id: 'uploadToSharepoint',
        name: 'Upload to SharePoint',
        description: 'Find the target library and upload a file into it.',
        operations: ['microsoftListSites', 'microsoftListDocumentLibraries', 'microsoftUploadFileToSharepointLibrary'],
      },
      {
        id: 'viewFileMetadata',
        name: 'View File Metadata',
        description: 'List files in a library and retrieve detailed metadata for a specific file.',
        operations: ['microsoftListSites', 'microsoftListLibraryFiles', 'microsoftGetSharepointDriveItemMetadata'],
      },
      {
        id: 'auditLibrary',
        name: 'Audit Library',
        description: 'Enumerate all libraries, recursively list every file, then inspect metadata.',
        operations: ['microsoftListSites', 'microsoftListDocumentLibraries', 'microsoftGetAllSharepointLibraryFilesRecursively', 'microsoftGetSharepointDriveItemMetadata'],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // Microsoft Shared Mailbox
  // ─────────────────────────────────────────────
  {
    id: 'sharedEmail',
    label: 'Microsoft Shared Mailbox',
    emoji: '📧',
    integrationIds: ['microsoft_exchange'],
    functions: [
      {
        id: 'readSharedMailbox',
        name: 'Read Shared Mailbox',
        description: 'Browse a shared mailbox and open a specific message.',
        operations: ['microsoftListSharedMailboxMessages', 'microsoftGetSharedMailboxMessage'],
        addons: [
          {
            id: 'includeAttachments',
            label: 'Include attachments',
            operations: ['microsoftGetSharedMailboxAttachments'],
          },
        ],
      },
      {
        id: 'downloadSharedMailboxAttachment',
        name: 'Download Attachment',
        description: 'Find a shared mailbox message, list its attachments, then download one.',
        operations: ['microsoftListSharedMailboxMessages', 'microsoftGetSharedMailboxMessage', 'microsoftGetSharedMailboxAttachments', 'microsoftDownloadSharedMailboxAttachment'],
      },
      {
        id: 'searchSharedMailbox',
        name: 'Search Shared Mailbox',
        description: 'Search the shared mailbox for a message and open it.',
        operations: ['microsoftSearchSharedMailboxMessages', 'microsoftGetSharedMailboxMessage'],
      },
      {
        id: 'draftSharedMailbox',
        name: 'Draft from Shared Mailbox',
        description: 'Compose and save a draft in a shared mailbox.',
        operations: ['microsoftCreateSharedMailboxDraft'],
      },
      {
        id: 'browseSharedMailboxFolders',
        name: 'Browse Shared Mailbox Folders',
        description: 'List all folders in a shared mailbox.',
        operations: ['microsoftListSharedMailboxFolders'],
      },
    ],
  },
];

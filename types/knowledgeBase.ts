/**
 * Office Knowledge Base Types
 *
 * Enables university offices to manage their own knowledge bases,
 * events, and integrations with external tools.
 */

import { AttachedDocument } from './attacheddocument';

// Integration provider types
export type IntegrationProvider =
  | 'google_calendar'
  | 'instagram'
  | 'canvas'
  | 'google_drive'
  | 'sharepoint'
  | 'outlook_calendar';

// Event categories for filtering
export type EventCategory =
  | 'academic'
  | 'social'
  | 'career'
  | 'sports'
  | 'arts'
  | 'community'
  | 'workshop'
  | 'other';

// Document processing status
export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';

// Integration sync status
export type SyncStatus = 'connected' | 'syncing' | 'error' | 'disconnected';

/**
 * Office Knowledge Base - Main container for an office's content
 */
export interface OfficeKnowledgeBase {
  id: string;
  officeName: string;
  description: string;
  assistantId: string;          // Links to existing Amplify assistant
  groupId: string;              // Links to existing group for access control
  icon?: string;                // Emoji or icon identifier
  color?: string;               // Brand color for the office
  managers: string[];           // Email addresses with management access
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Knowledge Base Document
 */
export interface KBDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  type: string;                 // MIME type
  size: number;                 // Bytes
  fileKey: string;              // S3 key reference
  uploadedBy: string;
  uploadedAt: Date;
  status: DocumentStatus;
  errorMessage?: string;
  tags: string[];
  // RAG metadata
  chunkCount?: number;
  lastProcessedAt?: Date;
}

/**
 * Office Event
 */
export interface OfficeEvent {
  id: string;
  knowledgeBaseId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location: string;
  virtualLink?: string;         // Zoom/Teams link
  category: EventCategory;
  imageUrl?: string;
  registrationUrl?: string;
  capacity?: number;
  currentRegistrations?: number;
  isRecurring: boolean;
  recurrencePattern?: string;   // RRULE format
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Source tracking for synced events
  sourceIntegration?: IntegrationProvider;
  sourceId?: string;
}

/**
 * Integration Connection
 */
export interface IntegrationConnection {
  id: string;
  knowledgeBaseId: string;
  provider: IntegrationProvider;
  status: SyncStatus;
  displayName: string;          // "Student Engagement Google Calendar"
  config: IntegrationConfig;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  errorMessage?: string;
  createdBy: string;
  createdAt: Date;
}

/**
 * Provider-specific configuration
 */
export interface IntegrationConfig {
  // Google Calendar
  calendarId?: string;
  calendarName?: string;

  // Instagram
  instagramAccountId?: string;
  instagramUsername?: string;
  hashtagsToTrack?: string[];
  includeStories?: boolean;

  // Canvas LMS
  canvasCourseIds?: string[];
  includeAssignments?: boolean;
  includeAnnouncements?: boolean;

  // Google Drive
  driveFolderId?: string;
  driveFolderName?: string;
  fileTypes?: string[];

  // SharePoint
  siteUrl?: string;
  libraryName?: string;

  // Generic
  webhookUrl?: string;
  accessToken?: string;         // Encrypted reference
  refreshToken?: string;        // Encrypted reference
}

/**
 * Sync Log Entry
 */
export interface SyncLogEntry {
  id: string;
  integrationId: string;
  timestamp: Date;
  status: 'success' | 'partial' | 'failed';
  itemsSynced: number;
  itemsFailed: number;
  errorDetails?: string;
  duration: number;             // Milliseconds
}

/**
 * Knowledge Base Stats
 */
export interface KBStats {
  documentCount: number;
  totalDocumentSize: number;
  eventCount: number;
  upcomingEventCount: number;
  integrationCount: number;
  lastActivity: Date;
  weeklyQueries: number;
}

/**
 * Available offices/departments for setup
 */
export const UNIVERSITY_OFFICES: { name: string; icon: string; color: string }[] = [
  { name: 'Student Engagement', icon: '🎉', color: '#4F46E5' },
  { name: 'Academic Affairs', icon: '📚', color: '#059669' },
  { name: 'Financial Aid', icon: '💰', color: '#D97706' },
  { name: 'Registrar', icon: '📋', color: '#7C3AED' },
  { name: 'Career Services', icon: '💼', color: '#2563EB' },
  { name: 'IT Help Desk', icon: '💻', color: '#DC2626' },
  { name: 'Library', icon: '📖', color: '#0891B2' },
  { name: 'Athletics', icon: '🏆', color: '#EA580C' },
  { name: 'Housing & Residence', icon: '🏠', color: '#16A34A' },
  { name: 'Health Services', icon: '🏥', color: '#E11D48' },
  { name: 'Counseling Center', icon: '💚', color: '#14B8A6' },
  { name: 'International Programs', icon: '🌍', color: '#8B5CF6' },
  { name: 'Admissions', icon: '🎓', color: '#F59E0B' },
  { name: 'Alumni Relations', icon: '🤝', color: '#6366F1' },
];

/**
 * Event category metadata
 */
export const EVENT_CATEGORIES: { value: EventCategory; label: string; icon: string }[] = [
  { value: 'academic', label: 'Academic', icon: '📚' },
  { value: 'social', label: 'Social', icon: '🎉' },
  { value: 'career', label: 'Career', icon: '💼' },
  { value: 'sports', label: 'Sports', icon: '🏆' },
  { value: 'arts', label: 'Arts & Culture', icon: '🎨' },
  { value: 'community', label: 'Community Service', icon: '🤝' },
  { value: 'workshop', label: 'Workshop', icon: '🛠️' },
  { value: 'other', label: 'Other', icon: '📌' },
];

/**
 * Integration provider metadata
 */
export const INTEGRATION_PROVIDERS: {
  id: IntegrationProvider;
  name: string;
  icon: string;
  description: string;
  setupUrl?: string;
}[] = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Sync events from Google Calendar automatically'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    description: 'Import posts and stories for knowledge base'
  },
  {
    id: 'canvas',
    name: 'Canvas LMS',
    icon: '🎓',
    description: 'Sync course announcements and assignments'
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    icon: '📁',
    description: 'Auto-sync documents from shared folders'
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    icon: '📂',
    description: 'Connect to Microsoft SharePoint libraries'
  },
  {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    icon: '📆',
    description: 'Sync events from Microsoft Outlook'
  },
];

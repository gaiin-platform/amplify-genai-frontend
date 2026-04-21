/**
 * Office Knowledge Base Portal
 *
 * Self-service portal for university offices to manage their knowledge bases,
 * events, and integrations.
 */

import { GetServerSideProps } from 'next';
import { getSession, useSession } from 'next-auth/react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  IconFiles,
  IconCalendarEvent,
  IconPlug,
  IconMessageCircle,
  IconSettings,
  IconRefresh,
  IconArrowLeft,
  IconExternalLink,
  IconAlertTriangle,
} from '@tabler/icons-react';

import {
  OfficeKnowledgeBase,
  KBDocument,
  OfficeEvent,
  IntegrationConnection,
  KBStats,
} from '@/types/knowledgeBase';

import {
  DocumentManager,
  EventsManager,
  AssistantPreview,
  IntegrationsPanel,
} from '@/components/KnowledgeBase';

import {
  getKnowledgeBase,
  getDocuments,
  getEvents,
  getIntegrations,
  getKnowledgeBaseStats,
  syncAllIntegrations,
  updateKnowledgeBase,
  deleteKnowledgeBase,
} from '@/services/knowledgeBaseService';

// Tab type
type PortalTab = 'documents' | 'events' | 'integrations' | 'preview' | 'settings';

export default function KnowledgeBasePortal() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<PortalTab>('documents');
  const [selectedOffice, setSelectedOffice] = useState<OfficeKnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    officeName: '',
    description: '',
    managers: '',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // For now, use mock data - replace with actual API calls
        // In production: const kb = await getKnowledgeBase(id);

        // Sample data for development/demo purposes.
        // TODO: Replace with actual API calls (e.g., const kb = await getKnowledgeBase(id);)
        // when the knowledge base backend service is ready.
        const mockOffice: OfficeKnowledgeBase = {
          id: '1',
          officeName: 'Student Engagement',
          description: 'Campus activities, clubs, and student events',
          assistantId: 'ast-123',
          groupId: 'grp-456',
          icon: '🎉',
          color: '#4F46E5',
          managers: [session?.user?.email || ''],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mockDocuments: KBDocument[] = [
          {
            id: '1',
            knowledgeBaseId: '1',
            name: 'Club Directory 2026.pdf',
            type: 'application/pdf',
            size: 2457600,
            fileKey: 'docs/club-directory-2026.pdf',
            uploadedBy: session?.user?.email || '',
            uploadedAt: new Date(Date.now() - 86400000),
            status: 'ready',
            tags: ['clubs', 'directory'],
            chunkCount: 45,
          },
          {
            id: '2',
            knowledgeBaseId: '1',
            name: 'Campus Activities Guide.docx',
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: 890000,
            fileKey: 'docs/activities-guide.docx',
            uploadedBy: session?.user?.email || '',
            uploadedAt: new Date(Date.now() - 172800000),
            status: 'ready',
            tags: ['activities', 'guide'],
            chunkCount: 28,
          },
        ];

        const mockEvents: OfficeEvent[] = [
          {
            id: '1',
            knowledgeBaseId: '1',
            title: 'Spring Fling 2026',
            description:
              'Annual spring celebration with live music, food trucks, and activities.',
            startDate: new Date('2026-03-15T19:00:00'),
            endDate: new Date('2026-03-15T23:00:00'),
            location: 'Campus Quad',
            category: 'social',
            createdBy: session?.user?.email || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            isRecurring: false,
          },
          {
            id: '2',
            knowledgeBaseId: '1',
            title: 'Career Fair',
            description: 'Meet employers from 50+ companies. Bring your resume!',
            startDate: new Date('2026-03-22T10:00:00'),
            endDate: new Date('2026-03-22T16:00:00'),
            location: 'Student Center Ballroom',
            category: 'career',
            createdBy: session?.user?.email || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            isRecurring: false,
          },
        ];

        const mockStats: KBStats = {
          documentCount: 2,
          totalDocumentSize: 3347600,
          eventCount: 2,
          upcomingEventCount: 2,
          integrationCount: 0,
          lastActivity: new Date(),
          weeklyQueries: 156,
        };

        setSelectedOffice(mockOffice);
        setDocuments(mockDocuments);
        setEvents(mockEvents);
        setStats(mockStats);
        setSettingsForm({
          officeName: mockOffice.officeName,
          description: mockOffice.description,
          managers: mockOffice.managers.join('\n'),
        });
      } catch (err) {
        console.error('Error loading knowledge base:', err);
        setError('Failed to load knowledge base data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [session]);

  const handleSync = async () => {
    if (!selectedOffice) return;

    setIsSyncing(true);
    try {
      await syncAllIntegrations(selectedOffice.id);
      // Reload data after sync
      // const newStats = await getKnowledgeBaseStats(selectedOffice.id);
      // setStats(newStats);
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedOffice) return;

    setIsSavingSettings(true);
    try {
      const success = await updateKnowledgeBase(selectedOffice.id, {
        officeName: settingsForm.officeName,
        description: settingsForm.description,
        managers: settingsForm.managers.split('\n').filter((e) => e.trim()),
      });

      if (success) {
        setSelectedOffice({
          ...selectedOffice,
          officeName: settingsForm.officeName,
          description: settingsForm.description,
          managers: settingsForm.managers.split('\n').filter((e) => e.trim()),
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOffice) return;

    try {
      const success = await deleteKnowledgeBase(selectedOffice.id);
      if (success) {
        // Redirect to home or knowledge bases list
        window.location.href = '/home';
      }
    } catch (err) {
      console.error('Error deleting knowledge base:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading Knowledge Base...</p>
        </div>
      </div>
    );
  }

  if (error || !selectedOffice) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <IconAlertTriangle className="w-12 h-12 mx-auto text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            {error || 'Knowledge base not found'}
          </h2>
          <Link
            href="/home"
            className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-700"
          >
            <IconArrowLeft className="w-4 h-4 mr-2" />
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{selectedOffice.officeName} - Knowledge Base Portal</title>
        <meta
          name="description"
          content="Manage your office knowledge base, events, and integrations"
        />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href="/home"
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <IconArrowLeft className="w-5 h-5" />
                </Link>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${selectedOffice.color}20` }}
                >
                  {selectedOffice.icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedOffice.officeName}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Knowledge Base Portal
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Stats */}
                <div className="hidden md:flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {stats?.documentCount || 0}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">Documents</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {stats?.upcomingEventCount || 0}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">Upcoming Events</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {stats?.weeklyQueries || 0}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">Weekly Queries</div>
                  </div>
                </div>

                {/* Sync Button */}
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <IconRefresh className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <nav className="flex space-x-1 mt-6 overflow-x-auto" aria-label="Tabs">
              {[
                { id: 'documents', label: 'Documents', icon: IconFiles },
                { id: 'events', label: 'Events', icon: IconCalendarEvent },
                { id: 'integrations', label: 'Integrations', icon: IconPlug },
                { id: 'preview', label: 'Preview', icon: IconMessageCircle },
                { id: 'settings', label: 'Settings', icon: IconSettings },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as PortalTab)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <DocumentManager
              knowledgeBaseId={selectedOffice.id}
              documents={documents}
              onDocumentsChange={setDocuments}
            />
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <EventsManager
              knowledgeBaseId={selectedOffice.id}
              events={events}
              onEventsChange={setEvents}
              calendarIntegration={integrations.find((i) => i.provider === 'google_calendar')}
              onSyncCalendar={handleSync}
            />
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <IntegrationsPanel knowledgeBaseId={selectedOffice.id} />
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && <AssistantPreview knowledgeBase={selectedOffice} />}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-6">
                  Knowledge Base Settings
                </h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Office Name
                    </label>
                    <input
                      type="text"
                      value={settingsForm.officeName}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, officeName: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={settingsForm.description}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, description: e.target.value })
                      }
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Managers (one email per line)
                    </label>
                    <textarea
                      value={settingsForm.managers}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, managers: e.target.value })
                      }
                      rows={3}
                      placeholder="admin@holyfamily.edu"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Managers can upload documents, create events, and manage integrations
                    </p>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>

              {/* Linked Assistant */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Linked Assistant
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This knowledge base is connected to an Amplify assistant. Students can
                  chat with the assistant to get information from your documents and events.
                </p>
                <a
                  href={`/home?assistant=${selectedOffice.assistantId}`}
                  className="inline-flex items-center text-blue-600 hover:text-blue-700"
                >
                  Open in Chat
                  <IconExternalLink className="w-4 h-4 ml-1" />
                </a>
              </div>

              {/* Danger Zone */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 p-6">
                <h2 className="font-semibold text-red-600 dark:text-red-400 mb-4">
                  Danger Zone
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Deleting your knowledge base will remove all documents, events, and
                  integrations. This action cannot be undone.
                </p>

                {showDeleteConfirm ? (
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-red-600">Are you sure?</span>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Delete Knowledge Base
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
      ...(await serverSideTranslations(context.locale ?? 'en', ['common'])),
    },
  };
};

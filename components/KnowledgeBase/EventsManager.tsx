/**
 * Events Manager
 *
 * Create, edit, and manage events for knowledge bases.
 * Events are synced to the assistant and appear in student queries.
 */

import { useState } from 'react';
import {
  IconPlus,
  IconCalendarEvent,
  IconEdit,
  IconTrash,
  IconMapPin,
  IconLink,
  IconUsers,
  IconRefresh,
  IconX,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import {
  OfficeEvent,
  EventCategory,
  EVENT_CATEGORIES,
  IntegrationConnection,
} from '@/types/knowledgeBase';
import { createEvent, updateEvent, deleteEvent } from '@/services/knowledgeBaseService';

interface EventsManagerProps {
  knowledgeBaseId: string;
  events: OfficeEvent[];
  onEventsChange: (events: OfficeEvent[]) => void;
  calendarIntegration?: IntegrationConnection;
  onSyncCalendar?: () => Promise<void>;
}

interface EventFormData {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  virtualLink: string;
  category: EventCategory;
  imageUrl: string;
  registrationUrl: string;
  capacity: string;
  isRecurring: boolean;
}

const emptyFormData: EventFormData = {
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  location: '',
  virtualLink: '',
  category: 'other',
  imageUrl: '',
  registrationUrl: '',
  capacity: '',
  isRecurring: false,
};

export default function EventsManager({
  knowledgeBaseId,
  events,
  onEventsChange,
  calendarIntegration,
  onSyncCalendar,
}: EventsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OfficeEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(emptyFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleOpenForm = (event?: OfficeEvent) => {
    if (event) {
      setEditingEvent(event);
      const start = new Date(event.startDate);
      const end = event.endDate ? new Date(event.endDate) : start;
      setFormData({
        title: event.title,
        description: event.description,
        startDate: start.toISOString().split('T')[0],
        startTime: start.toTimeString().slice(0, 5),
        endDate: end.toISOString().split('T')[0],
        endTime: end.toTimeString().slice(0, 5),
        location: event.location,
        virtualLink: event.virtualLink || '',
        category: event.category,
        imageUrl: event.imageUrl || '',
        registrationUrl: event.registrationUrl || '',
        capacity: event.capacity?.toString() || '',
        isRecurring: event.isRecurring,
      });
    } else {
      setEditingEvent(null);
      setFormData(emptyFormData);
    }
    setShowForm(true);
    setError(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setFormData(emptyFormData);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = formData.endDate
        ? new Date(`${formData.endDate}T${formData.endTime}`)
        : undefined;

      const eventData: Partial<OfficeEvent> = {
        title: formData.title,
        description: formData.description,
        startDate: startDateTime,
        endDate: endDateTime,
        location: formData.location,
        virtualLink: formData.virtualLink || undefined,
        category: formData.category,
        imageUrl: formData.imageUrl || undefined,
        registrationUrl: formData.registrationUrl || undefined,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
        isRecurring: formData.isRecurring,
      };

      if (editingEvent) {
        const success = await updateEvent(editingEvent.id, eventData);
        if (success) {
          onEventsChange(
            events.map((e) =>
              e.id === editingEvent.id
                ? { ...e, ...eventData, updatedAt: new Date() }
                : e
            )
          );
          handleCloseForm();
        } else {
          setError('Failed to update event');
        }
      } else {
        const newEvent = await createEvent(knowledgeBaseId, eventData);
        if (newEvent) {
          onEventsChange([...events, newEvent]);
          handleCloseForm();
        } else {
          setError('Failed to create event');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Error saving event:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (event: OfficeEvent) => {
    const confirmed = window.confirm(
      `Delete "${event.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const success = await deleteEvent(event.id);
      if (success) {
        onEventsChange(events.filter((e) => e.id !== event.id));
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const handleSyncCalendar = async () => {
    if (!onSyncCalendar) return;
    setIsSyncing(true);
    try {
      await onSyncCalendar();
    } finally {
      setIsSyncing(false);
    }
  };

  // Sort events by date
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // Filter to upcoming events
  const now = new Date();
  const upcomingEvents = sortedEvents.filter(
    (e) => new Date(e.startDate) >= now
  );
  const pastEvents = sortedEvents.filter((e) => new Date(e.startDate) < now);

  const getCategoryInfo = (category: EventCategory) => {
    return EVENT_CATEGORIES.find((c) => c.value === category) || EVENT_CATEGORIES[7];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <IconCalendarEvent className="w-5 h-5 mr-2" />
            Events
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {upcomingEvents.length} upcoming event
            {upcomingEvents.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {calendarIntegration && (
            <button
              onClick={handleSyncCalendar}
              disabled={isSyncing}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <IconRefresh className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="text-sm">Sync Calendar</span>
            </button>
          )}
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <IconPlus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Events Grid */}
      {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <IconCalendarEvent className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No events yet
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Create events that students can ask about through the assistant.
          </p>
          <button
            onClick={() => handleOpenForm()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Event
          </button>
        </div>
      ) : (
        <>
          {/* Upcoming Events */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => {
              const category = getCategoryInfo(event.category);
              return (
                <div
                  key={event.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group"
                >
                  {/* Color bar */}
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>

                  <div className="p-5">
                    {/* Category */}
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-lg">{category.icon}</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {category.label}
                      </span>
                      {event.sourceIntegration && (
                        <span className="ml-auto text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded">
                          Synced
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {event.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {event.description}
                    </p>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-500 dark:text-gray-400">
                        <IconCalendarEvent className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>
                          {formatDate(event.startDate)} at{' '}
                          {formatTime(event.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-500 dark:text-gray-400">
                        <IconMapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      {event.virtualLink && (
                        <div className="flex items-center text-blue-600 dark:text-blue-400">
                          <IconLink className="w-4 h-4 mr-2 flex-shrink-0" />
                          <a
                            href={event.virtualLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate hover:underline"
                          >
                            Virtual Link
                          </a>
                        </div>
                      )}
                      {event.capacity && (
                        <div className="flex items-center text-gray-500 dark:text-gray-400">
                          <IconUsers className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>
                            {event.currentRegistrations || 0}/{event.capacity} spots
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenForm(event)}
                        className="flex-1 flex items-center justify-center px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg"
                      >
                        <IconEdit className="w-4 h-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(event)}
                        className="flex-1 flex items-center justify-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg"
                      >
                        <IconTrash className="w-4 h-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Past Events ({pastEvents.length})
              </h3>
              <div className="space-y-2">
                {pastEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <span>{getCategoryInfo(event.category).icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {event.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(event.startDate)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(event)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <IconX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Spring Fling 2026"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the event..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as EventCategory,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="Campus Quad, Student Center, etc."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Virtual Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Virtual Link (Zoom/Teams)
                </label>
                <input
                  type="url"
                  value={formData.virtualLink}
                  onChange={(e) =>
                    setFormData({ ...formData, virtualLink: e.target.value })
                  }
                  placeholder="https://zoom.us/j/..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Registration & Capacity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Registration URL
                  </label>
                  <input
                    type="url"
                    value={formData.registrationUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, registrationUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    placeholder="Leave empty for unlimited"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <IconRefresh className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <IconCheck className="w-4 h-4" />
                      <span>{editingEvent ? 'Update Event' : 'Create Event'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

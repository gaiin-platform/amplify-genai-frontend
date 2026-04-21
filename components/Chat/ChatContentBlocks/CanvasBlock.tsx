import React, { FC, useState, useEffect } from 'react';
import { IconSchool, IconBook, IconCalendar, IconClipboard, IconSpeakerphone } from '@tabler/icons-react';
import { canvasService, CanvasCourse, CanvasAssignment, CanvasGrade, CanvasAnnouncement } from '@/services/canvasService';
import { LoadingIcon } from '@/components/Loader/LoadingIcon';

interface CanvasBlockProps {
  type: 'courses' | 'assignments' | 'grades' | 'announcements' | 'upcoming';
  courseId?: number;
  days?: number;
  limit?: number;
}

export const CanvasBlock: FC<CanvasBlockProps> = ({ type, courseId, days = 7, limit = 10 }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [type, courseId, days, limit]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let result;
      switch (type) {
        case 'courses':
          result = await canvasService.getCourses();
          break;
        case 'assignments':
          result = await canvasService.getAssignments(courseId);
          break;
        case 'upcoming':
          result = await canvasService.getUpcomingAssignments(days);
          break;
        case 'grades':
          result = await canvasService.getGrades(courseId);
          break;
        case 'announcements':
          result = await canvasService.getAnnouncements(limit);
          break;
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Canvas data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingIcon />
        <span className="ml-2">Loading Canvas data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-4">
        <p className="text-red-700 dark:text-red-300">Error: {error}</p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
          Make sure you have connected your Canvas account in Settings.
        </p>
      </div>
    );
  }

  const renderCourses = (courses: CanvasCourse[]) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
        <IconBook size={20} />
        Your Courses ({courses.length})
      </h3>
      <div className="grid gap-2">
        {courses.map(course => (
          <div key={course.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 hover:shadow-md transition-shadow">
            <h4 className="font-medium">{course.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {course.course_code} • {course.workflow_state}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAssignments = (assignments: CanvasAssignment[]) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
        <IconClipboard size={20} />
        {type === 'upcoming' ? `Upcoming Assignments (${assignments.length})` : `Assignments (${assignments.length})`}
      </h3>
      <div className="space-y-2">
        {assignments.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No assignments found.</p>
        ) : (
          assignments.map(assignment => (
            <div key={assignment.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium">{assignment.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {assignment.course_name}
                    {assignment.points_possible > 0 && ` • ${assignment.points_possible} points`}
                  </p>
                  {assignment.due_at && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                      <IconCalendar size={14} />
                      Due: {new Date(assignment.due_at).toLocaleString()}
                      {assignment.days_until_due !== undefined && (
                        <span className="ml-2 text-orange-600 dark:text-orange-400">
                          ({assignment.days_until_due} days)
                        </span>
                      )}
                    </p>
                  )}
                </div>
                {assignment.has_submitted && (
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded">
                    Submitted
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderGrades = (grades: CanvasGrade[]) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
        <IconSchool size={20} />
        Your Grades ({grades.length})
      </h3>
      <div className="space-y-2">
        {grades.map(grade => (
          <div key={grade.course_id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 hover:shadow-md transition-shadow">
            <h4 className="font-medium">{grade.course_name}</h4>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Current: </span>
                <span className="font-semibold">
                  {grade.current_grade || 'N/A'} ({grade.current_score || 'N/A'}%)
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Final: </span>
                <span className="font-semibold">
                  {grade.final_grade || 'N/A'} ({grade.final_score || 'N/A'}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnnouncements = (announcements: CanvasAnnouncement[]) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
        <IconSpeakerphone size={20} />
        Recent Announcements ({announcements.length})
      </h3>
      <div className="space-y-2">
        {announcements.map(announcement => (
          <div key={announcement.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 hover:shadow-md transition-shadow">
            <h4 className="font-medium">{announcement.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {announcement.course_name} • {new Date(announcement.posted_at).toLocaleDateString()}
            </p>
            <p className="text-sm mt-2 line-clamp-3">{announcement.message}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="canvas-block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 my-4">
      {type === 'courses' && renderCourses(data as CanvasCourse[])}
      {(type === 'assignments' || type === 'upcoming') && renderAssignments(data as CanvasAssignment[])}
      {type === 'grades' && renderGrades(data as CanvasGrade[])}
      {type === 'announcements' && renderAnnouncements(data as CanvasAnnouncement[])}
    </div>
  );
};
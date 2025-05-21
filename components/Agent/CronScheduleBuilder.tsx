import React, { useState, useEffect } from 'react';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { ScheduleDateRange } from '../../types/scheduledTasks';

interface CronScheduleBuilderProps {
  value: string;
  onChange: (cronExpression: string) => void;
  dateRange?: ScheduleDateRange;
  onRangeChange?: (range: ScheduleDateRange) => void;
}

interface ScheduleOption {
  label: string;
  value: string;
  description: string;
  configurable: boolean;
}

const PRESET_SCHEDULES: ScheduleOption[] = [
  // { label: 'Every minute', value: '* * * * *', description: 'Runs every minute', configurable: false },
  // { label: 'Hourly', value: '0 * * * *', description: 'Runs at the start of every hour', configurable: true },
  { label: 'Daily', value: '0 0 * * *', description: 'Runs daily at a specific time', configurable: true },
  { label: 'Weekly', value: '0 0 * * 0', description: 'Runs once a week on a specific day and time', configurable: true },
  { label: 'Monthly', value: '0 0 1 * *', description: 'Runs once a month on a specific day and time', configurable: true },
  // { label: 'Yearly', value: '0 0 1 1 *', description: 'Runs once a year on a specific date and time', configurable: true },
  { label: 'Custom', value: 'custom', description: 'Define a custom schedule', configurable: false },
];

// Time options
const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: i < 12 ? `${i === 0 ? 12 : i} AM` : `${i === 12 ? 12 : i - 12} PM`
}));

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: i.toString(),
  label: i.toString().padStart(2, '0')
}));

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: (i + 1).toString(),
  label: (i + 1).toString()
}));

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const CronScheduleBuilder: React.FC<CronScheduleBuilderProps> = ({ value, onChange, dateRange, onRangeChange }) => {
  const [scheduleType, setScheduleType] = useState<string>('');
  const [presetConfig, setPresetConfig] = useState({
    minute: '0',
    hour: '9', // Default to 9 AM for most presets
    dayOfMonth: '1',
    month: '1',
    dayOfWeek: '1', // Monday
  });
  const [customSchedule, setCustomSchedule] = useState({
    minute: '0',
    hour: '0',
    dayOfMonth: '*',
    month: '*',
    dayOfWeek: '*',
  });
  // For displaying upcoming execution times
  const [nextRunTimes, setNextRunTimes] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Date range state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateRange, setShowDateRange] = useState<boolean>(false);

  // Initialize the component with existing values
  useEffect(() => {
    // Initialize cron value
    const preset = PRESET_SCHEDULES.find(p => p.value === value);
    if (preset) {
      setScheduleType(preset.value);
    } else if (value) {
      const parts = value.split(' ');
      
      // Check if this is one of our configurable presets with custom values
      const hourlyPattern = /^([0-9]+) \* \* \* \*$/;
      const dailyPattern = /^([0-9]+) ([0-9]+) \* \* \*$/;
      const weeklyPattern = /^([0-9]+) ([0-9]+) \* \* ([0-6])$/;
      const monthlyPattern = /^([0-9]+) ([0-9]+) ([0-9]+) \* \*$/;
      const yearlyPattern = /^([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+) \*$/;

      if (hourlyPattern.test(value)) {
        setScheduleType('0 * * * *');
        setPresetConfig({...presetConfig, minute: parts[0]});
      } else if (dailyPattern.test(value)) {
        setScheduleType('0 0 * * *');
        setPresetConfig({...presetConfig, minute: parts[0], hour: parts[1]});
      } else if (weeklyPattern.test(value)) {
        setScheduleType('0 0 * * 0');
        setPresetConfig({...presetConfig, minute: parts[0], hour: parts[1], dayOfWeek: parts[4]});
      } else if (monthlyPattern.test(value)) {
        setScheduleType('0 0 1 * *');
        setPresetConfig({...presetConfig, minute: parts[0], hour: parts[1], dayOfMonth: parts[2]});
      } else if (yearlyPattern.test(value)) {
        setScheduleType('0 0 1 1 *');
        setPresetConfig({
          ...presetConfig, 
          minute: parts[0], 
          hour: parts[1], 
          dayOfMonth: parts[2], 
          month: parts[3]
        });
      } else {
        // If it doesn't match our patterns, treat as custom
        setScheduleType('custom');
        
        // Try to parse the custom cron expression
        if (parts.length === 5) {
          setCustomSchedule({
            minute: parts[0],
            hour: parts[1],
            dayOfMonth: parts[2],
            month: parts[3],
            dayOfWeek: parts[4],
          });
        }
      }
    } else {
      // Default to daily at 9 AM
      setScheduleType('0 0 * * *');
    }
    
    // Initialize date range
    if (dateRange) {
      if (dateRange.startDate) {
        setStartDate(formatDateForInput(dateRange.startDate));
        setShowDateRange(true);
      }
      if (dateRange.endDate) {
        setEndDate(formatDateForInput(dateRange.endDate));
        setShowDateRange(true);
      }
    }
  }, []);

  // Format date for input element
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0];
  
  // Handle date range changes
  useEffect(() => {
    if (onRangeChange) {
      const range: ScheduleDateRange = {
        startDate: showDateRange && startDate ? new Date(startDate) : null,
        endDate: showDateRange && endDate ? new Date(endDate) : null
      };
      onRangeChange(range);
    }
  }, [startDate, endDate, showDateRange]);

  // When schedule type or preset config changes, update the cron expression
  useEffect(() => {
    if (!scheduleType || scheduleType === 'custom') return;
    
    let cronExpression = '';
    
    switch(scheduleType) {
      case '* * * * *': // Every minute
        cronExpression = '* * * * *';
        break;
      case '0 * * * *': // Hourly
        cronExpression = `${presetConfig.minute} * * * *`;
        break;
      case '0 0 * * *': // Daily
        cronExpression = `${presetConfig.minute} ${presetConfig.hour} * * *`;
        break;
      case '0 0 * * 0': // Weekly
        cronExpression = `${presetConfig.minute} ${presetConfig.hour} * * ${presetConfig.dayOfWeek}`;
        break;
      case '0 0 1 * *': // Monthly
        cronExpression = `${presetConfig.minute} ${presetConfig.hour} ${presetConfig.dayOfMonth} * *`;
        break;
      case '0 0 1 1 *': // Yearly
        cronExpression = `${presetConfig.minute} ${presetConfig.hour} ${presetConfig.dayOfMonth} ${presetConfig.month} *`;
        break;
      default:
        cronExpression = scheduleType;
    }
    
    onChange(cronExpression);
    calculateNextRunTimes(cronExpression);
  }, [scheduleType, presetConfig, startDate, endDate, showDateRange]);

  // When custom schedule changes, generate the cron expression
  useEffect(() => {
    if (scheduleType === 'custom') {
      const cronExpression = `${customSchedule.minute} ${customSchedule.hour} ${customSchedule.dayOfMonth} ${customSchedule.month} ${customSchedule.dayOfWeek}`;
      onChange(cronExpression);
      calculateNextRunTimes(cronExpression);
    }
  }, [customSchedule, scheduleType, startDate, endDate, showDateRange]);

  // Modified calculateNextRunTimes to include date range info
  const calculateNextRunTimes = (cronExpression: string) => {
    // This is a simplified version. In a real app, you'd use a library like cron-parser
    // This just shows a general idea of what the schedule means
    const now = new Date();
    let times: string[] = [];
    
    try {
      // Basic cron pattern parsing - this is extremely simplified
      const parts = cronExpression.split(' ');
      const minute = parts[0];
      const hour = parts[1];
      const dayOfMonth = parts[2];
      const month = parts[3];
      const dayOfWeek = parts[4];
      
      // Convert our cron pattern to human-readable text
      let schedulePattern = "";
      let nextRunTime = "";
      
      // First, determine the base schedule pattern
      if (minute === '*' && hour === '*') {
        schedulePattern = "Every minute";
      } else if (minute !== '*' && hour === '*') {
        schedulePattern = `Every hour at ${minute} minutes past the hour`;
      } else if (dayOfMonth === '*' && dayOfWeek === '*') {
        const timeStr = formatTime(parseInt(hour), parseInt(minute));
        schedulePattern = `Daily at ${timeStr}`;
      } else if (dayOfMonth === '*' && dayOfWeek !== '*') {
        const day = DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || 'specified day';
        const timeStr = formatTime(parseInt(hour), parseInt(minute));
        schedulePattern = `Weekly on ${day} at ${timeStr}`;
      } else if (dayOfMonth !== '*' && month === '*') {
        const timeStr = formatTime(parseInt(hour), parseInt(minute));
        schedulePattern = `Monthly on day ${dayOfMonth} at ${timeStr}`;
      } else if (month !== '*') {
        const monthName = MONTHS.find(m => m.value === month)?.label || 'specified month';
        const timeStr = formatTime(parseInt(hour), parseInt(minute));
        schedulePattern = `Annually on ${monthName} ${dayOfMonth} at ${timeStr}`;
      } else {
        schedulePattern = "Complex schedule pattern";
      }
      
      // Add date range information to the pattern if provided
      let dateRangeInfo = "";
      if (showDateRange) {
        const rangeSegments = [];
        if (startDate) {
          const formattedStart = new Date(startDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          rangeSegments.push(`from ${formattedStart}`);
        }
        if (endDate) {
          const formattedEnd = new Date(endDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          rangeSegments.push(`until ${formattedEnd}`);
        }
        
        if (rangeSegments.length > 0) {
          dateRangeInfo = ` (${rangeSegments.join(' ')})`;
        }
      }
      
      times.push(schedulePattern + dateRangeInfo);
      
      // Now, determine the next run time
      let nextRunDate: Date | null = null;
      
      // Skip nextRunTime calculation if schedule is complex
      if (schedulePattern === "Complex schedule pattern") {
        times.push("Preview not available");
        return;
      }
      
      // Get the next scheduled time based on the cron pattern
      if (minute === '*' && hour === '*') {
        // Every minute - next run is within a minute
        nextRunDate = new Date(now.getTime() + 60000);
        nextRunTime = "Next run: In less than a minute";
      } else if (minute !== '*' && hour === '*') {
        // Hourly at specific minute
        nextRunDate = new Date(now);
        nextRunDate.setMinutes(parseInt(minute));
        if (nextRunDate <= now) {
          nextRunDate.setHours(nextRunDate.getHours() + 1);
        }
        nextRunTime = `Next run: ${formatDate(nextRunDate)} at ${formatTime(nextRunDate.getHours(), nextRunDate.getMinutes())}`;
      } else if (dayOfMonth === '*' && dayOfWeek === '*') {
        // Daily at specific time
        nextRunDate = new Date(now);
        nextRunDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
        if (nextRunDate <= now) {
          nextRunDate.setDate(nextRunDate.getDate() + 1);
        }
        nextRunTime = `Next run: ${formatDate(nextRunDate)} at ${formatTime(nextRunDate.getHours(), nextRunDate.getMinutes())}`;
      } else if (dayOfMonth === '*' && dayOfWeek !== '*') {
        // Weekly on specific day at specific time
        const dayIdx = parseInt(dayOfWeek);
        const today = now.getDay();
        let daysUntil = (dayIdx + 7 - today) % 7;
        if (daysUntil === 0) {
          // It's today, check if the time has passed
          const scheduledToday = new Date(now);
          scheduledToday.setHours(parseInt(hour), parseInt(minute), 0, 0);
          if (scheduledToday <= now) {
            daysUntil = 7; // Next week
          }
        }
        
        nextRunDate = new Date(now);
        nextRunDate.setDate(nextRunDate.getDate() + daysUntil);
        nextRunDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
        nextRunTime = `Next run: ${formatDate(nextRunDate)} at ${formatTime(nextRunDate.getHours(), nextRunDate.getMinutes())}`;
      } else if (dayOfMonth !== '*' && month === '*') {
        // Monthly on specific day at specific time
        nextRunDate = new Date(now.getFullYear(), now.getMonth(), parseInt(dayOfMonth), parseInt(hour), parseInt(minute));
        if (nextRunDate <= now) {
          nextRunDate.setMonth(nextRunDate.getMonth() + 1);
        }
        nextRunTime = `Next run: ${formatDate(nextRunDate)} at ${formatTime(nextRunDate.getHours(), nextRunDate.getMinutes())}`;
      } else if (month !== '*') {
        // Annually on specific month and day at specific time
        nextRunDate = new Date(now.getFullYear(), parseInt(month) - 1, parseInt(dayOfMonth), parseInt(hour), parseInt(minute));
        if (nextRunDate <= now) {
          nextRunDate.setFullYear(nextRunDate.getFullYear() + 1);
        }
        nextRunTime = `Next run: ${formatDate(nextRunDate)} at ${formatTime(nextRunDate.getHours(), nextRunDate.getMinutes())}`;
      }
      
      // Check if the next run date is within the date range constraints
      if (nextRunDate && showDateRange) {
        const startDateObj = startDate ? new Date(startDate) : null;
        const endDateObj = endDate ? new Date(endDate) : null;
        
        // Set to beginning/end of day for proper comparison
        if (startDateObj) {
          startDateObj.setHours(0, 0, 0, 0);
        }
        if (endDateObj) {
          endDateObj.setHours(23, 59, 59, 999);
        }
        
        // Check if the next run is before the start date
        if (startDateObj && nextRunDate < startDateObj) {
          // Adjust the next run date to the start date with the specified time
          nextRunDate = new Date(startDateObj);
          nextRunDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
          nextRunTime = `Next run: ${formatDate(nextRunDate)} at ${formatTime(nextRunDate.getHours(), nextRunDate.getMinutes())}`;
        }
        
        // Check if the next run is after the end date
        if (endDateObj && nextRunDate > endDateObj) {
          nextRunTime = "No upcoming runs (end date has passed)";
        }
        
        // Check if start date is in the future and this is the first run
        if (startDateObj && startDateObj > now && nextRunDate.getTime() === new Date(startDateObj).setHours(parseInt(hour), parseInt(minute), 0, 0)) {
          nextRunTime = `First run: ${formatDate(nextRunDate)} at ${formatTime(nextRunDate.getHours(), nextRunDate.getMinutes())}`;
        }
      }
      
      if (nextRunTime) {
        times.push(nextRunTime);
      }

      if (showDateRange) {
        const format = (date: string) => {
          return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        }
        const start = startDate ? format(startDate) : "Today";
        const end = endDate ? format(endDate) : "Indefinitely";
        const rangeInfo = `${start} - ${end}`;
        times.push(rangeInfo);
      }
      
      
    } catch (error) {
      times = ["Invalid cron expression"];
    }
    
    setNextRunTimes(times);
  };
  
  const formatTime = (hour: number, minute: number): string => {
    const h = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };
  
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get human-readable description of the current cron expression
  const getScheduleDescription = (): string => {
    if (scheduleType === 'custom') {
      return 'Custom schedule';
    }
    const preset = PRESET_SCHEDULES.find(p => p.value === scheduleType);
    return preset ? preset.description : '';
  };

  const renderHourlyConfig = () => (
    <div className="mt-2 bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
          At minute
        </label>
        <select
          value={presetConfig.minute}
          onChange={(e) => setPresetConfig({ ...presetConfig, minute: e.target.value })}
          className={selectClassName}
        >
          {MINUTES.map((minute) => (
            <option key={minute.value} value={minute.value}>{minute.label}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderDailyConfig = () => (
    <div className="mt-2 bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Hour</label>
          <select
            value={presetConfig.hour}
            onChange={(e) => setPresetConfig({ ...presetConfig, hour: e.target.value })}
            className={selectClassName}
          >
            {HOURS.map((hour) => (
              <option key={hour.value} value={hour.value}>{hour.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Minute</label>
          <select
            value={presetConfig.minute}
            onChange={(e) => setPresetConfig({ ...presetConfig, minute: e.target.value })}
            className={selectClassName}
          >
            {MINUTES.map((minute) => (
              <option key={minute.value} value={minute.value}>{minute.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderWeeklyConfig = () => (
    <div className="mt-2 bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Day of Week</label>
        <select
          value={presetConfig.dayOfWeek}
          onChange={(e) => setPresetConfig({ ...presetConfig, dayOfWeek: e.target.value })}
          className={selectClassName}
        >
          {DAYS_OF_WEEK.map((day) => (
            <option key={day.value} value={day.value}>{day.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Hour</label>
          <select
            value={presetConfig.hour}
            onChange={(e) => setPresetConfig({ ...presetConfig, hour: e.target.value })}
            className={selectClassName}
          >
            {HOURS.map((hour) => (
              <option key={hour.value} value={hour.value}>{hour.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Minute</label>
          <select
            value={presetConfig.minute}
            onChange={(e) => setPresetConfig({ ...presetConfig, minute: e.target.value })}
            className={selectClassName}
          >
            {MINUTES.map((minute) => (
              <option key={minute.value} value={minute.value}>{minute.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderMonthlyConfig = () => (
    <div className="mt-2 bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Day of Month</label>
        <select
          value={presetConfig.dayOfMonth}
          onChange={(e) => setPresetConfig({ ...presetConfig, dayOfMonth: e.target.value })}
          className={selectClassName}
        >
          {DAYS_OF_MONTH.map((day) => (
            <option key={day.value} value={day.value}>{day.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Hour</label>
          <select
            value={presetConfig.hour}
            onChange={(e) => setPresetConfig({ ...presetConfig, hour: e.target.value })}
            className={selectClassName}
          >
            {HOURS.map((hour) => (
              <option key={hour.value} value={hour.value}>{hour.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Minute</label>
          <select
            value={presetConfig.minute}
            onChange={(e) => setPresetConfig({ ...presetConfig, minute: e.target.value })}
            className={selectClassName}
          >
            {MINUTES.map((minute) => (
              <option key={minute.value} value={minute.value}>{minute.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderYearlyConfig = () => (
    <div className="mt-2 bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Month</label>
          <select
            value={presetConfig.month}
            onChange={(e) => setPresetConfig({ ...presetConfig, month: e.target.value })}
            className={selectClassName}
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Day</label>
          <select
            value={presetConfig.dayOfMonth}
            onChange={(e) => setPresetConfig({ ...presetConfig, dayOfMonth: e.target.value })}
            className={selectClassName}
          >
            {DAYS_OF_MONTH.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Hour</label>
          <select
            value={presetConfig.hour}
            onChange={(e) => setPresetConfig({ ...presetConfig, hour: e.target.value })}
            className={selectClassName}
          >
            {HOURS.map((hour) => (
              <option key={hour.value} value={hour.value}>{hour.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Minute</label>
          <select
            value={presetConfig.minute}
            onChange={(e) => setPresetConfig({ ...presetConfig, minute: e.target.value })}
            className={selectClassName}
          >
            {MINUTES.map((minute) => (
              <option key={minute.value} value={minute.value}>{minute.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderPresetConfig = () => {
    switch(scheduleType) {
      case '0 * * * *': // Hourly
        return renderHourlyConfig();
      case '0 0 * * *': // Daily
        return renderDailyConfig();
      case '0 0 * * 0': // Weekly
        return renderWeeklyConfig();
      case '0 0 1 * *': // Monthly
        return renderMonthlyConfig();
      case '0 0 1 1 *': // Yearly
        return renderYearlyConfig();
      default:
        return null;
    }
  };

  const renderCustomScheduleInputs = () => (
    <div className="mt-4 space-y-4 bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
      <h3 className="font-medium text-sm">Custom Cron Schedule</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Hour</label>
          <select
            value={customSchedule.hour}
            onChange={(e) => setCustomSchedule({ ...customSchedule, hour: e.target.value })}
            className={selectClassName}
          >
            <option value="*">Every hour</option>
            {HOURS.map((hour) => (
              <option key={hour.value} value={hour.value}>{hour.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Minute</label>
          <select
            value={customSchedule.minute}
            onChange={(e) => setCustomSchedule({ ...customSchedule, minute: e.target.value })}
            className={selectClassName}
          >
            <option value="*">Every minute</option>
            {MINUTES.map((minute) => (
              <option key={minute.value} value={minute.value}>{minute.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Day of Week</label>
          <select
            value={customSchedule.dayOfWeek}
            onChange={(e) => setCustomSchedule({ ...customSchedule, dayOfWeek: e.target.value })}
            className={selectClassName}
          >
            <option value="*">Every day</option>
            {DAYS_OF_WEEK.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Month</label>
          <select
            value={customSchedule.month}
            onChange={(e) => setCustomSchedule({ ...customSchedule, month: e.target.value })}
            className={selectClassName}
          >
            <option value="*">Every month</option>
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Day of Month</label>
        <select
          value={customSchedule.dayOfMonth}
          onChange={(e) => setCustomSchedule({ ...customSchedule, dayOfMonth: e.target.value })}
          className={selectClassName}
        >
          <option value="*">Every day</option>
          {DAYS_OF_MONTH.map((day) => (
            <option key={day.value} value={day.value}>{day.label}</option>
          ))}
        </select>
      </div>

    </div>
  );

  const renderRunTimesPreview = () => (
    <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200">
      <h4 className="font-medium mb-2">Schedule Preview</h4>
      <ul className="space-y-1 list-disc pl-5">
        {nextRunTimes.length > 0 && nextRunTimes.map((time, index) => (
          <li key={index}>{time}</li>
        ))}
      </ul>
    </div>
  );

  // Render date range selector
  const renderDateRangeSelector = () => (
    <div className="mt-4 bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
      <div className="flex items-center mb-3">
        <input
          type="checkbox"
          id="enableDateRange"
          checked={showDateRange}
          onChange={(e) => {
            setShowDateRange(e.target.checked);
            // If unchecked, recalculate next run times without date range info
            if (!e.target.checked) {
              const cronExpression = scheduleType === 'custom'
                ? `${customSchedule.minute} ${customSchedule.hour} ${customSchedule.dayOfMonth} ${customSchedule.month} ${customSchedule.dayOfWeek}`
                : value;
              calculateNextRunTimes(cronExpression);
            }
          }}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
        />
        <label htmlFor="enableDateRange" className="ml-2 block text-sm font-medium dark:text-neutral-200">
          Set date range for schedule
        </label>
      </div>
      
      {showDateRange && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full shadow custom-shadow p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full shadow custom-shadow p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <ExpansionComponent
        title="Configure Scheduled Time"
        isOpened={true}
        onOpen={() => setShowPreview(false)}
        onClose={() => setShowPreview(true)}
        content={ <>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-neutral-200">Scheduled Time</label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value)}
              className={selectClassName}
            >
              <option value="">Select scheduled time</option>
              {PRESET_SCHEDULES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {getScheduleDescription()}
          </div>

          {/* Show the appropriate config UI based on schedule type */}
          {scheduleType && scheduleType !== 'custom' && scheduleType !== '* * * * *' && renderPresetConfig()}
          {scheduleType === 'custom' && renderCustomScheduleInputs()}
          
          {/* Add date range selector */}
          {renderDateRangeSelector()}
        </>}
      />

      {/* Preview of upcoming execution times */}
      {showPreview && scheduleType && scheduleType !== '' && nextRunTimes.length > 0 && renderRunTimesPreview()}
    </div>
  );
}; 

const selectClassName = "w-full shadow custom-shadow p-2 border rounded-lg dark:bg-[#40414F] dark:border-neutral-600 dark:text-white"
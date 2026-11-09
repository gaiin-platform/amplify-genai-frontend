import { ScheduleDateRange } from '@/types/scheduledTasks';

export const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' },
] as const;

export type ScheduleKind = typeof SCHEDULE_OPTIONS[number]['value'];

export const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`,
}));

export const MINUTES = Array.from({ length: 60 }, (_, minute) => ({
  value: String(minute),
  label: String(minute).padStart(2, '0'),
}));

export const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' }, { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' }, { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, index) => String(index + 1));
export const EXCLUSION_DAYS = [
  ['sunday', 'Sun'], ['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'],
  ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'],
] as const;
export const EXCLUSION_WEEKS = [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [5, 'Last']] as const;
export const EXCLUSION_MONTHS = [
  ['january', 'Jan'], ['february', 'Feb'], ['march', 'Mar'], ['april', 'Apr'],
  ['may', 'May'], ['june', 'Jun'], ['july', 'Jul'], ['august', 'Aug'],
  ['september', 'Sep'], ['october', 'Oct'], ['november', 'Nov'], ['december', 'Dec'],
] as const;

export interface ScheduleDraft {
  kind: ScheduleKind;
  minute: string;
  hour: string;
  dayOfWeek: string;
  dayOfMonth: string;
  month: string;
  customMinute: string;
  customHour: string;
  customDayOfWeek: string;
  customDayOfMonth: string;
  customMonth: string;
  biweeklyStartDate: string;
}

const DEFAULT_DRAFT: ScheduleDraft = {
  kind: 'daily', minute: '0', hour: '9', dayOfWeek: '1', dayOfMonth: '1', month: '1',
  customMinute: '0', customHour: '0', customDayOfWeek: '*', customDayOfMonth: '*', customMonth: '*',
  biweeklyStartDate: '',
};

export const parseSchedule = (value: string): ScheduleDraft => {
  const draft = { ...DEFAULT_DRAFT };
  if (!value) return draft;
  const biweekly = value.match(/^BIWEEKLY:([a-z]+):(\d+):(\d+):(.*)$/i);
  if (biweekly) {
    const day = DAYS_OF_WEEK.find((item) => item.label.toLowerCase() === biweekly[1].toLowerCase());
    return { ...draft, kind: 'biweekly', dayOfWeek: day?.value ?? '1', hour: biweekly[2], minute: biweekly[3], biweeklyStartDate: biweekly[4] };
  }
  const parts = value.split(' ');
  if (parts.length !== 5) return { ...draft, kind: 'custom' };
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') return { ...draft, kind: 'daily', minute, hour };
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') return { ...draft, kind: 'weekly', minute, hour, dayOfWeek };
  if (dayOfMonth !== '*' && month === '*/3' && dayOfWeek === '*') return { ...draft, kind: 'quarterly', minute, hour, dayOfMonth };
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') return { ...draft, kind: 'monthly', minute, hour, dayOfMonth };
  return { ...draft, kind: 'custom', customMinute: minute, customHour: hour, customDayOfMonth: dayOfMonth, customMonth: month, customDayOfWeek: dayOfWeek };
};

export const buildCron = (draft: ScheduleDraft): string => {
  switch (draft.kind) {
    case 'daily': return `${draft.minute} ${draft.hour} * * *`;
    case 'weekly': return `${draft.minute} ${draft.hour} * * ${draft.dayOfWeek}`;
    case 'biweekly': {
      const day = DAYS_OF_WEEK.find((item) => item.value === draft.dayOfWeek)?.label.toLowerCase() ?? 'monday';
      return `BIWEEKLY:${day}:${draft.hour}:${draft.minute}:${draft.biweeklyStartDate}`;
    }
    case 'monthly': return `${draft.minute} ${draft.hour} ${draft.dayOfMonth} * *`;
    case 'quarterly': return `${draft.minute} ${draft.hour} ${draft.dayOfMonth} */3 *`;
    case 'custom': return `${draft.customMinute} ${draft.customHour} ${draft.customDayOfMonth} ${draft.customMonth} ${draft.customDayOfWeek}`;
  }
};

export const formatTimeValue = (hour: string, minute: string): string => {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 'Select time';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** Parse common typed time forms into the existing 24-hour hour/minute state. */
export const parseTypedTime = (raw: string): { hour: string; minute: string } | null => {
  const value = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!value) return null;
  const meridiem = value.match(/(am|pm)$/)?.[1];
  const numeric = meridiem ? value.slice(0, -2) : value;
  let hour: number;
  let minute = 0;
  if (/^\d{1,2}:\d{1,2}$/.test(numeric)) {
    const [h, m] = numeric.split(':').map(Number);
    hour = h; minute = m;
  } else if (/^\d{3,4}$/.test(numeric)) {
    hour = Number(numeric.slice(0, -2)); minute = Number(numeric.slice(-2));
  } else if (/^\d{1,2}$/.test(numeric)) {
    hour = Number(numeric);
  } else {
    return null;
  }
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (meridiem === 'pm' && hour !== 12) hour += 12;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour: String(hour), minute: String(minute) };
};

export const getTimezoneAbbreviation = (): string | null => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return null;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
};

const formatTime = (hour: string, minute: string) => {
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'the selected time';
  return formatTimeValue(hour, minute);
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatScheduleSummary = (draft: ScheduleDraft, range?: ScheduleDateRange): string => {
  const time = formatTime(draft.kind === 'custom' ? draft.customHour : draft.hour, draft.kind === 'custom' ? draft.customMinute : draft.minute);
  let summary = draft.kind === 'daily' ? `Runs every day at ${time}`
    : draft.kind === 'weekly' ? `Runs every ${DAYS_OF_WEEK.find((day) => day.value === draft.dayOfWeek)?.label ?? 'week'} at ${time}`
    : draft.kind === 'biweekly' ? `Runs every other ${DAYS_OF_WEEK.find((day) => day.value === draft.dayOfWeek)?.label ?? 'week'} at ${time}`
    : draft.kind === 'monthly' ? `Runs on day ${draft.dayOfMonth} of each month at ${time}`
    : draft.kind === 'quarterly' ? `Runs on day ${draft.dayOfMonth} every three months at ${time}`
    : `Runs on the configured custom schedule at ${time}`;
  if (range?.startDate || range?.endDate) {
    const from = range.startDate ? ` from ${formatDate(range.startDate)}` : '';
    const until = range.endDate ? ` until ${formatDate(range.endDate)}` : '';
    summary += `${from}${until}`;
  }
  return summary;
};

export const getBrowserTimezone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

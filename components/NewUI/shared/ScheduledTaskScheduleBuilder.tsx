import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronDown, IconClock, IconPlus, IconX } from '@tabler/icons-react';
import { ScheduleDateRange } from '@/types/scheduledTasks';
import {
  buildCron,
  DAYS_OF_MONTH,
  DAYS_OF_WEEK,
  EXCLUSION_DAYS,
  EXCLUSION_MONTHS,
  EXCLUSION_WEEKS,
  formatScheduleSummary,
  formatTimeValue,
  getBrowserTimezone,
  getTimezoneAbbreviation,
  HOURS,
  MINUTES,
  MONTHS,
  parseSchedule,
  parseTypedTime,
  SCHEDULE_OPTIONS,
  ScheduleDraft,
} from './scheduledTaskSchedule';

interface Exclusions {
  exclusionsEnabled: boolean;
  excludedDaysOfWeek: string[];
  excludedWeeksOfMonth: number[];
  excludedMonths: string[];
  excludedDates: string[];
}

export interface ScheduledTaskScheduleBuilderProps {
  value: string;
  onChange: (cronExpression: string) => void;
  dateRange?: ScheduleDateRange;
  onRangeChange?: (range: ScheduleDateRange) => void;
  exclusionsEnabled?: boolean;
  excludedDaysOfWeek?: string[];
  excludedWeeksOfMonth?: number[];
  excludedMonths?: string[];
  excludedDates?: string[];
  onExclusionsChange?: (exclusions: Exclusions) => void;
}

const controlClass = 'w-full h-9 rounded-[8px] border px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[--accent] focus:ring-offset-1';
const controlStyle = { backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' };
const labelClass = 'mb-1.5 block text-[13px] font-medium';
const labelStyle = { color: 'var(--text-secondary)' };

const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string }> = ({ label, id, children, className = '', ...props }) => (
  <div className="min-w-0">
    <label htmlFor={id} className={labelClass} style={labelStyle}>{label}</label>
    <div className="relative">
      <select id={id} {...props} className={`${controlClass} appearance-none pr-9 ${className}`} style={controlStyle}>{children}</select>
      <IconChevronDown aria-hidden="true" size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
    </div>
  </div>
);

const TimeCombobox: React.FC<{
  id: string;
  hour: string;
  minute: string;
  onChange: (hour: string, minute: string) => void;
  timezone: string | null;
}> = ({ id, hour, minute, onChange, timezone }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(formatTimeValue(hour, minute));
  const [highlighted, setHighlighted] = useState(`${hour}:${minute.padStart(2, '0')}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => Array.from({ length: 24 * 12 }, (_, index) => {
    const totalMinutes = index * 5;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { hour: String(h), minute: String(m), key: `${h}:${String(m).padStart(2, '0')}`, label: formatTimeValue(String(h), String(m)) };
  }), []);

  useEffect(() => setInput(formatTimeValue(hour, minute)), [hour, minute]);
  useEffect(() => {
    if (!open) return;
    const selected = listRef.current?.querySelector(`[data-time-key="${highlighted}"]`) as HTMLElement | null;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const commit = (raw: string) => {
    const parsed = parseTypedTime(raw);
    if (!parsed) { setInput(formatTimeValue(hour, minute)); return; }
    const next = options.reduce((best, option) => {
      const distance = Math.abs(Number(option.hour) * 60 + Number(option.minute) - (Number(parsed.hour) * 60 + Number(parsed.minute)));
      const bestDistance = Math.abs(Number(best.hour) * 60 + Number(best.minute) - (Number(parsed.hour) * 60 + Number(parsed.minute)));
      return distance < bestDistance ? option : best;
    });
    onChange(next.hour, next.minute);
    setInput(next.label);
    setHighlighted(next.key);
  };

  const moveHighlight = (delta: number) => {
    const index = Math.max(0, Math.min(options.length - 1, options.findIndex((option) => option.key === highlighted) + delta));
    setHighlighted(options[index].key);
  };

  return <div ref={containerRef} className="relative min-w-0">
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => { window.setTimeout(() => { if (document.activeElement !== containerRef.current?.querySelector('[role="listbox"]')) commit(input); }, 0); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); moveHighlight(1); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); moveHighlight(-1); }
          else if (event.key === 'Enter') { event.preventDefault(); const option = options.find((item) => item.key === highlighted); if (option) { onChange(option.hour, option.minute); setInput(option.label); setOpen(false); } else commit(input); }
          else if (event.key === 'Escape') { event.preventDefault(); setInput(formatTimeValue(hour, minute)); setOpen(false); }
        }}
        className={`${controlClass} pr-20`}
        style={controlStyle}
      />
      {timezone && <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{timezone}</span>}
      <IconChevronDown aria-hidden="true" size={15} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
    </div>
    {open && <div id={`${id}-listbox`} role="listbox" ref={listRef} aria-label="Available times" className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-[8px] border p-1 shadow-lg" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
      {options.map((option) => <button key={option.key} type="button" role="option" aria-selected={option.key === highlighted} data-time-key={option.key} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.hour, option.minute); setInput(option.label); setHighlighted(option.key); setOpen(false); }} className="block w-full rounded-[6px] px-3 py-1.5 text-left text-[13px] focus:outline-none focus:ring-2 focus:ring-[--accent]" style={{ backgroundColor: option.key === highlighted ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}>{option.label}</button>)}
    </div>}
  </div>;
};

const CheckRow: React.FC<{ id: string; checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }> = ({ id, checked, onChange, children }) => (
  <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
    <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded accent-[--accent]" />
    <span>{children}</span>
  </label>
);

export const ScheduledTaskScheduleBuilder: React.FC<ScheduledTaskScheduleBuilderProps> = ({
  value, onChange, dateRange, onRangeChange,
  exclusionsEnabled = false, excludedDaysOfWeek = [], excludedWeeksOfMonth = [], excludedMonths = [], excludedDates = [], onExclusionsChange,
}) => {
  const [draft, setDraft] = useState<ScheduleDraft>(() => parseSchedule(value));
  const [rangeEnabled, setRangeEnabled] = useState(Boolean(dateRange?.startDate || dateRange?.endDate));
  const [startDate, setStartDate] = useState(dateRange?.startDate ?? '');
  const [endDate, setEndDate] = useState(dateRange?.endDate ?? '');
  const [showExclusions, setShowExclusions] = useState(Boolean(exclusionsEnabled || excludedDaysOfWeek.length || excludedWeeksOfMonth.length || excludedMonths.length || excludedDates.length));
  const [excludedDateInput, setExcludedDateInput] = useState('');

  useEffect(() => {
    setDraft(parseSchedule(value));
  }, [value]);

  useEffect(() => {
    setStartDate(dateRange?.startDate ?? '');
    setEndDate(dateRange?.endDate ?? '');
  }, [dateRange]);

  useEffect(() => {
    setShowExclusions(Boolean(exclusionsEnabled || excludedDaysOfWeek.length || excludedWeeksOfMonth.length || excludedMonths.length || excludedDates.length));
  }, [exclusionsEnabled, excludedDaysOfWeek, excludedWeeksOfMonth, excludedMonths, excludedDates]);

  const timezone = useMemo(getBrowserTimezone, []);
  const timezoneAbbreviation = useMemo(getTimezoneAbbreviation, []);
  const updateDraft = (patch: Partial<ScheduleDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(buildCron(next));
  };
  const summary = formatScheduleSummary(draft, rangeEnabled ? { startDate: startDate || null, endDate: endDate || null } : undefined);

  const emitExclusions = (patch: Partial<Exclusions>) => onExclusionsChange?.({
    exclusionsEnabled: patch.exclusionsEnabled ?? showExclusions,
    excludedDaysOfWeek: patch.excludedDaysOfWeek ?? excludedDaysOfWeek,
    excludedWeeksOfMonth: patch.excludedWeeksOfMonth ?? excludedWeeksOfMonth,
    excludedMonths: patch.excludedMonths ?? excludedMonths,
    excludedDates: patch.excludedDates ?? excludedDates,
  });

  const toggleRange = (enabled: boolean) => {
    setRangeEnabled(enabled);
    if (!enabled) {
      setStartDate(''); setEndDate('');
      onRangeChange?.({ startDate: null, endDate: null });
    } else {
      onRangeChange?.({ startDate: startDate || null, endDate: endDate || null });
    }
  };

  const toggleExclusions = (enabled: boolean) => {
    setShowExclusions(enabled);
    if (enabled) emitExclusions({ exclusionsEnabled: true });
    else emitExclusions({ exclusionsEnabled: false, excludedDaysOfWeek: [], excludedWeeksOfMonth: [], excludedMonths: [], excludedDates: [] });
  };

  const addExcludedDate = () => {
    if (!excludedDateInput || excludedDates.includes(excludedDateInput)) return;
    emitExclusions({ excludedDates: [...excludedDates, excludedDateInput] });
    setExcludedDateInput('');
  };

  const updateRange = (start: string, end: string) => {
    setStartDate(start); setEndDate(end);
    onRangeChange?.({ startDate: start || null, endDate: end || null });
  };

  const currentExclusionOptions = draft.kind === 'daily' ? EXCLUSION_DAYS : draft.kind === 'weekly' || draft.kind === 'biweekly' ? EXCLUSION_WEEKS : draft.kind === 'monthly' || draft.kind === 'quarterly' ? EXCLUSION_MONTHS : [];

  return (
    <div className="space-y-5" data-new-ui-scheduled-schedule>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField id="scheduled-frequency" label="Frequency" value={draft.kind} onChange={(event) => updateDraft({ kind: event.target.value as ScheduleDraft['kind'] })}>
          {SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        {draft.kind === 'custom' ? (
          <div>
            <label htmlFor="scheduled-custom-hour" className={labelClass} style={labelStyle}>Hour</label>
            <SelectField id="scheduled-custom-hour" label="" aria-label="Hour" value={draft.customHour} onChange={(event) => updateDraft({ customHour: event.target.value })}>
              <option value="*">Every hour</option>{HOURS.map((hour) => <option key={hour.value} value={hour.value}>{hour.label}</option>)}
            </SelectField>
          </div>
        ) : (
          <div>
            <label htmlFor="scheduled-time" className={labelClass} style={labelStyle}>Time</label>
            <TimeCombobox id="scheduled-time" hour={draft.hour} minute={draft.minute} timezone={timezoneAbbreviation} onChange={(hour, minute) => updateDraft({ hour, minute })} />
          </div>
        )}
      </div>
      {draft.kind === 'custom' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField id="scheduled-custom-minute" label="Minute" value={draft.customMinute} onChange={(event) => updateDraft({ customMinute: event.target.value })}>
            <option value="*">Every minute</option>{MINUTES.map((minute) => <option key={minute.value} value={minute.value}>{minute.label}</option>)}
          </SelectField>
        </div>
      )}

      {(draft.kind === 'weekly' || draft.kind === 'biweekly' || draft.kind === 'monthly' || draft.kind === 'quarterly') && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(draft.kind === 'weekly' || draft.kind === 'biweekly') && (
            <SelectField id="scheduled-day-of-week" label="Day of week" value={draft.dayOfWeek} onChange={(event) => updateDraft({ dayOfWeek: event.target.value })}>
              {DAYS_OF_WEEK.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </SelectField>
          )}
          {(draft.kind === 'monthly' || draft.kind === 'quarterly') && (
            <SelectField id="scheduled-day-of-month" label="Day of month" value={draft.dayOfMonth} onChange={(event) => updateDraft({ dayOfMonth: event.target.value })}>
              {DAYS_OF_MONTH.map((day) => <option key={day} value={day}>{day}</option>)}
            </SelectField>
          )}
        </div>
      )}

      {draft.kind === 'biweekly' && (
        <div>
          <label htmlFor="scheduled-biweekly-start" className={labelClass} style={labelStyle}>Starting date</label>
          <input id="scheduled-biweekly-start" type="date" value={draft.biweeklyStartDate} onChange={(event) => updateDraft({ biweeklyStartDate: event.target.value })} className={controlClass} style={controlStyle} />
          {!draft.biweeklyStartDate && <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>Choose an anchor date to determine alternating weeks.</p>}
        </div>
      )}

      {draft.kind === 'custom' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField id="scheduled-custom-day-week" label="Day of week" value={draft.customDayOfWeek} onChange={(event) => updateDraft({ customDayOfWeek: event.target.value, customDayOfMonth: event.target.value === '*' ? draft.customDayOfMonth : '*' })}>
            <option value="*">Every day</option>{DAYS_OF_WEEK.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </SelectField>
          <SelectField id="scheduled-custom-month" label="Month" value={draft.customMonth} onChange={(event) => updateDraft({ customMonth: event.target.value })}>
            <option value="*">Every month</option>{MONTHS.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}
          </SelectField>
          <SelectField id="scheduled-custom-day-month" label="Day of month" value={draft.customDayOfMonth} onChange={(event) => updateDraft({ customDayOfMonth: event.target.value, customDayOfWeek: event.target.value === '*' ? draft.customDayOfWeek : '*' })}>
            <option value="*">Every day</option>{DAYS_OF_MONTH.map((day) => <option key={day} value={day}>{day}</option>)}
          </SelectField>
        </div>
      )}

      <div className="space-y-3 pt-1">
        <CheckRow id="scheduled-date-range" checked={rangeEnabled} onChange={toggleRange}>Set a date range</CheckRow>
        {rangeEnabled && (
          <div className="grid grid-cols-1 gap-3 pl-6 sm:grid-cols-2">
            <div><label htmlFor="scheduled-start-date" className={labelClass} style={labelStyle}>Start date</label><input id="scheduled-start-date" type="date" value={startDate} onChange={(event) => updateRange(event.target.value, endDate)} className={controlClass} style={controlStyle} /></div>
            <div><label htmlFor="scheduled-end-date" className={labelClass} style={labelStyle}>End date</label><input id="scheduled-end-date" type="date" min={startDate || undefined} value={endDate} onChange={(event) => updateRange(startDate, event.target.value)} className={controlClass} style={controlStyle} /></div>
          </div>
        )}
        <CheckRow id="scheduled-exclusions" checked={showExclusions} onChange={toggleExclusions}>Skip selected runs</CheckRow>
        {showExclusions && (
          <div className="space-y-3 pl-6">
            {currentExclusionOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentExclusionOptions.map(([key, label]) => {
                  const numeric = typeof key === 'number';
                  const selected = numeric ? excludedWeeksOfMonth.includes(key) : draft.kind === 'daily' ? excludedDaysOfWeek.includes(key) : excludedMonths.includes(key);
                  return <button key={String(key)} type="button" aria-pressed={selected} onClick={() => numeric ? emitExclusions({ excludedWeeksOfMonth: selected ? excludedWeeksOfMonth.filter((item) => item !== key) : [...excludedWeeksOfMonth, key] }) : draft.kind === 'daily' ? emitExclusions({ excludedDaysOfWeek: selected ? excludedDaysOfWeek.filter((item) => item !== key) : [...excludedDaysOfWeek, key] }) : emitExclusions({ excludedMonths: selected ? excludedMonths.filter((item) => item !== key) : [...excludedMonths, key] })} className="rounded-full border px-2.5 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-[--accent]" style={{ backgroundColor: selected ? 'var(--bg-active)' : 'transparent', borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{label}</button>;
                })}
              </div>
            )}
            <div>
              <label htmlFor="scheduled-excluded-date" className={labelClass} style={labelStyle}>Specific dates</label>
              <div className="flex gap-2"><input id="scheduled-excluded-date" type="date" value={excludedDateInput} onChange={(event) => setExcludedDateInput(event.target.value)} className={controlClass} style={controlStyle} /><button type="button" aria-label="Add excluded date" onClick={addExcludedDate} className="flex h-9 items-center gap-1 rounded-[8px] border px-3 text-[13px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}><IconPlus size={14} />Add</button></div>
              {excludedDates.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{excludedDates.map((date) => <span key={date} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[12px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{date}<button type="button" aria-label={`Remove excluded date ${date}`} onClick={() => emitExclusions({ excludedDates: excludedDates.filter((item) => item !== date) })}><IconX size={12} /></button></span>)}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[12.5px]" aria-live="polite" style={{ color: 'var(--text-muted)' }}>
        <IconClock size={14} aria-hidden="true" />
        <span>{summary}{timezoneAbbreviation ? ` ${timezoneAbbreviation}` : ''}</span>
        {timezone && <span className="sr-only">Timezone: {timezone}</span>}
      </div>
    </div>
  );
};

export default ScheduledTaskScheduleBuilder;

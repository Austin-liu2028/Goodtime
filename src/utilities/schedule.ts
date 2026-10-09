import type { EventDetails } from '../types/event';
import { addDays, daysBetween, formatDate } from './date';

// A fixed Sunday-to-Saturday week lets weekly responses use the same slot keys as dated polls.
// Its calendar dates are never shown to people or used as actual meeting dates.
export const WEEK_REFERENCE_SUNDAY = '2026-01-04';
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const weekdayReferenceDate = (day: number) => addDays(WEEK_REFERENCE_SUNDAY, day);
export const referenceWeekday = (date: string) => ((daysBetween(WEEK_REFERENCE_SUNDAY, date) % 7) + 7) % 7;
export const isWeekly = (event: Pick<EventDetails, 'scheduleMode'>) => event.scheduleMode === 'weekdays';

export const formatScheduleDay = (event: Pick<EventDetails, 'scheduleMode'>, date: string, short = false) =>
  isWeekly(event)
    ? (short ? WEEKDAY_SHORT_NAMES : WEEKDAY_NAMES)[referenceWeekday(date)]
    : formatDate(date, short
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'long', month: 'long', day: 'numeric' });

export const getScheduleSummary = (event: Pick<EventDetails, 'scheduleMode' | 'weekdays' | 'startDate' | 'endDate' | 'excludedDates' | 'dateSelectionMode'>) => {
  if (isWeekly(event)) {
    const days = (event.weekdays ?? []).slice().sort((a, b) => a - b).map((day) => WEEKDAY_SHORT_NAMES[day]).filter(Boolean);
    return `Every ${days.join(', ')}`;
  }
  const start = formatDate(event.startDate, { month: 'short', day: 'numeric' });
  const end = formatDate(event.endDate, { month: 'short', day: 'numeric' });
  const range = event.startDate === event.endDate ? start : `${start} – ${end}`;
  const skipped = (event.excludedDates ?? []).filter((date) => date > event.startDate && date < event.endDate).length;
  if (event.dateSelectionMode === 'multiple') {
    const count = daysBetween(event.startDate, event.endDate) + 1 - skipped;
    return count === 1 ? range : `${count} selected dates · ${range}`;
  }
  return skipped ? `${range} · ${skipped} skipped` : range;
};

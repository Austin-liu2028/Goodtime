import type { EventDetails } from '../types/event';
import { addDays, daysBetween } from './date';
import { isWeekly, weekdayReferenceDate } from './schedule';

type EventDateRange = Pick<EventDetails, 'scheduleMode' | 'weekdays' | 'startDate' | 'endDate' | 'excludedDates'>;

export const isEventDate = (event: EventDateRange, date: string) =>
  isWeekly(event)
    ? (event.weekdays ?? []).some((day) => weekdayReferenceDate(day) === date)
    : Boolean(event.startDate && event.endDate) && date >= event.startDate && date <= event.endDate && !(event.excludedDates ?? []).includes(date);

export const getEventDates = (event: EventDateRange) =>
  isWeekly(event)
    ? (event.weekdays ?? []).slice().sort((a, b) => a - b).map(weekdayReferenceDate)
    : !event.startDate || !event.endDate ? [] : Array.from({ length: Math.max(0, daysBetween(event.startDate, event.endDate) + 1) },
      (_, index) => addDays(event.startDate, index)).filter((date) => isEventDate(event, date));

// Keep the existing range-based event format while allowing any set of dates to be selected.
export const toDateSelection = (dates: string[]) => {
  const sorted = Array.from(new Set(dates)).sort();
  if (sorted.length === 0) return { startDate: '', endDate: '', excludedDates: [] as string[] };
  const [startDate] = sorted;
  const endDate = sorted[sorted.length - 1];
  const included = new Set(sorted);
  const excludedDates = Array.from({ length: daysBetween(startDate, endDate) + 1 },
    (_, index) => addDays(startDate, index)).filter((date) => !included.has(date));
  return { startDate, endDate, excludedDates };
};

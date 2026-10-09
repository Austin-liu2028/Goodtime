import type { ConfirmedTime, EventDetails } from '../types/event';
import { zonedTimeToUtc } from './calendar';
import { getSlotKey } from './availability';
import { addDays, formatDate, parseDateValue } from './date';
import { referenceWeekday, weekdayReferenceDate } from './schedule';
import { formatTime, formatTimeRange } from './time';
import { getTimeZoneName } from './timeZones';

export interface ZonedSlot {
  date: string;
  minutes: number;
}

// A real instant's wall-clock date and time in the chosen display zone.
export const getZonedSlot = (instant: Date, timeZone: string): ZonedSlot => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  };
};

export const convertSlot = (date: string, minutes: number, fromZone: string, toZone: string) =>
  getZonedSlot(zonedTimeToUtc(date, minutes, fromZone), toZone);

// Weekly polls use abstract dates for storage. Resolve them against an actual week before
// converting zones, so the current daylight-saving rules are applied.
export const getWeeklySourceDate = (referenceDate: string, timeZone: string, now = new Date()) => {
  const today = getZonedSlot(now, timeZone).date;
  return addDays(today, referenceWeekday(referenceDate) - parseDateValue(today).getDay());
};

const getNextWeeklySourceDate = (confirmed: ConfirmedTime, timeZone: string, now: Date) => {
  const candidate = getWeeklySourceDate(confirmed.date, timeZone, now);
  return zonedTimeToUtc(candidate, confirmed.start, timeZone) <= now ? addDays(candidate, 7) : candidate;
};

interface MeetingDisplayInput {
  confirmedTime: ConfirmedTime;
  scheduleMode?: EventDetails['scheduleMode'];
  eventTimeZone: string;
  displayTimeZone: string;
  weeklyLabel?: 'recurring' | 'next';
}

export const getMeetingTimeText = ({ confirmedTime, scheduleMode, eventTimeZone, displayTimeZone, weeklyLabel = 'recurring' }: MeetingDisplayInput, now = new Date()) => {
  const isWeekly = scheduleMode === 'weekdays';
  const sourceDate = isWeekly ? getNextWeeklySourceDate(confirmedTime, eventTimeZone, now) : confirmedTime.date;
  const start = convertSlot(sourceDate, confirmedTime.start, eventTimeZone, displayTimeZone);
  const end = convertSlot(sourceDate, confirmedTime.end, eventTimeZone, displayTimeZone);
  const shortDay = formatDate(start.date, { weekday: 'short', month: 'short', day: 'numeric' });
  const longDay = formatDate(start.date, { weekday: 'long', month: 'long', day: 'numeric' });
  const shortDate = isWeekly && weeklyLabel === 'recurring' ? `every ${formatDate(start.date, { weekday: 'short' })}` : shortDay;
  const longDate = isWeekly && weeklyLabel === 'recurring' ? `every ${formatDate(start.date, { weekday: 'long' })}` : longDay;
  const endDay = isWeekly
    ? formatDate(end.date, { weekday: 'short' })
    : formatDate(end.date, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeRange = start.date === end.date
    ? formatTimeRange(start.minutes, end.minutes)
    : `${formatTime(start.minutes)} – ${endDay} ${formatTime(end.minutes)}`;
  const zone = getTimeZoneName(displayTimeZone);
  return {
    shortDate,
    longDate,
    timeRange,
    zone,
    subjectTime: `${shortDate}, ${timeRange} (${zone})`,
    bodyTime: `${longDate}, ${timeRange} (${zone})`,
  };
};

export interface GridProjection {
  dates: string[];
  timeSlots: number[];
  // A local grid cell can represent two instants during a fall-back clock change.
  canonicalSlotsByDisplay: Map<string, string[]>;
}

export const projectGrid = (
  event: Pick<EventDetails, 'scheduleMode' | 'timeZone'>,
  canonicalDates: string[],
  canonicalMinutes: number[],
  displayTimeZone: string,
  now = new Date(),
): GridProjection => {
  const dateSet = new Set<string>();
  const minuteSet = new Set<number>();
  const canonicalSlotsByDisplay = new Map<string, string[]>();
  canonicalDates.forEach((canonicalDate) => {
    const sourceDate = event.scheduleMode === 'weekdays'
      ? getWeeklySourceDate(canonicalDate, event.timeZone, now)
      : canonicalDate;
    canonicalMinutes.forEach((minutes) => {
      const local = convertSlot(sourceDate, minutes, event.timeZone, displayTimeZone);
      const displayDate = event.scheduleMode === 'weekdays'
        ? weekdayReferenceDate(parseDateValue(local.date).getDay())
        : local.date;
      const displayKey = getSlotKey(displayDate, local.minutes);
      dateSet.add(displayDate);
      minuteSet.add(local.minutes);
      canonicalSlotsByDisplay.set(displayKey, [
        ...(canonicalSlotsByDisplay.get(displayKey) ?? []),
        getSlotKey(canonicalDate, minutes),
      ]);
    });
  });
  return {
    dates: [...dateSet].sort(),
    timeSlots: [...minuteSet].sort((a, b) => a - b),
    canonicalSlotsByDisplay,
  };
};

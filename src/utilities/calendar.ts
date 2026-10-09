import type { ConfirmedTime } from '../types/event';
import { addDays, parseDateValue, twoDigits } from './date';
import { referenceWeekday, WEEKDAY_SHORT_NAMES } from './schedule';

// Calendar export for a confirmed meeting. Times are stored as wall-clock time in the event's
// zone, so they are converted to UTC here; every calendar then shows them in the viewer's zone.

interface CalendarEntry {
  title: string;
  description: string;
  location: string;
  timeZone: string;
  confirmedTime: ConfirmedTime;
  scheduleMode?: 'dates' | 'weekdays';
  link: string;
  code: string;
}

// How far `timeZone` is ahead of UTC at the given instant, in milliseconds.
const getZoneOffset = (instant: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return asUtc - instant;
};

// The instant when it is `minutes` past midnight on `date` in `timeZone`.
export const zonedTimeToUtc = (date: string, minutes: number, timeZone: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, 0, minutes);
  // Second pass corrects for a DST change between the guess and the real instant.
  const firstGuess = wallClock - getZoneOffset(wallClock, timeZone);
  return new Date(wallClock - getZoneOffset(firstGuess, timeZone));
};

const toUtcStamp = (date: Date) =>
  `${date.getUTCFullYear()}${twoDigits(date.getUTCMonth() + 1)}${twoDigits(date.getUTCDate())}` +
  `T${twoDigits(date.getUTCHours())}${twoDigits(date.getUTCMinutes())}${twoDigits(date.getUTCSeconds())}Z`;

const toLocalStamp = (date: string, minutes: number) => {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 0, minutes));
  return `${value.getUTCFullYear()}${twoDigits(value.getUTCMonth() + 1)}${twoDigits(value.getUTCDate())}` +
    `T${twoDigits(value.getUTCHours())}${twoDigits(value.getUTCMinutes())}${twoDigits(value.getUTCSeconds())}`;
};

// First future occurrence of an abstract weekday in the event's own time zone.
const getNextWeeklyDate = ({ confirmedTime, timeZone }: CalendarEntry, now: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const today = `${value('year')}-${value('month')}-${value('day')}`;
  const daysAhead = (referenceWeekday(confirmedTime.date) - parseDateValue(today).getDay() + 7) % 7;
  const candidate = addDays(today, daysAhead);
  return daysAhead === 0 && zonedTimeToUtc(candidate, confirmedTime.start, timeZone) <= now
    ? addDays(candidate, 7)
    : candidate;
};

const getStampRange = ({ confirmedTime, timeZone }: CalendarEntry) => [
  toUtcStamp(zonedTimeToUtc(confirmedTime.date, confirmedTime.start, timeZone)),
  toUtcStamp(zonedTimeToUtc(confirmedTime.date, confirmedTime.end, timeZone)),
];

const getDetails = (entry: CalendarEntry) =>
  [entry.description, `Event page: ${entry.link}`].filter(Boolean).join('\n\n');

export const getGoogleCalendarUrl = (entry: CalendarEntry) => {
  const [start, end] = getStampRange(entry);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: entry.title,
    dates: `${start}/${end}`,
    details: getDetails(entry),
  });
  if (entry.location) params.set('location', entry.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// RFC 5545 text: escape backslashes, separators and newlines.
const escapeIcsText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export const buildIcsFile = (entry: CalendarEntry, now = new Date()) => {
  const isRecurring = entry.scheduleMode === 'weekdays';
  const [start, end] = isRecurring ? ['', ''] : getStampRange(entry);
  const nextDate = isRecurring ? getNextWeeklyDate(entry, now) : '';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Goodtime//Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(isRecurring ? [`X-WR-TIMEZONE:${entry.timeZone}`] : []),
    'BEGIN:VEVENT',
    `UID:${entry.code}-${isRecurring ? entry.confirmedTime.date : start}@goodtime`,
    `DTSTAMP:${toUtcStamp(now)}`,
    isRecurring ? `DTSTART;TZID=${entry.timeZone}:${toLocalStamp(nextDate, entry.confirmedTime.start)}` : `DTSTART:${start}`,
    isRecurring ? `DTEND;TZID=${entry.timeZone}:${toLocalStamp(nextDate, entry.confirmedTime.end)}` : `DTEND:${end}`,
    ...(isRecurring ? [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAY_SHORT_NAMES[referenceWeekday(entry.confirmedTime.date)].slice(0, 2).toUpperCase()}`] : []),
    `SUMMARY:${escapeIcsText(entry.title)}`,
    `DESCRIPTION:${escapeIcsText(getDetails(entry))}`,
    ...(entry.location ? [`LOCATION:${escapeIcsText(entry.location)}`] : []),
    `URL:${entry.link}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
};

export const RETENTION_DAYS = 7;
export const WEEKLY_RETENTION_DAYS = 365;

// Weekly polls have no last date, so their link and saved responses expire one year after creation.
export const getWeeklyEventExpiry = (createdAt: string) =>
  new Date(new Date(createdAt).getTime() + WEEKLY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

// When an event and everything attached to it is deleted: a week after its last day ends,
// in the event's own time zone.
export const getEventExpiry = (endDate: string, timeZone: string) =>
  new Date(zonedTimeToUtc(endDate, 24 * 60, timeZone).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

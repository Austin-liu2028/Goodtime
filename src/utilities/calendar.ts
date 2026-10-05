import type { ConfirmedTime } from '../types/event';
import { twoDigits } from './date';

// Calendar export for a confirmed meeting. Times are stored as wall-clock time in the event's
// zone, so they are converted to UTC here; every calendar then shows them in the viewer's zone.

interface CalendarEntry {
  title: string;
  description: string;
  location: string;
  timeZone: string;
  confirmedTime: ConfirmedTime;
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
  const [start, end] = getStampRange(entry);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Goodtime//Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${entry.code}-${start}@goodtime`,
    `DTSTAMP:${toUtcStamp(now)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(entry.title)}`,
    `DESCRIPTION:${escapeIcsText(getDetails(entry))}`,
    ...(entry.location ? [`LOCATION:${escapeIcsText(entry.location)}`] : []),
    `URL:${entry.link}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
};

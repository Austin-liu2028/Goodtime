import { describe, expect, it } from 'vitest';
import { buildIcsFile, getEventExpiry, getGoogleCalendarUrl, getWeeklyEventExpiry, zonedTimeToUtc } from './calendar';

const entry = {
  title: 'Design review, round 2',
  description: 'Bring notes',
  location: 'Mudd 3514',
  timeZone: 'America/Chicago',
  confirmedTime: { date: '2026-10-06', start: 600, end: 660 },
  link: 'https://goodtime.example/e/K7MQ2P',
  code: 'K7MQ2P',
};

describe('zonedTimeToUtc', () => {
  it('converts wall-clock time in a zone to the right instant, across daylight saving', () => {
    expect(zonedTimeToUtc('2026-10-06', 600, 'America/Chicago').toISOString()).toBe('2026-10-06T15:00:00.000Z');
    expect(zonedTimeToUtc('2026-12-01', 600, 'America/Chicago').toISOString()).toBe('2026-12-01T16:00:00.000Z');
    expect(zonedTimeToUtc('2026-10-06', 600, 'Asia/Shanghai').toISOString()).toBe('2026-10-06T02:00:00.000Z');
  });
});

describe('calendar export', () => {
  it('builds a Google Calendar link in UTC', () => {
    const url = new URL(getGoogleCalendarUrl(entry));
    expect(url.searchParams.get('text')).toBe('Design review, round 2');
    expect(url.searchParams.get('dates')).toBe('20261006T150000Z/20261006T160000Z');
    expect(url.searchParams.get('location')).toBe('Mudd 3514');
  });

  it('builds an .ics file with escaped text', () => {
    const ics = buildIcsFile(entry, new Date('2026-10-05T12:00:00Z'));
    expect(ics).toContain('DTSTART:20261006T150000Z\r\n');
    expect(ics).toContain('DTEND:20261006T160000Z\r\n');
    expect(ics).toContain('SUMMARY:Design review\\, round 2\r\n');
    expect(ics).toContain('DESCRIPTION:Bring notes\\n\\nEvent page: https://goodtime.example/e/K7MQ2P\r\n');
  });

  it('exports a weekly local-time recurrence beginning with the next occurrence', () => {
    const weekly = buildIcsFile({
      ...entry,
      scheduleMode: 'weekdays',
      confirmedTime: { date: '2026-01-05', start: 600, end: 660 },
    }, new Date('2026-10-05T16:00:00Z'));
    expect(weekly).toContain('DTSTART;TZID=America/Chicago:20261012T100000\r\n');
    expect(weekly).toContain('DTEND;TZID=America/Chicago:20261012T110000\r\n');
    expect(weekly).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO\r\n');
    expect(weekly).not.toContain('20260105T100000');
  });
});

describe('getEventExpiry', () => {
  it('is a week after the last day ends, in the event’s zone', () => {
    expect(getEventExpiry('2026-10-09', 'America/Chicago')).toBe('2026-10-17T05:00:00.000Z');
    expect(getEventExpiry('2026-10-09', 'Asia/Shanghai')).toBe('2026-10-16T16:00:00.000Z');
  });

  it('keeps a weekly poll for one year after creation', () => {
    expect(getWeeklyEventExpiry('2026-10-05T12:00:00.000Z')).toBe('2027-10-05T12:00:00.000Z');
  });
});

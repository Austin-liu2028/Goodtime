import { describe, expect, it } from 'vitest';
import { buildConfirmationEmail, buildRecipientDraft } from './email';
import { convertSlot, getMeetingTimeText, projectGrid } from './zonedSchedule';

describe('participant time zones', () => {
  it('converts the same instant across zones, dates and daylight saving', () => {
    expect(convertSlot('2026-10-07', 1200, 'UTC', 'America/New_York'))
      .toEqual({ date: '2026-10-07', minutes: 960 });
    expect(convertSlot('2026-12-07', 1200, 'UTC', 'America/New_York'))
      .toEqual({ date: '2026-12-07', minutes: 900 });
    expect(convertSlot('2026-10-07', 30, 'UTC', 'America/Los_Angeles'))
      .toEqual({ date: '2026-10-06', minutes: 1050 });
  });

  it('projects local grid cells back to the event-zone response keys', () => {
    const grid = projectGrid(
      { scheduleMode: 'dates', timeZone: 'America/Chicago' },
      ['2026-10-07'], [540, 555, 570], 'America/New_York',
    );
    expect(grid.dates).toEqual(['2026-10-07']);
    expect(grid.timeSlots).toEqual([600, 615, 630]);
    expect(grid.canonicalSlotsByDisplay.get('2026-10-07|600')).toEqual(['2026-10-07|540']);
  });

  it('uses actual dates for weekly conversions near a daylight saving change', () => {
    const confirmedTime = { date: '2026-01-05', start: 600, end: 660 };
    const input = { confirmedTime, scheduleMode: 'weekdays' as const,
      eventTimeZone: 'America/Chicago', displayTimeZone: 'Europe/London' };
    expect(getMeetingTimeText(input, new Date('2026-03-02T12:00:00Z')).timeRange).toBe('4:00 – 5:00 PM');
    expect(getMeetingTimeText(input, new Date('2026-03-16T12:00:00Z')).timeRange).toBe('3:00 – 4:00 PM');
  });

  it('writes each recipient one local time and falls back to the event zone', () => {
    const input = {
      title: 'Team sync', description: '', location: '', timeZone: 'America/Chicago',
      confirmedTime: { date: '2026-10-07', start: 540, end: 600 },
      organizerName: '', eventLink: 'https://goodtime.example/e/ABC123',
    };
    const template = buildConfirmationEmail(input);
    const eastern = buildRecipientDraft(input, { name: 'Alex', email: 'alex@example.com', timeZone: 'America/New_York' }, template);
    const fallback = buildRecipientDraft(input, { name: 'Sam', email: 'sam@example.com' }, template);
    expect(eastern.body).toContain('10:00 – 11:00 AM (Eastern Time)');
    expect(eastern.body).not.toContain('Central Time');
    expect(eastern.subject).toContain('Eastern Time');
    expect(fallback.body).toContain('9:00 – 10:00 AM (Central Time)');
  });
});

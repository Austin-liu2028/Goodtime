import { describe, expect, it } from 'vitest';
import { getEventDates, isEventDate, toDateSelection } from './eventDates';
import { getScheduleSummary, weekdayReferenceDate } from './schedule';

describe('event days', () => {
  it('keeps the range endpoints and omits skipped middle dates', () => {
    const event = {
      scheduleMode: 'dates' as const,
      startDate: '2026-10-05',
      endDate: '2026-10-09',
      excludedDates: ['2026-10-07'],
    };
    expect(getEventDates(event)).toEqual(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09']);
    expect(isEventDate(event, '2026-10-07')).toBe(false);
    expect(getScheduleSummary(event)).toContain('1 skipped');
  });

  it('uses selected weekdays as recurring days independent of calendar dates', () => {
    const event = {
      scheduleMode: 'weekdays' as const,
      weekdays: [5, 1],
      startDate: '2026-01-04',
      endDate: '2026-01-10',
    };
    expect(getEventDates(event)).toEqual([weekdayReferenceDate(1), weekdayReferenceDate(5)]);
    expect(isEventDate(event, weekdayReferenceDate(2))).toBe(false);
    expect(getScheduleSummary(event)).toBe('Every Mon, Fri');
  });

  it('encodes independently chosen dates without adding the days between them', () => {
    const selection = toDateSelection(['2026-10-20', '2026-10-08', '2026-10-15', '2026-10-15']);
    expect(selection.startDate).toBe('2026-10-08');
    expect(selection.endDate).toBe('2026-10-20');
    expect(getEventDates(selection)).toEqual(['2026-10-08', '2026-10-15', '2026-10-20']);
    expect(getScheduleSummary({ ...selection, dateSelectionMode: 'multiple' })).toBe('3 selected dates · Oct 8 – Oct 20');
    expect(toDateSelection([])).toEqual({ startDate: '', endDate: '', excludedDates: [] });
  });
});

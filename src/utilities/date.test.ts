import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, getMonthDays } from './date';

describe('date utilities', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between two dates', () => {
    expect(daysBetween('2026-10-02', '2026-10-08')).toBe(6);
    expect(daysBetween('2026-10-02', '2026-10-02')).toBe(0);
  });

  it('moves between months', () => {
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
  });

  it('pads the month grid so the 1st lands on its weekday', () => {
    // October 1, 2026 is a Thursday.
    const days = getMonthDays('2026-10-01');
    expect(days.slice(0, 4)).toEqual([null, null, null, null]);
    expect(days[4]).toBe('2026-10-01');
    expect(days[days.length - 1]).toBe('2026-10-31');
  });
});

import { describe, expect, it } from 'vitest';
import { formatDuration, formatTimeRange } from './time';

describe('formatDuration', () => {
  it('reads in minutes, hours, or both', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(120)).toBe('2 hr');
    expect(formatDuration(90)).toBe('1 hr 30 min');
  });
});

describe('formatTimeRange', () => {
  it('drops the first AM/PM only when both ends share it', () => {
    expect(formatTimeRange(600, 660)).toBe('10:00 – 11:00 AM');
    expect(formatTimeRange(660, 780)).toBe('11:00 AM – 1:00 PM');
    expect(formatTimeRange(1380, 1440)).toBe('11:00 PM – 12:00 AM');
  });
});

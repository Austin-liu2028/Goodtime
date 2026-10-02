import { describe, expect, it } from 'vitest';
import {
  applySelection,
  getAvailabilityRanges,
  getBestRanges,
  getEveryoneAvailableRanges,
  getRectangleSlotKeys,
} from './availability';

describe('getRectangleSlotKeys', () => {
  const dates = ['2026-10-05', '2026-10-06', '2026-10-07'];
  const timeSlots = [540, 570, 600];

  it('covers every slot between two corners', () => {
    expect(getRectangleSlotKeys(
      dates,
      timeSlots,
      { date: '2026-10-05', minutes: 540 },
      { date: '2026-10-06', minutes: 570 },
    )).toEqual(['2026-10-05|540', '2026-10-05|570', '2026-10-06|540', '2026-10-06|570']);
  });

  it('works when dragging up and to the left', () => {
    expect(getRectangleSlotKeys(
      dates,
      timeSlots,
      { date: '2026-10-07', minutes: 600 },
      { date: '2026-10-06', minutes: 570 },
    )).toEqual(['2026-10-06|570', '2026-10-06|600', '2026-10-07|570', '2026-10-07|600']);
  });
});

describe('applySelection', () => {
  it('adds or removes slots without changing the original set', () => {
    const slots = new Set(['a', 'b']);
    expect(applySelection(slots, ['b', 'c'], 'add')).toEqual(new Set(['a', 'b', 'c']));
    expect(applySelection(slots, ['b', 'c'], 'remove')).toEqual(new Set(['a']));
    expect(slots).toEqual(new Set(['a', 'b']));
  });
});

const AB = ['Alex', 'Sam'];
const ABC = ['Alex', 'Jordan', 'Sam'];

describe('getEveryoneAvailableRanges', () => {
  it('returns nothing when no one has responded', () => {
    expect(getEveryoneAvailableRanges(new Map([['2026-10-05|540', ['Alex']]]), 0, 30)).toEqual([]);
  });

  it('keeps only slots every respondent picked', () => {
    const namesBySlot = new Map([
      ['2026-10-05|540', AB],
      ['2026-10-05|570', ['Alex']],
    ]);
    expect(getEveryoneAvailableRanges(namesBySlot, 2, 30)).toEqual([
      { date: '2026-10-05', ranges: [{ start: 540, end: 570 }] },
    ]);
  });

  it('merges back-to-back slots and splits at gaps', () => {
    const namesBySlot = new Map([
      ['2026-10-05|600', ABC],
      ['2026-10-05|540', ABC],
      ['2026-10-05|570', ABC],
      ['2026-10-05|720', ABC],
    ]);
    expect(getEveryoneAvailableRanges(namesBySlot, 3, 30)).toEqual([
      {
        date: '2026-10-05',
        ranges: [
          { start: 540, end: 630 },
          { start: 720, end: 750 },
        ],
      },
    ]);
  });

  it('groups ranges by day in date order', () => {
    const namesBySlot = new Map([
      ['2026-10-07|540', ['Alex']],
      ['2026-10-05|600', ['Alex']],
    ]);
    expect(getEveryoneAvailableRanges(namesBySlot, 1, 30).map(({ date }) => date)).toEqual([
      '2026-10-05',
      '2026-10-07',
    ]);
  });
});

describe('getAvailabilityRanges', () => {
  it('splits a run when a different set of people is free', () => {
    const namesBySlot = new Map([
      ['2026-10-05|540', ['Sam', 'Alex']],
      ['2026-10-05|570', ['Alex', 'Sam']],
      ['2026-10-05|600', ['Alex', 'Jordan']],
    ]);
    expect(getAvailabilityRanges(namesBySlot, 30)).toEqual([
      { date: '2026-10-05', start: 540, end: 600, names: AB },
      { date: '2026-10-05', start: 600, end: 630, names: ['Alex', 'Jordan'] },
    ]);
  });

  it('never merges across days', () => {
    const namesBySlot = new Map([
      ['2026-10-05|1410', ['Alex']],
      ['2026-10-06|0', ['Alex']],
    ]);
    expect(getAvailabilityRanges(namesBySlot, 30)).toHaveLength(2);
  });
});

describe('getBestRanges', () => {
  it('returns the ranges with the most people, longest first, up to the limit', () => {
    const namesBySlot = new Map([
      ['2026-10-05|540', AB],
      ['2026-10-06|540', AB],
      ['2026-10-06|570', AB],
      ['2026-10-07|540', AB],
      ['2026-10-08|540', ['Alex']],
    ]);
    expect(getBestRanges(namesBySlot, 30, 2)).toEqual([
      { date: '2026-10-06', start: 540, end: 600, names: AB },
      { date: '2026-10-05', start: 540, end: 570, names: AB },
    ]);
  });

  it('returns nothing when no one picked any time', () => {
    expect(getBestRanges(new Map(), 30, 3)).toEqual([]);
  });
});

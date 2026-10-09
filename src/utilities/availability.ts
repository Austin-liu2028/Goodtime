export interface TimeRange {
  start: number;
  end: number;
}

export interface DayRanges {
  date: string;
  ranges: TimeRange[];
}

export interface SlotPosition {
  date: string;
  minutes: number;
}

export type SelectionMode = 'add' | 'remove';

export const getSlotKey = (date: string, minutes: number) => `${date}|${minutes}`;

// Slot keys inside the rectangle spanned by two corners of the grid, in either drag direction.
export const getRectangleSlotKeys = (
  dates: string[],
  timeSlots: number[],
  from: SlotPosition,
  to: SlotPosition,
) => {
  const [firstDate, lastDate] = from.date <= to.date ? [from.date, to.date] : [to.date, from.date];
  const firstMinutes = Math.min(from.minutes, to.minutes);
  const lastMinutes = Math.max(from.minutes, to.minutes);
  const slotKeys: string[] = [];
  dates
    .filter((date) => date >= firstDate && date <= lastDate)
    .forEach((date) => timeSlots
      .filter((minutes) => minutes >= firstMinutes && minutes <= lastMinutes)
      .forEach((minutes) => slotKeys.push(getSlotKey(date, minutes))));
  return slotKeys;
};

export const applySelection = (slots: Set<string>, slotKeys: string[], mode: SelectionMode) => {
  const nextSlots = new Set(slots);
  slotKeys.forEach((slotKey) => {
    if (mode === 'add') nextSlots.add(slotKey);
    else nextSlots.delete(slotKey);
  });
  return nextSlots;
};

export interface AvailabilityRange extends TimeRange {
  date: string;
  names: string[];
}

// Merges back-to-back slots on the same day when exactly the same people are free in both.
export const getAvailabilityRanges = (
  namesBySlot: Map<string, string[]>,
  slotLength: number,
): AvailabilityRange[] => {
  const slots = Array.from(namesBySlot.entries())
    .filter(([, names]) => names.length > 0)
    .map(([slotKey, names]) => {
      const [date, minutes] = slotKey.split('|');
      return { date, minutes: Number(minutes), names: [...names].sort() };
    })
    .sort((first, second) => first.date.localeCompare(second.date) || first.minutes - second.minutes);

  const ranges: AvailabilityRange[] = [];
  slots.forEach(({ date, minutes, names }) => {
    const lastRange = ranges[ranges.length - 1];
    if (
      lastRange &&
      lastRange.date === date &&
      lastRange.end === minutes &&
      lastRange.names.join('\n') === names.join('\n')
    ) {
      lastRange.end = minutes + slotLength;
    } else {
      ranges.push({ date, start: minutes, end: minutes + slotLength, names });
    }
  });
  return ranges;
};

// Every range all respondents can make, grouped by day.
export const getEveryoneAvailableRanges = (
  namesBySlot: Map<string, string[]>,
  responseCount: number,
  slotLength: number,
): DayRanges[] => {
  if (responseCount === 0) return [];
  const days: DayRanges[] = [];
  getAvailabilityRanges(namesBySlot, slotLength)
    .filter(({ names }) => names.length === responseCount)
    .forEach(({ date, start, end }) => {
      const lastDay = days[days.length - 1];
      if (lastDay && lastDay.date === date) lastDay.ranges.push({ start, end });
      else days.push({ date, ranges: [{ start, end }] });
    });
  return days;
};

// Ranges with the most people free, longest first, so the top pick is the easiest to schedule.
export const getBestRanges = (
  namesBySlot: Map<string, string[]>,
  slotLength: number,
  limit: number,
) => {
  const ranges = getAvailabilityRanges(namesBySlot, slotLength);
  const highestCount = Math.max(0, ...ranges.map(({ names }) => names.length));
  return ranges
    .filter(({ names }) => highestCount > 0 && names.length === highestCount)
    .sort((first, second) =>
      (second.end - second.start) - (first.end - first.start) ||
      first.date.localeCompare(second.date) ||
      first.start - second.start)
    .slice(0, limit);
};

// Candidate meeting times, best first: most people free, then the longest window, then the
// earliest. This is the order the summary recommends them in.
export const getMeetingOptions = (
  namesBySlot: Map<string, string[]>,
  slotLength: number,
  limit: number,
) => getAvailabilityRanges(namesBySlot, slotLength)
  .sort((first, second) =>
    second.names.length - first.names.length ||
    (second.end - second.start) - (first.end - first.start) ||
    first.date.localeCompare(second.date) ||
    first.start - second.start)
  .slice(0, limit);


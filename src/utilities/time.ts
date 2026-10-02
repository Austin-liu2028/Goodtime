import { twoDigits } from './date';

export const SLOT_LENGTH_MINUTES = 30;

export const formatTime = (minutes: number) => {
  // 24:00 (an event running until midnight) reads as 12:00 AM.
  const hours = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const period = hours < 12 ? 'AM' : 'PM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${twoDigits(minute)} ${period}`;
};

export const getTimeSlots = (startMinutes: number, endMinutes: number) =>
  Array.from(
    { length: Math.max(0, Math.floor((endMinutes - startMinutes) / SLOT_LENGTH_MINUTES)) },
    (_, index) => startMinutes + index * SLOT_LENGTH_MINUTES,
  );

export const toTimeValue = (minutes: number) => `${twoDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;

export const parseTimeValue = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

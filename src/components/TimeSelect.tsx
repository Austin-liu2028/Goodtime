import { formatTime, getTimeSlots, SLOT_LENGTH_MINUTES, toTimeValue } from '../utilities/time';

interface TimeSelectProps {
  id?: string;
  value: string;
  // Start times run 12:00 AM-11:30 PM; end times run 12:30 AM-midnight.
  kind: 'start' | 'end';
  // Optional bounds, in minutes after midnight, to offer only times that make sense here.
  minMinutes?: number;
  maxMinutes?: number;
  onChange: (value: string) => void;
}

// English labels regardless of browser locale; native time inputs follow the OS language.
const startOptions = getTimeSlots(0, 24 * 60);
const endOptions = getTimeSlots(SLOT_LENGTH_MINUTES, 24 * 60 + SLOT_LENGTH_MINUTES);

export const TimeSelect = ({ id, value, kind, minMinutes = 0, maxMinutes = 24 * 60, onChange }: TimeSelectProps) => (
  <select id={id} className="text-field date-input" value={value} onChange={(event) => onChange(event.target.value)}>
    {(kind === 'start' ? startOptions : endOptions)
      .filter((minutes) => minutes >= minMinutes && minutes <= maxMinutes)
      .map((minutes) => (
        <option key={minutes} value={toTimeValue(minutes)}>
          {formatTime(minutes)}{minutes === 24 * 60 ? ' (midnight)' : ''}
        </option>
      ))}
  </select>
);

import { useId, useState, type FormEvent } from 'react';
import { getSlotKey } from '../utilities/availability';
import { formatDate } from '../utilities/date';
import { formatScheduleDay } from '../utilities/schedule';
import { formatDuration, getTimeSlots, parseTimeValue, SLOT_LENGTH_MINUTES, toTimeValue } from '../utilities/time';
import { TimeSelect } from './TimeSelect';

interface QuickAddFormProps {
  eventDates: string[];
  scheduleMode?: 'dates' | 'weekdays';
  eventStartMinutes: number;
  eventEndMinutes: number;
  canonicalSlotsByDisplay?: Map<string, string[]>;
  onAdd: (slotKeys: string[]) => void;
}

const formatDay = (date: string) => formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });

// Adds the same stretch of time to one or more of the event's days at once: easier than
// tapping many small cells on a phone. Only the event's own days and hours are offered.
export const QuickAddForm = ({ eventDates, scheduleMode, eventStartMinutes, eventEndMinutes, canonicalSlotsByDisplay, onAdd }: QuickAddFormProps) => {
  const id = useId();
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set([eventDates[0]]));
  const [startTime, setStartTime] = useState(toTimeValue(eventStartMinutes));
  const [endTime, setEndTime] = useState(toTimeValue(Math.min(eventStartMinutes + 60, eventEndMinutes)));
  const [message, setMessage] = useState('');
  const startMinutes = parseTimeValue(startTime);
  const endMinutes = parseTimeValue(endTime);
  const isEveryDay = selectedDates.size === eventDates.length;

  const toggleDate = (date: string) => {
    setMessage('');
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const changeStart = (value: string) => {
    setStartTime(value);
    setMessage('');
    // Keep "Until" after "From".
    if (parseTimeValue(value) >= endMinutes) setEndTime(toTimeValue(parseTimeValue(value) + SLOT_LENGTH_MINUTES));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedDates.size === 0) {
      setMessage('Choose at least one day.');
      return;
    }
    const dates = eventDates.filter((date) => selectedDates.has(date));
    const slotKeys = dates.flatMap((date) => getTimeSlots(startMinutes, endMinutes).flatMap((minutes) => {
      const key = getSlotKey(date, minutes);
      return canonicalSlotsByDisplay?.get(key) ?? (canonicalSlotsByDisplay ? [] : [key]);
    }));
    if (slotKeys.length === 0) {
      setMessage('No event times fall in that range. Choose another time.');
      return;
    }
    onAdd(slotKeys);
    const where = dates.length === 1 ? `on ${scheduleMode === 'weekdays' ? `every ${formatScheduleDay({ scheduleMode }, dates[0])}` : formatDay(dates[0])}` : `on each of ${dates.length} days`;
    setMessage(`Added ${formatDuration(endMinutes - startMinutes)} ${where}. Submit availability to save it.`);
  };

  return (
    <form className="quick-availability" onSubmit={submit}>
      <p className="field-hint quick-hint">Pick one or more days and a stretch of time to select it all at once, instead of tapping each slot.</p>

      <fieldset className="quick-days">
        <legend className="field-label">Days</legend>
        <div className="day-chips">
          <button
            type="button"
            className={`day-chip${isEveryDay ? ' is-selected' : ''}`}
            aria-pressed={isEveryDay}
            onClick={() => {
              setMessage('');
              setSelectedDates(isEveryDay ? new Set() : new Set(eventDates));
            }}
          >
            All days
          </button>
          {eventDates.map((date) => (
            <button
              type="button"
              key={date}
              className={`day-chip${selectedDates.has(date) ? ' is-selected' : ''}`}
              aria-pressed={selectedDates.has(date)}
              onClick={() => toggleDate(date)}
            >
              {scheduleMode === 'weekdays' ? formatScheduleDay({ scheduleMode }, date, true) : formatDay(date)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="quick-fields">
        <label htmlFor={`${id}-from`}>
          <span>From</span>
          <TimeSelect
            id={`${id}-from`}
            kind="start"
            value={startTime}
            minMinutes={eventStartMinutes}
            maxMinutes={eventEndMinutes - SLOT_LENGTH_MINUTES}
            onChange={changeStart}
          />
        </label>
        <label htmlFor={`${id}-until`}>
          <span>Until</span>
          <TimeSelect
            id={`${id}-until`}
            kind="end"
            value={endTime}
            minMinutes={startMinutes + SLOT_LENGTH_MINUTES}
            maxMinutes={eventEndMinutes}
            onChange={(value) => {
              setEndTime(value);
              setMessage('');
            }}
          />
        </label>
        <button type="submit" className="button button-secondary quick-add-button">Add times</button>
      </div>
      <p className={selectedDates.size === 0 && message ? 'form-error' : 'share-message'} aria-live="polite">{message}</p>
    </form>
  );
};

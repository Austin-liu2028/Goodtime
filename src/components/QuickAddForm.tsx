import { useState, type FormEvent } from 'react';
import { getSlotKey } from '../utilities/availability';
import { formatDate } from '../utilities/date';
import { getTimeSlots, parseTimeValue, toTimeValue } from '../utilities/time';
import { TimeSelect } from './TimeSelect';

interface QuickAddFormProps {
  eventDates: string[];
  eventStartMinutes: number;
  eventEndMinutes: number;
  onAdd: (slotKeys: string[]) => void;
}

// Adds a whole time range at once: easier than tapping many small cells on a phone.
export const QuickAddForm = ({ eventDates, eventStartMinutes, eventEndMinutes, onAdd }: QuickAddFormProps) => {
  const [date, setDate] = useState(eventDates[0]);
  const [startTime, setStartTime] = useState(toTimeValue(eventStartMinutes));
  const [endTime, setEndTime] = useState(toTimeValue(Math.min(eventStartMinutes + 60, eventEndMinutes)));
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startMinutes = parseTimeValue(startTime);
    const endMinutes = parseTimeValue(endTime);
    if (startMinutes >= endMinutes) {
      setError('The end time must be after the start time.');
      return;
    }
    if (startMinutes < eventStartMinutes || endMinutes > eventEndMinutes) {
      setError('Choose times within the event hours.');
      return;
    }
    setError('');
    onAdd(getTimeSlots(startMinutes, endMinutes).map((minutes) => getSlotKey(date, minutes)));
  };

  return (
    <form className="quick-availability" onSubmit={submit}>
      <div>
        <div className="eyebrow schedule-eyebrow">ADD A TIME RANGE</div>
        <p>Choose a date and time range to add several slots at once.</p>
      </div>
      <div className="quick-fields">
        <label>
          <span>Date</span>
          <select className="text-field date-input" value={date} onChange={(event) => setDate(event.target.value)}>
            {eventDates.map((eventDate) => (
              <option key={eventDate} value={eventDate}>
                {formatDate(eventDate, { weekday: 'short', month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Start</span>
          <TimeSelect kind="start" value={startTime} onChange={setStartTime} />
        </label>
        <label>
          <span>End</span>
          <TimeSelect kind="end" value={endTime} onChange={setEndTime} />
        </label>
        <button type="submit" className="submit-button quick-add-button">Add times</button>
      </div>
      {error && <p className="form-error quick-error" role="alert">{error}</p>}
    </form>
  );
};

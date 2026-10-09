import { useState, type FormEvent } from 'react';
import { getSlotKey } from '../utilities/availability';
import { formatDate } from '../utilities/date';
import { formatDuration, getTimeSlots, parseTimeValue, SLOT_LENGTH_MINUTES, toTimeValue } from '../utilities/time';
import { TimeSelect } from './TimeSelect';

interface QuickAddFormProps {
  eventDates: string[];
  eventStartMinutes: number;
  eventEndMinutes: number;
  onAdd: (slotKeys: string[]) => void;
}

// Adds a whole time range at once: easier than tapping many small cells on a phone.
// Only times inside the event's hours are offered, so there's nothing to get wrong.
export const QuickAddForm = ({ eventDates, eventStartMinutes, eventEndMinutes, onAdd }: QuickAddFormProps) => {
  const [date, setDate] = useState(eventDates[0]);
  const [startTime, setStartTime] = useState(toTimeValue(eventStartMinutes));
  const [endTime, setEndTime] = useState(toTimeValue(Math.min(eventStartMinutes + 60, eventEndMinutes)));
  const [addedMessage, setAddedMessage] = useState('');
  const startMinutes = parseTimeValue(startTime);
  const endMinutes = parseTimeValue(endTime);

  const changeStart = (value: string) => {
    setStartTime(value);
    setAddedMessage('');
    // Keep "Until" after "From".
    if (parseTimeValue(value) >= endMinutes) setEndTime(toTimeValue(parseTimeValue(value) + SLOT_LENGTH_MINUTES));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAdd(getTimeSlots(startMinutes, endMinutes).map((minutes) => getSlotKey(date, minutes)));
    setAddedMessage(
      `Added ${formatDuration(endMinutes - startMinutes)} on ${formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}. Submit availability to save it.`,
    );
  };

  return (
    <form className="quick-availability" onSubmit={submit}>
      <p className="field-hint quick-hint">Pick a day and a stretch of time to select it all at once, instead of tapping each slot.</p>
      <div className="quick-fields">
        <label>
          <span>Date</span>
          <select
            className="text-field date-input"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setAddedMessage('');
            }}
          >
            {eventDates.map((eventDate) => (
              <option key={eventDate} value={eventDate}>
                {formatDate(eventDate, { weekday: 'short', month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <TimeSelect
            kind="start"
            value={startTime}
            minMinutes={eventStartMinutes}
            maxMinutes={eventEndMinutes - SLOT_LENGTH_MINUTES}
            onChange={changeStart}
          />
        </label>
        <label>
          <span>Until</span>
          <TimeSelect
            kind="end"
            value={endTime}
            minMinutes={startMinutes + SLOT_LENGTH_MINUTES}
            maxMinutes={eventEndMinutes}
            onChange={(value) => {
              setEndTime(value);
              setAddedMessage('');
            }}
          />
        </label>
        <button type="submit" className="button button-secondary quick-add-button">Add times</button>
      </div>
      <p className="share-message" aria-live="polite">{addedMessage}</p>
    </form>
  );
};

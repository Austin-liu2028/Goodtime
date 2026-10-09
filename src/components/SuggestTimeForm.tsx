import { useId, useState, type FormEvent } from 'react';
import { EventStorageError, suggestTime } from '../services/events';
import { formatDate, toDateValue } from '../utilities/date';
import { WEEKDAY_NAMES, weekdayReferenceDate } from '../utilities/schedule';
import { parseTimeValue, SLOT_LENGTH_MINUTES, toTimeValue } from '../utilities/time';
import { getTimeZoneName } from '../utilities/timeZones';
import { TimeSelect } from './TimeSelect';

interface SuggestTimeFormProps {
  eventCode: string;
  scheduleMode?: 'dates' | 'weekdays';
  participantName: string;
  timeZone: string;
  // The event's own range, as a sensible starting point.
  defaultDate: string;
  defaultStart: number;
}

// For a participant none of the event's times work for: proposes another day or hours,
// which the organizer sees and can add to the event in one click.
export const SuggestTimeForm = ({ eventCode, scheduleMode, participantName, timeZone, defaultDate, defaultStart }: SuggestTimeFormProps) => {
  const id = useId();
  const today = toDateValue(new Date());
  const [date, setDate] = useState(scheduleMode === 'weekdays' ? defaultDate : defaultDate < today ? today : defaultDate);
  const [startTime, setStartTime] = useState(toTimeValue(defaultStart));
  const [endTime, setEndTime] = useState(toTimeValue(Math.min(defaultStart + 60, 24 * 60)));
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    if (!participantName.trim()) {
      setError('Enter your name at the top first, so the organizer knows who it’s from.');
      return;
    }
    if (!date) {
      setError('Choose a date.');
      return;
    }
    setError('');
    setIsSending(true);
    try {
      await suggestTime(eventCode, {
        name: participantName,
        date,
        start: parseTimeValue(startTime),
        end: parseTimeValue(endTime),
        note,
      });
      setNote('');
      setMessage('Sent. The organizer will see your suggestion and can add it to the event.');
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not send your suggestion. Try again.');
    }
    setIsSending(false);
  };

  return (
    <form className="quick-availability suggest-time-form" onSubmit={submit}>
      <p className="field-hint quick-hint">
        None of the listed times work? Choose {scheduleMode === 'weekdays' ? 'another weekly day and time' : 'another date and time'} for the organizer to consider.
      </p>
      <p className="field-hint suggest-time-zone">Times shown in {getTimeZoneName(timeZone)}.</p>
      <div className="quick-fields suggest-fields">
        <label htmlFor={`${id}-date`}>
          <span>{scheduleMode === 'weekdays' ? 'Day of the week' : 'Date'}</span>
          {scheduleMode === 'weekdays' ? (
            <select id={`${id}-date`} className="text-field" value={date} onChange={(changeEvent) => setDate(changeEvent.target.value)}>
              {WEEKDAY_NAMES.map((day, index) => <option key={day} value={weekdayReferenceDate(index)}>{day}</option>)}
            </select>
          ) : (
            <span className="suggest-date-control">
              <span className="suggest-date-display" aria-hidden="true">
                {date ? formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Choose a date'}
              </span>
              <input
                id={`${id}-date`}
                className="text-field date-input"
                aria-label="Date"
                type="date"
                min={today}
                value={date}
                onChange={(changeEvent) => setDate(changeEvent.target.value)}
              />
            </span>
          )}
        </label>
        <label htmlFor={`${id}-from`}>
          <span>From</span>
          <TimeSelect
            id={`${id}-from`}
            kind="start"
            value={startTime}
            onChange={(value) => {
              setStartTime(value);
              if (parseTimeValue(value) >= parseTimeValue(endTime)) setEndTime(toTimeValue(parseTimeValue(value) + SLOT_LENGTH_MINUTES));
            }}
          />
        </label>
        <label htmlFor={`${id}-until`}>
          <span>Until</span>
          <TimeSelect
            id={`${id}-until`}
            kind="end"
            value={endTime}
            minMinutes={parseTimeValue(startTime) + SLOT_LENGTH_MINUTES}
            onChange={setEndTime}
          />
        </label>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-note`}>Note for the organizer <span>Optional</span></label>
        <textarea
          id={`${id}-note`}
          className="text-field"
          rows={2}
          maxLength={300}
          value={note}
          onChange={(changeEvent) => setNote(changeEvent.target.value)}
          placeholder="e.g. I have class all week, but Friday afternoon is open."
        />
      </div>
      <button type="submit" className="button button-secondary suggest-button" disabled={isSending}>
        {isSending ? 'Sending…' : 'Send to organizer'}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="share-message" aria-live="polite">{message}</p>
    </form>
  );
};

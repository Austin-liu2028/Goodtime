import { useState, type FormEvent } from 'react';
import { navigate } from '../hooks/useRoute';
import { createEvent, EventStorageError } from '../services/events';
import { addDays, toDateValue } from '../utilities/date';
import { parseTimeValue } from '../utilities/time';
import { DateRangePicker } from './DateRangePicker';
import { Link } from './Link';
import { TimeSelect } from './TimeSelect';

const getNames = (value: string) => {
  const uniqueNames = new Map<string, string>();
  value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLocaleLowerCase();
      if (!uniqueNames.has(key)) uniqueNames.set(key, name);
    });
  return Array.from(uniqueNames.values());
};

export const CreateEventPage = () => {
  const today = toDateValue(new Date());
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 6));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [inviteesInput, setInviteesInput] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hasValidTimes = parseTimeValue(startTime) < parseTimeValue(endTime);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Give your event a title.');
      return;
    }
    if (!hasValidTimes) {
      setError('The end time must be after the start time.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      const created = await createEvent({
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        startDate,
        endDate,
        startTime,
        endTime,
        invitees: getNames(inviteesInput),
      });
      navigate(`/e/${created.code}`);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not create the event. Try again.');
      setIsSaving(false);
    }
  };

  return (
    <section className="narrow-page" aria-labelledby="create-heading">
      <Link to="/" className="back-link"><span aria-hidden="true">←</span> Back</Link>
      <div className="eyebrow"><span className="eyebrow-line" /> CREATE AN EVENT</div>
      <h1 id="create-heading">Set the scene</h1>
      <p className="intro-copy">Tell your group what this is and which days and hours you are considering.</p>

      <form className="form-fields" onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="event-title">EVENT TITLE</label>
        <input
          id="event-title"
          className="text-field title-field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What are we getting together for?"
          maxLength={80}
          required
        />

        <div className="participant-field">
          <label className="field-label" htmlFor="event-location">LOCATION <span>OPTIONAL</span></label>
          <input
            id="event-location"
            className="text-field"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Room, address, or video link"
            maxLength={120}
          />
        </div>

        <div className="participant-field">
          <label className="field-label" htmlFor="event-description">A FEW DETAILS <span>OPTIONAL</span></label>
          <textarea
            id="event-description"
            className="text-field description-field"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add a note for your group"
            rows={3}
            maxLength={240}
          />
        </div>

        <div className="event-range-fields">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            minDate={today}
            onChange={(nextStartDate, nextEndDate) => {
              setStartDate(nextStartDate);
              setEndDate(nextEndDate);
            }}
          />
          <div>
            <label className="field-label" htmlFor="event-start-time">FROM</label>
            <TimeSelect id="event-start-time" kind="start" value={startTime} onChange={setStartTime} />
          </div>
          <div>
            <label className="field-label" htmlFor="event-end-time">UNTIL</label>
            <TimeSelect id="event-end-time" kind="end" value={endTime} onChange={setEndTime} />
          </div>
        </div>
        {!hasValidTimes && <p className="form-error">The end time must be after the start time.</p>}

        <div className="participant-field">
          <label className="field-label" htmlFor="invitees">WHO&apos;S INVITED <span>OPTIONAL · COMMA SEPARATED</span></label>
          <textarea
            id="invitees"
            className="text-field invitees-field"
            value={inviteesInput}
            onChange={(event) => setInviteesInput(event.target.value)}
            placeholder="Alex, Sam, Jordan"
            rows={2}
          />
          <p className="field-hint">Used to show you who still needs to respond.</p>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="submit-button create-button" disabled={isSaving}>
          {isSaving ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </section>
  );
};

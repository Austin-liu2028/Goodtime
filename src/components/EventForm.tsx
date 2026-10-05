import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { EventStorageError } from '../services/events';
import type { EventContact, EventDetails } from '../types/event';
import { isValidEmail } from '../utilities/email';
import { parseTimeValue } from '../utilities/time';
import { getTimeZoneOptionLabel, TIME_ZONE_OPTIONS } from '../utilities/timeZones';
import { DateRangePicker } from './DateRangePicker';
import { CloseIcon } from './CloseIcon';
import { Link } from './Link';
import { TimeSelect } from './TimeSelect';

// Trimmed, blank-free names, keeping the first spelling of each (case-insensitive).
const getNames = (names: string[]) => {
  const uniqueNames = new Map<string, string>();
  names
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLocaleLowerCase();
      if (!uniqueNames.has(key)) uniqueNames.set(key, name);
    });
  return Array.from(uniqueNames.values());
};

// One row per invitee: a name, and optionally an email for the confirmation message.
interface InviteeRow extends EventContact {
  id: number;
}

let nextInviteeId = 0;
const createInviteeRow = (name = '', email = ''): InviteeRow => ({ id: (nextInviteeId += 1), name, email });

const createInviteeRows = (names: string[], emails: Record<string, string>) =>
  names.length > 0 ? names.map((name) => createInviteeRow(name, emails[name] ?? '')) : [createInviteeRow()];

const hasBadEmail = (row: InviteeRow) => row.email.trim() !== '' && !isValidEmail(row.email);

interface EventFormProps {
  initialDetails: EventDetails;
  minDate: string;
  submitLabel: string;
  savingLabel: string;
  // Editing only: responses already in, so the form can warn when new dates or hours hide some.
  responses?: Record<string, string[]>;
  // Emails the organizer saved for invitees before, by name (editing only).
  initialInviteeEmails?: Record<string, string>;
  cancelTo?: string;
  // Invitee emails travel separately from the details: the event itself is readable by anyone
  // with the link, so emails are stored where only the organizer can read them.
  onSubmit: (details: EventDetails, inviteeContacts: EventContact[]) => Promise<void>;
}

// The event details form, shared by creating and editing an event.
export const EventForm = ({
  initialDetails,
  minDate,
  submitLabel,
  savingLabel,
  responses = {},
  initialInviteeEmails = {},
  cancelTo,
  onSubmit,
}: EventFormProps) => {
  const [title, setTitle] = useState(initialDetails.title);
  const [location, setLocation] = useState(initialDetails.location);
  const [description, setDescription] = useState(initialDetails.description);
  const [startDate, setStartDate] = useState(initialDetails.startDate);
  const [endDate, setEndDate] = useState(initialDetails.endDate);
  const [startTime, setStartTime] = useState(initialDetails.startTime);
  const [endTime, setEndTime] = useState(initialDetails.endTime);
  const [timeZone, setTimeZone] = useState(initialDetails.timeZone);
  const [inviteeRows, setInviteeRows] = useState<InviteeRow[]>(() => createInviteeRows(initialDetails.invitees, initialInviteeEmails));
  // The row to focus once it mounts, after "Add another person" or Enter.
  const [focusRowId, setFocusRowId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const startMinutes = parseTimeValue(startTime);
  const endMinutes = parseTimeValue(endTime);
  const hasValidTimes = startMinutes < endMinutes;
  const hiddenResponseCount = Object.values(responses).filter((slotKeys) => slotKeys.some((slotKey) => {
    const [date, minutes] = slotKey.split('|');
    return date < startDate || date > endDate || Number(minutes) < startMinutes || Number(minutes) >= endMinutes;
  })).length;

  // Pasting "Alex, Sam, Jordan" into one box splits it across boxes.
  const changeInvitee = (rowId: number, value: string) => {
    const parts = value.split(/[,;\n]/);
    if (parts.length === 1) {
      updateInvitee(rowId, { name: value });
      return;
    }
    const added = parts.slice(1).map((part) => part.trim()).filter(Boolean).map((part) => createInviteeRow(part));
    setInviteeRows((rows) => rows.flatMap((row) => (row.id === rowId ? [{ ...row, name: parts[0].trim() }, ...added] : [row])));
  };

  const updateInvitee = (rowId: number, change: Partial<InviteeRow>) =>
    setInviteeRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...change } : row)));

  const addInvitee = (afterRowId?: number) => {
    const row = createInviteeRow();
    setInviteeRows((rows) => {
      const index = afterRowId === undefined ? rows.length : rows.findIndex(({ id }) => id === afterRowId) + 1;
      return [...rows.slice(0, index), row, ...rows.slice(index)];
    });
    setFocusRowId(row.id);
  };

  // The last box empties instead of disappearing, so there's always somewhere to type.
  const removeInvitee = (rowId: number) =>
    setInviteeRows((rows) => (rows.length === 1 ? [createInviteeRow()] : rows.filter(({ id }) => id !== rowId)));

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
    if (inviteeRows.some(hasBadEmail)) {
      setError('Check the highlighted email addresses, or leave them blank.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        startDate,
        endDate,
        startTime,
        endTime,
        invitees: getNames(inviteeRows.map(({ name }) => name)),
        timeZone,
      }, inviteeRows
        .filter(({ name }) => name.trim())
        .map(({ name, email }) => ({ name: name.trim(), email: email.trim() })));
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not save the event. Try again.');
      setIsSaving(false);
    }
  };

  return (
    <form className="form-fields" onSubmit={submit} noValidate>
      <label className="field-label" htmlFor="event-title">Event title</label>
      <input
        id="event-title"
        className="text-field title-field"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Team lunch, study group, band practice…"
        maxLength={80}
        required
      />

      <div className="field">
        <label className="field-label" htmlFor="event-location">Location <span>Optional</span></label>
        <input
          id="event-location"
          className="text-field"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Room, address, or video link"
          maxLength={120}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="event-description">Note for your group <span>Optional</span></label>
        <textarea
          id="event-description"
          className="text-field description-field"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Agenda, what to bring, anything people should know"
          rows={3}
          maxLength={240}
        />
      </div>

      <div className="event-range-fields">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          minDate={minDate}
          onChange={(nextStartDate, nextEndDate) => {
            setStartDate(nextStartDate);
            setEndDate(nextEndDate);
          }}
        />
        <div>
          <label className="field-label" htmlFor="event-start-time">Earliest time</label>
          <TimeSelect id="event-start-time" kind="start" value={startTime} onChange={setStartTime} />
        </div>
        <div>
          <label className="field-label" htmlFor="event-end-time">Latest time</label>
          <TimeSelect id="event-end-time" kind="end" value={endTime} onChange={setEndTime} />
        </div>
      </div>
      {!hasValidTimes && <p className="form-error">The end time must be after the start time.</p>}

      <div className="field">
        <label className="field-label" htmlFor="event-time-zone">Time zone <span>Optional</span></label>
        <select
          id="event-time-zone"
          className="text-field"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
        >
          {/* An event saved in a zone that isn't listed keeps it as an option. */}
          {TIME_ZONE_OPTIONS.some(({ id }) => id === timeZone) ? null : (
            <option value={timeZone}>{getTimeZoneOptionLabel(timeZone)}</option>
          )}
          {TIME_ZONE_OPTIONS.map(({ id }) => (
            <option key={id} value={id}>{getTimeZoneOptionLabel(id)}</option>
          ))}
        </select>
        <p className="field-hint">The hours above are in this time zone. Calendar invites convert it for everyone.</p>
      </div>

      <div className="field">
        <fieldset className="invitee-fields">
          <legend className="field-label">Who’s invited <span>Optional</span></legend>
          {inviteeRows.map((row, index) => {
            // Enter adds the next person instead of submitting the whole form.
            const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addInvitee(row.id);
            };
            return (
              <div className="invitee-row" key={row.id}>
                <div className="invitee-row-fields">
                  <input
                    className="text-field"
                    value={row.name}
                    onChange={(event) => changeInvitee(row.id, event.target.value)}
                    onKeyDown={addOnEnter}
                    ref={(element) => {
                      if (element && row.id === focusRowId) {
                        element.focus();
                        setFocusRowId(null);
                      }
                    }}
                    placeholder={index === 0 ? 'Name, e.g. Alex' : 'Name'}
                    aria-label={`Invitee ${index + 1}`}
                    autoComplete="off"
                    maxLength={50}
                  />
                  <input
                    className="text-field"
                    type="email"
                    value={row.email}
                    onChange={(event) => updateInvitee(row.id, { email: event.target.value })}
                    onKeyDown={addOnEnter}
                    placeholder="Email (optional)"
                    aria-label={`Email for invitee ${index + 1} (optional)`}
                    aria-invalid={hasBadEmail(row) || undefined}
                    autoComplete="off"
                    maxLength={254}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeInvitee(row.id)}
                    aria-label={`Remove invitee ${index + 1}`}
                  >
                    <CloseIcon />
                  </button>
                </div>
                {hasBadEmail(row) && <p className="form-error">Check this email address.</p>}
              </div>
            );
          })}
          <button type="button" className="text-button" onClick={() => addInvitee()}>
            <span aria-hidden="true">+</span>&nbsp;Add another person
          </button>
        </fieldset>
        <p className="field-hint">One person per row; press Enter for the next. Emails are optional and only you can see them. They let you send everyone the confirmed time.</p>
      </div>

      {hiddenResponseCount > 0 && (
        <p className="form-notice" role="status">
          {hiddenResponseCount === 1 ? '1 person picked' : `${hiddenResponseCount} people picked`} times outside these dates or hours.
          {' '}Those picks will be hidden, not deleted, and come back if you widen the range again.
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={isSaving}>
          {isSaving ? savingLabel : submitLabel}
        </button>
        {cancelTo && <Link to={cancelTo} className="button button-secondary">Cancel</Link>}
      </div>
    </form>
  );
};

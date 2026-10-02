import { useState, type SetStateAction } from 'react';
import { useEvent } from '../hooks/useEvent';
import { EventStorageError, isEventOwner, saveResponse } from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { addDays, daysBetween, formatDate } from '../utilities/date';
import { formatTime, getTimeSlots, parseTimeValue } from '../utilities/time';
import { AvailabilityGrid } from './AvailabilityGrid';
import { GroupResults } from './GroupResults';
import { Link } from './Link';
import { QuickAddForm } from './QuickAddForm';
import { ResponseStatus } from './ResponseStatus';
import { SharePanel } from './SharePanel';

const getNameKey = (name: string) => name.trim().toLocaleLowerCase();

interface EventPageProps {
  code: string;
}

export const EventPage = ({ code }: EventPageProps) => {
  const [state, replaceEvent] = useEvent(code);

  if (state.status === 'ready') return <EventView event={state.event} onEventChange={replaceEvent} />;

  return (
    <section className="narrow-page page-message" aria-live="polite">
      {state.status === 'loading' && <p>Loading event…</p>}
      {state.status === 'not-found' && (
        <>
          <h1>Event not found</h1>
          <p className="intro-copy">
            There is no event with the code <strong>{code}</strong> in this browser. Check the code with your organizer.
          </p>
          <Link to="/join" className="submit-button link-button">Try another code</Link>
        </>
      )}
      {state.status === 'error' && (
        <>
          <h1>Could not load this event</h1>
          <p className="form-error" role="alert">{state.message}</p>
        </>
      )}
    </section>
  );
};

interface EventViewProps {
  event: ScheduledEvent;
  onEventChange: (event: ScheduledEvent) => void;
}

const EventView = ({ event, onEventChange }: EventViewProps) => {
  const isOwner = isEventOwner(event.code);
  const [participantName, setParticipantName] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => new Set());
  // Whose saved response is loaded into the grid, so switching names never leaks or wipes picks.
  const [loadedResponseName, setLoadedResponseName] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const eventStartMinutes = parseTimeValue(event.startTime);
  const eventEndMinutes = parseTimeValue(event.endTime);
  const timeSlots = getTimeSlots(eventStartMinutes, eventEndMinutes);
  const eventDates = Array.from(
    { length: daysBetween(event.startDate, event.endDate) + 1 },
    (_, index) => addDays(event.startDate, index),
  );

  const submittedNames = Object.keys(event.responses);
  const submittedNameKeys = new Set(submittedNames.map(getNameKey));
  const roster = [...event.invitees];
  submittedNames.forEach((name) => {
    if (!roster.some((rosterName) => getNameKey(rosterName) === getNameKey(name))) roster.push(name);
  });
  const waitingNames = roster.filter((name) => !submittedNameKeys.has(getNameKey(name)));
  const findResponseName = (name: string) =>
    submittedNames.find((submittedName) => getNameKey(submittedName) === getNameKey(name));

  const isInEvent = (slotKey: string) => {
    const [date, minuteValue] = slotKey.split('|');
    const minutes = Number(minuteValue);
    return date >= event.startDate && date <= event.endDate && minutes >= eventStartMinutes && minutes < eventEndMinutes;
  };

  // Submitted responses only: this drives the group results.
  const namesBySlot = new Map<string, string[]>();
  submittedNames.forEach((name) => {
    new Set(event.responses[name]).forEach((slotKey) => {
      if (isInEvent(slotKey)) namesBySlot.set(slotKey, [...(namesBySlot.get(slotKey) ?? []), name]);
    });
  });
  const highestCount = Math.max(0, ...Array.from(namesBySlot.values(), (names) => names.length));
  const bestSlotKeys = new Set(highestCount > 0
    ? Array.from(namesBySlot.entries())
      .filter(([, names]) => names.length === highestCount)
      .map(([slotKey]) => slotKey)
    : []);
  const selectedCount = Array.from(selectedSlots).filter(isInEvent).length;

  // The grid counts also include your unsubmitted picks, so a slot you just chose never reads 0.
  const myResponseName = findResponseName(participantName.trim());
  const isParticipating = participantName.trim() !== '' || selectedSlots.size > 0;
  const liveTotal = submittedNames.length - (myResponseName ? 1 : 0) + (isParticipating ? 1 : 0);

  const savedSlots = new Set(loadedResponseName ? event.responses[loadedResponseName] ?? [] : []);
  const hasUnsavedChanges =
    savedSlots.size !== selectedSlots.size ||
    Array.from(selectedSlots).some((slotKey) => !savedSlots.has(slotKey));

  const changeSelection = (update: SetStateAction<Set<string>>) => {
    setSelectedSlots(update);
    setSubmitMessage('');
  };

  // Runs when the name field is committed (blur or Enter), not per keystroke, so typing
  // "Alex" past an existing "Al" never swaps the grid mid-word.
  const loadResponseForName = () => {
    const existingName = findResponseName(participantName.trim()) ?? null;
    if (existingName === loadedResponseName) return;
    if (hasUnsavedChanges) {
      // Never throw away picks the person hasn't submitted yet.
      if (existingName) {
        setSubmitMessage(`${existingName} already responded. Submitting will replace their saved times.`);
      }
      return;
    }
    setSelectedSlots(new Set(existingName ? event.responses[existingName] : []));
    setLoadedResponseName(existingName);
  };

  const submitAvailability = async () => {
    const name = participantName.trim();
    if (!name) {
      setSubmitMessage('Enter your name before submitting availability.');
      return;
    }
    setIsSaving(true);
    try {
      onEventChange(await saveResponse(event.code, name, Array.from(selectedSlots)));
      setParticipantName(name);
      setLoadedResponseName(name);
      setSubmitMessage(`Availability submitted for ${name}.`);
    } catch (error) {
      console.error(error);
      setSubmitMessage(error instanceof EventStorageError ? error.message : 'Could not save. Try again.');
    }
    setIsSaving(false);
  };

  return (
    <div className="workspace" id="main">
      <section className="event-panel" aria-labelledby="event-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> {isOwner ? 'YOU’RE ORGANIZING' : 'YOU’RE INVITED'}</div>
        <h1 id="event-heading">{event.title}</h1>
        {event.description && <p className="intro-copy">{event.description}</p>}

        <dl className="event-facts">
          <div>
            <dt>When</dt>
            <dd>
              {formatDate(event.startDate, { weekday: 'short', month: 'short', day: 'numeric' })}
              {event.endDate !== event.startDate && <> – {formatDate(event.endDate, { weekday: 'short', month: 'short', day: 'numeric' })}</>}
            </dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd>{formatTime(eventStartMinutes)} – {formatTime(eventEndMinutes)}</dd>
          </div>
          {event.location && (
            <div>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {!isOwner && (
            <div>
              <dt>Code</dt>
              <dd>{event.code}</dd>
            </div>
          )}
        </dl>

        {isOwner && <SharePanel code={event.code} />}

        <div className="form-fields">
          <label className="field-label" htmlFor="participant-name">YOUR NAME</label>
          <input
            id="participant-name"
            className="text-field name-field"
            value={participantName}
            onChange={(changeEvent) => {
              setParticipantName(changeEvent.target.value);
              setSubmitMessage('');
            }}
            onBlur={loadResponseForName}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter') loadResponseForName();
            }}
            placeholder="Name"
            autoComplete="name"
            maxLength={50}
          />
          <p className="field-hint">Already responded? Enter the same name to edit your times.</p>
        </div>

        <div className="selection-summary" aria-live="polite">
          <span className="summary-icon" aria-hidden="true">+</span>
          <div>
            <strong>{selectedCount} {selectedCount === 1 ? 'time' : 'times'} selected</strong>
            <span>{participantName.trim() || 'Your availability'} · across the event dates</span>
          </div>
        </div>
      </section>

      <section className="availability-panel" aria-labelledby="availability-heading">
        <AvailabilityGrid
          eventDates={eventDates}
          timeSlots={timeSlots}
          selectedSlots={selectedSlots}
          onSelectedSlotsChange={changeSelection}
          namesBySlot={namesBySlot}
          myResponseName={myResponseName}
          liveTotal={liveTotal}
          bestSlotKeys={bestSlotKeys}
        />

        <div className="response-submit-row">
          <button type="button" className="submit-button" onClick={submitAvailability} disabled={isSaving}>
            {myResponseName ? 'Update availability' : 'Submit availability'}
          </button>
          <span className={`submit-message${!submitMessage && hasUnsavedChanges ? ' is-unsaved' : ''}`} aria-live="polite">
            {submitMessage || (hasUnsavedChanges ? 'Unsaved changes. Submit to share them with the group.' : '')}
          </span>
        </div>

        <QuickAddForm
          eventDates={eventDates}
          eventStartMinutes={eventStartMinutes}
          eventEndMinutes={eventEndMinutes}
          onAdd={(slotKeys) => changeSelection((current) => new Set([...current, ...slotKeys]))}
        />

        <GroupResults
          namesBySlot={namesBySlot}
          submittedNames={submittedNames}
          waitingNames={waitingNames}
          rosterSize={roster.length}
        />

        {isOwner && (
          <ResponseStatus submittedNames={submittedNames} waitingNames={waitingNames} rosterSize={roster.length} />
        )}
      </section>
    </div>
  );
};

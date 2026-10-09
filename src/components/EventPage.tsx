import { useState, type SetStateAction } from 'react';
import { useEvent } from '../hooks/useEvent';
import { EventStorageError, getInviteLink, getOwnContact, saveContact, saveResponse, setConfirmedTime } from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { addDays, daysBetween, formatDate } from '../utilities/date';
import { isValidEmail } from '../utilities/email';
import { getNameKey, getRoster, isOwnedBy } from '../utilities/eventStatus';
import { getTimeZoneName } from '../utilities/timeZones';
import { formatDuration, formatTime, formatTimeRange, getTimeSlots, parseTimeValue, SLOT_LENGTH_MINUTES } from '../utilities/time';
import { AvailabilityGrid } from './AvailabilityGrid';
import { ConfirmedBanner } from './ConfirmedBanner';
import { GroupResults } from './GroupResults';
import { Link } from './Link';
import { QuickAddForm } from './QuickAddForm';
import { ResponseStatus } from './ResponseStatus';
import { SharePanel } from './SharePanel';

const formatShortDate = (date: string) => formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });

const getDateSpan = (event: ScheduledEvent) =>
  event.endDate === event.startDate
    ? formatShortDate(event.startDate)
    : `${formatShortDate(event.startDate)} – ${formatShortDate(event.endDate)}`;

// What the organizer pastes into the group chat to chase people up, or to announce the time.
const getReminder = (event: ScheduledEvent, waitingNames: string[]) => {
  const link = getInviteLink(event.code);
  if (event.confirmedTime) {
    const { date, start, end } = event.confirmedTime;
    const place = event.location ? ` at ${event.location}` : '';
    return `“${event.title}” is confirmed for ${formatShortDate(date)}, ${formatTimeRange(start, end)}${place}. Add it to your calendar: ${link}`;
  }
  const greeting = waitingNames.length > 0 ? `Hi ${waitingNames.join(', ')}! ` : '';
  return `${greeting}Please add your availability for “${event.title}” so we can pick a time: ${link}`;
};

interface EventPageProps {
  code: string;
}

export const EventPage = ({ code }: EventPageProps) => {
  const [state, replaceEvent] = useEvent(code);

  if (state.status === 'ready') {
    return <EventView event={state.event} isOwner={isOwnedBy(state.event, state.userId)} onEventChange={replaceEvent} />;
  }

  return (
    <section className="narrow-page" aria-live="polite">
      {state.status === 'loading' && <p className="lede">Loading event…</p>}
      {state.status === 'not-found' && (
        <>
          <h1>Event not found</h1>
          <p className="lede">
            There’s no event with the code <strong className="tabular">{code}</strong>. Check the code with your organizer.
          </p>
          <div className="button-row">
            <Link to="/join" className="button button-primary">Enter another code</Link>
            <Link to="/create" className="button button-secondary">Create an event</Link>
          </div>
        </>
      )}
      {state.status === 'error' && (
        <>
          <h1>Couldn’t load this event</h1>
          <p className="form-error" role="alert">{state.message}</p>
          <Link to="/" className="button button-secondary">Go home</Link>
        </>
      )}
    </section>
  );
};

interface EventViewProps {
  event: ScheduledEvent;
  isOwner: boolean;
  onEventChange: (event: ScheduledEvent) => void;
}

const EventView = ({ event, isOwner, onEventChange }: EventViewProps) => {
  // Phones only: details start collapsed so the grid comes into view sooner.
  const [areDetailsOpen, setAreDetailsOpen] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
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

  const { submittedNames, waitingNames, roster } = getRoster(event);
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
  // Highlighting a slot only one person can make would oversell it.
  const bestSlotKeys = new Set(highestCount >= 2
    ? Array.from(namesBySlot.entries())
      .filter(([, names]) => names.length === highestCount)
      .map(([slotKey]) => slotKey)
    : []);
  const selectedInEvent = Array.from(selectedSlots).filter(isInEvent);
  const selectedDayCount = new Set(selectedInEvent.map((slotKey) => slotKey.split('|')[0])).size;
  const selectionSummary = selectedInEvent.length === 0
    ? 'No times selected yet'
    : `${formatDuration(selectedInEvent.length * SLOT_LENGTH_MINUTES)} selected${selectedDayCount > 1 ? ` across ${selectedDayCount} days` : ''}`;

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
    void prefillEmail(participantName.trim());
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

  // Someone coming back under the same name on this device gets their saved email back.
  const prefillEmail = async (name: string) => {
    if (!name) return;
    try {
      const contact = await getOwnContact(event.code, name);
      if (contact) setParticipantEmail((current) => current || contact.email);
    } catch (error) {
      // Only a convenience; they can type it again.
      console.error(error);
    }
  };

  const submitAvailability = async () => {
    const name = participantName.trim();
    const email = participantEmail.trim();
    if (!name) {
      setSubmitMessage('Enter your name before submitting availability.');
      return;
    }
    if (email && !isValidEmail(email)) {
      setSubmitMessage('Check your email address, or leave it blank.');
      return;
    }
    setIsSaving(true);
    try {
      onEventChange(await saveResponse(event.code, name, Array.from(selectedSlots)));
      setParticipantName(name);
      setLoadedResponseName(name);
      setSubmitMessage(`Availability submitted for ${name}.`);
      try {
        await saveContact(event.code, { name, email });
      } catch (error) {
        console.error(error);
        setSubmitMessage(`Availability submitted for ${name}, but your email couldn’t be saved. Try submitting again.`);
      }
    } catch (error) {
      console.error(error);
      setSubmitMessage(error instanceof EventStorageError ? error.message : 'Could not save. Try again.');
    }
    setIsSaving(false);
  };

  return (
    <div className="event-page">
      {/* Above everything, so it stays put however tall the confirmation and email panel get. */}
      <Link to="/" className="back-link"><span aria-hidden="true">←</span> Home</Link>
      {event.confirmedTime && (
        <ConfirmedBanner
          event={event}
          confirmedTime={event.confirmedTime}
          isOwner={isOwner}
          onReopen={async () => onEventChange(await setConfirmedTime(event.code, null))}
        />
      )}

      <div className="workspace">
        <aside className="event-panel" aria-labelledby="event-heading">
          <h1 id="event-heading">{event.title}</h1>
          <p className="event-summary-line mobile-only">
            {[getDateSpan(event), `${formatTimeRange(eventStartMinutes, eventEndMinutes)} ${getTimeZoneName(event.timeZone)}`, event.location].filter(Boolean).join(' · ')}
          </p>
          <button
            type="button"
            className="text-button details-toggle mobile-only"
            aria-expanded={areDetailsOpen}
            aria-controls="event-details"
            onClick={() => setAreDetailsOpen(!areDetailsOpen)}
          >
            {areDetailsOpen ? 'Hide details' : 'View details'}
          </button>

          <div id="event-details" className="collapsible" data-open={areDetailsOpen}>
            {event.description && <p className="event-description">{event.description}</p>}
            <dl className="event-facts">
              <div>
                <dt>Dates</dt>
                <dd>{getDateSpan(event)}</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>
                  {formatTime(eventStartMinutes)} – {formatTime(eventEndMinutes)}
                  <span className="fact-note">{getTimeZoneName(event.timeZone)}</span>
                </dd>
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
                  <dd className="tabular">{event.code}</dd>
                </div>
              )}
            </dl>
          </div>

          {isOwner && <SharePanel code={event.code} reminder={getReminder(event, waitingNames)} />}
          {isOwner && (
            <div className="collapsible" data-open={areDetailsOpen}>
              <ResponseStatus submittedNames={submittedNames} waitingNames={waitingNames} rosterSize={roster.length} />
            </div>
          )}
        </aside>

        <section className="availability-panel" aria-labelledby="availability-heading">
          <h2 id="availability-heading" className="section-title">Your availability</h2>
          <p className="section-lede">Enter your name, then tap or drag across the times you’re free.</p>

          <div className="participant-fields">
            <div className="name-field-wrap">
              <label className="field-label" htmlFor="participant-name">Your name</label>
              <input
                id="participant-name"
                className="text-field"
                value={participantName}
                onChange={(changeEvent) => {
                  setParticipantName(changeEvent.target.value);
                  setSubmitMessage('');
                }}
                onBlur={loadResponseForName}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === 'Enter') loadResponseForName();
                }}
                placeholder="e.g. Priya"
                autoComplete="name"
                maxLength={50}
              />
              <p className="field-hint">Already responded? Use the same name to edit your times.</p>
            </div>

            <div className="name-field-wrap">
              <label className="field-label" htmlFor="participant-email">Email <span>Optional</span></label>
              <input
                id="participant-email"
                className="text-field"
                type="email"
                value={participantEmail}
                onChange={(changeEvent) => {
                  setParticipantEmail(changeEvent.target.value);
                  setSubmitMessage('');
                }}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
              />
              <p className="field-hint">We’ll only use this to send you the confirmed time. Only the organizer can see it.</p>
            </div>
          </div>

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

          <div className="save-bar">
            <div className="save-status" aria-live="polite">
              <strong>{selectionSummary}</strong>
              <span className={`submit-message${!submitMessage && hasUnsavedChanges ? ' is-unsaved' : ''}`}>
                {submitMessage || (hasUnsavedChanges ? 'Unsaved changes. Submit to share them with the group.' : '')}
              </span>
            </div>
            <button type="button" className="button button-primary" onClick={submitAvailability} disabled={isSaving}>
              {myResponseName ? 'Update availability' : 'Submit availability'}
            </button>
          </div>

          <details className="quick-add">
            <summary>
              <svg className="summary-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <circle cx="10" cy="10" r="8.5" />
                <path d="M6.5 10h7" />
                <path className="summary-icon-vertical" d="M10 6.5v7" />
              </svg>
              <span>Add times without dragging</span>
            </summary>
            <QuickAddForm
              eventDates={eventDates}
              eventStartMinutes={eventStartMinutes}
              eventEndMinutes={eventEndMinutes}
              onAdd={(slotKeys) => changeSelection((current) => new Set([...current, ...slotKeys]))}
            />
          </details>

          <GroupResults
            eventCode={event.code}
            namesBySlot={namesBySlot}
            submittedNames={submittedNames}
            waitingNames={waitingNames}
            rosterSize={roster.length}
            isOwner={isOwner}
            confirmedTime={event.confirmedTime}
            onConfirm={async (time) => onEventChange(await setConfirmedTime(event.code, time))}
          />
        </section>
      </div>
    </div>
  );
};

import { useEffect, useState, type SetStateAction } from 'react';
import { useEvent } from '../hooks/useEvent';
import { useGuide } from '../hooks/useGuide';
import { useSuggestions } from '../hooks/useSuggestions';
import {
  EventStorageError,
  getOwnContact,
  rememberJoinedEvent,
  saveContact,
  saveResponse,
  setConfirmedTime,
} from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { addDays, formatDate } from '../utilities/date';
import { RETENTION_DAYS } from '../utilities/calendar';
import { isValidEmail } from '../utilities/email';
import { getEventDates, isEventDate } from '../utilities/eventDates';
import { getNameKey, getRoster, isOwnedBy } from '../utilities/eventStatus';
import { formatScheduleDay, getScheduleSummary, isWeekly } from '../utilities/schedule';
import { getTimeZoneName, getTimeZoneOptionLabel, isSelectableTimeZone, TIME_ZONE_OPTIONS } from '../utilities/timeZones';
import { projectGrid } from '../utilities/zonedSchedule';
import { formatDuration, formatTime, formatTimeRange, getTimeSlots, parseTimeValue, SLOT_LENGTH_MINUTES } from '../utilities/time';
import { AvailabilityGrid } from './AvailabilityGrid';
import { AvailabilitySteps } from './AvailabilitySteps';
import { ConfirmedBanner } from './ConfirmedBanner';
import { GroupResults } from './GroupResults';
import { GuideTip } from './GuideTip';
import { Link } from './Link';
import { QuickAddForm } from './QuickAddForm';
import { ResponseStatus } from './ResponseStatus';
import { SharePanel } from './SharePanel';
import { SuggestionsPanel } from './SuggestionsPanel';
import { SuggestTimeForm } from './SuggestTimeForm';

const formatShortDate = (date: string) => formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });

const getDateSpan = (event: ScheduledEvent) => getScheduleSummary(event);

// What the organizer sends the group, minus the link (the share panel adds it): an invitation
// at first, a nudge naming who's missing once people answer, an announcement once confirmed.
const getInviteText = (event: ScheduledEvent, waitingNames: string[], responseCount: number) => {
  if (event.confirmedTime) {
    const { date, start, end } = event.confirmedTime;
    const place = event.location ? ` at ${event.location}` : '';
    return `“${event.title}” is confirmed for ${isWeekly(event) ? `every ${formatScheduleDay(event, date)}` : formatShortDate(date)}, ${formatTimeRange(start, end)}${place}. Add it to your calendar here:`;
  }
  const noCode = 'Just open the link, no sign-up or code needed.';
  if (responseCount === 0) return `You’re invited to “${event.title}”! Mark the ${isWeekly(event) ? 'weekly ' : ''}times you’re free so we can pick one. ${noCode}`;
  const greeting = waitingNames.length > 0 ? `Hi ${waitingNames.join(', ')}! ` : '';
  return `${greeting}Please add your availability for “${event.title}” so we can pick a time. ${noCode}`;
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
  const guide = useGuide();
  const { suggestions, error: suggestionsError } = useSuggestions(event.code, isOwner);

  // Participants find this event again under "Events you joined" on the home page.
  useEffect(() => {
    // Only a convenience for the home page; a failure here shouldn't bother anyone.
    if (!isOwner) rememberJoinedEvent(event).catch((error: unknown) => console.error(error));
    // Once per visit, not on every live update of the event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.code, isOwner]);
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [displayTimeZone, setDisplayTimeZone] = useState(event.timeZone);
  const [savedDisplayTimeZone, setSavedDisplayTimeZone] = useState(event.timeZone);
  const [hasChosenTimeZone, setHasChosenTimeZone] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => new Set());
  // Whose saved response is loaded into the grid, so switching names never leaks or wipes picks.
  const [loadedResponseName, setLoadedResponseName] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const eventStartMinutes = parseTimeValue(event.startTime);
  const eventEndMinutes = parseTimeValue(event.endTime);
  const timeSlots = getTimeSlots(eventStartMinutes, eventEndMinutes);
  const eventDates = getEventDates(event);
  const convertedGrid = displayTimeZone === event.timeZone
    ? null
    : projectGrid(event, eventDates, timeSlots, displayTimeZone);
  const displayDates = convertedGrid?.dates ?? eventDates;
  const displayMinutes = convertedGrid?.timeSlots ?? timeSlots;
  const displaySlotMap = convertedGrid?.canonicalSlotsByDisplay;
  const timeZoneOptions = [event.timeZone, ...TIME_ZONE_OPTIONS.map((option) => option.id)]
    .filter((zone, index, all) => all.indexOf(zone) === index);

  const { submittedNames, waitingNames, roster } = getRoster(event);
  const findResponseName = (name: string) =>
    submittedNames.find((submittedName) => getNameKey(submittedName) === getNameKey(name));

  const isInEvent = (slotKey: string) => {
    const [date, minuteValue] = slotKey.split('|');
    const minutes = Number(minuteValue);
    return isEventDate(event, date) && minutes >= eventStartMinutes && minutes < eventEndMinutes;
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
  const hasUnsavedSlots =
    savedSlots.size !== selectedSlots.size ||
    Array.from(selectedSlots).some((slotKey) => !savedSlots.has(slotKey));
  const hasUnsavedChanges = hasUnsavedSlots || displayTimeZone !== savedDisplayTimeZone;
  // Submitted means the grid shows this name's saved times, unchanged.
  const isSubmitted = loadedResponseName !== null && !hasUnsavedChanges &&
    getNameKey(loadedResponseName) === getNameKey(participantName);

  const changeSelection = (update: SetStateAction<Set<string>>) => {
    setSelectedSlots(update);
    setSubmitMessage('');
  };

  // Runs when the name field is committed (blur or Enter), not per keystroke, so typing
  // "Alex" past an existing "Al" never swaps the grid mid-word.
  const loadResponseForName = () => {
    void prefillEmail(participantName.trim());
    if (guide.step === 1 && participantName.trim()) guide.goTo(2);
    const existingName = findResponseName(participantName.trim()) ?? null;
    if (existingName === loadedResponseName) return;
    if (hasUnsavedSlots) {
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
      if (contact) {
        setParticipantEmail((current) => current || contact.email);
        const savedZone = contact.timeZone &&
          (contact.timeZone === event.timeZone || isSelectableTimeZone(contact.timeZone))
          ? contact.timeZone : event.timeZone;
        setSavedDisplayTimeZone(savedZone);
        if (!hasChosenTimeZone && contact.timeZone &&
          (contact.timeZone === event.timeZone || isSelectableTimeZone(contact.timeZone))) {
          setDisplayTimeZone(contact.timeZone);
        }
      }
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
      if (!isOwner) rememberJoinedEvent(event, name).catch((error: unknown) => console.error(error));
      if (guide.step !== null) guide.finish();
      try {
        await saveContact(event.code, { name, email, timeZone: displayTimeZone === event.timeZone ? undefined : displayTimeZone });
        setSavedDisplayTimeZone(displayTimeZone);
      } catch (error) {
        console.error(error);
        setSubmitMessage(`Availability submitted for ${name}, but your contact preferences couldn’t be saved. Try submitting again.`);
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
          displayTimeZone={isOwner ? event.timeZone : displayTimeZone}
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
                <dt>{isWeekly(event) ? 'Days' : 'Dates'}</dt>
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
              {isOwner && event.expiresAt && (
                <div>
                  <dt>Deleted</dt>
                  <dd>
                    {/* Kept through the 7th day after the last one; gone as the 8th begins, in the event's zone. */}
                    {isWeekly(event)
                      ? new Intl.DateTimeFormat('en-US', {
                        timeZone: event.timeZone, month: 'short', day: 'numeric', year: 'numeric',
                      }).format(new Date(event.expiresAt))
                      : formatDate(addDays(event.endDate, RETENTION_DAYS + 1), { month: 'short', day: 'numeric' })}
                    <span className="fact-note">{isWeekly(event) ? 'Automatically, one year after creation' : 'Automatically, a week after the last day'}</span>
                  </dd>
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

          {isOwner && suggestions.length > 0 && (
            <a className="suggestion-alert" href="#suggestions">
              <strong>
                {suggestions.length === 1
                  ? `${suggestions[0].name} suggested a new time`
                  : `${suggestions.length} new time suggestions`}
              </strong>
              <span>Review</span>
            </a>
          )}
          {isOwner && (
            <SharePanel
              code={event.code}
              title={event.title}
              message={getInviteText(event, waitingNames, submittedNames.length)}
            />
          )}
          {isOwner && (
            <SuggestionsPanel
              event={event}
              suggestions={suggestions}
              loadError={suggestionsError}
              onEventChange={onEventChange}
            />
          )}
          {isOwner && (
            <div className="collapsible" data-open={areDetailsOpen}>
              <ResponseStatus submittedNames={submittedNames} waitingNames={waitingNames} rosterSize={roster.length} />
            </div>
          )}
        </aside>

        <section className="availability-panel" aria-labelledby="availability-heading">
          <h2 id="availability-heading" className="section-title">Your availability</h2>
          <p className="section-lede">
            {event.confirmedTime
              ? 'The meeting time is set. You can still update your availability here; it won’t change the confirmed time.'
              : 'Enter your name, then tap or drag across the times you’re free.'}
          </p>
          <AvailabilitySteps
            hasName={participantName.trim() !== ''}
            hasTimes={selectedInEvent.length > 0}
            isSubmitted={isSubmitted}
            guideStep={guide.step}
            onShowGuide={guide.start}
          />

          {guide.step === 1 && (
            <GuideTip step={1} onBack={guide.back} onNext={guide.next} onSkip={guide.finish} />
          )}
          <div className={`participant-fields${guide.step === 1 ? ' guide-target' : ''}`}>
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

            {!isOwner && <div className="name-field-wrap">
              <label className="field-label" htmlFor="participant-time-zone">Show times in</label>
              <select
                id="participant-time-zone"
                className="text-field"
                value={displayTimeZone}
                onChange={(changeEvent) => {
                  setDisplayTimeZone(changeEvent.target.value);
                  setHasChosenTimeZone(true);
                  setSubmitMessage('');
                }}
              >
                {timeZoneOptions.map((zone) => <option key={zone} value={zone}>{getTimeZoneOptionLabel(zone)}{zone === event.timeZone ? ' (event default)' : ''}</option>)}
              </select>
              <p className="field-hint">Your picks are converted automatically for the organizer. Your choice is saved with your response.</p>
              {isWeekly(event) && <p className="field-hint">Weekly times follow the current week’s daylight saving offset.</p>}
            </div>}
          </div>

          {guide.step === 2 && (
            <GuideTip step={2} onBack={guide.back} onNext={guide.next} onSkip={guide.finish} />
          )}
          <div className={guide.step === 2 ? 'guide-target' : undefined}>
            <AvailabilityGrid
              eventDates={displayDates}
              scheduleMode={event.scheduleMode}
              timeSlots={displayMinutes}
              canonicalSlotsByDisplay={displaySlotMap}
              selectedSlots={selectedSlots}
              onSelectedSlotsChange={changeSelection}
              namesBySlot={namesBySlot}
              myResponseName={myResponseName}
              liveTotal={liveTotal}
              bestSlotKeys={bestSlotKeys}
            />
          </div>

          {guide.step === 3 && (
            <GuideTip step={3} onBack={guide.back} onNext={guide.next} onSkip={guide.finish} />
          )}
          {(!event.confirmedTime || isParticipating || guide.step === 3) && <div className={`save-bar${event.confirmedTime ? ' is-inline' : ''}${guide.step === 3 ? ' guide-target' : ''}`}>
            <div className="save-status" aria-live="polite">
              <strong>{selectionSummary}</strong>
              <span className={`submit-message${!submitMessage && hasUnsavedChanges ? ' is-unsaved' : ''}`}>
                {submitMessage || (hasUnsavedChanges ? 'Unsaved changes. Submit to share them with the group.' : '')}
              </span>
            </div>
            <button type="button" className="button button-primary" onClick={submitAvailability} disabled={isSaving}>
              {myResponseName ? 'Update availability' : 'Submit availability'}
            </button>
          </div>}

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
              key={`${displayTimeZone}|${displayDates.join('|')}`}
              eventDates={displayDates}
              scheduleMode={event.scheduleMode}
              eventStartMinutes={displayMinutes[0] ?? eventStartMinutes}
              eventEndMinutes={(displayMinutes.at(-1) ?? eventEndMinutes - SLOT_LENGTH_MINUTES) + SLOT_LENGTH_MINUTES}
              canonicalSlotsByDisplay={displaySlotMap}
              onAdd={(slotKeys) => changeSelection((current) => new Set([...current, ...slotKeys]))}
            />
          </details>

          {!isOwner && (
            <details className="quick-add">
              <summary>
                <svg className="summary-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <circle cx="10" cy="10" r="8.5" />
                  <path d="M6.5 10h7" />
                  <path className="summary-icon-vertical" d="M10 6.5v7" />
                </svg>
                <span>Suggest another time</span>
              </summary>
              <SuggestTimeForm
                eventCode={event.code}
                scheduleMode={event.scheduleMode}
                participantName={participantName}
                timeZone={event.timeZone}
                defaultDate={event.endDate}
                defaultStart={eventStartMinutes}
              />
            </details>
          )}
          <GroupResults
            eventCode={event.code}
            scheduleMode={event.scheduleMode}
            eventTimeZone={event.timeZone}
            displayTimeZone={isOwner ? event.timeZone : displayTimeZone}
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

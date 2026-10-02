import { useState, type FormEvent } from 'react';
import './App.css';

const SLOT_LENGTH_MINUTES = 30;

const twoDigits = (value: number) => value < 10 ? `0${value}` : `${value}`;

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = twoDigits(date.getMonth() + 1);
  const day = twoDigits(date.getDate());
  return `${year}-${month}-${day}`;
};

const parseDateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const addDays = (dateValue: string, days: number) => {
  const date = parseDateValue(dateValue);
  date.setDate(date.getDate() + days);
  return toDateValue(date);
};

const formatDate = (dateValue: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options).format(parseDateValue(dateValue));

const formatTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hours < 12 ? 'AM' : 'PM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minute === 0 ? '00' : minute} ${period}`;
};

const getTimeSlots = (startMinutes: number, endMinutes: number) =>
  Array.from(
    { length: Math.max(0, Math.floor((endMinutes - startMinutes) / SLOT_LENGTH_MINUTES)) },
    (_, index) => startMinutes + index * SLOT_LENGTH_MINUTES,
  );

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

const getNameKey = (name: string) => name.trim().toLocaleLowerCase();
const getSlotKey = (date: string, minutes: number) => `${date}|${minutes}`;

const App = () => {
  const today = toDateValue(new Date());
  const [title, setTitle] = useState('Team sync');
  const [description, setDescription] = useState('Find a time that works for everyone.');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 6));
  const [eventStartTime, setEventStartTime] = useState('08:00');
  const [eventEndTime, setEventEndTime] = useState('17:00');
  const [visibleStart, setVisibleStart] = useState(today);
  const [inviteesInput, setInviteesInput] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [availableSlots, setAvailableSlots] = useState<Set<string>>(() => new Set());
  const [responses, setResponses] = useState<Record<string, string[]>>({});
  const [quickDate, setQuickDate] = useState(today);
  const [quickStartTime, setQuickStartTime] = useState('09:00');
  const [quickEndTime, setQuickEndTime] = useState('10:00');
  const [quickError, setQuickError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');

  const eventStartMinutes = Number(eventStartTime.slice(0, 2)) * 60 + Number(eventStartTime.slice(3, 5));
  const eventEndMinutes = Number(eventEndTime.slice(0, 2)) * 60 + Number(eventEndTime.slice(3, 5));
  const timeSlots = getTimeSlots(eventStartMinutes, eventEndMinutes);
  const lastVisibleStart = addDays(startDate, Math.max(0, Math.round(
    (parseDateValue(endDate).getTime() - parseDateValue(startDate).getTime()) / 86400000,
  ) - 6));
  const dates = Array.from({ length: 7 }, (_, index) => addDays(visibleStart, index))
    .filter((date) => date >= startDate && date <= endDate);
  const invitees = getNames(inviteesInput);
  const submittedNames = Object.keys(responses);
  const submittedNameKeys = new Set(submittedNames.map(getNameKey));
  const roster = [...invitees];
  submittedNames.forEach((name) => {
    if (!roster.some((rosterName) => getNameKey(rosterName) === getNameKey(name))) roster.push(name);
  });
  const waitingNames = roster.filter((name) => !submittedNameKeys.has(getNameKey(name)));

  const counts = new Map<string, number>();
  submittedNames.forEach((name) => {
    new Set(responses[name]).forEach((slotKey) => {
      const [date, minuteValue] = slotKey.split('|');
      const minutes = Number(minuteValue);
      if (
        date >= startDate &&
        date <= endDate &&
        minutes >= eventStartMinutes &&
        minutes < eventEndMinutes
      ) {
        counts.set(slotKey, (counts.get(slotKey) ?? 0) + 1);
      }
    });
  });
  const highestCount = Math.max(0, ...counts.values());
  const bestSlotKeys = highestCount > 0
    ? Array.from(counts.entries())
      .filter(([, count]) => count === highestCount)
      .map(([slotKey]) => slotKey)
      .sort((first, second) => {
        const [firstDate, firstMinutes] = first.split('|');
        const [secondDate, secondMinutes] = second.split('|');
        return firstDate.localeCompare(secondDate) || Number(firstMinutes) - Number(secondMinutes);
      })
    : [];
  const selectedCount = Array.from(availableSlots).filter((slotKey) => {
    const date = slotKey.split('|')[0];
    return date >= startDate && date <= endDate;
  }).length;
  const quickStartMinutes = Number(quickStartTime.slice(0, 2)) * 60 + Number(quickStartTime.slice(3, 5));
  const quickEndMinutes = Number(quickEndTime.slice(0, 2)) * 60 + Number(quickEndTime.slice(3, 5));

  const findResponseName = (name: string) =>
    submittedNames.find((submittedName) => getNameKey(submittedName) === getNameKey(name));

  const updateParticipantName = (name: string) => {
    setParticipantName(name);
    const existingName = findResponseName(name);
    setAvailableSlots(new Set(existingName ? responses[existingName] : []));
    setSubmitMessage('');
  };

  const toggleSlot = (slotKey: string) => {
    setAvailableSlots((currentSlots) => {
      const nextSlots = new Set(currentSlots);
      if (nextSlots.has(slotKey)) nextSlots.delete(slotKey);
      else nextSlots.add(slotKey);
      return nextSlots;
    });
    setSubmitMessage('');
  };

  const submitAvailability = () => {
    const name = participantName.trim();
    if (!name) {
      setSubmitMessage('Enter your name before submitting availability.');
      return;
    }
    const existingName = findResponseName(name);
    setResponses((currentResponses) => {
      const nextResponses = { ...currentResponses };
      if (existingName && existingName !== name) delete nextResponses[existingName];
      nextResponses[name] = Array.from(availableSlots);
      return nextResponses;
    });
    setParticipantName(name);
    setSubmitMessage(`Availability submitted for ${name}.`);
  };

  const addQuickAvailability = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuickError('');
    if (!participantName.trim()) {
      setQuickError('Enter your name before adding availability.');
      return;
    }
    if (quickDate < startDate || quickDate > endDate) {
      setQuickError('Choose a date within the event date range.');
      return;
    }
    if (quickStartMinutes >= quickEndMinutes) {
      setQuickError('The end time must be after the start time.');
      return;
    }
    if (quickStartMinutes < eventStartMinutes || quickEndMinutes > eventEndMinutes) {
      setQuickError('Choose times within the event time range.');
      return;
    }
    const addedSlots = getTimeSlots(quickStartMinutes, quickEndMinutes)
      .map((minutes) => getSlotKey(quickDate, minutes));
    setAvailableSlots((currentSlots) => new Set([...currentSlots, ...addedSlots]));
    setSubmitMessage('');
  };

  const changeStartDate = (value: string) => {
    if (!value) return;
    setStartDate(value);
    if (value > endDate) setEndDate(value);
    setVisibleStart(value);
    setQuickDate(value);
  };

  const changeEndDate = (value: string) => {
    if (!value) return;
    const nextStartDate = value < startDate ? value : startDate;
    setStartDate(nextStartDate);
    setEndDate(value);
    if (visibleStart < nextStartDate || visibleStart > value) setVisibleStart(nextStartDate);
    if (quickDate < nextStartDate || quickDate > value) setQuickDate(nextStartDate);
  };

  const changeEventTime = (value: string, isStart: boolean) => {
    if (!value) return;
    if (isStart) setEventStartTime(value);
    else setEventEndTime(value);
  };

  const currentNameForEditing = findResponseName(participantName.trim());
  const responseCount = submittedNames.length;
  const responseTotal = Math.max(roster.length, responseCount);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="#main" aria-label="Goodtime home">
          <span className="wordmark-mark" aria-hidden="true">g</span>
          <span>goodtime</span>
        </a>
        <span className="topbar-note">A little less back-and-forth</span>
        <span className="draft-indicator"><span /> Local session</span>
      </header>

      <div className="workspace" id="main">
        <section className="event-panel" aria-labelledby="event-heading">
          <div className="eyebrow"><span className="eyebrow-line" /> MAKE A PLAN</div>
          <h1 id="event-heading">When works<br />for your people?</h1>
          <p className="intro-copy">Set the scene, add your name, then pick the moments you can make.</p>

          <div className="form-fields">
            <label className="field-label" htmlFor="event-title">EVENT TITLE</label>
            <input
              id="event-title"
              className="text-field title-field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What are we getting together for?"
              maxLength={80}
            />

            <label className="field-label description-label" htmlFor="event-description">
              A FEW DETAILS <span>OPTIONAL</span>
            </label>
            <textarea
              id="event-description"
              className="text-field description-field"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a note for your group"
              rows={3}
              maxLength={240}
            />

            <div className="event-range-fields">
              <div>
                <label className="field-label" htmlFor="event-start-date">START DATE</label>
                <input
                  id="event-start-date"
                  className="text-field date-input"
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(event) => changeStartDate(event.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="event-end-date">END DATE</label>
                <input
                  id="event-end-date"
                  className="text-field date-input"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => changeEndDate(event.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="event-start-time">FROM</label>
                <input
                  id="event-start-time"
                  className="text-field date-input"
                  type="time"
                  step={SLOT_LENGTH_MINUTES * 60}
                  value={eventStartTime}
                  onChange={(event) => changeEventTime(event.target.value, true)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="event-end-time">UNTIL</label>
                <input
                  id="event-end-time"
                  className="text-field date-input"
                  type="time"
                  step={SLOT_LENGTH_MINUTES * 60}
                  value={eventEndTime}
                  onChange={(event) => changeEventTime(event.target.value, false)}
                />
              </div>
            </div>
            {eventStartMinutes >= eventEndMinutes && (
              <p className="form-error" role="alert">The event end time must be after its start time.</p>
            )}

            <div className="participant-field">
              <label className="field-label" htmlFor="invitees">INVITED PARTICIPANTS <span>COMMA SEPARATED</span></label>
              <textarea
                id="invitees"
                className="text-field invitees-field"
                value={inviteesInput}
                onChange={(event) => setInviteesInput(event.target.value)}
                placeholder="Alex, Sam, Jordan"
                rows={2}
              />
            </div>

            <div className="participant-field">
              <label className="field-label" htmlFor="participant-name">YOUR NAME</label>
              <input
                id="participant-name"
                className="text-field"
                value={participantName}
                onChange={(event) => updateParticipantName(event.target.value)}
                placeholder="Name"
                autoComplete="name"
                maxLength={50}
              />
            </div>
          </div>

          <div className="selection-summary" aria-live="polite">
            <span className="summary-icon" aria-hidden="true">+</span>
            <div>
              <strong>{selectedCount} {selectedCount === 1 ? 'time' : 'times'} selected</strong>
              <span>{participantName.trim() || 'Your availability'} · across the event date range</span>
            </div>
          </div>
          <p className="privacy-note"><span aria-hidden="true">●</span> Responses stay in this page session.</p>
        </section>

        <section className="availability-panel" aria-labelledby="availability-heading">
          <div className="event-description-card">
            <div className="eyebrow schedule-eyebrow">EVENT DETAILS</div>
            <h2>{title.trim() || 'Untitled event'}</h2>
            <p>{description.trim() || 'No event description added.'}</p>
          </div>

          <div className="schedule-header">
            <div>
              <div className="eyebrow schedule-eyebrow">YOUR AVAILABILITY</div>
              <h2 id="availability-heading">Choose your times</h2>
            </div>
            <div className="week-controls" aria-label="Navigate event dates">
              <button
                type="button"
                className="week-button"
                disabled={visibleStart <= startDate}
                onClick={() => setVisibleStart((current) => {
                  const previous = addDays(current, -7);
                  return previous < startDate ? startDate : previous;
                })}
                aria-label="Previous dates"
              >
                <span aria-hidden="true">←</span> Previous
              </button>
              <button
                type="button"
                className="week-button"
                disabled={visibleStart >= lastVisibleStart}
                onClick={() => setVisibleStart((current) => {
                  const next = addDays(current, 7);
                  return next > lastVisibleStart ? lastVisibleStart : next;
                })}
                aria-label="Next dates"
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="date-range" aria-live="polite">
            {dates.length > 0 && <>
              {formatDate(dates[0], { month: 'long', day: 'numeric' })} – {formatDate(dates[dates.length - 1], { month: 'long', day: 'numeric', year: 'numeric' })}
            </>}
          </div>

          <div className="grid-scroll" role="region" aria-label="Weekly availability grid" tabIndex={0}>
            <div className="availability-grid" role="grid" aria-label="Availability by day and time">
              <div className="time-heading" role="columnheader">TIME</div>
              {dates.map((date) => (
                <div className="day-heading" role="columnheader" key={date}>
                  <span>{formatDate(date, { weekday: 'short' }).toUpperCase()}</span>
                  <strong>{formatDate(date, { day: 'numeric' })}</strong>
                </div>
              ))}

              {timeSlots.map((minutes) => (
                <div className="time-row" role="row" key={minutes}>
                  <div className="time-label" role="rowheader">{formatTime(minutes)}</div>
                  {dates.map((date) => {
                    const slotKey = getSlotKey(date, minutes);
                    const isAvailable = availableSlots.has(slotKey);
                    const isRecommended = bestSlotKeys.indexOf(slotKey) !== -1;
                    const count = counts.get(slotKey) ?? 0;

                    return (
                      <button
                        className={`time-slot${isAvailable ? ' is-available' : ''}${isRecommended ? ' is-recommended' : ''}`}
                        type="button"
                        role="gridcell"
                        aria-pressed={isAvailable}
                        aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${formatTime(minutes)}, ${count} of ${responseCount} participants available${isRecommended ? ', best meeting time' : ''}`}
                        key={slotKey}
                        onClick={() => toggleSlot(slotKey)}
                      >
                        <span>{count}/{responseCount}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="grid-legend">
            <span className="legend-item"><span className="legend-swatch available-swatch" /> Your pick</span>
            <span className="legend-item"><span className="legend-swatch recommended-swatch" /> Best time</span>
            <span className="legend-caption">Tap slots to select or remove availability</span>
          </div>

          <form className="quick-availability" onSubmit={addQuickAvailability}>
            <div>
              <div className="eyebrow schedule-eyebrow">ADD A TIME RANGE</div>
              <p>Choose a date and time range to add several slots at once.</p>
            </div>
            <div className="quick-fields">
              <label>
                <span>Date</span>
                <input
                  className="text-field date-input"
                  type="date"
                  min={startDate}
                  max={endDate}
                  value={quickDate}
                  onChange={(event) => setQuickDate(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Start</span>
                <input
                  className="text-field date-input"
                  type="time"
                  step={SLOT_LENGTH_MINUTES * 60}
                  value={quickStartTime}
                  onChange={(event) => setQuickStartTime(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>End</span>
                <input
                  className="text-field date-input"
                  type="time"
                  step={SLOT_LENGTH_MINUTES * 60}
                  value={quickEndTime}
                  onChange={(event) => setQuickEndTime(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className="submit-button quick-add-button">Add times</button>
            </div>
            {quickError && <p className="form-error quick-error" role="alert">{quickError}</p>}
          </form>

          <div className="response-submit-row">
            <button type="button" className="submit-button" onClick={submitAvailability}>
              {currentNameForEditing ? 'Update availability' : 'Submit availability'}
            </button>
            <span className="submit-message" aria-live="polite">{submitMessage}</span>
          </div>

          <section className="insights-section" aria-labelledby="best-times-heading">
            <div className="insights-title-row">
              <div>
                <div className="eyebrow schedule-eyebrow">GROUP AVAILABILITY</div>
                <h2 id="best-times-heading">Best Meeting Times</h2>
              </div>
              {responseCount > 0 && <span className="best-count">{highestCount}/{responseCount} available</span>}
            </div>
            {responseCount === 0 ? (
              <p className="insight-empty">Submit availability to see the best meeting times.</p>
            ) : bestSlotKeys.length === 0 ? (
              <p className="insight-empty">No availability selected yet. Add times to find a match.</p>
            ) : (
              <>
                <p className={highestCount === responseCount ? 'insight-summary' : 'insight-summary no-perfect-overlap'}>
                  {highestCount === responseCount
                    ? 'Everyone who has responded is available at these times.'
                    : 'No time works for everyone. Best alternatives:'}
                </p>
                <ul className="best-times-list">
                  {bestSlotKeys.map((slotKey) => {
                    const [date, minuteValue] = slotKey.split('|');
                    const minutes = Number(minuteValue);
                    return (
                      <li key={slotKey}>
                        <strong>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                        <span>{formatTime(minutes)} – {formatTime(minutes + SLOT_LENGTH_MINUTES)}</span>
                        <span className="best-time-count">{highestCount} of {responseCount} available</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="insights-section response-section" aria-labelledby="responses-heading">
            <div className="insights-title-row">
              <div>
                <div className="eyebrow schedule-eyebrow">PARTICIPANT STATUS</div>
                <h2 id="responses-heading">Responses: {responseCount} / {responseTotal}</h2>
              </div>
            </div>
            <div className="response-lists">
              <div>
                <h3>Submitted <span>{responseCount}</span></h3>
                {submittedNames.length > 0 ? (
                  <ul>{submittedNames.map((name) => <li key={name}>{name}</li>)}</ul>
                ) : <p>No responses yet.</p>}
              </div>
              <div>
                <h3>Waiting for response <span>{waitingNames.length}</span></h3>
                {waitingNames.length > 0 ? (
                  <ul>{waitingNames.map((name) => <li key={getNameKey(name)}>{name}</li>)}</ul>
                ) : <p>{roster.length === 0 ? 'Add invitees to track responses.' : 'Everyone has responded.'}</p>}
              </div>
            </div>
          </section>
        </section>
      </div>

      <footer className="page-footer">
        <span>GOODTIME <span className="footer-dot">/</span> BETTER PLANS, TOGETHER</span>
        <span>ONE EVENT AT A TIME</span>
      </footer>
    </main>
  );
};

export default App;

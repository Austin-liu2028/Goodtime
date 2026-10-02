import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import './App.css';
import {
  applySelection,
  getBestRanges,
  getEveryoneAvailableRanges,
  getRectangleSlotKeys,
  getSlotKey,
  type SelectionMode,
  type SlotPosition,
} from './utilities/availability';
import { addDays, daysBetween, formatDate, toDateValue, twoDigits } from './utilities/date';
import { DateRangePicker } from './components/DateRangePicker';

interface DragSelection {
  mode: SelectionMode;
  start: SlotPosition;
  slotsBeforeDrag: Set<string>;
}

const SLOT_LENGTH_MINUTES = 30;
const BEST_RANGE_LIMIT = 5;
const HEAT_LEVELS = 4;

// Share of people free, bucketed into 0 (nobody) .. HEAT_LEVELS (everyone) for the heatmap shade.
const getHeatLevel = (count: number, total: number) =>
  count === 0 || total === 0 ? 0 : Math.max(1, Math.ceil((count / total) * HEAT_LEVELS));

const formatTime = (minutes: number) => {
  // 24:00 (an event running until midnight) reads as 12:00 AM.
  const hours = Math.floor(minutes / 60) % 24;
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

const toTimeValue = (minutes: number) => `${twoDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;

// English labels regardless of browser locale; native time inputs follow the OS language.
const startTimeOptions = getTimeSlots(0, 24 * 60).map((minutes) => (
  <option key={minutes} value={toTimeValue(minutes)}>{formatTime(minutes)}</option>
));
const endTimeOptions = getTimeSlots(SLOT_LENGTH_MINUTES, 24 * 60 + SLOT_LENGTH_MINUTES).map((minutes) => (
  <option key={minutes} value={toTimeValue(minutes)}>
    {formatTime(minutes)}{minutes === 24 * 60 ? ' (midnight)' : ''}
  </option>
));

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
  // Whose saved response is loaded into the grid, so switching names never leaks or wipes picks.
  const [loadedResponseName, setLoadedResponseName] = useState<string | null>(null);
  const [quickDate, setQuickDate] = useState(today);
  const [quickStartTime, setQuickStartTime] = useState('09:00');
  const [quickEndTime, setQuickEndTime] = useState('10:00');
  const [quickError, setQuickError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  // Roving focus: only one grid cell is in the tab order; arrow keys move it.
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = dragSelection !== null;

  useEffect(() => {
    if (!isDragging) return;
    const endDrag = () => setDragSelection(null);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [isDragging]);

  const eventStartMinutes = Number(eventStartTime.slice(0, 2)) * 60 + Number(eventStartTime.slice(3, 5));
  const eventEndMinutes = Number(eventEndTime.slice(0, 2)) * 60 + Number(eventEndTime.slice(3, 5));
  const timeSlots = getTimeSlots(eventStartMinutes, eventEndMinutes);
  const lastVisibleStart = addDays(startDate, Math.max(0, daysBetween(startDate, endDate) - 6));
  const eventDates = Array.from({ length: daysBetween(startDate, endDate) + 1 }, (_, index) => addDays(startDate, index));
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
  const findResponseName = (name: string) =>
    submittedNames.find((submittedName) => getNameKey(submittedName) === getNameKey(name));

  const isInEvent = (slotKey: string) => {
    const [date, minuteValue] = slotKey.split('|');
    const minutes = Number(minuteValue);
    return date >= startDate && date <= endDate && minutes >= eventStartMinutes && minutes < eventEndMinutes;
  };

  // Submitted responses only: this drives the group results.
  const namesBySlot = new Map<string, string[]>();
  submittedNames.forEach((name) => {
    new Set(responses[name]).forEach((slotKey) => {
      if (isInEvent(slotKey)) namesBySlot.set(slotKey, [...(namesBySlot.get(slotKey) ?? []), name]);
    });
  });
  const highestCount = Math.max(0, ...Array.from(namesBySlot.values(), (names) => names.length));
  const bestSlotKeys = new Set(highestCount > 0
    ? Array.from(namesBySlot.entries())
      .filter(([, names]) => names.length === highestCount)
      .map(([slotKey]) => slotKey)
    : []);
  const selectedCount = Array.from(availableSlots).filter(isInEvent).length;

  // The grid counts also include your unsubmitted picks, so a slot you just chose never reads 0.
  const myResponseName = findResponseName(participantName.trim());
  const isParticipating = participantName.trim() !== '' || availableSlots.size > 0;
  const liveTotal = submittedNames.length - (myResponseName ? 1 : 0) + (isParticipating ? 1 : 0);
  const getLiveNames = (slotKey: string) => [
    ...(namesBySlot.get(slotKey) ?? []).filter((name) => name !== myResponseName),
    ...(availableSlots.has(slotKey) ? ['you'] : []),
  ];

  const savedSlots = new Set(loadedResponseName ? responses[loadedResponseName] ?? [] : []);
  const hasUnsavedChanges =
    savedSlots.size !== availableSlots.size ||
    Array.from(availableSlots).some((slotKey) => !savedSlots.has(slotKey));
  const quickStartMinutes = Number(quickStartTime.slice(0, 2)) * 60 + Number(quickStartTime.slice(3, 5));
  const quickEndMinutes = Number(quickEndTime.slice(0, 2)) * 60 + Number(quickEndTime.slice(3, 5));

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
    setAvailableSlots(new Set(existingName ? responses[existingName] : []));
    setLoadedResponseName(existingName);
  };

  const visibleSlotKeys = timeSlots.map((minutes) => dates.map((date) => getSlotKey(date, minutes)));
  const tabbableSlotKey = activeSlotKey && dates.indexOf(activeSlotKey.split('|')[0]) !== -1 &&
    timeSlots.indexOf(Number(activeSlotKey.split('|')[1])) !== -1
    ? activeSlotKey
    : visibleSlotKeys[0]?.[0];

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) => {
    const lastRow = timeSlots.length - 1;
    const lastColumn = dates.length - 1;
    const targets: Record<string, [number, number]> = {
      ArrowUp: [Math.max(0, row - 1), column],
      ArrowDown: [Math.min(lastRow, row + 1), column],
      ArrowLeft: [row, Math.max(0, column - 1)],
      ArrowRight: [row, Math.min(lastColumn, column + 1)],
      Home: event.ctrlKey ? [0, 0] : [row, 0],
      End: event.ctrlKey ? [lastRow, lastColumn] : [row, lastColumn],
      PageUp: [0, column],
      PageDown: [lastRow, column],
    };
    const target = targets[event.key];
    if (!target) return;
    event.preventDefault();
    const nextKey = visibleSlotKeys[target[0]][target[1]];
    setActiveSlotKey(nextKey);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-slot-key="${nextKey}"]`)?.focus();
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

  const startDrag = (event: PointerEvent<HTMLButtonElement>, position: SlotPosition) => {
    if (event.button !== 0) return;
    // Touch pointers are captured by the first cell; release so pointerenter fires on the cells we pass over.
    event.currentTarget.releasePointerCapture(event.pointerId);
    const mode = availableSlots.has(getSlotKey(position.date, position.minutes)) ? 'remove' : 'add';
    setDragSelection({ mode, start: position, slotsBeforeDrag: availableSlots });
    setAvailableSlots(applySelection(
      availableSlots,
      getRectangleSlotKeys(dates, timeSlots, position, position),
      mode,
    ));
    setSubmitMessage('');
  };

  const extendDrag = (event: PointerEvent<HTMLButtonElement>, position: SlotPosition) => {
    if (!dragSelection) return;
    // The button was released outside the window, so no pointerup reached us.
    if (event.buttons === 0) {
      setDragSelection(null);
      return;
    }
    setAvailableSlots(applySelection(
      dragSelection.slotsBeforeDrag,
      getRectangleSlotKeys(dates, timeSlots, dragSelection.start, position),
      dragSelection.mode,
    ));
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
    setLoadedResponseName(name);
    setSubmitMessage(`Availability submitted for ${name}.`);
  };

  const addQuickAvailability = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuickError('');
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

  const changeDateRange = (nextStartDate: string, nextEndDate: string) => {
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setVisibleStart(nextStartDate);
    if (quickDate < nextStartDate || quickDate > nextEndDate) setQuickDate(nextStartDate);
  };

  const changeEventTime = (value: string, isStart: boolean) => {
    if (!value) return;
    if (isStart) setEventStartTime(value);
    else setEventEndTime(value);
  };

  const currentNameForEditing = findResponseName(participantName.trim());
  const responseCount = submittedNames.length;
  const responseTotal = roster.length;
  const everyoneAvailableDays = getEveryoneAvailableRanges(namesBySlot, responseCount, SLOT_LENGTH_MINUTES);
  const bestRanges = getBestRanges(namesBySlot, SLOT_LENGTH_MINUTES, BEST_RANGE_LIMIT);

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
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                minDate={today}
                onChange={changeDateRange}
              />
              <div>
                <label className="field-label" htmlFor="event-start-time">FROM</label>
                <select
                  id="event-start-time"
                  className="text-field date-input"
                  value={eventStartTime}
                  onChange={(event) => changeEventTime(event.target.value, true)}
                >
                  {startTimeOptions}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="event-end-time">UNTIL</label>
                <select
                  id="event-end-time"
                  className="text-field date-input"
                  value={eventEndTime}
                  onChange={(event) => changeEventTime(event.target.value, false)}
                >
                  {endTimeOptions}
                </select>
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
                onChange={(event) => {
                  setParticipantName(event.target.value);
                  setSubmitMessage('');
                }}
                onBlur={loadResponseForName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') loadResponseForName();
                }}
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
            <div
              className="availability-grid"
              data-days={dates.length}
              role="grid"
              aria-label="Availability by day and time. Use arrow keys to move and Space to select."
              ref={gridRef}
            >
              <div className="time-heading" role="columnheader">TIME</div>
              {dates.map((date) => (
                <div className="day-heading" role="columnheader" key={date}>
                  <span>{formatDate(date, { weekday: 'short' }).toUpperCase()}</span>
                  <strong>{formatDate(date, { day: 'numeric' })}</strong>
                </div>
              ))}

              {timeSlots.map((minutes, row) => (
                <div className="time-row" role="row" key={minutes}>
                  <div className="time-label" role="rowheader">{formatTime(minutes)}</div>
                  {dates.map((date, column) => {
                    const slotKey = getSlotKey(date, minutes);
                    const isAvailable = availableSlots.has(slotKey);
                    const isRecommended = bestSlotKeys.has(slotKey);
                    const liveNames = getLiveNames(slotKey);
                    const count = liveNames.length;
                    const whoIsFree = count > 0 ? `: ${liveNames.join(', ')}` : '';
                    const readout = `${count} of ${liveTotal} available${whoIsFree}`;

                    return (
                      <button
                        className={`time-slot${isAvailable ? ' is-available' : ''}${isRecommended ? ' is-recommended' : ''}`}
                        type="button"
                        role="gridcell"
                        data-heat={getHeatLevel(count, liveTotal)}
                        data-slot-key={slotKey}
                        tabIndex={slotKey === tabbableSlotKey ? 0 : -1}
                        aria-pressed={isAvailable}
                        aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${formatTime(minutes)}, ${readout}${isRecommended ? ', best meeting time' : ''}`}
                        title={liveTotal > 0 ? readout : undefined}
                        key={slotKey}
                        onFocus={() => setActiveSlotKey(slotKey)}
                        onKeyDown={(event) => moveFocus(event, row, column)}
                        onPointerDown={(event) => startDrag(event, { date, minutes })}
                        onPointerEnter={(event) => extendDrag(event, { date, minutes })}
                        onClick={(event) => {
                          // Pointer clicks are handled by the drag; detail 0 means Enter/Space from the keyboard.
                          if (event.detail === 0) toggleSlot(slotKey);
                        }}
                      >
                        {count > 0 && <span>{count}/{liveTotal}</span>}
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
            <span className="legend-item heat-legend" aria-label="Darker green means more people are free">
              <span>Fewer free</span>
              {Array.from({ length: HEAT_LEVELS }, (_, index) => (
                <span className="legend-swatch heat-swatch" data-heat={index + 1} key={index} />
              ))}
              <span>Everyone</span>
            </span>
            <span className="legend-caption">Tap, drag, or use arrow keys and Space to pick times</span>
          </div>

          <div className="response-submit-row">
            <button type="button" className="submit-button" onClick={submitAvailability}>
              {currentNameForEditing ? 'Update availability' : 'Submit availability'}
            </button>
            <span className={`submit-message${!submitMessage && hasUnsavedChanges ? ' is-unsaved' : ''}`} aria-live="polite">
              {submitMessage || (hasUnsavedChanges ? 'Unsaved changes. Submit to share them with the group.' : '')}
            </span>
          </div>

          <form className="quick-availability" onSubmit={addQuickAvailability}>
            <div>
              <div className="eyebrow schedule-eyebrow">ADD A TIME RANGE</div>
              <p>Choose a date and time range to add several slots at once.</p>
            </div>
            <div className="quick-fields">
              <label>
                <span>Date</span>
                <select
                  className="text-field date-input"
                  value={quickDate}
                  onChange={(event) => setQuickDate(event.target.value)}
                >
                  {eventDates.map((date) => (
                    <option key={date} value={date}>
                      {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start</span>
                <select
                  className="text-field date-input"
                  value={quickStartTime}
                  onChange={(event) => setQuickStartTime(event.target.value)}
                >
                  {startTimeOptions}
                </select>
              </label>
              <label>
                <span>End</span>
                <select
                  className="text-field date-input"
                  value={quickEndTime}
                  onChange={(event) => setQuickEndTime(event.target.value)}
                >
                  {endTimeOptions}
                </select>
              </label>
              <button type="submit" className="submit-button quick-add-button">Add times</button>
            </div>
            {quickError && <p className="form-error quick-error" role="alert">{quickError}</p>}
          </form>

          <section className="insights-section" aria-labelledby="everyone-heading">
            <div className="insights-title-row">
              <div>
                <div className="eyebrow schedule-eyebrow">EVERYONE&apos;S FREE</div>
                <h2 id="everyone-heading">Works for Everyone</h2>
              </div>
              {everyoneAvailableDays.length > 0 && (
                <span className="everyone-count">{responseCount}/{responseCount} available</span>
              )}
            </div>
            {responseCount === 0 ? (
              <p className="insight-empty">Submit availability to see when everyone is free.</p>
            ) : everyoneAvailableDays.length === 0 ? (
              <p className="insight-summary no-perfect-overlap">
                No time works for all {responseCount} {responseCount === 1 ? 'person' : 'people'} yet. See the best alternatives below.
              </p>
            ) : (
              <ul className="everyone-list">
                {everyoneAvailableDays.map(({ date, ranges }) => (
                  <li key={date}>
                    <strong>{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                    <span className="everyone-ranges">
                      {ranges.map(({ start, end }) => (
                        <span className="everyone-range" key={start}>
                          {formatTime(start)} – {formatTime(end)}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {responseCount > 0 && waitingNames.length > 0 && (
              <p className="insight-empty">
                Based on {responseCount} of {responseTotal} responses. Still waiting on {waitingNames.join(', ')}.
              </p>
            )}
          </section>

          {responseCount > 0 && everyoneAvailableDays.length === 0 && (
            <section className="insights-section" aria-labelledby="best-times-heading">
              <div className="insights-title-row">
                <div>
                  <div className="eyebrow schedule-eyebrow">GROUP AVAILABILITY</div>
                  <h2 id="best-times-heading">Best Alternatives</h2>
                </div>
                {highestCount > 0 && <span className="best-count">{highestCount}/{responseCount} available</span>}
              </div>
              {bestRanges.length === 0 ? (
                <p className="insight-empty">No availability selected yet. Add times to find a match.</p>
              ) : (
                <ul className="best-times-list">
                  {bestRanges.map(({ date, start, end, names }) => {
                    const missingNames = submittedNames.filter((name) => names.indexOf(name) === -1);
                    return (
                      <li key={`${date}|${start}`}>
                        <strong>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                        <span>{formatTime(start)} – {formatTime(end)}</span>
                        <span className="best-time-count">{names.length} of {responseCount} available</span>
                        <span className="best-time-missing">Missing: {missingNames.join(', ')}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

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

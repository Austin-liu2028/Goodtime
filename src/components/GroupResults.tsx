import { useState, type FormEvent } from 'react';
import { EventStorageError } from '../services/events';
import type { ConfirmedTime } from '../types/event';
import { getAvailabilityRanges, getMeetingOptions, type AvailabilityRange } from '../utilities/availability';
import { formatDate } from '../utilities/date';
import { formatScheduleDay } from '../utilities/schedule';
import { formatDuration, formatTime, formatTimeRange, getTimeSlots, SLOT_LENGTH_MINUTES } from '../utilities/time';
import { getMeetingTimeText } from '../utilities/zonedSchedule';
import { Link } from './Link';

const OPTION_LIMIT = 5;

interface GroupResultsProps {
  eventCode: string;
  scheduleMode?: 'dates' | 'weekdays';
  eventTimeZone: string;
  displayTimeZone: string;
  namesBySlot: Map<string, string[]>;
  submittedNames: string[];
  waitingNames: string[];
  rosterSize: number;
  isOwner: boolean;
  confirmedTime: ConfirmedTime | null;
  onConfirm: (time: ConfirmedTime) => Promise<void>;
}

// The answer to "when should we meet?", so nobody has to read the heatmap themselves.
export const GroupResults = ({
  eventCode,
  scheduleMode,
  eventTimeZone,
  displayTimeZone,
  namesBySlot,
  submittedNames,
  waitingNames,
  rosterSize,
  isOwner,
  confirmedTime,
  onConfirm,
}: GroupResultsProps) => {
  const responseCount = submittedNames.length;
  // A time only one person can make isn't a meeting option.
  const options = getMeetingOptions(namesBySlot, SLOT_LENGTH_MINUTES, OPTION_LIMIT).filter(({ names }) => names.length >= 2);
  const everyoneWindowCount = getAvailabilityRanges(namesBySlot, SLOT_LENGTH_MINUTES)
    .filter(({ names }) => names.length === responseCount).length;
  const hasRecommendations = responseCount >= 2 && options.length > 0;

  return (
    <section className="insights-section" aria-labelledby="summary-heading">
      <div className="insights-title-row">
        <h2 id="summary-heading" className="section-title">{scheduleMode === 'weekdays' ? 'Best weekly times' : 'Best times'}</h2>
        {responseCount >= 2 && (
          <span className={`count-pill${everyoneWindowCount === 0 ? ' is-alert' : ''}`}>
            {everyoneWindowCount > 0
              ? `${everyoneWindowCount} ${everyoneWindowCount === 1 ? 'window works' : 'windows work'} for everyone`
              : 'No time works for everyone'}
          </span>
        )}
      </div>

      {responseCount === 0 && (
        <p className="insight-empty">No responses yet. Once people add their times, the best options show up here.</p>
      )}
      {responseCount === 1 && (
        <p className="insight-empty">
          Only {submittedNames[0]} has responded so far. Recommendations start once a second person adds their times.
        </p>
      )}

      {responseCount >= 2 && everyoneWindowCount === 0 && (
        <div className="no-overlap">
          <p>
            No time works for all {responseCount} people yet.
            {isOwner ? ` Try adding more ${scheduleMode === 'weekdays' ? 'days' : 'dates'} or hours. Everyone’s responses are kept.` : ' The closest options are below.'}
          </p>
          {isOwner && (
            <Link to={`/e/${eventCode}/edit`} className="button button-secondary button-small">
              <span aria-hidden="true">+</span> Add more {scheduleMode === 'weekdays' ? 'days' : 'dates'}
            </Link>
          )}
        </div>
      )}

      {hasRecommendations && (
        <ol className="meeting-options">
          {options.map((option, index) => (
            <MeetingOption
              key={`${option.date}|${option.start}`}
              option={option}
              scheduleMode={scheduleMode}
              eventTimeZone={eventTimeZone}
              displayTimeZone={displayTimeZone}
              isTop={index === 0}
              responseCount={responseCount}
              missingNames={submittedNames.filter((name) => option.names.indexOf(name) === -1)}
              isOwner={isOwner}
              isConfirmed={Boolean(confirmedTime && confirmedTime.date === option.date &&
                confirmedTime.start >= option.start && confirmedTime.end <= option.end)}
              onConfirm={onConfirm}
            />
          ))}
        </ol>
      )}

      {responseCount > 0 && waitingNames.length > 0 && (
        <p className="insight-empty">
          Based on {responseCount} of {rosterSize} responses. Still waiting on {waitingNames.join(', ')}.
        </p>
      )}
    </section>
  );
};

interface MeetingOptionProps {
  option: AvailabilityRange;
  scheduleMode?: 'dates' | 'weekdays';
  eventTimeZone: string;
  displayTimeZone: string;
  isTop: boolean;
  responseCount: number;
  missingNames: string[];
  isOwner: boolean;
  isConfirmed: boolean;
  onConfirm: (time: ConfirmedTime) => Promise<void>;
}

const MeetingOption = ({ option, scheduleMode, eventTimeZone, displayTimeZone, isTop, responseCount, missingNames, isOwner, isConfirmed, onConfirm }: MeetingOptionProps) => {
  const [isChoosing, setIsChoosing] = useState(false);
  const isEveryone = option.names.length === responseCount;
  const headingId = `option-${option.date}-${option.start}`;
  const converted = displayTimeZone === eventTimeZone ? null : getMeetingTimeText({
    confirmedTime: { date: option.date, start: option.start, end: option.end },
    scheduleMode, eventTimeZone, displayTimeZone,
  });

  return (
    <li className={`meeting-option${isTop ? ' is-top' : ''}${isEveryone ? ' is-everyone' : ''}`} aria-labelledby={headingId}>
      <div className="option-main">
        {(isTop || isConfirmed) && (
          <span className="option-tags">
            {isTop && <span className="option-tag">Best option</span>}
            {isConfirmed && <span className="option-tag is-confirmed">Confirmed</span>}
          </span>
        )}
        <strong id={headingId} className="option-time">
          {converted
            ? `${converted.shortDate} · ${converted.timeRange} (${converted.zone})`
            : `${scheduleMode === 'weekdays' ? `Every ${formatScheduleDay({ scheduleMode }, option.date)}` : formatDate(option.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatTimeRange(option.start, option.end)}`}
        </strong>
        <span className="option-meta">
          {option.names.length} of {responseCount} free · {formatDuration(option.end - option.start)}
          {isTop && <> · {isEveryone ? 'Longest window everyone can make' : 'Most people free'}</>}
        </span>
        {missingNames.length > 0 && <span className="option-missing">Can’t make it: {missingNames.join(', ')}</span>}
      </div>
      {isOwner && !isChoosing && (
        <button
          type="button"
          className={`button button-small ${isTop ? 'button-primary' : 'button-secondary'}`}
          aria-describedby={headingId}
          onClick={() => setIsChoosing(true)}
        >
          {isConfirmed ? 'Change time' : 'Choose this time'}
        </button>
      )}
      {isOwner && isChoosing && (
        <ConfirmTimeForm option={option} onClose={() => setIsChoosing(false)} onConfirm={onConfirm} />
      )}
    </li>
  );
};

interface ConfirmTimeFormProps {
  option: AvailabilityRange;
  onClose: () => void;
  onConfirm: (time: ConfirmedTime) => Promise<void>;
}

// Lets the organizer book part of a long window, e.g. one hour out of a free afternoon.
const ConfirmTimeForm = ({ option, onClose, onConfirm }: ConfirmTimeFormProps) => {
  const [start, setStart] = useState(option.start);
  const [end, setEnd] = useState(option.end);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const startChoices = getTimeSlots(option.start, option.end);
  const endChoices = getTimeSlots(start + SLOT_LENGTH_MINUTES, option.end + SLOT_LENGTH_MINUTES);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onConfirm({ date: option.date, start, end });
      onClose();
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not confirm. Try again.');
      setIsSaving(false);
    }
  };

  return (
    <form className="confirm-form" onSubmit={submit}>
      <label>
        <span>From</span>
        <select
          className="text-field"
          value={start}
          onChange={(changeEvent) => {
            const nextStart = Number(changeEvent.target.value);
            setStart(nextStart);
            if (end <= nextStart) setEnd(nextStart + SLOT_LENGTH_MINUTES);
          }}
        >
          {startChoices.map((minutes) => <option key={minutes} value={minutes}>{formatTime(minutes)}</option>)}
        </select>
      </label>
      <label>
        <span>Until</span>
        <select className="text-field" value={end} onChange={(changeEvent) => setEnd(Number(changeEvent.target.value))}>
          {endChoices.map((minutes) => <option key={minutes} value={minutes}>{formatTime(minutes)}</option>)}
        </select>
      </label>
      <div className="confirm-actions">
        <button type="submit" className="button button-primary button-small" disabled={isSaving}>
          {isSaving ? 'Confirming…' : 'Confirm meeting'}
        </button>
        <button type="button" className="button button-secondary button-small" onClick={onClose} disabled={isSaving}>
          Cancel
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
};

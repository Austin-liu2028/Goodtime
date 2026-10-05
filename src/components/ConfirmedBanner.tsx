import { useState } from 'react';
import { EventStorageError, getInviteLink } from '../services/events';
import type { ConfirmedTime, ScheduledEvent } from '../types/event';
import { buildIcsFile, getGoogleCalendarUrl } from '../utilities/calendar';
import { formatDate } from '../utilities/date';
import { formatTimeRange } from '../utilities/time';
import { getTimeZoneName } from '../utilities/timeZones';
import { EmailComposer } from './EmailComposer';

interface ConfirmedBannerProps {
  event: ScheduledEvent;
  confirmedTime: ConfirmedTime;
  isOwner: boolean;
  onReopen: () => Promise<void>;
}

const getFileName = (title: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting'}.ics`;

// Shown to everyone once the organizer picks a time: the last step from availability to a meeting.
export const ConfirmedBanner = ({ event, confirmedTime, isOwner, onReopen }: ConfirmedBannerProps) => {
  const [error, setError] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const entry = {
    title: event.title,
    description: event.description,
    location: event.location,
    timeZone: event.timeZone,
    confirmedTime,
    link: getInviteLink(event.code),
    code: event.code,
  };

  const downloadIcs = () => {
    const url = URL.createObjectURL(new Blob([buildIcsFile(entry)], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getFileName(event.title);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const reopen = async () => {
    setIsReopening(true);
    try {
      await onReopen();
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not reopen scheduling. Try again.');
      setIsReopening(false);
    }
  };

  return (
    <section className="confirmed-banner" aria-labelledby="confirmed-heading">
      <div className="confirmed-copy">
        <span className="confirmed-label" id="confirmed-heading">Meeting confirmed</span>
        <strong className="confirmed-time">
          {formatDate(confirmedTime.date, { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}
          {formatTimeRange(confirmedTime.start, confirmedTime.end)}
        </strong>
        <span className="confirmed-meta">
          {[getTimeZoneName(event.timeZone), event.location].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="confirmed-actions">
        {isOwner && (
          <button
            type="button"
            className="button button-email button-small"
            aria-expanded={isComposing}
            onClick={() => setIsComposing(!isComposing)}
          >
            <svg className="button-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
              <path d="M3 5.5l7 5 7-5" />
            </svg>
            {isComposing ? 'Close email' : 'Email everyone'}
          </button>
        )}
        <a className="button button-primary button-small" href={getGoogleCalendarUrl(entry)} target="_blank" rel="noopener noreferrer">
          Add to my Google Calendar
        </a>
        <button type="button" className="button button-secondary button-small" onClick={downloadIcs}>
          Download .ics
        </button>
        {isOwner && (
          <button type="button" className="text-button" onClick={reopen} disabled={isReopening}>
            {isReopening ? 'Reopening…' : 'Reopen scheduling'}
          </button>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {isOwner && isComposing && (
        <EmailComposer event={event} confirmedTime={confirmedTime} />
      )}
    </section>
  );
};

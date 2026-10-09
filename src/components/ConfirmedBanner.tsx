import { useState } from 'react';
import { EventStorageError, getInviteLink } from '../services/events';
import type { ConfirmedTime, ScheduledEvent } from '../types/event';
import { buildIcsFile, getGoogleCalendarUrl } from '../utilities/calendar';
import { getMeetingTimeText } from '../utilities/zonedSchedule';
import { EmailComposer } from './EmailComposer';

interface ConfirmedBannerProps {
  event: ScheduledEvent;
  confirmedTime: ConfirmedTime;
  isOwner: boolean;
  displayTimeZone: string;
  onReopen: () => Promise<void>;
}

const getFileName = (title: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting'}.ics`;

// Shown to everyone once the organizer picks a time: the last step from availability to a meeting.
export const ConfirmedBanner = ({ event, confirmedTime, isOwner, displayTimeZone, onReopen }: ConfirmedBannerProps) => {
  const [error, setError] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const shownTime = getMeetingTimeText({ confirmedTime, scheduleMode: event.scheduleMode, eventTimeZone: event.timeZone, displayTimeZone });
  const entry = {
    title: event.title,
    description: event.description,
    location: event.location,
    timeZone: event.timeZone,
    confirmedTime,
    scheduleMode: event.scheduleMode,
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
          {shownTime.longDate} · {shownTime.timeRange}
        </strong>
        <span className="confirmed-meta">
          {[shownTime.zone, event.location].filter(Boolean).join(' · ')}
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
        {event.scheduleMode !== 'weekdays' && (
          <a className="button button-primary button-small" href={getGoogleCalendarUrl(entry)} target="_blank" rel="noopener noreferrer">
            Add to my Google Calendar
          </a>
        )}
        <button type="button" className="button button-secondary button-small" onClick={downloadIcs}>
          {event.scheduleMode === 'weekdays' ? 'Download weekly .ics' : 'Download .ics'}
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

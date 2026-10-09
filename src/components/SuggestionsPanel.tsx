import { useState } from 'react';
import { acceptSuggestion, dismissSuggestion, EventStorageError } from '../services/events';
import type { ScheduledEvent, TimeSuggestion } from '../types/event';
import { formatDate } from '../utilities/date';
import { isEventDate } from '../utilities/eventDates';
import { formatScheduleDay } from '../utilities/schedule';
import { formatTimeRange, parseTimeValue } from '../utilities/time';

interface SuggestionsPanelProps {
  event: ScheduledEvent;
  suggestions: TimeSuggestion[];
  loadError: string;
  onEventChange: (event: ScheduledEvent) => void;
}

// Organizer-only: times participants proposed. "Add to event" widens the dates and hours to
// cover one, keeping every response; "Dismiss" just clears it.
export const SuggestionsPanel = ({ event, suggestions, loadError, onEventChange }: SuggestionsPanelProps) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isCovered = ({ date, start, end }: TimeSuggestion) =>
    isEventDate(event, date) &&
    start >= parseTimeValue(event.startTime) && end <= parseTimeValue(event.endTime);

  const act = async (suggestion: TimeSuggestion, action: 'add' | 'dismiss') => {
    setBusyId(suggestion.id);
    setError('');
    try {
      if (action === 'add') onEventChange(await acceptSuggestion(event.code, suggestion));
      else await dismissSuggestion(event.code, suggestion.id);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not update the suggestion. Try again.');
    }
    setBusyId(null);
  };

  return (
    <section className="suggestions-panel" id="suggestions" aria-labelledby="suggestions-heading">
      <h2 className="panel-title" id="suggestions-heading">
        Suggestions {suggestions.length > 0 && <span className="tabular">{suggestions.length} new</span>}
      </h2>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {suggestions.length === 0 && !loadError && (
        <p className="suggestions-empty">None yet. If your times don’t work for someone, they can suggest another here.</p>
      )}
      {suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((suggestion) => {
            const covered = isCovered(suggestion);
            return (
              <li key={suggestion.id}>
                <p className="suggestion-who"><strong>{suggestion.name}</strong> suggested</p>
                <p className="suggestion-time">
                  {event.scheduleMode === 'weekdays' ? `Every ${formatScheduleDay(event, suggestion.date)}` : formatDate(suggestion.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTimeRange(suggestion.start, suggestion.end)}
                </p>
                {suggestion.note && <p className="suggestion-note">“{suggestion.note}”</p>}
                  {covered && <p className="suggestion-covered">Already within the event’s {event.scheduleMode === 'weekdays' ? 'days' : 'dates'} and hours.</p>}
                <div className="suggestion-actions">
                  {!covered && (
                    <button
                      type="button"
                      className="button button-primary button-small"
                      disabled={busyId === suggestion.id}
                      onClick={() => act(suggestion, 'add')}
                    >
                      Add to event
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    disabled={busyId === suggestion.id}
                    onClick={() => act(suggestion, 'dismiss')}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
};

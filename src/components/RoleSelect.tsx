import { useEffect, useState } from 'react';
import { deleteEvent, EventStorageError, listOwnedEvents } from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { formatDate } from '../utilities/date';
import { getEventStatus } from '../utilities/eventStatus';
import { JoinForm } from './JoinForm';
import { Link } from './Link';

// Landing page. The two paths sit side by side so nobody has to guess which one is theirs:
// organizers start an event, invitees type their code right here without another click.
export const RoleSelect = () => {
  const [ownedEvents, setOwnedEvents] = useState<ScheduledEvent[]>([]);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [eventToDelete, setEventToDelete] = useState<ScheduledEvent | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        const events = await listOwnedEvents();
        if (isCurrent) setOwnedEvents(events);
      } catch (error) {
        // The list is a shortcut; the page still works without it.
        console.error(error);
      }
    };
    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!eventToDelete) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEventToDelete(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [eventToDelete]);

  const handleDelete = async () => {
    if (!eventToDelete) return;
    const event = eventToDelete;
    setDeleteError('');
    setDeletingCode(event.code);
    try {
      await deleteEvent(event.code);
      setOwnedEvents((events) => events.filter(({ code }) => code !== event.code));
      setEventToDelete(null);
    } catch (error) {
      console.error(error);
      setDeleteError(error instanceof EventStorageError ? error.message : 'Could not delete this event. Try again.');
      setEventToDelete(null);
    } finally {
      setDeletingCode(null);
    }
  };

  return (
    <section className="home" aria-labelledby="home-heading">
      <h1 id="home-heading">Find a time that works for everyone</h1>
      <p className="lede">One person sets the dates, everyone marks when they’re free, and the overlap shows up as answers come in.</p>

      <div className="paths">
        <section className="path path-create" aria-labelledby="create-path-heading">
          <h2 id="create-path-heading">I’m organizing</h2>
          <ol className="path-steps">
            <li>Pick the dates and hours you’re considering</li>
            <li>Send the link or code to your group</li>
            <li>See which times everyone can make</li>
          </ol>
          <Link to="/create" className="button button-primary">Create an event</Link>
        </section>

        <section className="path path-join" aria-labelledby="join-path-heading">
          <h2 id="join-path-heading">I was invited</h2>
          <p className="path-copy">Got a link? Just open it. Got a code? Enter it here to add your times.</p>
          <JoinForm />
        </section>
      </div>

      {ownedEvents.length > 0 && (
        <section className="owned-events" aria-labelledby="owned-heading">
          <h2 id="owned-heading">Events you created</h2>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          <ul>
            {ownedEvents.map((event) => {
              const status = getEventStatus(event);
              return (
                <li key={event.code}>
                  <div className="owned-event-row">
                    <Link to={`/e/${event.code}`}>
                      <strong>
                        {event.title}
                        {event.location && (
                          <>
                            {' '}<span aria-hidden="true">—</span>{' '}
                            <span className="owned-location">{event.location}</span>
                          </>
                        )}
                      </strong>
                      <span className="owned-meta">
                        {formatDate(event.startDate, { month: 'short', day: 'numeric' })} – {formatDate(event.endDate, { month: 'short', day: 'numeric' })}
                        <span aria-hidden="true"> · </span>
                        <span className="tabular">{event.code}</span>
                      </span>
                      <span className={`status-pill is-${status.tone}`}>{status.label}</span>
                    </Link>
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      disabled={deletingCode !== null}
                      onClick={() => setEventToDelete(event)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {eventToDelete && (
        <div
          className="modal-backdrop"
          onClick={(clickEvent) => {
            if (clickEvent.target === clickEvent.currentTarget) setEventToDelete(null);
          }}
        >
          <section
            className="delete-event-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-heading"
          >
            <h2 id="delete-event-heading">Delete event?</h2>
            <p>Delete &quot;{eventToDelete.title}&quot;? This can’t be undone.</p>
            <div className="form-actions">
              <button
                type="button"
                className="button button-secondary"
                autoFocus
                disabled={deletingCode !== null}
                onClick={() => setEventToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-destructive"
                disabled={deletingCode !== null}
                onClick={() => void handleDelete()}
              >
                {deletingCode === eventToDelete.code ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};

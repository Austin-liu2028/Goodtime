import { useEffect, useState } from 'react';
import { useAccount } from '../hooks/useAccount';
import { canSignIn, forgetJoinedEvent, getCurrentUserId, getEvent, listJoinedEvents } from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { getScheduleSummary } from '../utilities/schedule';
import { getJoinedStatus } from '../utilities/eventStatus';
import { CloseIcon } from './CloseIcon';
import { Link } from './Link';

interface JoinedItem {
  event: ScheduledEvent;
  name: string;
}

// "Events you joined": events this browser opened as a participant, most recent first.
export const JoinedEvents = () => {
  const [items, setItems] = useState<JoinedItem[]>([]);
  const account = useAccount();

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const joined = await listJoinedEvents().catch((error: unknown) => {
        // The list is a shortcut; the page still works without it.
        console.error(error);
        return [];
      });
      const [userId, events] = await Promise.all([
        getCurrentUserId().catch(() => ''),
        // One missing, expired or unreadable event shouldn't hide the rest.
        Promise.all(joined.map(({ code }) => getEvent(code).catch(() => null))),
      ]);
      if (!isCurrent) return;
      setItems(joined.flatMap(({ name }, index) => {
        const event = events[index];
        // Events since deleted, or ones this browser turned out to organize, belong elsewhere.
        return event && event.ownerId !== userId ? [{ event, name }] : [];
      }));
    };
    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="owned-events joined-events" aria-labelledby="joined-heading">
      <h2 id="joined-heading">Events you joined</h2>
      <ul>
        {items.map(({ event, name }) => {
          const status = getJoinedStatus(event, name);
          return (
            <li key={event.code}>
              <Link to={`/e/${event.code}`}>
                <strong>{event.title}</strong>
                <span className="owned-meta">
                  {getScheduleSummary(event)}
                  <span aria-hidden="true"> · </span>
                  <span className="tabular">{event.code}</span>
                </span>
                <span className="owned-status">
                  <span className={`status-pill is-${status.tone}`}>{status.label}</span>
                </span>
              </Link>
              <button
                type="button"
                className="icon-button joined-remove"
                aria-label={`Remove ${event.title} from this list`}
                onClick={() => {
                  setItems((current) => current.filter((item) => item.event.code !== event.code));
                  forgetJoinedEvent(event.code).catch((error: unknown) => console.error(error));
                }}
              >
                <CloseIcon />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="field-hint">
        {canSignIn && !account.isSignedIn ? 'Sign in to see these on any device. ' : ''}Removing an event here doesn’t change your response.
      </p>
    </section>
  );
};

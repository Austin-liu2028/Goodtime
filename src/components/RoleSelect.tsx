import { useEffect, useState } from 'react';
import { listOwnedEvents } from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { formatDate } from '../utilities/date';
import { Link } from './Link';

// Landing page: pick a path. Organizers create an event; everyone else joins one.
export const RoleSelect = () => {
  const [ownedEvents, setOwnedEvents] = useState<ScheduledEvent[]>([]);

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

  return (
    <section className="landing" aria-labelledby="landing-heading">
      <div className="eyebrow"><span className="eyebrow-line" /> FIND A TIME TOGETHER</div>
      <h1 id="landing-heading">When works<br />for your people?</h1>
      <p className="intro-copy">Start a new plan, or add your times to one you were invited to.</p>

      <div className="role-grid">
        <Link to="/create" className="role-card">
          <span className="role-number" aria-hidden="true">01</span>
          <strong>Create an event</strong>
          <span>Pick the dates, times and place. You get a code and a link to send your group.</span>
          <span className="role-cta">Start planning <span aria-hidden="true">→</span></span>
        </Link>
        <Link to="/join" className="role-card">
          <span className="role-number" aria-hidden="true">02</span>
          <strong>Join an event</strong>
          <span>Enter the event code from your organizer, then choose the times you can make.</span>
          <span className="role-cta">Enter a code <span aria-hidden="true">→</span></span>
        </Link>
      </div>

      {ownedEvents.length > 0 && (
        <div className="owned-events">
          <h2>Your events</h2>
          <ul>
            {ownedEvents.map((event) => (
              <li key={event.code}>
                <Link to={`/e/${event.code}`}>
                  <strong>{event.title}</strong>
                  <span>
                    {formatDate(event.startDate, { month: 'short', day: 'numeric' })} – {formatDate(event.endDate, { month: 'short', day: 'numeric' })}
                    {' · '}{Object.keys(event.responses).length} responses · {event.code}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

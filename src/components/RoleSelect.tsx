import { useEffect, useState } from 'react';
import { cleanUpExpiredEvents, countSuggestions, listOwnedEvents } from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { getScheduleSummary } from '../utilities/schedule';
import { getEventStatus } from '../utilities/eventStatus';
import { DeleteEventSection } from './DeleteEventSection';
import { JoinedEvents } from './JoinedEvents';
import { JoinForm } from './JoinForm';
import { Link } from './Link';

// Landing page. The two paths sit side by side so nobody has to guess which one is theirs:
// organizers start an event, invitees type their code right here without another click.
export const RoleSelect = () => {
  const [ownedEvents, setOwnedEvents] = useState<ScheduledEvent[]>([]);
  // New time suggestions per event code, so organizers notice them from home.
  const [suggestionCounts, setSuggestionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        // Nothing deletes expired events on a schedule, so each visit clears out this person's.
        await cleanUpExpiredEvents().catch((error: unknown) => console.error(error));
        const events = await listOwnedEvents();
        if (!isCurrent) return;
        setOwnedEvents(events);
        const counts = await Promise.all(events.map(({ code }) => countSuggestions(code).catch(() => 0)));
        if (isCurrent) setSuggestionCounts(Object.fromEntries(events.map(({ code }, index) => [code, counts[index]])));
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
    <section className="home" aria-labelledby="home-heading">
      <h1 id="home-heading">Find a time that works for everyone</h1>
      <p className="lede">One person picks the days, everyone marks when they’re free, and the overlap shows up as answers come in.</p>

      <div className="paths">
        <section className="path path-create" aria-labelledby="create-path-heading">
          <h2 id="create-path-heading">I’m organizing</h2>
          <ol className="path-steps">
            <li>Pick specific dates or repeat weekly, then choose the hours</li>
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
          <ul>
            {ownedEvents.map((event) => {
              const status = getEventStatus(event);
              return (
                <li key={event.code} className="owned-event-row">
                  <Link to={`/e/${event.code}`}>
                    <strong>{event.title}</strong>
                    <span className="owned-meta">
                      {getScheduleSummary(event)}
                      <span aria-hidden="true"> · </span>
                      <span className="tabular">{event.code}</span>
                    </span>
                    <span className="owned-status">
                      {(suggestionCounts[event.code] ?? 0) > 0 && (
                        <span className="status-pill is-ready">
                          {suggestionCounts[event.code]} {suggestionCounts[event.code] === 1 ? 'suggestion' : 'suggestions'}
                        </span>
                      )}
                      <span className={`status-pill is-${status.tone}`}>{status.label}</span>
                    </span>
                  </Link>
                  <DeleteEventSection
                    code={event.code}
                    title={event.title}
                    compact
                    onDeleted={() => setOwnedEvents((events) => events.filter(({ code }) => code !== event.code))}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <JoinedEvents />
    </section>
  );
};

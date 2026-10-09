import { useEffect, useState } from 'react';
import { useEvent } from '../hooks/useEvent';
import { navigate } from '../hooks/useRoute';
import { getInviteeEmails, saveInviteeContacts, updateEventDetails } from '../services/events';
import type { ScheduledEvent } from '../types/event';
import { toDateValue } from '../utilities/date';
import { isOwnedBy } from '../utilities/eventStatus';
import { EventForm } from './EventForm';
import { Link } from './Link';

interface EditEventPageProps {
  code: string;
}

// Organizer-only. Also where "Add more dates" lands: widening the range keeps every response.
export const EditEventPage = ({ code }: EditEventPageProps) => {
  const [state] = useEvent(code);

  if (state.status !== 'ready') {
    return (
      <section className="narrow-page" aria-live="polite">
        {state.status === 'loading' && <p className="lede">Loading event…</p>}
        {state.status === 'not-found' && <h1>Event not found</h1>}
        {state.status === 'error' && <p className="form-error" role="alert">{state.message}</p>}
      </section>
    );
  }

  const { event, userId } = state;
  if (!isOwnedBy(event, userId)) {
    return (
      <section className="narrow-page">
        <h1>Only the organizer can edit this event</h1>
        <p className="lede">Ask whoever created “{event.title}” to change the dates or details.</p>
        <Link to={`/e/${code}`} className="button button-primary">Back to the event</Link>
      </section>
    );
  }

  return <EditEventForm event={event} />;
};

interface EditEventFormProps {
  event: ScheduledEvent;
}

const EditEventForm = ({ event }: EditEventFormProps) => {
  const eventLink = `/e/${event.code}`;
  // Invitee emails live apart from the event, so they load before the form fills in.
  const [inviteeEmails, setInviteeEmails] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        const emails = await getInviteeEmails(event.code, event.invitees);
        if (isCurrent) setInviteeEmails(emails);
      } catch (error) {
        // Editing still works; the email boxes just start empty.
        console.error(error);
        if (isCurrent) setInviteeEmails({});
      }
    };
    void load();
    return () => {
      isCurrent = false;
    };
    // Only on open: later edits to the invitee list come from this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.code]);

  const today = toDateValue(new Date());
  return (
    <section className="narrow-page" aria-labelledby="edit-heading">
      <Link to={eventLink} className="back-link"><span aria-hidden="true">←</span> {event.title}</Link>
      <h1 id="edit-heading">Edit event</h1>
      <p className="lede">Add dates or widen the hours any time. Everyone’s existing responses are kept.</p>
      {inviteeEmails === null ? (
        <p className="lede" aria-live="polite">Loading event…</p>
      ) : (
        <EventForm
          initialDetails={event}
          initialInviteeEmails={inviteeEmails}
          minDate={event.startDate < today ? event.startDate : today}
          submitLabel="Save changes"
          savingLabel="Saving…"
          responses={event.responses}
          cancelTo={eventLink}
          onSubmit={async (details, inviteeContacts) => {
            await updateEventDetails(event.code, details);
            const keptNames = new Set(inviteeContacts.map(({ name }) => name.toLocaleLowerCase()));
            const removedNames = Object.keys(inviteeEmails).filter((name) => !keptNames.has(name.toLocaleLowerCase()));
            await saveInviteeContacts(event.code, inviteeContacts, removedNames);
            navigate(eventLink);
          }}
        />
      )}
    </section>
  );
};

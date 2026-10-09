import { navigate } from '../hooks/useRoute';
import { useEffect } from 'react';
import { createEvent, getCurrentUserId, saveInviteeContacts } from '../services/events';
import { addDays, toDateValue } from '../utilities/date';
import { DEFAULT_TIME_ZONE } from '../utilities/timeZones';
import { EventForm } from './EventForm';
import { Link } from './Link';

export const CreateEventPage = () => {
  const today = toDateValue(new Date());

  // Sign in and connect while the organizer fills in the form, so "Create event" only has to
  // save. On a slow connection this is most of the wait.
  useEffect(() => {
    getCurrentUserId().catch((error: unknown) => console.error(error));
  }, []);

  return (
    <section className="narrow-page" aria-labelledby="create-heading">
      <Link to="/" className="back-link"><span aria-hidden="true">←</span> Home</Link>
      <h1 id="create-heading">New event</h1>
      <p className="lede">Choose the days and hours you’re considering. You’ll get a link and a code to send your group.</p>
      <EventForm
        initialDetails={{
          title: '',
          description: '',
          location: '',
          startDate: today,
          endDate: addDays(today, 6),
          startTime: '09:00',
          endTime: '17:00',
          invitees: [],
          timeZone: DEFAULT_TIME_ZONE,
        }}
        minDate={today}
        submitLabel="Create event"
        savingLabel="Creating…"
        onSubmit={async (details, inviteeContacts) => {
          const created = await createEvent(details);
          try {
            await saveInviteeContacts(created, inviteeContacts);
          } catch (error) {
            // The event exists either way; emails can be added again from Edit event.
            console.error(error);
          }
          navigate(`/e/${created.code}`);
        }}
      />
    </section>
  );
};

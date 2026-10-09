import type {
  Account,
  ConfirmedTime,
  EventContact,
  EventDetails,
  NewTimeSuggestion,
  ScheduledEvent,
  TimeSuggestion,
} from '../types/event';
import { getEventExpiry, getWeeklyEventExpiry } from '../utilities/calendar';
import { isEventDate } from '../utilities/eventDates';
import { parseTimeValue, toTimeValue } from '../utilities/time';
import { referenceWeekday } from '../utilities/schedule';
import { EventStorageError, type EventStore } from './eventStore';
import { isFirebaseConfigured } from './firebase';
import { JOINED_EVENTS_KEY, localEventStore, readJoined } from './localEventStore';

// Every read and write of events goes through this module. With Firebase configured the data
// lives in Firestore and is shared across devices; otherwise it stays in this browser.

export { EventStorageError };

// No 0/O or 1/I/L, so codes survive being read aloud or typed from a screenshot.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

// Firestore loads on demand, so the local store (and the tests) never pull in the SDK.
let storePromise: Promise<EventStore> | null = null;
const getStore = () => {
  storePromise ??= isFirebaseConfigured
    ? import('./firestoreEventStore').then((module) => module.firestoreEventStore)
    : Promise.resolve(localEventStore);
  return storePromise;
};

export const normalizeEventCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Accepts a bare code ("k7m q2p") or a pasted invite link (".../e/K7MQ2P").
export const extractEventCode = (value: string) => {
  const linkMatch = /\/e\/([A-Za-z0-9-]+)/.exec(value);
  return normalizeEventCode(linkMatch ? linkMatch[1] : value);
};

export const getInviteLink = (code: string) => `${window.location.origin}/e/${code}`;

const generateCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export const getCurrentUserId = async () => (await getStore()).getUserId();

// Dated events expire after their last day; weekly polls expire one year after creation. The database removes them on a schedule that
// can lag, so the app also treats them as gone the moment they expire.
const isExpired = (event: ScheduledEvent) => Boolean(event.expiresAt) && event.expiresAt <= new Date().toISOString();
const unlessExpired = (event: ScheduledEvent | null) => (event && !isExpired(event) ? event : null);
const withExpiry = (event: ScheduledEvent): ScheduledEvent => ({
  ...event,
  expiresAt: event.scheduleMode === 'weekdays'
    ? getWeeklyEventExpiry(event.createdAt)
    : getEventExpiry(event.endDate, event.timeZone),
});

// Organizer edits that can move the last day: keep the deletion date, and the emails and
// suggestions attached to the event, in step with it.
const updateDates = async (code: string, apply: (event: ScheduledEvent) => ScheduledEvent) => {
  const store = await getStore();
  let previousExpiry = '';
  const updated = await store.update(normalizeEventCode(code), (event) => {
    previousExpiry = event.expiresAt;
    return withExpiry(apply(event));
  });
  if (updated.expiresAt !== previousExpiry) {
    // The event itself is saved either way; its attachments catch up next time if this fails.
    await store.extendAttachedExpiry(normalizeEventCode(code), updated.expiresAt).catch((error: unknown) => console.error(error));
  }
  return updated;
};

// Contacts and suggestions are deleted along with their event.
const getExpiryFor = async (store: EventStore, code: string) => {
  const event = await store.get(code);
  if (!event || isExpired(event)) throw new EventStorageError('This event no longer exists.');
  return event.expiresAt;
};

export const createEvent = async (details: EventDetails): Promise<ScheduledEvent> => {
  const store = await getStore();
  const ownerId = await store.getUserId();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const event = withExpiry({
      ...details,
      scheduleMode: details.scheduleMode ?? 'dates',
      weekdays: details.weekdays ?? [],
      dateSelectionMode: details.dateSelectionMode ?? 'range',
      excludedDates: details.excludedDates ?? [],
      code: generateCode(),
      createdAt: new Date().toISOString(),
      ownerId,
      expiresAt: '',
      confirmedTime: null,
      responses: {},
    });
    if (await store.create(event)) return event;
  }
  throw new EventStorageError('Could not find a free event code. Try again.');
};

export const getEvent = async (code: string) => unlessExpired(await (await getStore()).get(normalizeEventCode(code)));

// Saves one person's availability. Names match case-insensitively, so "alex" updates "Alex"
// and takes on the newly typed spelling.
export const saveResponse = async (code: string, name: string, slotKeys: string[]) => {
  const nameKey = name.trim().toLocaleLowerCase();
  return (await getStore()).update(normalizeEventCode(code), (event) => {
    const responses = Object.fromEntries(
      Object.entries(event.responses).filter(([existingName]) => existingName.toLocaleLowerCase() !== nameKey),
    );
    return { ...event, responses: { ...responses, [name.trim()]: slotKeys } };
  });
};

// Organizer-only. Responses are kept as-is: picks outside new dates are hidden, not deleted,
// so widening the range again brings them back.
export const updateEventDetails = async (code: string, details: EventDetails) =>
  updateDates(code, (event) => {
    const confirmed = event.confirmedTime;
    const stillCovered = confirmed &&
      (event.scheduleMode ?? 'dates') === (details.scheduleMode ?? 'dates') &&
      isEventDate(details, confirmed.date) &&
      confirmed.start >= parseTimeValue(details.startTime) &&
      confirmed.end <= parseTimeValue(details.endTime);
    return { ...event, ...details, confirmedTime: stillCovered ? confirmed : null };
  });

// Organizer-only. Pass null to reopen scheduling.
export const setConfirmedTime = async (code: string, confirmedTime: ConfirmedTime | null) =>
  (await getStore()).update(normalizeEventCode(code), (event) => ({ ...event, confirmedTime }));

// Calls back when the event changes anywhere (another tab, or another device with Firestore).
export const subscribeToEvent = (
  code: string,
  onChange: (event: ScheduledEvent | null) => void,
  onError: (error: unknown) => void,
) => {
  let unsubscribe: (() => void) | null = null;
  let isActive = true;
  getStore()
    .then((store) => {
      if (isActive) unsubscribe = store.subscribe(normalizeEventCode(code), (event) => onChange(unlessExpired(event)), onError);
    })
    .catch(onError);
  return () => {
    isActive = false;
    unsubscribe?.();
  };
};

// Organizer-only: deletes the event right away, with everyone's responses, emails and suggestions.
export const deleteEvent = async (code: string) => (await getStore()).deleteEvent(normalizeEventCode(code));

// Deletes this person's expired events and joined entries; run on visits instead of a schedule.
export const cleanUpExpiredEvents = async () => (await getStore()).cleanUpExpired();

// Events this person created, newest first, so organizers can get back to them.
export const listOwnedEvents = async (): Promise<ScheduledEvent[]> => {
  const store = await getStore();
  const events = await store.listByOwner(await store.getUserId());
  return events.filter((event) => !isExpired(event)).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
};

// Saves a participant's email and optional display zone alongside their response.
// Pass the event's expiry when it's already known, to skip reading the event again.
export const saveContact = async (code: string, contact: EventContact, knownExpiry = '') => {
  const store = await getStore();
  const expiresAt = knownExpiry || await getExpiryFor(store, normalizeEventCode(code));
  await store.saveContact(normalizeEventCode(code), {
    name: contact.name.trim(),
    email: contact.email.trim(),
    ...(contact.timeZone ? { timeZone: contact.timeZone } : {}),
  }, expiresAt);
};

export const getOwnContact = async (code: string, name: string) =>
  (await getStore()).getOwnContact(normalizeEventCode(code), name.trim());

// Organizer-only: everyone who asked to hear about the confirmed time.
export const listContacts = async (code: string) => (await getStore()).listContacts(normalizeEventCode(code));

// Organizer-only: emails typed next to invitee names. They're saved as the organizer's own
// contacts, so they show up as recipients without ever living in the readable event.
// An invitee whose email was cleared or who was removed from the list loses theirs.
export const saveInviteeContacts = async (event: ScheduledEvent, contacts: EventContact[], removedNames: string[] = []) => {
  // Only rows with an email (or one to clear) need a write.
  await Promise.all([
    ...contacts.filter(({ name, email }) => name.trim() && email.trim()).map((contact) => saveContact(event.code, contact, event.expiresAt)),
    ...removedNames.map((name) => saveContact(event.code, { name, email: '' }, event.expiresAt)),
  ]);
};

// Organizer-only: the emails they saved for these invitee names, by name.
export const getInviteeEmails = async (code: string, names: string[]) => {
  const contacts = await Promise.all(names.map((name) => getOwnContact(code, name)));
  return Object.fromEntries(names.flatMap((name, index) => {
    const contact = contacts[index];
    return contact?.email ? [[name, contact.email]] : [];
  }));
};

// Organizer-only: keeps the recipient list current while the email panel is open.
export const subscribeToContacts = (
  code: string,
  onChange: (contacts: EventContact[]) => void,
  onError: (error: unknown) => void,
) => {
  let unsubscribe: (() => void) | null = null;
  let isActive = true;
  getStore()
    .then((store) => {
      if (isActive) unsubscribe = store.subscribeContacts(normalizeEventCode(code), onChange, onError);
    })
    .catch(onError);
  return () => {
    isActive = false;
    unsubscribe?.();
  };
};

// A participant proposes a time outside the event's dates or hours.
export const suggestTime = async (code: string, suggestion: NewTimeSuggestion) => {
  const store = await getStore();
  const expiresAt = await getExpiryFor(store, normalizeEventCode(code));
  await store.addSuggestion(
    normalizeEventCode(code),
    { ...suggestion, name: suggestion.name.trim(), note: suggestion.note.trim() },
    expiresAt,
  );
};

// Organizer-only: live list of suggestions, newest first.
export const subscribeToSuggestions = (
  code: string,
  onChange: (suggestions: TimeSuggestion[]) => void,
  onError: (error: unknown) => void,
) => {
  let unsubscribe: (() => void) | null = null;
  let isActive = true;
  getStore()
    .then((store) => {
      if (isActive) unsubscribe = store.subscribeSuggestions(normalizeEventCode(code), onChange, onError);
    })
    .catch(onError);
  return () => {
    isActive = false;
    unsubscribe?.();
  };
};

export const countSuggestions = async (code: string) => (await getStore()).countSuggestions(normalizeEventCode(code));

export const dismissSuggestion = async (code: string, id: string) =>
  (await getStore()).deleteSuggestion(normalizeEventCode(code), id);

// Organizer-only: widens the event's dates and hours to cover a suggestion, then clears it.
// Existing responses are untouched.
export const acceptSuggestion = async (code: string, suggestion: TimeSuggestion) => {
  const store = await getStore();
  const updated = await updateDates(code, (event) => ({
    ...event,
    startDate: event.scheduleMode === 'weekdays' ? event.startDate : suggestion.date < event.startDate ? suggestion.date : event.startDate,
    endDate: event.scheduleMode === 'weekdays' ? event.endDate : suggestion.date > event.endDate ? suggestion.date : event.endDate,
    weekdays: event.scheduleMode === 'weekdays'
      ? Array.from(new Set([...(event.weekdays ?? []), referenceWeekday(suggestion.date)])).sort((a, b) => a - b)
      : event.weekdays,
    excludedDates: (event.excludedDates ?? []).filter((date) => date !== suggestion.date),
    startTime: suggestion.start < parseTimeValue(event.startTime) ? toTimeValue(suggestion.start) : event.startTime,
    endTime: suggestion.end > parseTimeValue(event.endTime) ? toTimeValue(suggestion.end) : event.endTime,
  }));
  await store.deleteSuggestion(normalizeEventCode(code), suggestion.id);
  return updated;
};

// "Events you joined": remembered for this identity, so with Google sign-in it follows them
// across devices. Visiting records the event; responding also records the name used.
export const rememberJoinedEvent = async (event: ScheduledEvent, name = '') =>
  (await getStore()).rememberJoined({ code: event.code, name, lastVisited: new Date().toISOString() }, event.expiresAt);

export const listJoinedEvents = async () => {
  const store = await getStore();
  if (store !== localEventStore) {
    // Lists kept only in this browser before cloud storage move up once, then the local copy goes.
    const legacy = readJoined();
    if (legacy.length > 0) {
      const events = await Promise.all(legacy.map(({ code }) => getEvent(code).catch(() => null)));
      await Promise.all(legacy.flatMap((entry, index) => {
        const event = events[index];
        return event ? [store.rememberJoined(entry, event.expiresAt)] : [];
      }));
      window.localStorage.removeItem(JOINED_EVENTS_KEY);
    }
  }
  return store.listJoined();
};

export const forgetJoinedEvent = async (code: string) => (await getStore()).forgetJoined(normalizeEventCode(code));

// Optional Google sign-in.
export const subscribeToAccount = (onChange: (account: Account) => void) => {
  let unsubscribe: (() => void) | null = null;
  let isActive = true;
  getStore()
    .then((store) => {
      if (isActive) unsubscribe = store.subscribeAccount(onChange);
    })
    .catch((error: unknown) => console.error(error));
  return () => {
    isActive = false;
    unsubscribe?.();
  };
};

export const signInWithGoogle = async () => (await getStore()).signInWithGoogle();

export const signOutOfGoogle = async () => (await getStore()).signOut();

// Sign-in exists only with the shared Firebase backend.
export const canSignIn = isFirebaseConfigured;

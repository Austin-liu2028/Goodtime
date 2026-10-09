import type { ConfirmedTime, EventContact, EventDetails, ScheduledEvent } from '../types/event';
import { EventStorageError, type EventStore } from './eventStore';
import { isFirebaseConfigured } from './firebase';
import { localEventStore } from './localEventStore';

// Every read and write of events goes through this module. With Firebase configured the data
// lives in Firestore and is shared across devices; otherwise it stays in this browser.

export { EventStorageError };

export const DUPLICATE_EVENT_NAME_ERROR = 'An event with this name already exists. Please choose a different name.';

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

export const createEvent = async (details: EventDetails): Promise<ScheduledEvent> => {
  const store = await getStore();
  const ownerId = await store.getUserId();
  const existingEvents = await store.listByOwner(ownerId);
  if (existingEvents.some((event) => event.title === details.title)) {
    throw new EventStorageError(DUPLICATE_EVENT_NAME_ERROR);
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const event: ScheduledEvent = {
      ...details,
      code: generateCode(),
      createdAt: new Date().toISOString(),
      ownerId,
      confirmedTime: null,
      responses: {},
    };
    if (await store.create(event)) return event;
  }
  throw new EventStorageError('Could not find a free event code. Try again.');
};

export const getEvent = async (code: string) => (await getStore()).get(normalizeEventCode(code));

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
  (await getStore()).update(normalizeEventCode(code), (event) => ({ ...event, ...details }));

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
      if (isActive) unsubscribe = store.subscribe(normalizeEventCode(code), onChange, onError);
    })
    .catch(onError);
  return () => {
    isActive = false;
    unsubscribe?.();
  };
};

// Events this person created, newest first, so organizers can get back to them.
export const listOwnedEvents = async (): Promise<ScheduledEvent[]> => {
  const store = await getStore();
  const events = await store.listByOwner(await store.getUserId());
  return events.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
};

// Saves the email a participant left alongside their response. An empty email removes it.
export const saveContact = async (code: string, contact: EventContact) =>
  (await getStore()).saveContact(normalizeEventCode(code), { name: contact.name.trim(), email: contact.email.trim() });

export const getOwnContact = async (code: string, name: string) =>
  (await getStore()).getOwnContact(normalizeEventCode(code), name.trim());

// Organizer-only: everyone who asked to hear about the confirmed time.
export const listContacts = async (code: string) => (await getStore()).listContacts(normalizeEventCode(code));

// Organizer-only: emails typed next to invitee names. They're saved as the organizer's own
// contacts, so they show up as recipients without ever living in the readable event.
// An invitee whose email was cleared or who was removed from the list loses theirs.
export const saveInviteeContacts = async (code: string, contacts: EventContact[], removedNames: string[] = []) => {
  await Promise.all([
    ...contacts.filter(({ name }) => name.trim()).map((contact) => saveContact(code, contact)),
    ...removedNames.map((name) => saveContact(code, { name, email: '' })),
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

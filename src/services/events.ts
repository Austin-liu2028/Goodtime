import type { EventDetails, ScheduledEvent } from '../types/event';

// Events live in this browser's localStorage for now. Every read and write goes through this
// module, so moving to Firestore means reimplementing these functions with the same signatures.

const EVENT_KEY_PREFIX = 'goodtime:event:';
const OWNED_EVENTS_KEY = 'goodtime:owned-events';
// No 0/O or 1/I/L, so codes survive being read aloud or typed from a screenshot.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export class EventStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EventStorageError';
  }
}

const eventKey = (code: string) => `${EVENT_KEY_PREFIX}${code}`;

export const normalizeEventCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Accepts a bare code ("k7m q2p") or a pasted invite link (".../e/K7MQ2P").
export const extractEventCode = (value: string) => {
  const linkMatch = /\/e\/([A-Za-z0-9-]+)/.exec(value);
  return normalizeEventCode(linkMatch ? linkMatch[1] : value);
};

export const getInviteLink = (code: string) => `${window.location.origin}/e/${code}`;

const readItem = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    throw new EventStorageError('This browser is blocking storage, so events cannot be loaded.', { cause: error });
  }
};

const writeItem = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    throw new EventStorageError('Could not save. Storage may be full or blocked in this browser.', { cause: error });
  }
};

const parseEvent = (raw: string | null): ScheduledEvent | null => {
  if (!raw) return null;
  try {
    const event = JSON.parse(raw) as ScheduledEvent;
    return typeof event.code === 'string' && typeof event.responses === 'object' ? event : null;
  } catch {
    return null;
  }
};

const generateCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export const createEvent = async (details: EventDetails): Promise<ScheduledEvent> => {
  let code = generateCode();
  while (readItem(eventKey(code))) code = generateCode();
  const event: ScheduledEvent = { ...details, code, createdAt: new Date().toISOString(), responses: {} };
  writeItem(eventKey(code), JSON.stringify(event));
  writeItem(OWNED_EVENTS_KEY, JSON.stringify([...getOwnedEventCodes(), code]));
  return event;
};

export const getEvent = async (code: string): Promise<ScheduledEvent | null> =>
  parseEvent(readItem(eventKey(normalizeEventCode(code))));

// Saves one person's availability. Names match case-insensitively, so "alex" updates "Alex"
// and takes on the newly typed spelling.
export const saveResponse = async (code: string, name: string, slotKeys: string[]): Promise<ScheduledEvent> => {
  const event = await getEvent(code);
  if (!event) throw new EventStorageError('This event no longer exists.');
  const nameKey = name.trim().toLocaleLowerCase();
  const responses = Object.fromEntries(
    Object.entries(event.responses).filter(([existingName]) => existingName.toLocaleLowerCase() !== nameKey),
  );
  const updated = { ...event, responses: { ...responses, [name.trim()]: slotKeys } };
  writeItem(eventKey(event.code), JSON.stringify(updated));
  return updated;
};

// Calls back when another tab changes the event, so open pages stay current.
export const subscribeToEvent = (code: string, onChange: (event: ScheduledEvent | null) => void) => {
  const key = eventKey(normalizeEventCode(code));
  const handleStorage = (storageEvent: StorageEvent) => {
    if (storageEvent.key === key) onChange(parseEvent(storageEvent.newValue));
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
};

const getOwnedEventCodes = (): string[] => {
  try {
    const codes: unknown = JSON.parse(readItem(OWNED_EVENTS_KEY) ?? '[]');
    return Array.isArray(codes) ? codes.filter((code): code is string => typeof code === 'string') : [];
  } catch {
    return [];
  }
};

// The organizer is whoever created the event on this device (no sign-in yet).
export const isEventOwner = (code: string) => getOwnedEventCodes().indexOf(normalizeEventCode(code)) !== -1;

// Events created on this device, newest first, so organizers can get back to them.
export const listOwnedEvents = async (): Promise<ScheduledEvent[]> => {
  const events = await Promise.all(getOwnedEventCodes().map(getEvent));
  return events
    .filter((event): event is ScheduledEvent => event !== null)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
};

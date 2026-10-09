import type {
  Account,
  ConfirmedTime,
  EventContact,
  JoinedEvent,
  NewTimeSuggestion,
  ScheduledEvent,
  TimeSuggestion,
} from '../types/event';
import { getEventExpiry, getWeeklyEventExpiry } from '../utilities/calendar';
import { DEFAULT_TIME_ZONE } from '../utilities/timeZones';

// The storage backend behind services/events.ts: Firestore when configured, else localStorage.
export interface EventStore {
  getUserId: () => Promise<string>;
  // Resolves false when the code is already taken, so the caller can pick another.
  create: (event: ScheduledEvent) => Promise<boolean>;
  get: (code: string) => Promise<ScheduledEvent | null>;
  // Read-modify-write that never loses a concurrent update.
  update: (code: string, apply: (event: ScheduledEvent) => ScheduledEvent) => Promise<ScheduledEvent>;
  delete: (code: string) => Promise<void>;
  listByOwner: (ownerId: string) => Promise<ScheduledEvent[]>;
  subscribe: (
    code: string,
    onChange: (event: ScheduledEvent | null) => void,
    onError: (error: unknown) => void,
  ) => () => void;
  // Contacts are keyed by who saved them and under which name. An empty email removes the contact.
  // expiresAt matches the event's, so they're deleted together.
  saveContact: (code: string, contact: EventContact, expiresAt: string) => Promise<void>;
  getOwnContact: (code: string, name: string) => Promise<EventContact | null>;
  // Organizer-only in Firestore.
  listContacts: (code: string) => Promise<EventContact[]>;
  // Organizer-only in Firestore: calls back with the full list whenever anyone saves an email.
  subscribeContacts: (
    code: string,
    onChange: (contacts: EventContact[]) => void,
    onError: (error: unknown) => void,
  ) => () => void;
  // Anyone can suggest; only the organizer can read, count or remove suggestions.
  addSuggestion: (code: string, suggestion: NewTimeSuggestion, expiresAt: string) => Promise<void>;
  subscribeSuggestions: (
    code: string,
    onChange: (suggestions: TimeSuggestion[]) => void,
    onError: (error: unknown) => void,
  ) => () => void;
  countSuggestions: (code: string) => Promise<number>;
  deleteSuggestion: (code: string, id: string) => Promise<void>;
  // Organizer-only: when an event's dates move, its emails and suggestions are kept as long.
  extendAttachedExpiry: (code: string, expiresAt: string) => Promise<void>;

  // Organizer-only: deletes the event now, with its emails and suggestions.
  deleteEvent: (code: string) => Promise<void>;
  // Deletes this person's events that are past their retention week, with everything attached,
  // and expired entries in their joined list. Run when they visit, since nothing runs on a schedule.
  cleanUpExpired: () => Promise<void>;

  // "Events you joined", stored for the current identity. A blank name keeps the earlier one.
  rememberJoined: (entry: JoinedEvent, expiresAt: string) => Promise<void>;
  listJoined: () => Promise<JoinedEvent[]>;
  forgetJoined: (code: string) => Promise<void>;

  // Optional Google sign-in. Signing in keeps this browser's events; signing out starts fresh.
  subscribeAccount: (onChange: (account: Account) => void) => () => void;
  // Resolves false if the person closed the sign-in window instead.
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const SIGNED_OUT: Account = { isSignedIn: false, name: '', email: '' };

// One contact per person per name, so a shared laptop can hold several people's emails.
export const getContactId = (userId: string, name: string) =>
  `${userId}:${encodeURIComponent(name.trim().toLocaleLowerCase())}`;

export class EventStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EventStorageError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const parseConfirmedTime = (value: unknown): ConfirmedTime | null => {
  if (!isRecord(value)) return null;
  const { date, start, end } = value;
  return typeof date === 'string' && typeof start === 'number' && typeof end === 'number' ? { date, start, end } : null;
};

// Turns stored data into a ScheduledEvent, filling fields older events were saved without.
export const parseEventRecord = (value: unknown, fallbackOwnerId = ''): ScheduledEvent | null => {
  if (!isRecord(value) || typeof value.code !== 'string' || !isRecord(value.responses)) return null;
  const responses = Object.fromEntries(
    Object.entries(value.responses).map(([name, slotKeys]) => [name, asStringArray(slotKeys)]),
  );
  const endDate = asString(value.endDate);
  const timeZone = asString(value.timeZone) || DEFAULT_TIME_ZONE;
  const scheduleMode = value.scheduleMode === 'weekdays' ? 'weekdays' : 'dates';
  const weekdays = Array.isArray(value.weekdays)
    ? value.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  return {
    title: asString(value.title),
    description: asString(value.description),
    location: asString(value.location),
    scheduleMode,
    weekdays,
    dateSelectionMode: value.dateSelectionMode === 'multiple' ? 'multiple' : 'range',
    startDate: asString(value.startDate),
    endDate,
    excludedDates: asStringArray(value.excludedDates),
    startTime: asString(value.startTime, '09:00'),
    endTime: asString(value.endTime, '17:00'),
    invitees: asStringArray(value.invitees),
    code: value.code,
    createdAt: asString(value.createdAt),
    ownerId: asString(value.ownerId, fallbackOwnerId),
    timeZone,
    // Events saved before automatic deletion get the same week-after-the-last-day rule.
    expiresAt: asString(value.expiresAt) || (scheduleMode === 'weekdays'
      ? getWeeklyEventExpiry(asString(value.createdAt))
      : endDate ? getEventExpiry(endDate, timeZone) : ''),
    confirmedTime: parseConfirmedTime(value.confirmedTime),
    responses,
  };
};

// Newest first.
export const sortSuggestions = (suggestions: TimeSuggestion[]) =>
  [...suggestions].sort((first, second) => second.createdAt.localeCompare(first.createdAt));

export const parseSuggestion = (id: string, value: unknown): TimeSuggestion | null => {
  if (!isRecord(value)) return null;
  const { name, date, start, end, note, createdAt } = value;
  if (typeof name !== 'string' || typeof date !== 'string' || typeof start !== 'number' || typeof end !== 'number') return null;
  return { id, name, date, start, end, note: asString(note), createdAt: asString(createdAt) };
};

import type { ConfirmedTime, EventContact, ScheduledEvent } from '../types/event';
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
  saveContact: (code: string, contact: EventContact) => Promise<void>;
  getOwnContact: (code: string, name: string) => Promise<EventContact | null>;
  // Organizer-only in Firestore.
  listContacts: (code: string) => Promise<EventContact[]>;
  // Organizer-only in Firestore: calls back with the full list whenever anyone saves an email.
  subscribeContacts: (
    code: string,
    onChange: (contacts: EventContact[]) => void,
    onError: (error: unknown) => void,
  ) => () => void;
}

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
  return {
    title: asString(value.title),
    description: asString(value.description),
    location: asString(value.location),
    startDate: asString(value.startDate),
    endDate: asString(value.endDate),
    startTime: asString(value.startTime, '09:00'),
    endTime: asString(value.endTime, '17:00'),
    invitees: asStringArray(value.invitees),
    code: value.code,
    createdAt: asString(value.createdAt),
    ownerId: asString(value.ownerId, fallbackOwnerId),
    timeZone: asString(value.timeZone) || DEFAULT_TIME_ZONE,
    confirmedTime: parseConfirmedTime(value.confirmedTime),
    responses,
  };
};

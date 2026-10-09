import type { EventContact, JoinedEvent, ScheduledEvent, TimeSuggestion } from '../types/event';
import {
  EventStorageError,
  getContactId,
  parseEventRecord,
  parseSuggestion,
  SIGNED_OUT,
  sortSuggestions,
  type EventStore,
} from './eventStore';

// Fallback when Firebase isn't configured: events live in this browser's localStorage,
// so only other tabs on this device see them.

const EVENT_KEY_PREFIX = 'goodtime:event:';
const CONTACTS_KEY_PREFIX = 'goodtime:contacts:';
const SUGGESTIONS_KEY_PREFIX = 'goodtime:suggestions:';
// Also read by the Firestore store once, to move these into the cloud.
export const JOINED_EVENTS_KEY = 'goodtime:joined-events';
const DEVICE_ID_KEY = 'goodtime:device-id';
// Before owner ids existed, created events were tracked in this list.
const LEGACY_OWNED_EVENTS_KEY = 'goodtime:owned-events';

const eventKey = (code: string) => `${EVENT_KEY_PREFIX}${code}`;

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

// Read fresh each time rather than cached, so clearing storage really makes a new device.
const getDeviceId = () => {
  const existing = readItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = `device-${crypto.randomUUID()}`;
  writeItem(DEVICE_ID_KEY, created);
  return created;
};

const getLegacyOwnedCodes = (): string[] => {
  try {
    const codes: unknown = JSON.parse(readItem(LEGACY_OWNED_EVENTS_KEY) ?? '[]');
    return Array.isArray(codes) ? codes.filter((code): code is string => typeof code === 'string') : [];
  } catch {
    return [];
  }
};

const parseStored = (raw: string | null): ScheduledEvent | null => {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const code = typeof value === 'object' && value !== null && 'code' in value ? String(value.code) : '';
    const legacyOwner = getLegacyOwnedCodes().indexOf(code) !== -1 ? getDeviceId() : '';
    return parseEventRecord(value, legacyOwner);
  } catch {
    return null;
  }
};

const write = (event: ScheduledEvent) => writeItem(eventKey(event.code), JSON.stringify(event));

// Same-tab listeners: the browser's `storage` event only reaches other tabs.
const contactListeners = new Set<(code: string) => void>();
const suggestionListeners = new Set<(code: string) => void>();

const readSuggestions = (code: string): TimeSuggestion[] => {
  try {
    const value: unknown = JSON.parse(readItem(`${SUGGESTIONS_KEY_PREFIX}${code}`) ?? '[]');
    return Array.isArray(value)
      ? sortSuggestions(value.flatMap((item: unknown) => {
        const id = typeof item === 'object' && item !== null && 'id' in item ? String(item.id) : '';
        return parseSuggestion(id, item) ?? [];
      }))
      : [];
  } catch {
    return [];
  }
};

export const readJoined = (): JoinedEvent[] => {
  try {
    const value: unknown = JSON.parse(readItem(JOINED_EVENTS_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: unknown) => {
      if (typeof item !== 'object' || item === null) return [];
      const { code, name, lastVisited } = item as Record<string, unknown>;
      return typeof code === 'string'
        ? [{ code, name: typeof name === 'string' ? name : '', lastVisited: typeof lastVisited === 'string' ? lastVisited : '' }]
        : [];
    });
  } catch {
    return [];
  }
};

// The event and everything stored with it.
const removeEvent = (code: string) => {
  [eventKey(code), `${CONTACTS_KEY_PREFIX}${code}`, `${SUGGESTIONS_KEY_PREFIX}${code}`]
    .forEach((key) => window.localStorage.removeItem(key));
};

const writeJoined = (events: JoinedEvent[]) => writeItem(JOINED_EVENTS_KEY, JSON.stringify(events));

const writeSuggestions = (code: string, suggestions: TimeSuggestion[]) => {
  writeItem(`${SUGGESTIONS_KEY_PREFIX}${code}`, JSON.stringify(suggestions));
  suggestionListeners.forEach((notify) => notify(code));
};

const readContacts = (code: string): Record<string, EventContact> => {
  try {
    const value: unknown = JSON.parse(readItem(`${CONTACTS_KEY_PREFIX}${code}`) ?? '{}');
    return typeof value === 'object' && value !== null ? (value as Record<string, EventContact>) : {};
  } catch {
    return {};
  }
};

export const localEventStore: EventStore = {
  getUserId: async () => getDeviceId(),

  create: async (event) => {
    if (readItem(eventKey(event.code))) return false;
    write(event);
    return true;
  },

  get: async (code) => parseStored(readItem(eventKey(code))),

  update: async (code, apply) => {
    const current = parseStored(readItem(eventKey(code)));
    if (!current) throw new EventStorageError('This event no longer exists.');
    const updated = apply(current);
    write(updated);
    return updated;
  },

  listByOwner: async (ownerId) => {
    const events: ScheduledEvent[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(EVENT_KEY_PREFIX)) continue;
      const event = parseStored(readItem(key));
      if (event && event.ownerId === ownerId) events.push(event);
    }
    return events;
  },

  saveContact: async (code, contact) => {
    const contacts = readContacts(code);
    const id = getContactId(getDeviceId(), contact.name);
    if (contact.email || contact.timeZone) contacts[id] = contact;
    else delete contacts[id];
    writeItem(`${CONTACTS_KEY_PREFIX}${code}`, JSON.stringify(contacts));
    contactListeners.forEach((notify) => notify(code));
  },

  getOwnContact: async (code, name) => readContacts(code)[getContactId(getDeviceId(), name)] ?? null,

  listContacts: async (code) => Object.values(readContacts(code)),

  subscribeContacts: (code, onChange) => {
    const key = `${CONTACTS_KEY_PREFIX}${code}`;
    onChange(Object.values(readContacts(code)));
    const handleStorage = (storageEvent: StorageEvent) => {
      if (storageEvent.key === key) onChange(Object.values(readContacts(code)));
    };
    const handleSameTab = (changedCode: string) => {
      if (changedCode === code) onChange(Object.values(readContacts(code)));
    };
    window.addEventListener('storage', handleStorage);
    contactListeners.add(handleSameTab);
    return () => {
      window.removeEventListener('storage', handleStorage);
      contactListeners.delete(handleSameTab);
    };
  },

  addSuggestion: async (code, suggestion) => {
    const created: TimeSuggestion = { ...suggestion, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    writeSuggestions(code, [created, ...readSuggestions(code)]);
  },

  subscribeSuggestions: (code, onChange) => {
    const key = `${SUGGESTIONS_KEY_PREFIX}${code}`;
    onChange(readSuggestions(code));
    const handleStorage = (storageEvent: StorageEvent) => {
      if (storageEvent.key === key) onChange(readSuggestions(code));
    };
    const handleSameTab = (changedCode: string) => {
      if (changedCode === code) onChange(readSuggestions(code));
    };
    window.addEventListener('storage', handleStorage);
    suggestionListeners.add(handleSameTab);
    return () => {
      window.removeEventListener('storage', handleStorage);
      suggestionListeners.delete(handleSameTab);
    };
  },

  countSuggestions: async (code) => readSuggestions(code).length,

  deleteSuggestion: async (code, id) => writeSuggestions(code, readSuggestions(code).filter((item) => item.id !== id)),

  // Nothing to keep in step locally: clean-up below works from each event's own expiry.
  extendAttachedExpiry: async () => undefined,

  deleteEvent: async (code) => removeEvent(code),

  cleanUpExpired: async () => {
    const now = new Date().toISOString();
    const deviceId = getDeviceId();
    const expiredCodes: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(EVENT_KEY_PREFIX)) continue;
      const event = parseStored(readItem(key));
      if (event && event.ownerId === deviceId && event.expiresAt && event.expiresAt <= now) expiredCodes.push(event.code);
    }
    expiredCodes.forEach(removeEvent);
    // Joined entries whose event is gone or past its week.
    const live = readJoined().filter(({ code }) => {
      const event = parseStored(readItem(eventKey(code)));
      return event !== null && !(event.expiresAt && event.expiresAt <= now);
    });
    writeJoined(live);
  },

  rememberJoined: async (entry) => {
    const existing = readJoined();
    const previous = existing.find((item) => item.code === entry.code);
    const updated = { ...entry, name: entry.name.trim() || previous?.name || '' };
    writeJoined([updated, ...existing.filter((item) => item.code !== entry.code)]);
  },

  listJoined: async () => readJoined().sort((first, second) => second.lastVisited.localeCompare(first.lastVisited)),

  forgetJoined: async (code) => writeJoined(readJoined().filter((item) => item.code !== code)),

  // Signing in needs Firebase; without it there's only this browser.
  subscribeAccount: (onChange) => {
    onChange(SIGNED_OUT);
    return () => undefined;
  },
  signInWithGoogle: async (): Promise<boolean> => {
    throw new EventStorageError('Signing in isn’t available in this version of Goodtime.');
  },
  signOut: async () => undefined,

  // Other tabs fire `storage` events; this tab's own writes come back through the caller.
  subscribe: (code, onChange) => {
    const key = eventKey(code);
    const handleStorage = (storageEvent: StorageEvent) => {
      if (storageEvent.key === key) onChange(parseStored(storageEvent.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  },
};

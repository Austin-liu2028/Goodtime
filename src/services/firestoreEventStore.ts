import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type { EventContact } from '../types/event';
import { EventStorageError, getContactId, parseEventRecord, type EventStore } from './eventStore';
import { firebaseConfig } from './firebase';

// Shared backend: every device that opens an invite link reads and writes the same document.
// Collection `events`, document id = event code. See firestore.rules for who may change what.

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const eventsCollection = collection(db, 'events');
// events/{code}/contacts/{uid}:{name}. Separate from the event, which anyone with the code can read.
const contactsCollection = (code: string) => collection(db, 'events', code, 'contacts');

const parseContact = (value: unknown): EventContact | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { name, email } = value as Record<string, unknown>;
  return typeof name === 'string' && typeof email === 'string' ? { name, email } : null;
};

const describeFirebaseError = (error: unknown, fallback: string) => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  // configuration-not-found: Authentication was never set up for the project at all.
  if (['auth/operation-not-allowed', 'auth/admin-restricted-operation', 'auth/configuration-not-found'].indexOf(code) !== -1) {
    return 'Anonymous sign-in is turned off for this Firebase project. Enable it under Authentication → Sign-in method.';
  }
  if (code === 'permission-denied') return 'You don’t have permission to make that change.';
  if (code === 'unavailable') return 'Can’t reach the server. Check your connection and try again.';
  return fallback;
};

const wrap = async <Result>(task: () => Promise<Result>, fallback: string) => {
  try {
    return await task();
  } catch (error) {
    if (error instanceof EventStorageError) throw error;
    throw new EventStorageError(describeFirebaseError(error, fallback), { cause: error });
  }
};

// Every device gets a stable anonymous account, kept in IndexedDB across visits, with no sign-in UI.
let currentUser: Promise<User> | null = null;
const getUser = () => {
  currentUser ??= (async () => {
    await auth.authStateReady();
    return auth.currentUser ?? (await signInAnonymously(auth)).user;
  })().catch((error: unknown) => {
    currentUser = null;
    throw error;
  });
  return currentUser;
};

export const firestoreEventStore: EventStore = {
  getUserId: () => wrap(async () => (await getUser()).uid, 'Could not sign in to save your changes.'),

  create: (event) => wrap(async () => {
    await getUser();
    const ref = doc(eventsCollection, event.code);
    return runTransaction(db, async (transaction) => {
      if ((await transaction.get(ref)).exists()) return false;
      transaction.set(ref, event);
      return true;
    });
  }, 'Could not create the event. Try again.'),

  get: (code) => wrap(async () => {
    const snapshot = await getDoc(doc(eventsCollection, code));
    return snapshot.exists() ? parseEventRecord(snapshot.data()) : null;
  }, 'Could not load this event.'),

  // A transaction, so two people submitting at once never overwrite each other's responses.
  update: (code, apply) => wrap(async () => {
    await getUser();
    const ref = doc(eventsCollection, code);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists() ? parseEventRecord(snapshot.data()) : null;
      if (!current) throw new EventStorageError('This event no longer exists.');
      const updated = apply(current);
      transaction.set(ref, updated);
      return updated;
    });
  }, 'Could not save. Try again.'),

  delete: (code) => wrap(async () => {
    await getUser();
    await deleteDoc(doc(eventsCollection, code));
  }, 'Could not delete the event. Try again.'),

  listByOwner: (ownerId) => wrap(async () => {
    const snapshot = await getDocs(query(eventsCollection, where('ownerId', '==', ownerId)));
    return snapshot.docs.flatMap((document) => parseEventRecord(document.data()) ?? []);
  }, 'Could not load your events.'),

  subscribe: (code, onChange, onError) => onSnapshot(
    doc(eventsCollection, code),
    (snapshot) => onChange(snapshot.exists() ? parseEventRecord(snapshot.data()) : null),
    (error) => onError(new EventStorageError(describeFirebaseError(error, 'Lost the live connection to this event.'), { cause: error })),
  ),

  saveContact: (code, contact) => wrap(async () => {
    const { uid } = await getUser();
    const ref = doc(contactsCollection(code), getContactId(uid, contact.name));
    if (!contact.email) {
      await deleteDoc(ref);
      return;
    }
    await setDoc(ref, { uid, name: contact.name, email: contact.email, updatedAt: serverTimestamp() });
  }, 'Could not save your email. Try again.'),

  getOwnContact: (code, name) => wrap(async () => {
    const { uid } = await getUser();
    const snapshot = await getDoc(doc(contactsCollection(code), getContactId(uid, name)));
    return snapshot.exists() ? parseContact(snapshot.data()) : null;
  }, 'Could not load your saved email.'),

  listContacts: (code) => wrap(async () => {
    await getUser();
    const snapshot = await getDocs(contactsCollection(code));
    return snapshot.docs.flatMap((document) => parseContact(document.data()) ?? []);
  }, 'Could not load participants’ emails.'),

  subscribeContacts: (code, onChange, onError) => {
    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    // Listing contacts needs the organizer's sign-in, so wait for it before listening.
    getUser()
      .then(() => {
        if (!isActive) return;
        unsubscribe = onSnapshot(
          contactsCollection(code),
          (snapshot) => onChange(snapshot.docs.flatMap((document) => parseContact(document.data()) ?? [])),
          (error) => onError(new EventStorageError(describeFirebaseError(error, 'Could not load participants’ emails.'), { cause: error })),
        );
      })
      .catch((error: unknown) => onError(new EventStorageError(describeFirebaseError(error, 'Could not load participants’ emails.'), { cause: error })));
    return () => {
      isActive = false;
      unsubscribe?.();
    };
  },
};

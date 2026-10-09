import { deleteApp, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { EventContact, ScheduledEvent } from '../types/event';
import {
  EventStorageError,
  getContactId,
  parseEventRecord,
  parseSuggestion,
  sortSuggestions,
  type EventStore,
} from './eventStore';
import { firebaseConfig } from './firebase';

// Shared backend: every device that opens an invite link reads and writes the same document.
// See firestore.rules for who may change what. Each document carries an `expireAt`: past it, the
// rules lock the event to everyone but its organizer, whose next visit deletes it (cleanUpExpired).
//
//   events/{code}                     the event (anyone with the code can read it)
//   events/{code}/contacts/{uid}:{n}  emails, organizer-only
//   events/{code}/suggestions/{id}    suggested times, organizer-only
//   users/{uid}/joined/{code}         "Events you joined", private to that person

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const eventsCollection = collection(db, 'events');
const contactsCollection = (code: string) => collection(db, 'events', code, 'contacts');
const suggestionsCollection = (code: string) => collection(db, 'events', code, 'suggestions');
const joinedCollection = (uid: string) => collection(db, 'users', uid, 'joined');

const toTimestamp = (iso: string) => Timestamp.fromDate(new Date(iso));

// The app works with ISO strings; the rules compare a Timestamp field named expireAt.
const toStored = ({ expiresAt, ...event }: ScheduledEvent) => ({ ...event, expireAt: toTimestamp(expiresAt) });

const fromStored = (data: DocumentData) => {
  const { expireAt, ...rest } = data;
  return parseEventRecord({ ...rest, expiresAt: expireAt instanceof Timestamp ? expireAt.toDate().toISOString() : '' });
};

const parseContact = (value: unknown): EventContact | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { name, email, timeZone } = value as Record<string, unknown>;
  return typeof name === 'string' && typeof email === 'string'
    ? { name, email, ...(typeof timeZone === 'string' && timeZone ? { timeZone } : {}) }
    : null;
};

const getErrorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

const describeFirebaseError = (error: unknown, fallback: string) => {
  const code = getErrorCode(error);
  // configuration-not-found: Authentication was never set up for the project at all.
  if (['auth/operation-not-allowed', 'auth/admin-restricted-operation', 'auth/configuration-not-found'].indexOf(code) !== -1) {
    return 'This sign-in method is turned off for the Firebase project. Enable it under Authentication → Sign-in method.';
  }
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'Can’t reach the server. Check your connection and try again.';
  if (code === 'permission-denied') return 'You don’t have permission to make that change.';
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

// Every browser gets a stable anonymous account, kept in IndexedDB across visits, with no
// sign-in UI. Signing in with Google upgrades it (or swaps it for an existing Google account).
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

// Organizer-only: give an event's emails and suggestions the event's deletion time.
const setAttachedExpiry = async (code: string, expiresAt: string) => {
  const expireAt = toTimestamp(expiresAt);
  const [contacts, suggestions] = await Promise.all([
    getDocs(contactsCollection(code)),
    getDocs(suggestionsCollection(code)),
  ]);
  const batch = writeBatch(db);
  [...contacts.docs, ...suggestions.docs].forEach((document) => batch.update(document.ref, { expireAt }));
  await batch.commit();
};

// Events saved before automatic deletion existed have no expireAt, so TTL would never remove
// them. Their organizer fills it in the next time they open the event.
const backfillExpiry = (code: string, data: DocumentData, event: ScheduledEvent) => {
  if (data.expireAt instanceof Timestamp || !event.expiresAt || auth.currentUser?.uid !== event.ownerId) return;
  void (async () => {
    await updateDoc(doc(eventsCollection, code), { expireAt: toTimestamp(event.expiresAt) });
    await setAttachedExpiry(code, event.expiresAt);
  })().catch((error: unknown) => console.error(error));
};

type GoogleCredential = ReturnType<typeof GoogleAuthProvider.credentialFromError>;

// Attachments first, then the event: the rules check the event to know who its organizer is,
// and a failure part-way never leaves emails behind without their event.
const deleteWithAttachments = async (code: string) => {
  const [contacts, suggestions] = await Promise.all([
    getDocs(contactsCollection(code)),
    getDocs(suggestionsCollection(code)),
  ]);
  const batch = writeBatch(db);
  [...contacts.docs, ...suggestions.docs].forEach((document) => batch.delete(document.ref));
  await batch.commit();
  await deleteDoc(doc(eventsCollection, code));
};

// Hands this browser's events and joined list over to the Google account it's switching to.
// Done before switching, while this browser can still act as their owner.
const moveDataTo = async (fromUid: string, credential: NonNullable<GoogleCredential>) => {
  // A throwaway second app signs in as the target account to learn its id and write its list.
  const sideApp = initializeApp(firebaseConfig, `move-${Date.now()}`);
  try {
    const target = (await signInWithCredential(getAuth(sideApp), credential)).user;
    const sideDb = getFirestore(sideApp);
    const [owned, joined] = await Promise.all([
      getDocs(query(eventsCollection, where('ownerId', '==', fromUid))),
      getDocs(joinedCollection(fromUid)),
    ]);
    await Promise.all([
      ...owned.docs.map((document) => updateDoc(document.ref, { ownerId: target.uid })),
      ...joined.docs.map((document) => setDoc(doc(sideDb, 'users', target.uid, 'joined', document.id), document.data(), { merge: true })),
    ]);
  } finally {
    await deleteApp(sideApp);
  }
};

export const firestoreEventStore: EventStore = {
  getUserId: () => wrap(async () => (await getUser()).uid, 'Could not sign in to save your changes.'),

  // One write, no read first: on a slow connection every round trip shows. If the code is
  // already someone else's event, the rules refuse the write and the caller tries another code.
  create: (event) => wrap(async () => {
    await getUser();
    try {
      await setDoc(doc(eventsCollection, event.code), toStored(event));
      return true;
    } catch (error) {
      if (getErrorCode(error) === 'permission-denied') return false;
      throw error;
    }
  }, 'Could not create the event. Try again.'),

  get: (code) => wrap(async () => {
    const snapshot = await getDoc(doc(eventsCollection, code));
    if (!snapshot.exists()) return null;
    const event = fromStored(snapshot.data());
    if (event) backfillExpiry(code, snapshot.data(), event);
    return event;
  }, 'Could not load this event.'),

  // A transaction, so two people submitting at once never overwrite each other's responses.
  update: (code, apply) => wrap(async () => {
    const { uid } = await getUser();
    const ref = doc(eventsCollection, code);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists() ? fromStored(snapshot.data()) : null;
      if (!current) throw new EventStorageError('This event no longer exists.');
      const updated = apply(current);
      const stored: Partial<ReturnType<typeof toStored>> = toStored(updated);
      // A participant may only touch responses, so on an older event with no deletion date yet
      // they leave it for the organizer to fill in rather than adding it themselves.
      if (!(snapshot.data()?.expireAt instanceof Timestamp) && uid !== current.ownerId) delete stored.expireAt;
      transaction.set(ref, stored);
      return updated;
    });
  }, 'Could not save. Try again.'),

  delete: (code) => wrap(async () => {
    await getUser();
    await deleteDoc(doc(eventsCollection, code));
  }, 'Could not delete the event. Try again.'),

  listByOwner: (ownerId) => wrap(async () => {
    const snapshot = await getDocs(query(eventsCollection, where('ownerId', '==', ownerId)));
    return snapshot.docs.flatMap((document) => fromStored(document.data()) ?? []);
  }, 'Could not load your events.'),

  subscribe: (code, onChange, onError) => onSnapshot(
    doc(eventsCollection, code),
    (snapshot) => onChange(snapshot.exists() ? fromStored(snapshot.data()) : null),
    (error) => onError(new EventStorageError(describeFirebaseError(error, 'Lost the live connection to this event.'), { cause: error })),
  ),

  saveContact: (code, contact, expiresAt) => wrap(async () => {
    const { uid } = await getUser();
    const ref = doc(contactsCollection(code), getContactId(uid, contact.name));
    if (!contact.email && !contact.timeZone) {
      await deleteDoc(ref);
      return;
    }
    await setDoc(ref, {
      uid, name: contact.name, email: contact.email,
      ...(contact.timeZone ? { timeZone: contact.timeZone } : {}),
      updatedAt: serverTimestamp(), expireAt: toTimestamp(expiresAt),
    });
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
    const fail = (error: unknown) =>
      onError(new EventStorageError(describeFirebaseError(error, 'Could not load participants’ emails.'), { cause: error }));
    // Listing contacts needs the organizer's sign-in, so wait for it before listening.
    getUser()
      .then(() => {
        if (!isActive) return;
        unsubscribe = onSnapshot(
          contactsCollection(code),
          (snapshot) => onChange(snapshot.docs.flatMap((document) => parseContact(document.data()) ?? [])),
          fail,
        );
      })
      .catch(fail);
    return () => {
      isActive = false;
      unsubscribe?.();
    };
  },

  addSuggestion: (code, suggestion, expiresAt) => wrap(async () => {
    const { uid } = await getUser();
    await addDoc(suggestionsCollection(code), {
      ...suggestion,
      uid,
      createdAt: new Date().toISOString(),
      expireAt: toTimestamp(expiresAt),
    });
  }, 'Could not send your suggestion. Try again.'),

  subscribeSuggestions: (code, onChange, onError) => {
    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    const fail = (error: unknown) =>
      onError(new EventStorageError(describeFirebaseError(error, 'Could not load suggestions.'), { cause: error }));
    // Only the organizer may read these, so wait for sign-in before listening.
    getUser()
      .then(() => {
        if (!isActive) return;
        unsubscribe = onSnapshot(
          suggestionsCollection(code),
          (snapshot) => onChange(sortSuggestions(snapshot.docs.flatMap((document) => parseSuggestion(document.id, document.data()) ?? []))),
          fail,
        );
      })
      .catch(fail);
    return () => {
      isActive = false;
      unsubscribe?.();
    };
  },

  countSuggestions: (code) => wrap(async () => {
    await getUser();
    return (await getCountFromServer(suggestionsCollection(code))).data().count;
  }, 'Could not load suggestions.'),

  deleteSuggestion: (code, id) => wrap(async () => {
    await getUser();
    await deleteDoc(doc(suggestionsCollection(code), id));
  }, 'Could not remove that suggestion. Try again.'),

  deleteEvent: (code) => wrap(async () => {
    await getUser();
    await deleteWithAttachments(code);
  }, 'Could not delete the event. Try again.'),

  cleanUpExpired: () => wrap(async () => {
    const { uid } = await getUser();
    const isPast = (value: unknown) => value instanceof Timestamp && value.toMillis() <= Date.now();
    const [owned, joined] = await Promise.all([
      getDocs(query(eventsCollection, where('ownerId', '==', uid))),
      getDocs(joinedCollection(uid)),
    ]);
    const expired = owned.docs.filter((document) => isPast(document.data().expireAt));
    for (const event of expired) await deleteWithAttachments(event.id);
    await Promise.all(joined.docs.filter((document) => isPast(document.data().expireAt)).map((document) => deleteDoc(document.ref)));
  }, 'Could not clear out expired events.'),

  extendAttachedExpiry: (code, expiresAt) => wrap(async () => {
    await getUser();
    await setAttachedExpiry(code, expiresAt);
  }, 'Could not update when this event’s data is deleted.'),

  rememberJoined: (entry, expiresAt) => wrap(async () => {
    const { uid } = await getUser();
    await setDoc(
      doc(joinedCollection(uid), entry.code),
      {
        code: entry.code,
        lastVisited: entry.lastVisited,
        expireAt: toTimestamp(expiresAt),
        // Merging keeps the name from an earlier response when this visit didn't give one.
        ...(entry.name.trim() ? { name: entry.name.trim() } : {}),
      },
      { merge: true },
    );
  }, 'Could not remember this event.'),

  listJoined: () => wrap(async () => {
    const { uid } = await getUser();
    const snapshot = await getDocs(joinedCollection(uid));
    return snapshot.docs
      .map((document) => {
        const { code, name, lastVisited } = document.data();
        return {
          code: typeof code === 'string' ? code : document.id,
          name: typeof name === 'string' ? name : '',
          lastVisited: typeof lastVisited === 'string' ? lastVisited : '',
        };
      })
      .sort((first, second) => second.lastVisited.localeCompare(first.lastVisited));
  }, 'Could not load the events you joined.'),

  forgetJoined: (code) => wrap(async () => {
    const { uid } = await getUser();
    await deleteDoc(doc(joinedCollection(uid), code));
  }, 'Could not remove that event from your list.'),

  subscribeAccount: (onChange) => onAuthStateChanged(auth, (user) => onChange({
    isSignedIn: Boolean(user && !user.isAnonymous),
    name: user?.displayName ?? '',
    email: user?.email ?? '',
  })),

  signInWithGoogle: () => wrap(async () => {
    const provider = new GoogleAuthProvider();
    const anonymous = await getUser();
    try {
      // First sign-in with this Google account: the anonymous account becomes it, same id,
      // so every event and response stays exactly where it is.
      await linkWithPopup(anonymous, provider);
      return true;
    } catch (error) {
      const code = getErrorCode(error);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
      if (code !== 'auth/credential-already-in-use') throw error;
      // This Google account already has Goodtime data from another device: bring this
      // browser's events along, then switch to it.
      const credential = GoogleAuthProvider.credentialFromError(error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]);
      if (!credential) throw error;
      await moveDataTo(anonymous.uid, credential);
      const { user } = await signInWithCredential(auth, credential);
      currentUser = Promise.resolve(user);
      return true;
    }
  }, 'Could not sign in with Google. Try again.'),

  signOut: () => wrap(async () => {
    await signOut(auth);
    // The next action gets a fresh anonymous identity on this browser.
    currentUser = null;
  }, 'Could not sign out. Try again.'),
};

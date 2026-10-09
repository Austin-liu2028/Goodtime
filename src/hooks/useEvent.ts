import { useEffect, useState } from 'react';
import { EventStorageError, getCurrentUserId, getEvent, subscribeToEvent } from '../services/events';
import type { ScheduledEvent } from '../types/event';

export type EventState =
  | { status: 'loading' }
  | { status: 'ready'; event: ScheduledEvent; userId: string }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

const describeError = (error: unknown) =>
  error instanceof EventStorageError ? error.message : 'Something went wrong loading this event.';

const REFRESH_INTERVAL_MS = 30_000;

const getUserId = (state: EventState) => (state.status === 'ready' ? state.userId : '');

// Loads an event by code and keeps it current when it changes elsewhere. Callers key the
// component by code, so state starts fresh for each event.
export const useEvent = (code: string) => {
  const [state, setState] = useState<EventState>({ status: 'loading' });

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        // Sign-in failing only costs organizer controls; the event itself still loads.
        const [event, currentUserId] = await Promise.all([getEvent(code), getCurrentUserId().catch(() => '')]);
        if (!isCurrent) return;
        setState(event ? { status: 'ready', event, userId: currentUserId } : { status: 'not-found' });
      } catch (error) {
        if (!isCurrent) return;
        console.error(error);
        setState({ status: 'error', message: describeError(error) });
      }
    };
    void load();
    const unsubscribe = subscribeToEvent(
      code,
      (event) => {
        setState((current) => {
          // The initial load also learns who the viewer is; let it finish first.
          if (current.status === 'loading') return current;
          return event ? { status: 'ready', event, userId: getUserId(current) } : { status: 'not-found' };
        });
      },
      (error) => {
        console.error(error);
        if (isCurrent) setState({ status: 'error', message: describeError(error) });
      },
    );
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [code]);

  // Backstop for the live listener, which can stall silently after sleep, a network switch, or
  // an extension blocking the connection: re-read when the tab comes back and every so often.
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const event = await getEvent(code);
        if (event) setState((current) => (current.status === 'ready' ? { ...current, event } : current));
      } catch (error) {
        // The live listener and the initial load already surface errors; a missed refresh just waits for the next.
        console.error(error);
      }
    };
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [code]);

  const replaceEvent = (event: ScheduledEvent) =>
    setState((current) => ({ status: 'ready', event, userId: getUserId(current) }));

  return [state, replaceEvent] as const;
};

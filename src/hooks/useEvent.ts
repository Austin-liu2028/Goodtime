import { useEffect, useState } from 'react';
import { EventStorageError, getEvent, subscribeToEvent } from '../services/events';
import type { ScheduledEvent } from '../types/event';

export type EventState =
  | { status: 'loading' }
  | { status: 'ready'; event: ScheduledEvent }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

// Loads an event by code and keeps it current when it changes elsewhere.
// Callers key the component by code, so state starts fresh for each event.
export const useEvent = (code: string) => {
  const [state, setState] = useState<EventState>({ status: 'loading' });

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        const event = await getEvent(code);
        if (isCurrent) setState(event ? { status: 'ready', event } : { status: 'not-found' });
      } catch (error) {
        if (!isCurrent) return;
        console.error(error);
        setState({
          status: 'error',
          message: error instanceof EventStorageError ? error.message : 'Something went wrong loading this event.',
        });
      }
    };
    void load();
    const unsubscribe = subscribeToEvent(code, (event) => {
      setState(event ? { status: 'ready', event } : { status: 'not-found' });
    });
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [code]);

  const replaceEvent = (event: ScheduledEvent) => setState({ status: 'ready', event });

  return [state, replaceEvent] as const;
};

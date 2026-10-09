import { useEffect, useState } from 'react';
import { EventStorageError, subscribeToSuggestions } from '../services/events';
import type { TimeSuggestion } from '../types/event';

// Organizer-only: participants' suggested times for an event, kept live.
export const useSuggestions = (code: string, isOrganizer: boolean) => {
  const [suggestions, setSuggestions] = useState<TimeSuggestion[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOrganizer) return undefined;
    return subscribeToSuggestions(
      code,
      (loaded) => {
        setSuggestions(loaded);
        setError('');
      },
      (caught) => {
        console.error(caught);
        setError(caught instanceof EventStorageError ? caught.message : 'Could not load suggestions.');
      },
    );
  }, [code, isOrganizer]);

  return { suggestions: isOrganizer ? suggestions : [], error };
};

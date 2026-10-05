import type { ScheduledEvent } from '../types/event';
import { formatDate } from './date';

export const getNameKey = (name: string) => name.trim().toLocaleLowerCase();

// Everyone expected to answer: the invite list plus anyone who responded without being on it.
export const getRoster = (event: ScheduledEvent) => {
  const submittedNames = Object.keys(event.responses);
  const submittedNameKeys = new Set(submittedNames.map(getNameKey));
  const roster = [...event.invitees];
  submittedNames.forEach((name) => {
    if (!roster.some((rosterName) => getNameKey(rosterName) === getNameKey(name))) roster.push(name);
  });
  const waitingNames = roster.filter((name) => !submittedNameKeys.has(getNameKey(name)));
  return { submittedNames, waitingNames, roster };
};

export type EventStatusTone = 'confirmed' | 'ready' | 'waiting';

// One-line progress for the organizer's event list.
export const getEventStatus = (event: ScheduledEvent): { label: string; tone: EventStatusTone } => {
  if (event.confirmedTime) {
    return {
      label: `Confirmed · ${formatDate(event.confirmedTime.date, { weekday: 'short', month: 'short', day: 'numeric' })}`,
      tone: 'confirmed',
    };
  }
  const { submittedNames, waitingNames, roster } = getRoster(event);
  if (event.invitees.length > 0 && waitingNames.length === 0) {
    return { label: `${roster.length}/${roster.length} responded · Ready to choose`, tone: 'ready' };
  }
  if (event.invitees.length > 0) {
    return { label: `${submittedNames.length}/${roster.length} responded`, tone: 'waiting' };
  }
  if (submittedNames.length === 0) return { label: 'No responses yet', tone: 'waiting' };
  return { label: `${submittedNames.length} ${submittedNames.length === 1 ? 'response' : 'responses'}`, tone: 'waiting' };
};

// An empty id means sign-in failed (or a legacy event with no owner): never treat that as a match.
export const isOwnedBy = (event: ScheduledEvent, userId: string) => userId !== '' && event.ownerId === userId;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDetails } from '../types/event';
import {
  cleanUpExpiredEvents,
  createEvent,
  extractEventCode,
  getCurrentUserId,
  getEvent,
  getInviteLink,
  forgetJoinedEvent,
  getOwnContact,
  listContacts,
  listJoinedEvents,
  listOwnedEvents,
  saveContact,
  rememberJoinedEvent,
  saveResponse,
  setConfirmedTime,
  suggestTime,
  updateEventDetails,
} from './events';

const details: EventDetails = {
  title: 'Team sync',
  description: '',
  location: 'Room 101',
  startDate: '2026-10-05',
  endDate: '2026-10-09',
  startTime: '09:00',
  endTime: '12:00',
  invitees: ['Alex', 'Sam'],
  timeZone: 'America/Chicago',
};

beforeEach(() => {
  window.localStorage.clear();
  // Test events are dated October 2026; pin "now" so they only expire when a test says so.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('events service', () => {
  it('creates an event with a readable 6-character code owned by the current user', async () => {
    const event = await createEvent(details);
    expect(event.code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    expect(event.responses).toEqual({});
    expect(event.confirmedTime).toBeNull();
    expect(event.ownerId).toBe(await getCurrentUserId());
    expect(await getEvent(event.code.toLowerCase())).toEqual(event);
    expect(await listOwnedEvents()).toEqual([event]);
  });

  it('rejects an exact duplicate event title for the current user', async () => {
    await createEvent(details);

    await expect(createEvent(details)).rejects.toThrow(
      'An event with this name already exists. Please choose a different name.',
    );
    expect(await listOwnedEvents()).toHaveLength(1);
  });

  it('does not list events created by someone else', async () => {
    await createEvent(details);
    window.localStorage.removeItem('goodtime:device-id');
    expect(await listOwnedEvents()).toEqual([]);
  });

  it('returns null for an unknown code', async () => {
    expect(await getEvent('ZZZZZZ')).toBeNull();
  });

  it('pulls the code out of a pasted invite link or loosely typed code', async () => {
    const { code } = await createEvent(details);
    expect(extractEventCode(getInviteLink(code))).toBe(code);
    expect(extractEventCode(` ${code.slice(0, 3).toLowerCase()} ${code.slice(3)} `)).toBe(code);
  });

  it('replaces a response when the same name is saved again in any case', async () => {
    const { code } = await createEvent(details);
    await saveResponse(code, 'Alex', ['2026-10-05|540']);
    const updated = await saveResponse(code, 'alex', ['2026-10-06|600']);
    expect(updated.responses).toEqual({ alex: ['2026-10-06|600'] });
    expect((await getEvent(code))?.responses).toEqual({ alex: ['2026-10-06|600'] });
  });

  it('keeps every response when the organizer changes the dates', async () => {
    const { code } = await createEvent(details);
    await saveResponse(code, 'Alex', ['2026-10-05|540']);
    const updated = await updateEventDetails(code, { ...details, startDate: '2026-10-07', endDate: '2026-10-20' });
    expect(updated.endDate).toBe('2026-10-20');
    expect(updated.responses).toEqual({ Alex: ['2026-10-05|540'] });
  });

  it('clears confirmation if a confirmed day is skipped, but keeps the response', async () => {
    const { code } = await createEvent(details);
    await saveResponse(code, 'Alex', ['2026-10-06|600']);
    await setConfirmedTime(code, { date: '2026-10-06', start: 600, end: 660 });
    const updated = await updateEventDetails(code, { ...details, excludedDates: ['2026-10-06'] });
    expect(updated.confirmedTime).toBeNull();
    expect(updated.responses.Alex).toEqual(['2026-10-06|600']);
  });

  it('stores weekly polls and their confirmation without tying them to a real date', async () => {
    const weekly = await createEvent({
      ...details,
      scheduleMode: 'weekdays',
      weekdays: [1, 3],
      startDate: '2026-01-04',
      endDate: '2026-01-10',
    });
    expect(weekly.expiresAt).toBe(new Date(new Date(weekly.createdAt).getTime() + 365 * 86400000).toISOString());
    await saveResponse(weekly.code, 'Alex', ['2026-01-05|600']);
    const confirmed = await setConfirmedTime(weekly.code, { date: '2026-01-05', start: 600, end: 660 });
    expect((await getEvent(weekly.code))?.confirmedTime).toEqual(confirmed.confirmedTime);
    expect((await getEvent(weekly.code))?.responses.Alex).toEqual(['2026-01-05|600']);
  });

  it('confirms a meeting time and can reopen scheduling', async () => {
    const { code } = await createEvent(details);
    const confirmed = await setConfirmedTime(code, { date: '2026-10-06', start: 600, end: 660 });
    expect(confirmed.confirmedTime).toEqual({ date: '2026-10-06', start: 600, end: 660 });
    expect((await setConfirmedTime(code, null)).confirmedTime).toBeNull();
  });

  it('reads events saved before owners and confirmations existed', async () => {
    window.localStorage.setItem('goodtime:event:OLD234', JSON.stringify({ ...details, code: 'OLD234', createdAt: '', responses: {} }));
    window.localStorage.setItem('goodtime:owned-events', JSON.stringify(['OLD234']));
    const event = await getEvent('OLD234');
    expect(event?.confirmedTime).toBeNull();
    expect(event?.ownerId).toBe(await getCurrentUserId());
  });

  it('keeps one email per person and name, and removes it when cleared', async () => {
    const { code } = await createEvent(details);
    await saveContact(code, { name: 'Alex', email: 'alex@u.edu' });
    await saveContact(code, { name: 'alex ', email: 'alex@new.edu' });
    await saveContact(code, { name: 'Sam', email: 'sam@u.edu' });
    expect(await getOwnContact(code, 'ALEX')).toEqual({ name: 'alex', email: 'alex@new.edu' });
    expect(await listContacts(code)).toHaveLength(2);

    await saveContact(code, { name: 'Sam', email: '' });
    expect(await getOwnContact(code, 'Sam')).toBeNull();
    expect(await listContacts(code)).toEqual([{ name: 'alex', email: 'alex@new.edu' }]);
  });

  it('keeps a selected time zone even when the participant leaves email blank', async () => {
    const { code } = await createEvent(details);
    await saveContact(code, { name: 'Alex', email: '', timeZone: 'America/New_York' });
    expect(await getOwnContact(code, 'Alex')).toEqual({ name: 'Alex', email: '', timeZone: 'America/New_York' });
    expect(await listContacts(code)).toEqual([{ name: 'Alex', email: '', timeZone: 'America/New_York' }]);
    await saveContact(code, { name: 'Alex', email: '' });
    expect(await getOwnContact(code, 'Alex')).toBeNull();
  });

  it('deletes events a week after their last day, and moves that date when the dates change', async () => {
    // Team sync ends Fri Oct 9, Chicago time: kept through Fri Oct 16.
    const event = await createEvent(details);
    expect(event.expiresAt).toBe('2026-10-17T05:00:00.000Z');

    const extended = await updateEventDetails(event.code, { ...details, endDate: '2026-10-20' });
    expect(extended.expiresAt).toBe('2026-10-28T05:00:00.000Z');

    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    expect(await getEvent(event.code)).toBeNull();
    expect(await listOwnedEvents()).toEqual([]);
    await expect(createEvent({ ...details, startDate: '2026-11-01', endDate: '2026-11-05' }))
      .resolves.toMatchObject({ title: details.title });
  });

  it('remembers joined events with the latest name, and forgets them on request', async () => {
    const event = await createEvent(details);
    await rememberJoinedEvent(event, 'Priya');
    await rememberJoinedEvent(event);
    expect(await listJoinedEvents()).toEqual([{ code: event.code, name: 'Priya', lastVisited: expect.any(String) }]);
    await forgetJoinedEvent(event.code);
    expect(await listJoinedEvents()).toEqual([]);
  });

  it('clears out expired events with everything attached, but leaves live ones alone', async () => {
    const old = await createEvent(details);
    await saveContact(old.code, { name: 'Alex', email: 'alex@u.edu' });
    await suggestTime(old.code, { name: 'Sam', date: '2026-10-20', start: 600, end: 660, note: '' });
    await rememberJoinedEvent(old, 'Alex');
    const later = await createEvent({ ...details, title: 'Later team sync', startDate: '2026-11-01', endDate: '2026-11-05' });

    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    await cleanUpExpiredEvents();

    const leftover = Object.keys(window.localStorage).filter((key) => key.indexOf(old.code) !== -1);
    expect(leftover).toEqual([]);
    expect(await listJoinedEvents()).toEqual([]);
    expect(await getEvent(later.code)).not.toBeNull();
  });
});

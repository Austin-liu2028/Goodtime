import { beforeEach, describe, expect, it } from 'vitest';
import type { EventDetails } from '../types/event';
import {
  createEvent,
  extractEventCode,
  getCurrentUserId,
  getEvent,
  getInviteLink,
  getOwnContact,
  listContacts,
  listOwnedEvents,
  saveContact,
  saveResponse,
  setConfirmedTime,
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
});

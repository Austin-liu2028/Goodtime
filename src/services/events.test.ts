import { beforeEach, describe, expect, it } from 'vitest';
import type { EventDetails } from '../types/event';
import {
  createEvent,
  extractEventCode,
  getEvent,
  getInviteLink,
  isEventOwner,
  listOwnedEvents,
  saveResponse,
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
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('events service', () => {
  it('creates an event with a readable 6-character code and marks this device as its owner', async () => {
    const event = await createEvent(details);
    expect(event.code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    expect(event.responses).toEqual({});
    expect(isEventOwner(event.code)).toBe(true);
    expect(await getEvent(event.code.toLowerCase())).toEqual(event);
    expect(await listOwnedEvents()).toEqual([event]);
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
});

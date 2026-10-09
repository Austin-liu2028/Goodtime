import { describe, expect, it } from 'vitest';
import type { ScheduledEvent } from '../types/event';
import { getEventStatus, getRoster, isOwnedBy } from './eventStatus';

const event: ScheduledEvent = {
  title: 'Study group',
  description: '',
  location: '',
  startDate: '2026-10-09',
  endDate: '2026-10-11',
  startTime: '14:00',
  endTime: '18:00',
  invitees: ['Mei', 'Omar'],
  code: 'R4TB8N',
  createdAt: '',
  ownerId: 'owner',
  expiresAt: '2026-10-19T05:00:00.000Z',
  timeZone: 'America/Chicago',
  confirmedTime: null,
  responses: {},
};

describe('getRoster', () => {
  it('adds people who responded without being invited and matches names in any case', () => {
    const { roster, waitingNames } = getRoster({ ...event, responses: { mei: [], Lina: [] } });
    expect(roster).toEqual(['Mei', 'Omar', 'Lina']);
    expect(waitingNames).toEqual(['Omar']);
  });
});

describe('getEventStatus', () => {
  it('tracks progress until everyone answers, then until a time is confirmed', () => {
    expect(getEventStatus(event)).toEqual({ label: '0/2 responded', tone: 'waiting' });
    const answered = { ...event, responses: { Mei: [], Omar: [] } };
    expect(getEventStatus(answered)).toEqual({ label: '2/2 responded · Ready to choose', tone: 'ready' });
    expect(getEventStatus({ ...answered, confirmedTime: { date: '2026-10-10', start: 900, end: 960 } }))
      .toEqual({ label: 'Confirmed · Sat, Oct 10', tone: 'confirmed' });
  });

  it('counts responses when there is no invite list', () => {
    expect(getEventStatus({ ...event, invitees: [] })).toEqual({ label: 'No responses yet', tone: 'waiting' });
    expect(getEventStatus({ ...event, invitees: [], responses: { Mei: [] } })).toEqual({ label: '1 response', tone: 'waiting' });
  });
});

describe('isOwnedBy', () => {
  it('never matches an empty id, even against an event with no owner', () => {
    expect(isOwnedBy(event, 'owner')).toBe(true);
    expect(isOwnedBy(event, 'someone-else')).toBe(false);
    expect(isOwnedBy({ ...event, ownerId: '' }, '')).toBe(false);
  });
});

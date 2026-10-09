import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createEvent, getEvent, getOwnContact, listContacts, saveContact, saveResponse, setConfirmedTime, suggestTime } from './services/events';
import type { EventDetails } from './types/event';

const details: EventDetails = {
  title: 'Team sync',
  description: 'Planning for next sprint',
  location: 'Mudd 3514',
  startDate: '2026-10-05',
  endDate: '2026-10-11',
  startTime: '09:00',
  endTime: '12:00',
  invitees: ['Alex', 'Sam', 'Jordan'],
  timeZone: 'America/Chicago',
};

const renderAt = (path: string) => {
  window.history.pushState(null, '', path);
  return render(<App />);
};

// Becoming someone else: the next read of the device id makes a fresh one.
const switchToAnotherDevice = () => window.localStorage.removeItem('goodtime:device-id');

// Opens an event page the way an invitee would: via the link, on a device that didn't create it.
const openAsInvitee = async () => {
  const { code } = await createEvent(details);
  switchToAnotherDevice();
  renderAt(`/e/${code}`);
  await screen.findByRole('heading', { name: 'Team sync' });
  return code;
};

const nameField = () => screen.getByLabelText('Your name');
const typeName = (name: string) => fireEvent.change(nameField(), { target: { value: name } });
// Typing then leaving the field, which is when a saved response gets loaded.
const enterName = (name: string) => {
  typeName(name);
  fireEvent.blur(nameField());
};
// fireEvent.click has detail 0, the same path a keyboard Enter/Space takes.
const toggleSlot = (index: number) => fireEvent.click(screen.getAllByRole('gridcell')[index]);
const submit = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: /availability$/ }));
  await screen.findByText(`Availability submitted for ${name}.`);
};

beforeEach(() => {
  window.localStorage.clear();
  // Test events are dated October 2026; pin "now" so they never count as expired.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
});

describe('choosing a role', () => {
  it('offers creating or joining an event', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'I’m organizing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'I was invited' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Create an event' }));
    expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument();
  });

  it('lets an invitee join straight from the home page', async () => {
    const { code } = await createEvent(details);
    renderAt('/');
    fireEvent.change(screen.getByLabelText('Event code or link'), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('heading', { name: 'Team sync' })).toBeInTheDocument();
  });

  it('lets the organizer return to events they created', async () => {
    const { code } = await createEvent(details);
    renderAt('/');
    const link = await screen.findByRole('link', { name: new RegExp(`Team sync.*${code}`) });
    expect(link).toHaveAttribute('href', `/e/${code}`);
    expect(link).toHaveTextContent('Team sync — Mudd 3514');
    expect(link).toHaveTextContent('0/3 responded');
  });

  it('lets the organizer delete an event from its home row after confirming', async () => {
    const code = await createAnsweredEvent();
    await saveContact(code, { name: 'Alex', email: 'alex@u.edu' });
    await suggestTime(code, { name: 'Sam', date: '2026-10-20', start: 600, end: 660, note: '' });
    renderAt('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Team sync' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This can’t be undone.');
    expect(screen.getByRole('button', { name: 'Keep event' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Keep event' }));
    expect(await getEvent(code)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Team sync' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(await screen.findByRole('heading', { name: 'Find a time that works for everyone' })).toBeInTheDocument();
    expect(await getEvent(code)).toBeNull();
    expect(screen.queryByRole('link', { name: new RegExp(`Team sync.*${code}`) })).not.toBeInTheDocument();
    expect(Object.keys(window.localStorage).filter((key) => key.includes(code))).toEqual([]);
  });
});

describe('creating an event', () => {
  it('asks for a date after the organizer clears the calendar', () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Needs a day' } });
    fireEvent.click(screen.getByRole('button', { name: /Start date.*End date/ }));
    const picker = within(screen.getByRole('dialog', { name: 'Choose event dates' }));
    fireEvent.click(picker.getByRole('button', { name: 'Clear dates' }));
    fireEvent.click(picker.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one date.');
  });

  it('picks separate calendar dates and keeps that mode when the organizer edits them', async () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Separate dates' } });
    fireEvent.click(screen.getByRole('button', { name: /Start date.*End date/ }));
    const picker = within(screen.getByRole('dialog', { name: 'Choose event dates' }));
    fireEvent.click(picker.getByRole('button', { name: 'Multiple dates' }));
    fireEvent.click(picker.getByRole('button', { name: 'Clear dates' }));
    fireEvent.click(picker.getByRole('button', { name: 'Thursday, October 8, 2026' }));
    fireEvent.click(picker.getByRole('button', { name: 'Thursday, October 15, 2026' }));
    fireEvent.click(picker.getByRole('button', { name: 'Tuesday, October 20, 2026' }));
    expect(picker.getByText('3 days')).toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', { name: 'Thursday, October 15, 2026' }));
    expect(picker.getByText('2 days')).toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', { name: 'Thursday, October 15, 2026' }));
    fireEvent.click(picker.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await screen.findByRole('heading', { name: 'Separate dates' });
    const code = window.location.pathname.split('/').pop() ?? '';
    const saved = await getEvent(code);
    expect(saved?.dateSelectionMode).toBe('multiple');
    expect(saved?.startDate).toBe('2026-10-08');
    expect(saved?.endDate).toBe('2026-10-20');
    expect(screen.getAllByText(/3 selected dates/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('gridcell', { name: /Thursday, October 8/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('gridcell', { name: /Thursday, October 15/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('gridcell', { name: /Tuesday, October 20/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('gridcell', { name: /Friday, October 9/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Edit event' }));
    fireEvent.click(await screen.findByRole('button', { name: /First selected.*Last selected/ }));
    const editedPicker = within(screen.getByRole('dialog', { name: 'Choose event dates' }));
    expect(editedPicker.getByRole('button', { name: 'Multiple dates' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(editedPicker.getByRole('button', { name: 'Thursday, October 22, 2026' }));
    fireEvent.click(editedPicker.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Separate dates' });
    expect((await getEvent(code))?.endDate).toBe('2026-10-22');
    expect(screen.getAllByRole('gridcell', { name: /Thursday, October 22/ }).length).toBeGreaterThan(0);
  });

  it('skips an interior date in a specific-date poll', async () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'One-off meeting' } });
    fireEvent.click(screen.getByRole('button', { name: /Start date.*End date/ }));
    const picker = within(screen.getByRole('dialog', { name: 'Choose event dates' }));
    fireEvent.click(picker.getByRole('button', { name: 'Wednesday, October 7, 2026' }));
    expect(picker.getByRole('button', { name: 'Wednesday, October 7, 2026 (skipped)' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(picker.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    await screen.findByRole('heading', { name: 'One-off meeting' });
    const code = window.location.pathname.split('/').pop() ?? '';
    expect((await getEvent(code))?.excludedDates).toEqual(['2026-10-07']);
    expect(screen.queryByRole('gridcell', { name: /Wednesday, October 7/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/1 skipped/).length).toBeGreaterThan(0);
  });

  it('switches repeat weekly on and creates an undated recurring poll', async () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Weekly standup' } });
    const repeat = screen.getByRole('switch', { name: 'Repeat weekly' });
    expect(repeat).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(repeat);
    expect(repeat).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: /Start date.*End date/ })).not.toBeInTheDocument();
    fireEvent.click(repeat);
    expect(repeat).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: /Start date.*End date/ })).toBeInTheDocument();
    fireEvent.click(repeat);
    fireEvent.click(screen.getByRole('button', { name: 'Tuesday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thursday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Friday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    await screen.findByRole('heading', { name: 'Weekly standup' });
    const code = window.location.pathname.split('/').pop() ?? '';
    expect((await getEvent(code))?.weekdays).toEqual([1, 3]);
    expect(screen.getByText('Every Mon, Wed')).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Every Monday, 9:00 AM/ })).toBeInTheDocument();
    expect(screen.queryByText(/Jan 2026/)).not.toBeInTheDocument();

    await saveResponse(code, 'Alex', ['2026-01-05|600', '2026-01-05|630']);
    await saveResponse(code, 'Sam', ['2026-01-05|600', '2026-01-05|630']);
    cleanup();
    renderAt(`/e/${code}`);
    expect(await screen.findByRole('heading', { name: 'Best weekly times' })).toBeInTheDocument();
    expect(screen.getByText(/Every Monday · 10:00 – 11:00 AM/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose this time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm meeting' }));
    expect((await screen.findAllByText(/Every Monday · 10:00 – 11:00 AM/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Download weekly .ics' })).toBeInTheDocument();
  });

  it('requires a title', () => {
    renderAt('/create');
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give your event a title.');
  });

  it('shows a clear error when creating an event with an existing title', async () => {
    await createEvent(details);
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: details.title } });

    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An event with this name already exists. Please choose a different name.',
    );
    const modal = screen.getByRole('dialog', { name: 'Duplicate event name' });
    expect(modal).toHaveTextContent('An event with this name already exists. Please choose a different name.');
    fireEvent.click(within(modal).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('An event with this name already exists.');
    expect(window.location.pathname).toBe('/create');
  });

  it('takes invitees one name per box, with boxes added and removed', () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Invitee 1'), { target: { value: 'Alex' } });
    fireEvent.keyDown(screen.getByLabelText('Invitee 1'), { key: 'Enter' });
    expect(screen.getByLabelText('Invitee 2')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Invitee 2'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: /Add another person/ }));
    fireEvent.change(screen.getByLabelText('Invitee 3'), { target: { value: 'Jordan' } });

    fireEvent.click(screen.getByRole('button', { name: 'Remove invitee 2' }));
    expect(screen.getByLabelText('Invitee 1')).toHaveValue('Alex');
    expect(screen.getByLabelText('Invitee 2')).toHaveValue('Jordan');
    expect(screen.queryByLabelText('Invitee 3')).not.toBeInTheDocument();
  });

  it('keeps invitee emails private to the organizer and editable later', async () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Book club' } });
    fireEvent.change(screen.getByLabelText('Invitee 1'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Email for invitee 1 (optional)'), { target: { value: 'alex@u' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Check the highlighted email addresses');

    fireEvent.change(screen.getByLabelText('Email for invitee 1 (optional)'), { target: { value: 'alex@u.edu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    await screen.findByRole('heading', { name: 'Book club' });
    const code = window.location.pathname.split('/').pop() ?? '';
    expect((await getEvent(code))?.invitees).toEqual(['Alex']);
    expect(JSON.stringify(await getEvent(code))).not.toContain('alex@u.edu');
    expect(await listContacts(code)).toEqual([{ name: 'Alex', email: 'alex@u.edu' }]);

    fireEvent.click(screen.getByRole('link', { name: 'Edit event' }));
    expect(await screen.findByLabelText('Email for invitee 1 (optional)')).toHaveValue('alex@u.edu');
    fireEvent.click(screen.getByRole('button', { name: 'Remove invitee 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Book club' });
    expect(await listContacts(code)).toEqual([]);
  });

  it('deletes an invitee’s email when the organizer clears it but keeps the invitee', async () => {
    const { code } = await createEvent({ ...details, invitees: ['Alex'] });
    await saveContact(code, { name: 'Alex', email: 'alex@u.edu' });
    renderAt(`/e/${code}/edit`);
    fireEvent.change(await screen.findByLabelText('Email for invitee 1 (optional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Team sync' });
    expect((await getEvent(code))?.invitees).toEqual(['Alex']);
    expect(await listContacts(code)).toEqual([]);
  });

  it('lets the organizer pick a time zone, defaulting to Chicago', async () => {
    renderAt('/create');
    expect(screen.getByLabelText(/Time zone/)).toHaveValue('America/Chicago');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Call with Shanghai' } });
    fireEvent.change(screen.getByLabelText(/Time zone/), { target: { value: 'Asia/Shanghai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await screen.findByRole('heading', { name: 'Call with Shanghai' });
    expect(screen.getAllByText('China Time').length).toBeGreaterThan(0);
    const code = window.location.pathname.split('/').pop() ?? '';
    expect((await getEvent(code))?.timeZone).toBe('Asia/Shanghai');
  });

  it('saves the event and shows the organizer a code and invite link', async () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Book club' } });
    fireEvent.change(screen.getByLabelText(/Location/), { target: { value: 'Library' } });
    // Pasting a list into one box splits it into a box per person; duplicates collapse on save.
    fireEvent.change(screen.getByLabelText('Invitee 1'), { target: { value: 'Alex, Sam, alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await screen.findByRole('heading', { name: 'Book club' });
    const code = window.location.pathname.split('/').pop() ?? '';
    expect(screen.getByRole('heading', { name: 'Invite people' })).toBeInTheDocument();
    expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `${window.location.origin}/e/${code}` }))
      .toHaveAttribute('href', `${window.location.origin}/e/${code}`);
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Responses 0 of 2' })).toBeInTheDocument();
    expect((await getEvent(code))?.invitees).toEqual(['Alex', 'Sam']);
  });
});

describe('joining an event', () => {
  it('finds the event by code, ignoring case and spaces', async () => {
    const { code } = await createEvent(details);
    switchToAnotherDevice();
    renderAt('/join');
    fireEvent.change(screen.getByLabelText('Event code or link'), {
      target: { value: `${code.slice(0, 3).toLowerCase()} ${code.slice(3)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await screen.findByRole('heading', { name: 'Team sync' });
    expect(window.location.pathname).toBe(`/e/${code}`);
    expect(screen.queryByRole('heading', { name: 'Invite people' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Responses/ })).not.toBeInTheDocument();
  });

  it('accepts a pasted invite link', async () => {
    const { code } = await createEvent(details);
    renderAt('/join');
    fireEvent.change(screen.getByLabelText('Event code or link'), {
      target: { value: `https://example.com/e/${code}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('heading', { name: 'Team sync' })).toBeInTheDocument();
  });

  it('explains when a code does not match an event', async () => {
    renderAt('/join');
    fireEvent.change(screen.getByLabelText('Event code or link'), { target: { value: 'ZZZZZZ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No event found for “ZZZZZZ”');
  });

  it('tells the organizer when the event will be deleted, and offers no sign-in without Firebase', async () => {
    const { code } = await createEvent(details);
    renderAt(`/e/${code}`);
    await screen.findByRole('heading', { name: 'Team sync' });
    // Team sync ends Sun Oct 11, so it's kept through Oct 18 and gone on Oct 19.
    expect(screen.getByText('Deleted').nextElementSibling).toHaveTextContent('Oct 19');
    expect(screen.queryByRole('button', { name: /Sign in with Google/ })).not.toBeInTheDocument();

    cleanup();
    switchToAnotherDevice();
    renderAt(`/e/${code}`);
    await screen.findByRole('heading', { name: 'Team sync' });
    expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
  });

  it('catches up on responses when the organizer comes back to the tab', async () => {
    // jsdom reports "prerender"; a real tab the organizer returns to is visible.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { code } = await createEvent(details);
    renderAt(`/e/${code}`);
    await screen.findByRole('heading', { name: 'Team sync' });

    // Saved elsewhere without this page hearing about it, like a stalled live connection.
    await saveResponse(code, 'Priya', ['2026-10-05|540']);
    expect(screen.queryByText('Priya')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.focus(window);
    });
    expect(await screen.findByText('Priya', { selector: '.response-group li' })).toBeInTheDocument();
  });

  it('lets anyone leave an event page for home or a new event', async () => {
    await openAsInvitee();
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'New event' })).toHaveAttribute('href', '/create');
    fireEvent.click(screen.getByRole('link', { name: 'New event' }));
    expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument();
  });

  it('shows a not-found page for an invite link to a missing event', async () => {
    renderAt('/e/ZZZZZZ');
    expect(await screen.findByRole('heading', { name: 'Event not found' })).toBeInTheDocument();
  });

  it('saves submitted availability to the event', async () => {
    const code = await openAsInvitee();
    enterName('Priya');
    toggleSlot(0);
    await submit('Priya');
    expect((await getEvent(code))?.responses).toEqual({ Priya: ['2026-10-05|540'] });
  });
});

describe('participant name and selections', () => {
  it('keeps slots picked before the name is typed', async () => {
    await openAsInvitee();
    toggleSlot(0);
    enterName('Alex');
    expect(screen.getByText('30 min selected')).toBeInTheDocument();
  });

  it('loads a saved response for that name and clears it for a new name', async () => {
    await openAsInvitee();
    enterName('Alex');
    toggleSlot(0);
    await submit('Alex');

    enterName('Sam');
    expect(screen.getByText('No times selected yet')).toBeInTheDocument();

    enterName('alex');
    expect(screen.getByText('30 min selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update availability' })).toBeInTheDocument();
  });

  it('does not swap in a saved response while typing past a matching prefix', async () => {
    await openAsInvitee();
    enterName('Al');
    toggleSlot(0);
    await submit('Al');

    enterName('');
    expect(screen.getByText('No times selected yet')).toBeInTheDocument();
    toggleSlot(1);
    toggleSlot(2);
    typeName('A');
    typeName('Al');
    typeName('Ale');
    enterName('Alex');
    expect(screen.getByText('1 hr selected across 2 days')).toBeInTheDocument();
  });

  it('keeps unsaved picks and warns when the name already has a response', async () => {
    await openAsInvitee();
    enterName('Alex');
    toggleSlot(0);
    await submit('Alex');

    enterName('');
    toggleSlot(1);
    enterName('Alex');
    expect(screen.getByText('30 min selected')).toBeInTheDocument();
    expect(screen.getByText(/Alex already responded/)).toBeInTheDocument();
  });

  it('flags unsaved changes until they are submitted', async () => {
    await openAsInvitee();
    enterName('Alex');
    toggleSlot(0);
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    await submit('Alex');
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
  });
});

describe('availability grid', () => {
  it('shows a short mobile grid and selects by tap while leaving swipes for scrolling', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    const { code } = await createEvent({ ...details, endTime: '21:00' });
    switchToAnotherDevice();
    renderAt(`/e/${code}`);
    await screen.findByRole('heading', { name: 'Team sync' });
    expect(screen.getAllByRole('gridcell')).toHaveLength(8 * 7);
    const first = screen.getAllByRole('gridcell')[0];
    fireEvent.pointerDown(first, { pointerType: 'touch', pointerId: 1, button: 0 });
    expect(screen.getByText('No times selected yet')).toBeInTheDocument();
    fireEvent.click(first, { detail: 1 });
    expect(screen.getByText('30 min selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Later hours' }));
    expect(screen.getAllByRole('gridcell')).toHaveLength(8 * 7);
    expect(screen.getAllByRole('gridcell')[0]).toHaveAccessibleName(/Monday, October 5, 1:00 PM/);
    expect(screen.getByText('30 min selected')).toBeInTheDocument();
  });

  it('shows local time while saving the matching event-zone slot and time-zone preference', async () => {
    const code = await openAsInvitee();
    fireEvent.change(screen.getByLabelText('Show times in'), { target: { value: 'America/New_York' } });
    expect(screen.getAllByRole('gridcell')[0]).toHaveAccessibleName(/Monday, October 5, 10:00 AM/);
    enterName('Alex');
    toggleSlot(0);
    await submit('Alex');
    expect((await getEvent(code))?.responses.Alex).toEqual(['2026-10-05|540']);
    await waitFor(async () => {
      expect(await getOwnContact(code, 'Alex')).toEqual({ name: 'Alex', email: '', timeZone: 'America/New_York' });
    });
  });

  it('leaves empty slots blank and shades slots by how many people are free', async () => {
    await openAsInvitee();
    enterName('Alex');
    toggleSlot(0);
    await submit('Alex');
    enterName('Sam');
    toggleSlot(0);
    toggleSlot(1);

    const cells = screen.getAllByRole('gridcell');
    expect(cells[0]).toHaveTextContent('2/2');
    expect(cells[0]).toHaveAttribute('data-heat', '4');
    expect(cells[1]).toHaveTextContent('1/2');
    expect(cells[1]).toHaveAttribute('data-heat', '2');
    expect(cells[2].textContent).toBe('');
    expect(cells[2]).toHaveAttribute('data-heat', '0');
    expect(cells[0]).toHaveAccessibleName(/2 of 2 available: Alex, you/);
  });

  it('adds a time range to one or several days from menus that only offer the event’s hours', async () => {
    await openAsInvitee();
    fireEvent.click(screen.getByText('Add times without dragging'));
    const panel = within(screen.getByText('Add times without dragging').closest('details') as HTMLElement);
    const from = panel.getByLabelText('From');
    const until = panel.getByLabelText('Until');
    const optionLabels = (select: HTMLElement) => Array.from((select as HTMLSelectElement).options, ({ text }) => text);
    // The event runs 9:00 AM to 12:00 PM, Oct 5 to 11.
    expect(optionLabels(from)[0]).toBe('9:00 AM');
    expect(optionLabels(from).at(-1)).toBe('11:30 AM');
    expect(optionLabels(until).at(-1)).toBe('12:00 PM');
    expect(panel.getAllByRole('button', { pressed: false }).map(({ textContent }) => textContent)).toContain('Sun, Oct 11');

    fireEvent.change(from, { target: { value: '10:00' } });
    expect(optionLabels(until)[0]).toBe('10:30 AM');
    fireEvent.change(until, { target: { value: '11:00' } });
    fireEvent.click(panel.getByRole('button', { name: 'Add times' }));
    expect(screen.getByText('Added 1 hr on Mon, Oct 5. Submit availability to save it.')).toBeInTheDocument();
    expect(screen.getByText('1 hr selected')).toBeInTheDocument();

    // Several days at once.
    fireEvent.click(panel.getByRole('button', { name: 'Tue, Oct 6' }));
    fireEvent.click(panel.getByRole('button', { name: 'Wed, Oct 7' }));
    fireEvent.click(panel.getByRole('button', { name: 'Add times' }));
    expect(screen.getByText('Added 1 hr on each of 3 days. Submit availability to save it.')).toBeInTheDocument();
    expect(screen.getByText('3 hr selected across 3 days')).toBeInTheDocument();

    fireEvent.click(panel.getByRole('button', { name: 'All days' }));
    expect(panel.getByRole('button', { name: 'All days' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps every toggle when several land before a re-render', async () => {
    await openAsInvitee();
    const cells = screen.getAllByRole('gridcell');
    act(() => {
      [0, 1, 7, 8].forEach((index) => cells[index].click());
    });
    expect(screen.getByText('2 hr selected across 2 days')).toBeInTheDocument();
  });

  it('keeps one cell in the tab order and moves it with the arrow keys', async () => {
    await openAsInvitee();
    const cells = screen.getAllByRole('gridcell');
    const columns = 7;
    expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([cells[0]]);

    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: 'ArrowRight' });
    expect(cells[1]).toHaveFocus();
    fireEvent.keyDown(cells[1], { key: 'ArrowDown' });
    expect(cells[1 + columns]).toHaveFocus();
    fireEvent.keyDown(cells[1 + columns], { key: 'Home' });
    expect(cells[columns]).toHaveFocus();
    fireEvent.keyDown(cells[columns], { key: 'ArrowLeft' });
    expect(cells[columns]).toHaveFocus();
    expect(cells[columns].tabIndex).toBe(0);
    expect(cells[0].tabIndex).toBe(-1);
  });
});

// Two people answered; their overlap is Mon Oct 5, 9:00-10:00 AM.
const createAnsweredEvent = async () => {
  const { code } = await createEvent(details);
  await saveResponse(code, 'Alex', ['2026-10-05|540', '2026-10-05|570', '2026-10-06|540']);
  await saveResponse(code, 'Sam', ['2026-10-05|540', '2026-10-05|570']);
  return code;
};

describe('summary and confirming a time', () => {
  it('recommends the best option and lets the organizer confirm it', async () => {
    const code = await createAnsweredEvent();
    renderAt(`/e/${code}`);
    expect(await screen.findByText('Best option')).toBeInTheDocument();
    expect(screen.getByText('1 window works for everyone')).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 free · 1 hr · Longest window everyone can make/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Choose this time' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm meeting' }));

    expect(await screen.findByText('Meeting confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add to my Google Calendar' }))
      .toHaveAttribute('href', expect.stringContaining('calendar.google.com'));
    expect(screen.getByRole('button', { name: 'Download .ics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your availability' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /Availability by day and time/ })).toBeInTheDocument();
    expect(screen.queryByText('No times selected yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit availability' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Best times' })).toBeInTheDocument();
    expect((await getEvent(code))?.confirmedTime).toEqual({ date: '2026-10-05', start: 540, end: 600 });

    toggleSlot(0);
    expect(screen.getByRole('button', { name: 'Submit availability' }).closest('.save-bar')).toHaveClass('is-inline');

    fireEvent.click(screen.getByRole('button', { name: 'Reopen scheduling' }));
    expect(await screen.findByRole('heading', { name: 'Your availability' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit availability' }).closest('.save-bar')).not.toHaveClass('is-inline');
  });

  it('shows invitees the confirmed time without organizer controls', async () => {
    const code = await createAnsweredEvent();
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    switchToAnotherDevice();
    renderAt(`/e/${code}`);
    expect(await screen.findByText('Meeting confirmed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your availability' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit availability' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reopen scheduling' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose this time|Change time/ })).not.toBeInTheDocument();
  });

  it('offers the organizer more dates when nobody overlaps', async () => {
    const { code } = await createEvent(details);
    await saveResponse(code, 'Alex', ['2026-10-05|540']);
    await saveResponse(code, 'Sam', ['2026-10-06|600']);
    renderAt(`/e/${code}`);
    expect(await screen.findByText('No time works for everyone')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add more dates/ })).toHaveAttribute('href', `/e/${code}/edit`);
  });

  it('shares one invite that needs only the link, with the code tucked away for in person', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { code } = await createEvent(details);
    renderAt(`/e/${code}`);
    const panel = within(await screen.findByRole('region', { name: /Invite people/ }));
    expect((panel.getByLabelText('Invite message') as HTMLTextAreaElement).value)
      .toMatch(/You’re invited to “Team sync”! .* no sign-up or code needed\./);
    expect(panel.getByRole('link', { name: `${window.location.origin}/e/${code}` }))
      .toHaveAttribute('href', `${window.location.origin}/e/${code}`);
    expect(panel.queryByText('The link opens the event directly. No sign-up or code needed.')).not.toBeInTheDocument();

    fireEvent.click(panel.getByRole('button', { name: 'Copy invite' }));
    expect(await panel.findByText('Invite copied. Paste it into your group chat.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`no sign-up or code needed\\.\\n${window.location.origin}/e/${code}$`)));

    const customInvite = 'Please join us!';
    fireEvent.change(panel.getByLabelText('Invite message'), { target: { value: customInvite } });
    fireEvent.click(panel.getByRole('button', { name: 'Copy invite' }));
    expect(writeText).toHaveBeenLastCalledWith(`${customInvite}\n${window.location.origin}/e/${code}`);
    expect(panel.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    fireEvent.click(panel.getByRole('button', { name: 'Reset invite' }));
    expect((panel.getByLabelText('Invite message') as HTMLTextAreaElement).value)
      .toContain('You’re invited to “Team sync”!');

    // The code is still there, but folded away as the in-person option.
    const codeDetails = panel.getByText('Joining in person? Click here to share the code').closest('details');
    expect(codeDetails).not.toHaveAttribute('open');
    expect(within(codeDetails as HTMLElement).getByText(code)).toBeInTheDocument();
  });

  it('passes the event URL to the phone share sheet even after the message is edited', async () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    try {
      const { code } = await createEvent(details);
      renderAt(`/e/${code}`);
      const panel = within(await screen.findByRole('region', { name: /Invite people/ }));
      fireEvent.change(panel.getByLabelText('Invite message'), { target: { value: 'Join my meeting' } });
      fireEvent.click(panel.getByRole('button', { name: 'Share invite' }));
      await waitFor(() => expect(share).toHaveBeenCalledWith({
        title: 'Team sync',
        text: 'Join my meeting',
        url: `${window.location.origin}/e/${code}`,
      }));
    } finally {
      if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
      else Reflect.deleteProperty(window, 'matchMedia');
      if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
      else Reflect.deleteProperty(navigator, 'share');
    }
  });

  it('writes a reminder that names who has not answered', async () => {
    const code = await createAnsweredEvent();
    renderAt(`/e/${code}`);
    expect(((await screen.findByLabelText('Invite message')) as HTMLTextAreaElement).value)
      .toMatch(/^Hi Jordan! Please add your availability for “Team sync”/);
  });
});

describe('editing an event', () => {
  it('saves changes and keeps every response', async () => {
    const code = await createAnsweredEvent();
    renderAt(`/e/${code}/edit`);
    fireEvent.change(await screen.findByLabelText('Event title'), { target: { value: 'Team sync v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: 'Team sync v2' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/e/${code}`);
    expect(Object.keys((await getEvent(code))?.responses ?? {})).toEqual(['Alex', 'Sam']);
  });

  it('deletes the event and everything attached, after asking once more', async () => {
    const code = await createAnsweredEvent();
    await saveContact(code, { name: 'Alex', email: 'alex@u.edu' });
    await suggestTime(code, { name: 'Sam', date: '2026-10-20', start: 600, end: 660, note: '' });
    renderAt(`/e/${code}/edit`);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete event' }));
    expect(screen.getByText(/This can’t be undone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep event' }));
    expect(await getEvent(code)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete for good' }));
    await screen.findByRole('heading', { name: 'Find a time that works for everyone' });
    expect(await getEvent(code)).toBeNull();
    expect(Object.keys(window.localStorage).filter((key) => key.indexOf(code) !== -1)).toEqual([]);
  });

  it('is only open to the organizer', async () => {
    const { code } = await createEvent(details);
    switchToAnotherDevice();
    renderAt(`/e/${code}/edit`);
    expect(await screen.findByRole('heading', { name: 'Only the organizer can edit this event' })).toBeInTheDocument();
  });
});

describe('emailing the confirmed time', () => {
  it('drafts the recipient’s chosen zone and uses event time for others', async () => {
    const code = await createAnsweredEvent();
    await saveContact(code, { name: 'Alex', email: 'alex@u.edu', timeZone: 'America/New_York' });
    await saveContact(code, { name: 'Sam', email: 'sam@u.edu' });
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    renderAt(`/e/${code}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Email everyone' }));
    await screen.findByRole('link', { name: 'Open Alex’s email in Gmail' });
    const draft = (name: string) => new URL(screen.getByRole('link', { name: `Open ${name}’s email in Gmail` }).getAttribute('href') ?? '');
    expect(draft('Alex').searchParams.get('body')).toContain('10:00 – 11:00 AM (Eastern Time)');
    expect(draft('Alex').searchParams.get('body')).not.toContain('Central Time');
    expect(draft('Sam').searchParams.get('body')).toContain('9:00 – 10:00 AM (Central Time)');
  });

  it('collects an optional email with the response and rejects a broken one', async () => {
    const code = await openAsInvitee();
    enterName('Priya');
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'priya@school' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit availability' }));
    expect(screen.getByText('Check your email address, or leave it blank.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'priya@u.edu' } });
    await submit('Priya');
    expect(await getOwnContact(code, 'Priya')).toEqual({ name: 'Priya', email: 'priya@u.edu' });
  });

  it('drafts one email per person, each naming only its own recipient', async () => {
    const code = await createAnsweredEvent();
    await saveContact(code, { name: 'Alex', email: 'alex@u.edu' });
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    renderAt(`/e/${code}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Email everyone' }));
    expect(await screen.findByLabelText(/Alex alex@u.edu/)).toBeChecked();
    expect(screen.getByLabelText('Subject'))
      .toHaveValue('Meeting time confirmed: Team sync on Mon, Oct 5, 9:00 – 10:00 AM (Central Time)');
    expect((screen.getByLabelText(/^Message/) as HTMLTextAreaElement).value).toContain('Address: Mudd 3514\n\n');

    fireEvent.change(screen.getByLabelText('Name for person 1'), { target: { value: 'Jordan' } });
    fireEvent.change(screen.getByLabelText('Email for person 1'), { target: { value: 'jordan@u' } });
    expect(screen.getByText('Check this email address.')).toBeInTheDocument();
    expect(screen.getByText('1 email, one per person')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email for person 1'), { target: { value: 'jordan@u.edu' } });
    expect(screen.getByText('2 emails, one per person')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add another person/ }));
    fireEvent.change(screen.getByLabelText('Email for person 2'), { target: { value: 'kai@u.edu' } });
    expect(screen.getByText('3 emails, one per person')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove person 2' }));
    expect(screen.getByText('2 emails, one per person')).toBeInTheDocument();

    const alexDraft = new URL(screen.getByRole('link', { name: 'Open Alex’s email in Gmail' }).getAttribute('href') ?? '');
    expect(alexDraft.searchParams.get('to')).toBe('alex@u.edu');
    expect(alexDraft.searchParams.get('body')).toMatch(/^Hi Alex,/);
    expect(alexDraft.searchParams.get('body')).not.toContain('Jordan');

    const jordanDraft = new URL(screen.getByRole('link', { name: 'Open Jordan’s email in Gmail' }).getAttribute('href') ?? '');
    expect(jordanDraft.searchParams.get('to')).toBe('jordan@u.edu');
    expect(jordanDraft.searchParams.get('body')).toMatch(/^Hi Jordan,/);

    fireEvent.click(screen.getByRole('radio', { name: 'Outlook' }));
    expect(screen.getByRole('link', { name: 'Open Alex’s email in Outlook' }))
      .toHaveAttribute('href', expect.stringContaining('https://outlook.office.com/mail/deeplink/compose?to=alex%40u.edu'));
  });

  it('copies one person’s finished email to paste anywhere', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const code = await createAnsweredEvent();
    await saveContact(code, { name: 'Alex', email: 'alex@u.edu' });
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    renderAt(`/e/${code}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Email everyone' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Copy Alex’s email' }));
    expect(await screen.findByText(/Email copied/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^To: alex@u\.edu\nSubject: Meeting time confirmed: Team sync[^\n]*\n\nHi Alex,/));
    expect(screen.getByRole('button', { name: 'Copy Alex’s email' })).toHaveTextContent('Copied');
  });

  it('shows new emails live and lets the organizer fill in missing ones', async () => {
    const code = await createAnsweredEvent();
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    renderAt(`/e/${code}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Email everyone' }));

    // Alex and Sam responded and Jordan was invited, all without emails.
    expect(await screen.findByLabelText('Email for Alex')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add an email above before sending/ }));
    expect(screen.getByLabelText('Email for Alex')).toHaveFocus();
    expect(screen.getByLabelText('Email for Jordan')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email for Jordan'), { target: { value: 'jordan@u.edu' } });
    expect(screen.queryByRole('button', { name: /Add an email above before sending/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Jordan’s email in Gmail' })).toBeInTheDocument();

    // Sam leaves an email while the panel is open: it arrives without reopening.
    await act(async () => {
      await saveContact(code, { name: 'Sam', email: 'sam@u.edu' });
    });
    expect(screen.getByLabelText(/Sam sam@u.edu/)).toBeChecked();
    expect(screen.queryByLabelText('Email for Sam')).not.toBeInTheDocument();
    expect(screen.getByText('2 emails, one per person')).toBeInTheDocument();
  });

  it('points to the extra email field when no one is on the roster', async () => {
    const { code } = await createEvent({ ...details, invitees: [] });
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    renderAt(`/e/${code}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Email everyone' }));

    fireEvent.click(await screen.findByRole('button', { name: /Add an email above before sending/ }));
    expect(screen.getByLabelText('Email for person 1')).toHaveFocus();
  });

  it('keeps the organizer’s edits until they reset to the template', async () => {
    const code = await createAnsweredEvent();
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    renderAt(`/e/${code}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Email everyone' }));

    fireEvent.change(screen.getByLabelText(/Sign off as/), { target: { value: 'Nate' } });
    expect((screen.getByLabelText(/^Message/) as HTMLTextAreaElement).value).toMatch(/Best,\nNate$/);

    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: 'Custom note' } });
    fireEvent.change(screen.getByLabelText(/Sign off as/), { target: { value: 'Nate X' } });
    expect(screen.getByLabelText(/^Message/)).toHaveValue('Custom note');

    fireEvent.click(screen.getByRole('button', { name: 'Reset to template' }));
    expect((screen.getByLabelText(/^Message/) as HTMLTextAreaElement).value).toMatch(/Best,\nNate X$/);
  });

  it('is not offered to invitees', async () => {
    const code = await createAnsweredEvent();
    await setConfirmedTime(code, { date: '2026-10-05', start: 540, end: 600 });
    switchToAnotherDevice();
    renderAt(`/e/${code}`);
    expect(await screen.findByText('Meeting confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email everyone' })).not.toBeInTheDocument();
  });
});

describe('privacy and terms', () => {
  it('asks for consent once, linking to both documents, and remembers the answer', () => {
    const { unmount } = renderAt('/');
    const banner = screen.getByRole('region', { name: 'Cookies and privacy' });
    expect(banner).toHaveTextContent('doesn’t use advertising or tracking cookies');
    expect(within(banner).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(within(banner).getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms');

    fireEvent.click(within(banner).getByRole('button', { name: 'Accept' }));
    expect(screen.queryByRole('region', { name: 'Cookies and privacy' })).not.toBeInTheDocument();
    unmount();
    renderAt('/');
    expect(screen.queryByRole('region', { name: 'Cookies and privacy' })).not.toBeInTheDocument();
  });

  it('serves the Privacy Policy and Terms of Use, linked from every page', () => {
    renderAt('/create');
    const footer = screen.getByRole('navigation', { name: 'Legal' });
    fireEvent.click(within(footer).getByRole('link', { name: 'Privacy Policy' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/never sell or share your personal information/)).toBeInTheDocument();

    fireEvent.click(within(footer).getByRole('link', { name: 'Terms of Use' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeInTheDocument();
    expect(screen.getByText(/provided “as is” and “as available”/)).toBeInTheDocument();
  });
});

describe('first-time guide', () => {
  const guideTitle = () => screen.queryByRole('heading', { level: 3, name: /Enter your name|Pick the times|Submit your availability/ });

  it('walks a newcomer through name, times and submit, then stays out of the way', async () => {
    await openAsInvitee();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(guideTitle()).toHaveTextContent('Enter your name');
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Your name');

    // Committing a name moves the guide on by itself.
    enterName('Priya');
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    toggleSlot(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Submit');

    // Submitting finishes it, and every step shows as done.
    await submit('Priya');
    expect(guideTitle()).not.toBeInTheDocument();
    expect(screen.getAllByText(/\(done\)/)).toHaveLength(3);
  });

  it('can be skipped, stays skipped, and can be replayed', async () => {
    const code = await openAsInvitee();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(guideTitle()).not.toBeInTheDocument();

    cleanup();
    renderAt(`/e/${code}`);
    await screen.findByRole('heading', { name: 'Team sync' });
    expect(guideTitle()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });
});

describe('suggesting another time', () => {
  it('lets a participant suggest a time, which the organizer can add to the event', async () => {
    const code = await openAsInvitee();
    const suggestPanel = () => within(screen.getByText('Suggest another time').closest('details') as HTMLElement);
    fireEvent.click(screen.getByText('Suggest another time'));

    fireEvent.click(suggestPanel().getByRole('button', { name: 'Send to organizer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name at the top first');

    enterName('Priya');
    fireEvent.change(suggestPanel().getByLabelText('Date'), { target: { value: '2026-10-14' } });
    expect(suggestPanel().getByText('Oct 14, 2026')).toBeInTheDocument();
    fireEvent.change(suggestPanel().getByLabelText('From'), { target: { value: '15:00' } });
    fireEvent.change(suggestPanel().getByLabelText('Until'), { target: { value: '17:00' } });
    fireEvent.change(suggestPanel().getByLabelText(/Note for the organizer/), { target: { value: 'Class all week' } });
    fireEvent.click(suggestPanel().getByRole('button', { name: 'Send to organizer' }));
    expect(await screen.findByText(/Sent\. The organizer will see your suggestion/)).toBeInTheDocument();

    // Back on the organizer's device.
    cleanup();
    window.localStorage.setItem('goodtime:device-id', (await getEvent(code))?.ownerId ?? '');
    renderAt(`/e/${code}`);
    expect(await screen.findByRole('link', { name: /Priya suggested a new time/ })).toHaveAttribute('href', '#suggestions');
    const panel = within(screen.getByRole('region', { name: /Suggestions/ }));
    expect(panel.getByText('Wed, Oct 14 · 3:00 – 5:00 PM')).toBeInTheDocument();
    expect(panel.getByText('“Class all week”')).toBeInTheDocument();

    fireEvent.click(panel.getByRole('button', { name: 'Add to event' }));
    await screen.findByText(/None yet/);
    const updated = await getEvent(code);
    expect([updated?.startDate, updated?.endDate, updated?.startTime, updated?.endTime])
      .toEqual(['2026-10-05', '2026-10-14', '09:00', '17:00']);
  });

  it('is not offered to the organizer, and dismissing clears a suggestion', async () => {
    const { code } = await createEvent(details);
    await suggestTime(code, { name: 'Sam', date: '2026-10-06', start: 600, end: 660, note: '' });
    renderAt(`/e/${code}`);
    expect(await screen.findByText('Already within the event’s dates and hours.')).toBeInTheDocument();
    expect(screen.queryByText('Suggest another time')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(await screen.findByText(/None yet/)).toBeInTheDocument();
  });

  it('flags events with suggestions on the home page', async () => {
    const { code } = await createEvent(details);
    await suggestTime(code, { name: 'Sam', date: '2026-10-20', start: 600, end: 660, note: '' });
    renderAt('/');
    expect(await screen.findByText('1 suggestion')).toBeInTheDocument();
  });
});

describe('events you joined', () => {
  it('lists events opened as a participant, with progress, and can forget one', async () => {
    const code = await openAsInvitee();
    cleanup();
    renderAt('/');
    const section = () => within(screen.getByRole('region', { name: 'Events you joined' }));
    expect(await screen.findByRole('region', { name: 'Events you joined' })).toBeInTheDocument();
    expect(section().getByRole('link', { name: new RegExp(`Team sync.*${code}`) })).toHaveTextContent('Not responded yet');

    cleanup();
    renderAt(`/e/${code}`);
    await screen.findByRole('heading', { name: 'Team sync' });
    enterName('Priya');
    toggleSlot(0);
    await submit('Priya');

    cleanup();
    renderAt('/');
    expect(await screen.findByText('Responded as Priya')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Events you created' })).not.toBeInTheDocument();

    fireEvent.click(section().getByRole('button', { name: 'Remove Team sync from this list' }));
    expect(screen.queryByRole('region', { name: 'Events you joined' })).not.toBeInTheDocument();
  });
});

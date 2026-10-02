import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { createEvent, getEvent } from './services/events';
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
};

const renderAt = (path: string) => {
  window.history.pushState(null, '', path);
  return render(<App />);
};

// Opens an event page the way an invitee would: via the link, on a device that didn't create it.
const openAsInvitee = async () => {
  const { code } = await createEvent(details);
  window.localStorage.removeItem('goodtime:owned-events');
  renderAt(`/e/${code}`);
  await screen.findByRole('heading', { name: 'Team sync' });
  return code;
};

const nameField = () => screen.getByLabelText('YOUR NAME');
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
});

describe('choosing a role', () => {
  it('offers creating or joining an event', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: /Create an event/ }));
    expect(screen.getByRole('heading', { name: 'Set the scene' })).toBeInTheDocument();
  });

  it('lets the organizer return to events they created', async () => {
    const { code } = await createEvent(details);
    renderAt('/');
    expect(await screen.findByRole('link', { name: new RegExp(`Team sync.*${code}`) })).toHaveAttribute('href', `/e/${code}`);
  });
});

describe('creating an event', () => {
  it('requires a title', () => {
    renderAt('/create');
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give your event a title.');
  });

  it('saves the event and shows the organizer a code and invite link', async () => {
    renderAt('/create');
    fireEvent.change(screen.getByLabelText('EVENT TITLE'), { target: { value: 'Book club' } });
    fireEvent.change(screen.getByLabelText(/LOCATION/), { target: { value: 'Library' } });
    fireEvent.change(screen.getByLabelText(/WHO.S INVITED/), { target: { value: 'Alex, Sam, alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await screen.findByRole('heading', { name: 'Book club' });
    const code = window.location.pathname.split('/').pop() ?? '';
    expect(screen.getByText(/ORGANIZING/)).toBeInTheDocument();
    expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/e/${code}`)).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Responses: 0 / 2' })).toBeInTheDocument();
    expect((await getEvent(code))?.invitees).toEqual(['Alex', 'Sam']);
  });
});

describe('joining an event', () => {
  it('finds the event by code, ignoring case and spaces', async () => {
    const { code } = await createEvent(details);
    window.localStorage.removeItem('goodtime:owned-events');
    renderAt('/join');
    fireEvent.change(screen.getByLabelText('EVENT CODE OR LINK'), {
      target: { value: `${code.slice(0, 3).toLowerCase()} ${code.slice(3)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await screen.findByRole('heading', { name: 'Team sync' });
    expect(window.location.pathname).toBe(`/e/${code}`);
    expect(screen.getByText(/INVITED/)).toBeInTheDocument();
    expect(screen.queryByText('INVITE YOUR GROUP')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Responses:/ })).not.toBeInTheDocument();
  });

  it('accepts a pasted invite link', async () => {
    const { code } = await createEvent(details);
    renderAt('/join');
    fireEvent.change(screen.getByLabelText('EVENT CODE OR LINK'), {
      target: { value: `https://example.com/e/${code}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('heading', { name: 'Team sync' })).toBeInTheDocument();
  });

  it('explains when a code does not match an event', async () => {
    renderAt('/join');
    fireEvent.change(screen.getByLabelText('EVENT CODE OR LINK'), { target: { value: 'ZZZZZZ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No event found for "ZZZZZZ"');
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
    expect(screen.getByText('1 time selected')).toBeInTheDocument();
  });

  it('loads a saved response for that name and clears it for a new name', async () => {
    await openAsInvitee();
    enterName('Alex');
    toggleSlot(0);
    await submit('Alex');

    enterName('Sam');
    expect(screen.getByText('0 times selected')).toBeInTheDocument();

    enterName('alex');
    expect(screen.getByText('1 time selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update availability' })).toBeInTheDocument();
  });

  it('does not swap in a saved response while typing past a matching prefix', async () => {
    await openAsInvitee();
    enterName('Al');
    toggleSlot(0);
    await submit('Al');

    enterName('');
    expect(screen.getByText('0 times selected')).toBeInTheDocument();
    toggleSlot(1);
    toggleSlot(2);
    typeName('A');
    typeName('Al');
    typeName('Ale');
    enterName('Alex');
    expect(screen.getByText('2 times selected')).toBeInTheDocument();
  });

  it('keeps unsaved picks and warns when the name already has a response', async () => {
    await openAsInvitee();
    enterName('Alex');
    toggleSlot(0);
    await submit('Alex');

    enterName('');
    toggleSlot(1);
    enterName('Alex');
    expect(screen.getByText('1 time selected')).toBeInTheDocument();
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

  it('keeps every toggle when several land before a re-render', async () => {
    await openAsInvitee();
    const cells = screen.getAllByRole('gridcell');
    act(() => {
      [0, 1, 7, 8].forEach((index) => cells[index].click());
    });
    expect(screen.getByText('4 times selected')).toBeInTheDocument();
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

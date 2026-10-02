import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

const nameField = () => screen.getByLabelText('YOUR NAME');

const typeName = (name: string) => fireEvent.change(nameField(), { target: { value: name } });

// Typing then leaving the field, which is when a saved response gets loaded.
const enterName = (name: string) => {
  typeName(name);
  fireEvent.blur(nameField());
};

// fireEvent.click has detail 0, the same path a keyboard Enter/Space takes.
const toggleSlot = (index: number) => fireEvent.click(screen.getAllByRole('gridcell')[index]);

const submit = () => fireEvent.click(screen.getByRole('button', { name: /availability$/ }));

describe('participant name and selections', () => {
  it('keeps slots picked before the name is typed', () => {
    render(<App />);
    toggleSlot(0);
    enterName('Alex');
    expect(screen.getByText('1 time selected')).toBeInTheDocument();
  });

  it('loads a saved response for that name and clears it for a new name', () => {
    render(<App />);
    enterName('Alex');
    toggleSlot(0);
    submit();

    enterName('Sam');
    expect(screen.getByText('0 times selected')).toBeInTheDocument();

    enterName('alex');
    expect(screen.getByText('1 time selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update availability' })).toBeInTheDocument();
  });

  it('does not swap in a saved response while typing past a matching prefix', () => {
    render(<App />);
    enterName('Al');
    toggleSlot(0);
    submit();

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

  it('keeps unsaved picks and warns when the name already has a response', () => {
    render(<App />);
    enterName('Alex');
    toggleSlot(0);
    submit();

    enterName('');
    toggleSlot(1);
    enterName('Alex');
    expect(screen.getByText('1 time selected')).toBeInTheDocument();
    expect(screen.getByText(/Alex already responded/)).toBeInTheDocument();
  });

  it('flags unsaved changes until they are submitted', () => {
    render(<App />);
    enterName('Alex');
    toggleSlot(0);
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    submit();
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
  });

  it('counts your own unsubmitted pick in the slot total', () => {
    render(<App />);
    enterName('Alex');
    toggleSlot(0);
    expect(screen.getAllByRole('gridcell')[0]).toHaveTextContent('1/1');
  });
});

describe('availability grid', () => {
  it('leaves empty slots blank and shades slots by how many people are free', () => {
    render(<App />);
    enterName('Alex');
    toggleSlot(0);
    submit();
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

  it('keeps one cell in the tab order and moves it with the arrow keys', () => {
    render(<App />);
    const cells = screen.getAllByRole('gridcell');
    const columns = Number(cells[0].closest('[data-days]')?.getAttribute('data-days'));
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
